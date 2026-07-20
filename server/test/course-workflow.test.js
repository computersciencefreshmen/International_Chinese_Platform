import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import adminRoutes from '../routes/admin.js'
import courseRoutes from '../routes/courses.js'

function authorization(token) {
  return { authorization: `Bearer ${token}` }
}

async function createCourseTestApp(t) {
  const db = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  app.decorate('db', db)

  await app.register(cookie)
  await authPlugin(app, {
    db,
    allowBearer: true,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(courseRoutes)
  await app.register(adminRoutes)

  const passwordHash = await hashPassword('CourseTest123!')
  const now = new Date().toISOString()
  const insertUser = db.prepare(
    `INSERT INTO users (
      id, email, password_hash, role, display_name, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  )

  const accounts = {}
  for (const [key, role, displayName] of [
    ['student', 'student', '测试学生'],
    ['teacher', 'teacher', '王老师'],
    ['otherTeacher', 'teacher', '李老师'],
    ['administrator', 'administrator', '审核员']
  ]) {
    const id = randomUUID()
    insertUser.run(
      id,
      `${key.toLowerCase()}@course.test`,
      passwordHash,
      role,
      displayName,
      now,
      now
    )
    const session = createSession(db, id, { ttlSeconds: 3600 })
    accounts[key] = {
      id,
      role,
      headers: authorization(session.token)
    }
  }

  const insertTeacherProfile = db.prepare(
    `INSERT INTO teacher_profiles (user_id, verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?)`
  )
  insertTeacherProfile.run(accounts.teacher.id, now, now, now)
  insertTeacherProfile.run(accounts.otherTeacher.id, now, now, now)

  await app.ready()
  t.after(async () => {
    await app.close()
    db.close()
  })

  return { app, db, accounts, now }
}

test('course workflow enforces ownership and closes the reject-revise-approve loop', async (t) => {
  const { app, db, accounts, now } = await createCourseTestApp(t)

  const createdResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/courses',
    headers: accounts.teacher.headers,
    payload: {
      title: '商务中文沟通实训',
      summary: '用真实职场任务练习口语与书面沟通。',
      description: '包含会议、邮件和商务洽谈三个单元。',
      level: 'intermediate',
      category: '商务中文',
      durationMinutes: 90,
      priceCents: 12900,
      capacity: 24
    }
  })

  assert.equal(createdResponse.statusCode, 201)
  assert.equal(createdResponse.json().code, 0)
  assert.equal(createdResponse.json().data.status, 'draft')
  assert.equal(createdResponse.json().data.teacherId, accounts.teacher.id)
  const courseId = createdResponse.json().data.id

  const invalidId = await app.inject({
    method: 'GET',
    url: '/api/v1/courses/not-a-uuid'
  })
  assert.equal(invalidId.statusCode, 400)

  const anonymousBeforePublish = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${courseId}`
  })
  assert.equal(anonymousBeforePublish.statusCode, 404)

  const studentCatalogBeforePublish = await app.inject({
    method: 'GET',
    url: '/api/v1/courses?status=draft',
    headers: accounts.student.headers
  })
  assert.equal(studentCatalogBeforePublish.statusCode, 200)
  assert.equal(studentCatalogBeforePublish.json().data.items.length, 0)

  const ownerDrafts = await app.inject({
    method: 'GET',
    url: '/api/v1/courses?status=draft',
    headers: accounts.teacher.headers
  })
  assert.equal(ownerDrafts.statusCode, 200)
  assert.deepEqual(
    ownerDrafts.json().data.items.map((course) => course.id),
    [courseId]
  )

  const otherTeacherDrafts = await app.inject({
    method: 'GET',
    url: '/api/v1/courses?status=draft',
    headers: accounts.otherTeacher.headers
  })
  assert.equal(otherTeacherDrafts.statusCode, 200)
  assert.equal(otherTeacherDrafts.json().data.items.length, 0)

  const studentCreate = await app.inject({
    method: 'POST',
    url: '/api/v1/courses',
    headers: accounts.student.headers,
    payload: { title: '越权课程' }
  })
  assert.equal(studentCreate.statusCode, 403)

  const otherTeacherRead = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${courseId}`,
    headers: accounts.otherTeacher.headers
  })
  assert.equal(otherTeacherRead.statusCode, 403)

  const otherTeacherUpdate = await app.inject({
    method: 'PATCH',
    url: `/api/v1/courses/${courseId}`,
    headers: accounts.otherTeacher.headers,
    payload: { title: '恶意篡改' }
  })
  assert.equal(otherTeacherUpdate.statusCode, 403)

  const otherTeacherSubmit = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${courseId}/submit`,
    headers: accounts.otherTeacher.headers
  })
  assert.equal(otherTeacherSubmit.statusCode, 403)

  db.prepare(
    'UPDATE teacher_profiles SET verified_at = NULL WHERE user_id = ?'
  ).run(accounts.teacher.id)
  const unverifiedSubmission = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${courseId}/submit`,
    headers: accounts.teacher.headers
  })
  assert.equal(unverifiedSubmission.statusCode, 409)
  db.prepare(
    'UPDATE teacher_profiles SET verified_at = ? WHERE user_id = ?'
  ).run(now, accounts.teacher.id)

  const firstSubmission = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${courseId}/submit`,
    headers: accounts.teacher.headers
  })
  assert.equal(firstSubmission.statusCode, 200)
  assert.equal(firstSubmission.json().data.status, 'pending')

  const updateWhilePending = await app.inject({
    method: 'PATCH',
    url: `/api/v1/courses/${courseId}`,
    headers: accounts.teacher.headers,
    payload: { summary: '待审核时不允许修改' }
  })
  assert.equal(updateWhilePending.statusCode, 409)

  const teacherReviewAttempt = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.teacher.headers,
    payload: { action: 'approve' }
  })
  assert.equal(teacherReviewAttempt.statusCode, 403)

  const reviewQueue = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/course-reviews?status=pending',
    headers: accounts.administrator.headers
  })
  assert.equal(reviewQueue.statusCode, 200)
  assert.equal(reviewQueue.json().data.pagination.total, 1)
  assert.equal(reviewQueue.json().data.items[0].course.id, courseId)

  const rejectionWithoutNote = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.administrator.headers,
    payload: { action: 'reject' }
  })
  assert.equal(rejectionWithoutNote.statusCode, 400)

  const rejectedResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.administrator.headers,
    payload: {
      action: 'reject',
      note: '请补充课程学习目标和作业评价标准。'
    }
  })
  assert.equal(rejectedResponse.statusCode, 200)
  assert.equal(rejectedResponse.json().data.course.status, 'rejected')
  assert.equal(rejectedResponse.json().data.review.decision, 'rejected')
  assert.match(
    rejectedResponse.json().data.course.rejectionReason,
    /作业评价标准/
  )
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND type = 'course.rejected'"
      )
      .get(accounts.teacher.id).count,
    1
  )
  assert.equal(
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM audit_logs WHERE entity_id = ? AND action = 'course.rejected'"
      )
      .get(courseId).count,
    1
  )

  const revisedResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/courses/${courseId}`,
    headers: accounts.teacher.headers,
    payload: {
      summary: '已补充明确的学习目标、单元作业和评价量表。'
    }
  })
  assert.equal(revisedResponse.statusCode, 200)
  assert.equal(revisedResponse.json().data.status, 'rejected')
  assert.match(revisedResponse.json().data.summary, /评价量表/)

  const secondSubmission = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${courseId}/submit`,
    headers: accounts.teacher.headers
  })
  assert.equal(secondSubmission.statusCode, 200)
  assert.equal(secondSubmission.json().data.status, 'pending')
  assert.equal(secondSubmission.json().data.rejectionReason, null)

  db.prepare(
    'UPDATE teacher_profiles SET verified_at = NULL WHERE user_id = ?'
  ).run(accounts.teacher.id)
  const approvalWhileUnverified = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.administrator.headers,
    payload: { action: 'approve', note: '不应通过' }
  })
  assert.equal(approvalWhileUnverified.statusCode, 409)
  db.prepare(
    'UPDATE teacher_profiles SET verified_at = ? WHERE user_id = ?'
  ).run(now, accounts.teacher.id)

  const approvedResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.administrator.headers,
    payload: {
      action: 'approve',
      note: '修订内容完整，同意发布。'
    }
  })
  assert.equal(approvedResponse.statusCode, 200)
  assert.equal(approvedResponse.json().data.course.status, 'published')
  assert.ok(approvedResponse.json().data.course.publishedAt)
  assert.equal(approvedResponse.json().data.review.decision, 'approved')

  const duplicateReview = await app.inject({
    method: 'POST',
    url: `/api/v1/admin/course-reviews/${courseId}`,
    headers: accounts.administrator.headers,
    payload: { action: 'approve' }
  })
  assert.equal(duplicateReview.statusCode, 409)

  const studentCatalogAfterPublish = await app.inject({
    method: 'GET',
    url: '/api/v1/courses?search=%E5%95%86%E5%8A%A1',
    headers: accounts.student.headers
  })
  assert.equal(studentCatalogAfterPublish.statusCode, 200)
  assert.deepEqual(
    studentCatalogAfterPublish.json().data.items.map((course) => course.id),
    [courseId]
  )

  const publicDetail = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${courseId}`
  })
  assert.equal(publicDetail.statusCode, 200)
  assert.equal(publicDetail.json().data.id, courseId)
  assert.equal(publicDetail.json().data.status, 'published')

  db.prepare(
    'UPDATE teacher_profiles SET verified_at = NULL WHERE user_id = ?'
  ).run(accounts.teacher.id)
  const hiddenCatalog = await app.inject({
    method: 'GET',
    url: '/api/v1/courses',
    headers: accounts.student.headers
  })
  assert.deepEqual(hiddenCatalog.json().data.items, [])
  const hiddenPublicDetail = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${courseId}`
  })
  assert.equal(hiddenPublicDetail.statusCode, 404)
  const ownerStillReadsCourse = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${courseId}`,
    headers: accounts.teacher.headers
  })
  assert.equal(ownerStillReadsCourse.statusCode, 200)
  db.prepare(
    'UPDATE teacher_profiles SET verified_at = ? WHERE user_id = ?'
  ).run(now, accounts.teacher.id)

  const studentMetrics = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/metrics',
    headers: accounts.student.headers
  })
  assert.equal(studentMetrics.statusCode, 403)

  const metrics = await app.inject({
    method: 'GET',
    url: '/api/v1/admin/metrics',
    headers: accounts.administrator.headers
  })
  assert.equal(metrics.statusCode, 200)
  assert.equal(metrics.json().data.users.total, 4)
  assert.equal(metrics.json().data.courses.total, 1)
  assert.equal(metrics.json().data.courses.published, 1)
  assert.equal(metrics.json().data.reviews.total, 2)
  assert.ok(metrics.json().data.recentActivity.length >= 4)
})
