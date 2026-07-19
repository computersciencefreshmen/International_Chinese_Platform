import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import appointmentRoutes from '../routes/appointments.js'
import teacherRoutes from '../routes/teachers.js'

function readBody(response) {
  return JSON.parse(response.body)
}

function bearer(token) {
  return { authorization: `Bearer ${token}` }
}

function addUser(database, { id = randomUUID(), role, displayName }) {
  database
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status
      ) VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .run(id, `${role}-${id}@example.com`, 'x'.repeat(64), role, displayName)

  const session = createSession(database, id, { ttlSeconds: 3600 })
  return { id, role, displayName, token: session.token }
}

function addTeacherProfile(database, teacherId, overrides = {}) {
  database
    .prepare(
      `INSERT INTO teacher_profiles (
        user_id, school, title, experience_years, rating,
        hourly_rate_cents, specialties_json, certificates_json,
        teaching_style_json, languages_json, verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      teacherId,
      overrides.school ?? '国际中文学院',
      overrides.title ?? '国际中文讲师',
      overrides.experienceYears ?? 6,
      overrides.rating ?? 4.8,
      overrides.hourlyRateCents ?? 16800,
      JSON.stringify(overrides.specialties ?? ['口语', 'HSK']),
      JSON.stringify(overrides.certificates ?? ['国际中文教师证书']),
      JSON.stringify(overrides.teachingStyle ?? ['情景教学']),
      JSON.stringify(overrides.languages ?? ['中文', '英语']),
      overrides.verifiedAt ?? '2026-01-01T00:00:00.000Z'
    )
}

function addCourse(database, teacherId, overrides = {}) {
  const id = overrides.id ?? randomUUID()
  database
    .prepare(
      `INSERT INTO courses (
        id, teacher_id, title, summary, level, category,
        duration_minutes, price_cents, status, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      teacherId,
      overrides.title ?? '生活汉语',
      overrides.summary ?? '真实场景中文训练',
      overrides.level ?? 'beginner',
      overrides.category ?? '综合汉语',
      overrides.durationMinutes ?? 45,
      overrides.priceCents ?? 9900,
      overrides.status ?? 'published',
      overrides.status === 'draft' ? null : '2026-01-01T00:00:00.000Z'
    )
  return id
}

function futureIso(minutesFromNow) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString()
}

async function createTestApp(t) {
  const database = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  app.decorate('db', database)

  await app.register(cookie)
  await authPlugin(app, {
    db: database,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(teacherRoutes)
  await app.register(appointmentRoutes)
  await app.ready()

  t.after(async () => {
    await app.close()
    database.close()
  })

  return { app, database }
}

async function requestAppointment(
  app,
  student,
  teacher,
  courseId,
  overrides = {}
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/appointments',
    headers: bearer(student.token),
    payload: {
      teacherId: teacher.id,
      courseId,
      topic: overrides.topic ?? '口语练习',
      message: overrides.message ?? '希望加强真实情景表达。',
      scheduledStart: overrides.scheduledStart ?? futureIso(180),
      durationMinutes: overrides.durationMinutes ?? 45
    }
  })
}

test('teacher discovery exposes active teachers and only their published courses', async (t) => {
  const { app, database } = await createTestApp(t)
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '陈老师'
  })
  addTeacherProfile(database, teacher.id, { specialties: ['商务汉语'] })
  const publishedCourseId = addCourse(database, teacher.id)
  addCourse(database, teacher.id, { status: 'draft', title: '未发布课程' })

  const listing = await app.inject({
    method: 'GET',
    url: '/api/v1/teachers?search=%E9%99%88&specialty=%E5%95%86%E5%8A%A1'
  })

  assert.equal(listing.statusCode, 200)
  assert.equal(readBody(listing).code, 0)
  assert.equal(readBody(listing).data.items.length, 1)
  assert.equal(readBody(listing).data.items[0].publishedCourseCount, 1)
  assert.equal(readBody(listing).data.items[0].rating, 4.8)

  const detail = await app.inject({
    method: 'GET',
    url: `/api/v1/teachers/${teacher.id}`
  })

  assert.equal(detail.statusCode, 200)
  assert.deepEqual(
    readBody(detail).data.courses.map((course) => course.id),
    [publishedCourseId]
  )
})

test('a student request can be accepted atomically with a classroom, notifications and audit', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '学习者甲'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '教师甲'
  })
  addTeacherProfile(database, teacher.id)
  const courseId = addCourse(database, teacher.id)

  const created = await requestAppointment(app, student, teacher, courseId)
  assert.equal(created.statusCode, 201)
  const appointmentId = readBody(created).data.id
  assert.equal(readBody(created).data.status, 'pending')

  const accepted = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${appointmentId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'accept', note: '课堂见。' }
  })

  assert.equal(accepted.statusCode, 200)
  const acceptedData = readBody(accepted).data
  assert.equal(acceptedData.status, 'accepted')
  assert.equal(acceptedData.responseNote, '课堂见。')
  assert.match(acceptedData.classroom.roomCode, /^[A-Za-z0-9_-]{6,64}$/)
  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM notifications
         WHERE resource_type = 'appointment' AND resource_id = ?`
      )
      .get(appointmentId).count,
    2
  )
  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM audit_logs
         WHERE action = 'appointment.accepted' AND entity_id = ?`
      )
      .get(appointmentId).count,
    1
  )

  const joinInfo = await app.inject({
    method: 'GET',
    url: `/api/v1/classrooms/${acceptedData.classroom.id}/join-info`,
    headers: bearer(student.token)
  })
  assert.equal(joinInfo.statusCode, 200)
  assert.equal(
    readBody(joinInfo).data.roomCode,
    acceptedData.classroom.roomCode
  )
  assert.deepEqual(
    new Set(readBody(joinInfo).data.participants.map((item) => item.role)),
    new Set(['student', 'teacher'])
  )
})

test('teachers can reject pending requests and either participant can cancel an active request', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '学习者乙'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '教师乙'
  })
  addTeacherProfile(database, teacher.id)
  const courseId = addCourse(database, teacher.id)

  const rejectedRequest = await requestAppointment(
    app,
    student,
    teacher,
    courseId,
    { scheduledStart: futureIso(300) }
  )
  const rejectedId = readBody(rejectedRequest).data.id
  const rejected = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${rejectedId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'reject', note: '该时段无法授课。' }
  })
  assert.equal(rejected.statusCode, 200)
  assert.equal(readBody(rejected).data.status, 'rejected')
  assert.equal(
    database
      .prepare(
        'SELECT COUNT(*) AS count FROM classrooms WHERE appointment_id = ?'
      )
      .get(rejectedId).count,
    0
  )

  const pendingRequest = await requestAppointment(
    app,
    student,
    teacher,
    courseId,
    { scheduledStart: futureIso(420) }
  )
  const pendingId = readBody(pendingRequest).data.id
  const studentCancelled = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${pendingId}/cancel`,
    headers: bearer(student.token),
    payload: { reason: '行程有变' }
  })
  assert.equal(studentCancelled.statusCode, 200)
  assert.equal(readBody(studentCancelled).data.status, 'cancelled')

  const acceptedRequest = await requestAppointment(
    app,
    student,
    teacher,
    courseId,
    { scheduledStart: futureIso(540) }
  )
  const acceptedId = readBody(acceptedRequest).data.id
  await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${acceptedId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'accept' }
  })
  const teacherCancelled = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${acceptedId}/cancel`,
    headers: bearer(teacher.token),
    payload: { reason: '临时教研安排' }
  })
  assert.equal(teacherCancelled.statusCode, 200)
  assert.equal(readBody(teacherCancelled).data.status, 'cancelled')
  assert.equal(readBody(teacherCancelled).data.classroom.status, 'closed')
})

test('accepting an overlapping lesson is rejected without partial side effects', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '学习者丙'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '教师丙'
  })
  addTeacherProfile(database, teacher.id)
  const courseId = addCourse(database, teacher.id)
  const sharedStart = futureIso(720)

  const first = await requestAppointment(app, student, teacher, courseId, {
    scheduledStart: sharedStart,
    durationMinutes: 60,
    topic: '第一节课'
  })
  const second = await requestAppointment(app, student, teacher, courseId, {
    scheduledStart: new Date(
      new Date(sharedStart).getTime() + 30 * 60_000
    ).toISOString(),
    durationMinutes: 60,
    topic: '冲突课程'
  })
  const firstId = readBody(first).data.id
  const secondId = readBody(second).data.id

  const accepted = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${firstId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'accept' }
  })
  assert.equal(accepted.statusCode, 200)

  const conflicted = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${secondId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'accept' }
  })
  assert.equal(conflicted.statusCode, 409)
  assert.equal(readBody(conflicted).data.conflictingAppointmentId, firstId)
  assert.equal(
    database
      .prepare('SELECT status FROM appointments WHERE id = ?')
      .get(secondId).status,
    'pending'
  )
  assert.equal(
    database
      .prepare(
        'SELECT COUNT(*) AS count FROM classrooms WHERE appointment_id = ?'
      )
      .get(secondId).count,
    0
  )
})

test('appointment ownership prevents response, listing and classroom access leaks', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '学习者丁'
  })
  const outsiderStudent = addUser(database, {
    role: 'student',
    displayName: '无关学生'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '教师丁'
  })
  const outsiderTeacher = addUser(database, {
    role: 'teacher',
    displayName: '无关教师'
  })
  addTeacherProfile(database, teacher.id)
  addTeacherProfile(database, outsiderTeacher.id)
  const courseId = addCourse(database, teacher.id)
  const created = await requestAppointment(app, student, teacher, courseId)
  const appointmentId = readBody(created).data.id

  const forbiddenResponse = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${appointmentId}/respond`,
    headers: bearer(outsiderTeacher.token),
    payload: { action: 'accept' }
  })
  assert.equal(forbiddenResponse.statusCode, 403)

  const outsiderList = await app.inject({
    method: 'GET',
    url: '/api/v1/appointments',
    headers: bearer(outsiderStudent.token)
  })
  assert.equal(outsiderList.statusCode, 200)
  assert.equal(readBody(outsiderList).data.items.length, 0)

  const accepted = await app.inject({
    method: 'PATCH',
    url: `/api/v1/appointments/${appointmentId}/respond`,
    headers: bearer(teacher.token),
    payload: { action: 'accept' }
  })
  const classroomId = readBody(accepted).data.classroom.id
  const forbiddenJoin = await app.inject({
    method: 'GET',
    url: `/api/v1/classrooms/${classroomId}/join-info`,
    headers: bearer(outsiderStudent.token)
  })
  assert.equal(forbiddenJoin.statusCode, 403)

  const invalidRequest = await requestAppointment(
    app,
    student,
    teacher,
    courseId,
    { scheduledStart: new Date(Date.now() - 60_000).toISOString() }
  )
  assert.equal(invalidRequest.statusCode, 400)
})
