import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import assignmentRoutes from '../routes/assignments.js'

function bearer(token) {
  return { authorization: `Bearer ${token}` }
}

function body(response) {
  return JSON.parse(response.body)
}

function addUser(database, role, displayName) {
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status
      ) VALUES (?, ?, ?, ?, ?, 'active')`
    )
    .run(id, `${role}-${id}@assignment.test`, 'x'.repeat(64), role, displayName)
  const session = createSession(database, id, { ttlSeconds: 3600 })

  return { id, role, headers: bearer(session.token) }
}

function addCourse(database, teacherId, status = 'published') {
  const id = randomUUID()
  database
    .prepare(
      `INSERT INTO courses (
        id, teacher_id, title, summary, description, level, category,
        duration_minutes, price_cents, capacity, status, published_at
      ) VALUES (?, ?, ?, '', '', 'beginner', '综合汉语', 60, 0, 30, ?, ?)`
    )
    .run(
      id,
      teacherId,
      `作业测试课程-${id}`,
      status,
      status === 'published' ? new Date().toISOString() : null
    )
  return id
}

async function createAssignmentTestApp(t) {
  const database = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  app.decorate('db', database)

  await app.register(cookie)
  await authPlugin(app, {
    db: database,
    allowBearer: true,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(assignmentRoutes)
  await app.ready()

  t.after(async () => {
    await app.close()
    database.close()
  })

  return { app, database }
}

function assignmentPayload(title = '第一单元作业') {
  return {
    title,
    instructions: '完成选择题和简答题。',
    dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    maxScore: 100,
    questions: [
      {
        type: 'single_choice',
        prompt: '见面时最自然的问候是哪一句？',
        options: ['你好', '再见', '谢谢'],
        correctAnswer: '你好',
        points: 40,
        explanation: '见面时可以说“你好”。'
      },
      {
        type: 'text',
        prompt: '请写两句话介绍自己。',
        correctAnswer: '绝密参考答案：我叫小林，我喜欢学习中文。',
        points: 60,
        explanation: '绝密解析：回答应包含姓名和兴趣。'
      }
    ]
  }
}

test('student submission, teacher grading and student result form a complete workflow', async (t) => {
  const { app, database } = await createAssignmentTestApp(t)
  const student = addUser(database, 'student', '测试学生')
  const teacher = addUser(database, 'teacher', '王老师')
  const otherTeacher = addUser(database, 'teacher', '李老师')
  const courseId = addCourse(database, teacher.id)

  const created = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${courseId}/assignments`,
    headers: teacher.headers,
    payload: assignmentPayload()
  })
  assert.equal(created.statusCode, 201)
  assert.equal(body(created).code, 0)
  assert.equal(body(created).data.status, 'draft')
  const assignmentId = body(created).data.id

  const hiddenBeforePublish = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}`,
    headers: student.headers
  })
  assert.equal(hiddenBeforePublish.statusCode, 404)

  const forbiddenPublish = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/publish`,
    headers: otherTeacher.headers
  })
  assert.equal(forbiddenPublish.statusCode, 403)

  const published = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/publish`,
    headers: teacher.headers
  })
  assert.equal(published.statusCode, 200)
  assert.equal(body(published).data.status, 'published')

  const studentDetail = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}`,
    headers: student.headers
  })
  assert.equal(studentDetail.statusCode, 200)
  const questions = body(studentDetail).data.questions
  assert.equal(questions.length, 2)
  assert.equal('correctAnswer' in questions[0], false)
  assert.equal('correctAnswer' in questions[1], false)
  assert.equal('explanation' in questions[0], false)
  assert.doesNotMatch(studentDetail.body, /绝密参考答案|绝密解析/)

  const [choiceQuestion, textQuestion] = questions
  const savedDraft = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: student.headers,
    payload: {
      action: 'save',
      answers: { [choiceQuestion.id]: '你好' }
    }
  })
  assert.equal(savedDraft.statusCode, 201)
  assert.equal(body(savedDraft).data.status, 'draft')
  const submissionId = body(savedDraft).data.id

  const hiddenStudentDraft = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: teacher.headers
  })
  assert.equal(hiddenStudentDraft.statusCode, 200)
  assert.equal(body(hiddenStudentDraft).data.items.length, 0)

  const incompleteSubmit = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: student.headers,
    payload: {
      answers: { [choiceQuestion.id]: '你好' }
    }
  })
  assert.equal(incompleteSubmit.statusCode, 400)

  const submitted = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: student.headers,
    payload: {
      answers: {
        [choiceQuestion.id]: '你好',
        [textQuestion.id]: '我叫林安，我喜欢读中文故事。'
      }
    }
  })
  assert.equal(submitted.statusCode, 200)
  assert.equal(body(submitted).data.id, submissionId)
  assert.equal(body(submitted).data.status, 'submitted')

  const duplicateSubmit = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: student.headers,
    payload: {
      answers: {
        [choiceQuestion.id]: '你好',
        [textQuestion.id]: '重复提交。'
      }
    }
  })
  assert.equal(duplicateSubmit.statusCode, 409)

  const forbiddenSubmissions = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: otherTeacher.headers
  })
  assert.equal(forbiddenSubmissions.statusCode, 403)

  const teacherSubmissions = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}/submissions?status=submitted`,
    headers: teacher.headers
  })
  assert.equal(teacherSubmissions.statusCode, 200)
  assert.equal(body(teacherSubmissions).data.items.length, 1)
  assert.equal(body(teacherSubmissions).data.items[0].student.id, student.id)

  const forbiddenGrade = await app.inject({
    method: 'PATCH',
    url: `/api/v1/submissions/${submissionId}/grade`,
    headers: otherTeacher.headers,
    payload: { score: 90, feedback: '越权批阅' }
  })
  assert.equal(forbiddenGrade.statusCode, 403)

  const invalidScore = await app.inject({
    method: 'PATCH',
    url: `/api/v1/submissions/${submissionId}/grade`,
    headers: teacher.headers,
    payload: { score: 101, feedback: '超过满分' }
  })
  assert.equal(invalidScore.statusCode, 400)

  const graded = await app.inject({
    method: 'PATCH',
    url: `/api/v1/submissions/${submissionId}/grade`,
    headers: teacher.headers,
    payload: { score: 92, feedback: '表达完整，继续注意量词。' }
  })
  assert.equal(graded.statusCode, 200)
  assert.equal(body(graded).data.status, 'graded')
  assert.equal(body(graded).data.score, 92)

  const duplicateGrade = await app.inject({
    method: 'PATCH',
    url: `/api/v1/submissions/${submissionId}/grade`,
    headers: teacher.headers,
    payload: { score: 95, feedback: '重复批阅' }
  })
  assert.equal(duplicateGrade.statusCode, 409)

  const studentResults = await app.inject({
    method: 'GET',
    url: '/api/v1/me/submissions?status=graded',
    headers: student.headers
  })
  assert.equal(studentResults.statusCode, 200)
  assert.equal(body(studentResults).data.items.length, 1)
  assert.equal(body(studentResults).data.items[0].score, 92)
  assert.equal(
    body(studentResults).data.items[0].feedback,
    '表达完整，继续注意量词。'
  )

  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM notifications
         WHERE user_id = ? AND type = 'submission.graded' AND resource_id = ?`
      )
      .get(student.id, submissionId).count,
    1
  )
  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM audit_logs
         WHERE action = 'submission.graded' AND entity_id = ?`
      )
      .get(submissionId).count,
    1
  )
})

test('assignment visibility, ownership and state transitions stay explicit', async (t) => {
  const { app, database } = await createAssignmentTestApp(t)
  const student = addUser(database, 'student', '学生乙')
  const teacher = addUser(database, 'teacher', '教师乙')
  const otherTeacher = addUser(database, 'teacher', '教师丙')
  const draftCourseId = addCourse(database, teacher.id, 'draft')

  const invalidPoints = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${draftCourseId}/assignments`,
    headers: teacher.headers,
    payload: {
      ...assignmentPayload('分值错误作业'),
      maxScore: 99
    }
  })
  assert.equal(invalidPoints.statusCode, 400)

  const forbiddenCreate = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${draftCourseId}/assignments`,
    headers: otherTeacher.headers,
    payload: assignmentPayload('越权作业')
  })
  assert.equal(forbiddenCreate.statusCode, 403)

  const created = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${draftCourseId}/assignments`,
    headers: teacher.headers,
    payload: assignmentPayload('课程尚未发布的作业')
  })
  assert.equal(created.statusCode, 201)
  const assignmentId = body(created).data.id

  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/v1/assignments/${assignmentId}`,
    headers: teacher.headers,
    payload: { instructions: '更新后的作业说明。' }
  })
  assert.equal(updated.statusCode, 200)

  const published = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/publish`,
    headers: teacher.headers
  })
  assert.equal(published.statusCode, 200)

  const secondPublish = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/publish`,
    headers: teacher.headers
  })
  assert.equal(secondPublish.statusCode, 409)

  const updateAfterPublish = await app.inject({
    method: 'PATCH',
    url: `/api/v1/assignments/${assignmentId}`,
    headers: teacher.headers,
    payload: { instructions: '发布后不应允许修改。' }
  })
  assert.equal(updateAfterPublish.statusCode, 409)

  const studentCourseList = await app.inject({
    method: 'GET',
    url: `/api/v1/courses/${draftCourseId}/assignments`,
    headers: student.headers
  })
  assert.equal(studentCourseList.statusCode, 404)

  const studentDetail = await app.inject({
    method: 'GET',
    url: `/api/v1/assignments/${assignmentId}`,
    headers: student.headers
  })
  assert.equal(studentDetail.statusCode, 404)

  const studentSubmit = await app.inject({
    method: 'POST',
    url: `/api/v1/assignments/${assignmentId}/submissions`,
    headers: student.headers,
    payload: { answers: {} }
  })
  assert.equal(studentSubmit.statusCode, 409)
})
