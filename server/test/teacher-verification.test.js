import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createTestDatabase } from './support/database.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import adminRoutes from '../routes/admin.js'
import appointmentRoutes from '../routes/appointments.js'
import teacherRoutes from '../routes/teachers.js'

function bearer(token) {
  return { authorization: `Bearer ${token}` }
}

async function addUser(database, role, displayName) {
  const id = randomUUID()
  await database
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status
      ) VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .run(id, `${role}-${id}@example.test`, 'x'.repeat(64), role, displayName)
  const session = await createSession(database, id, { ttlSeconds: 3600 })
  return { id, headers: bearer(session.token) }
}

async function createTestApp(t) {
  const database = await createTestDatabase()
  const app = Fastify({ logger: false })
  app.decorate('db', database)

  await app.register(cookie)
  await authPlugin(app, {
    db: database,
    allowBearer: true,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(teacherRoutes)
  await app.register(appointmentRoutes)
  await app.register(adminRoutes)
  await app.ready()

  t.after(async () => {
    await app.close()
    await database.close()
  })

  return { app, database }
}

function futureIso(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

test('administrator approval and revocation gate public discovery and booking', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = await addUser(database, 'student', '学习者')
  const teacher = await addUser(database, 'teacher', '待认证教师')
  const administrator = await addUser(database, 'administrator', '认证审核员')
  await database
    .prepare(
      `INSERT INTO teacher_profiles (
        user_id, school, title, certificates_json, verified_at
      ) VALUES (?, ?, ?, ?, NULL)`
    )
    .run(
      teacher.id,
      '国际中文学院',
      '国际中文讲师',
      JSON.stringify(['国际中文教师证书'])
    )
  const courseId = randomUUID()
  await database
    .prepare(
      `INSERT INTO courses (
        id, teacher_id, title, status, published_at
      ) VALUES (?, ?, ?, 'published', ?)`
    )
    .run(courseId, teacher.id, '认证门禁测试课', new Date().toISOString())

  const publicBeforeApproval = await app.inject({
    method: 'GET',
    url: '/api/v1/teachers'
  })
  assert.equal(publicBeforeApproval.statusCode, 200)
  assert.deepEqual(publicBeforeApproval.json().data.items, [])

  const attemptedPendingDiscovery = await app.inject({
    method: 'GET',
    url: '/api/v1/teachers?verified=false'
  })
  assert.equal(attemptedPendingDiscovery.statusCode, 200)
  assert.deepEqual(attemptedPendingDiscovery.json().data.items, [])

  const publicDetailBeforeApproval = await app.inject({
    method: 'GET',
    url: `/api/v1/teachers/${teacher.id}`
  })
  assert.equal(publicDetailBeforeApproval.statusCode, 404)

  const bookingBeforeApproval = await app.inject({
    method: 'POST',
    url: '/api/v1/appointments',
    headers: student.headers,
    payload: {
      teacherId: teacher.id,
      courseId,
      topic: '认证前预约',
      scheduledStart: futureIso(120),
      durationMinutes: 45
    }
  })
  assert.equal(bookingBeforeApproval.statusCode, 409)
  assert.equal(bookingBeforeApproval.json().data.verificationStatus, 'pending')

  const unauthorizedQueue = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/teacher-verifications',
    headers: student.headers
  })
  assert.equal(unauthorizedQueue.statusCode, 403)

  const pendingQueue = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/teacher-verifications',
    headers: administrator.headers
  })
  assert.equal(pendingQueue.statusCode, 200)
  assert.equal(pendingQueue.json().data.items[0].id, teacher.id)
  assert.equal(pendingQueue.json().data.items[0].verificationStatus, 'pending')

  const unauthorizedApproval = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/teacher-verifications/${teacher.id}`,
    headers: teacher.headers,
    payload: { action: 'approve' }
  })
  assert.equal(unauthorizedApproval.statusCode, 403)

  const approved = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/teacher-verifications/${teacher.id}`,
    headers: administrator.headers,
    payload: { action: 'approve', note: '资料齐全，人工审核通过。' }
  })
  assert.equal(approved.statusCode, 200)
  assert.equal(approved.json().data.verificationStatus, 'verified')
  assert.ok(approved.json().data.verifiedAt)

  const approvalAudit = await database
    .prepare(
      `SELECT actor_id, details_json, created_at
       FROM audit_logs
       WHERE action = 'teacher.verification.approved' AND entity_id = ?`
    )
    .get(teacher.id)
  assert.equal(approvalAudit.actor_id, administrator.id)
  assert.equal(JSON.parse(approvalAudit.details_json).nextStatus, 'verified')
  assert.ok(approvalAudit.created_at)
  assert.equal(
    (
      await database
        .prepare(
          `SELECT COUNT(*) AS count FROM notifications
         WHERE user_id = ? AND type = 'teacher.verification.approved'`
        )
        .get(teacher.id)
    ).count,
    1
  )

  const duplicateApproval = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/teacher-verifications/${teacher.id}`,
    headers: administrator.headers,
    payload: { action: 'approve' }
  })
  assert.equal(duplicateApproval.statusCode, 409)
  assert.equal(duplicateApproval.json().data.currentStatus, 'verified')

  const publicAfterApproval = await app.inject({
    method: 'GET',
    url: '/api/v1/teachers'
  })
  assert.equal(publicAfterApproval.json().data.items[0].id, teacher.id)
  const publicDetailAfterApproval = await app.inject({
    method: 'GET',
    url: `/api/v1/teachers/${teacher.id}`
  })
  assert.equal(publicDetailAfterApproval.statusCode, 200)

  const bookingAfterApproval = await app.inject({
    method: 'POST',
    url: '/api/v1/appointments',
    headers: student.headers,
    payload: {
      teacherId: teacher.id,
      courseId,
      topic: '认证后预约',
      scheduledStart: futureIso(240),
      durationMinutes: 45
    }
  })
  assert.equal(bookingAfterApproval.statusCode, 201)

  const revokeWithoutReason = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/teacher-verifications/${teacher.id}`,
    headers: administrator.headers,
    payload: { action: 'revoke' }
  })
  assert.equal(revokeWithoutReason.statusCode, 400)

  const revoked = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/teacher-verifications/${teacher.id}`,
    headers: administrator.headers,
    payload: { action: 'revoke', note: '证书信息需要重新核验。' }
  })
  assert.equal(revoked.statusCode, 200)
  assert.equal(revoked.json().data.verificationStatus, 'pending')
  assert.equal(revoked.json().data.verifiedAt, null)

  const publicAfterRevocation = await app.inject({
    method: 'GET',
    url: `/api/v1/teachers/${teacher.id}`
  })
  assert.equal(publicAfterRevocation.statusCode, 404)

  const revokedAudit = await database
    .prepare(
      `SELECT actor_id, details_json, created_at
       FROM audit_logs
       WHERE action = 'teacher.verification.revoked' AND entity_id = ?`
    )
    .get(teacher.id)
  assert.equal(revokedAudit.actor_id, administrator.id)
  assert.equal(JSON.parse(revokedAudit.details_json).nextStatus, 'pending')
  assert.ok(revokedAudit.created_at)
  assert.equal(
    (
      await database
        .prepare(
          `SELECT COUNT(*) AS count FROM notifications
         WHERE user_id = ? AND type = 'teacher.verification.revoked'`
        )
        .get(teacher.id)
    ).count,
    1
  )
})
