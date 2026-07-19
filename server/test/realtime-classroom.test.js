import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import realtimeRoutes from '../routes/realtime.js'

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

function addClassroom(database, studentId, teacherId) {
  const appointmentId = randomUUID()
  const classroomId = randomUUID()
  const now = Date.now()

  database
    .prepare(
      `INSERT INTO appointments (
        id, student_id, teacher_id, scheduled_start, scheduled_end,
        topic, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'accepted')`
    )
    .run(
      appointmentId,
      studentId,
      teacherId,
      new Date(now + 60_000).toISOString(),
      new Date(now + 3_660_000).toISOString(),
      '实时课堂测试'
    )

  database
    .prepare(
      `INSERT INTO classrooms (id, appointment_id, room_code, status)
       VALUES (?, ?, ?, 'scheduled')`
    )
    .run(classroomId, appointmentId, randomUUID())

  return classroomId
}

function waitForEvent(socket, predicate, timeoutMs = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage)
      reject(new Error('Timed out waiting for WebSocket event'))
    }, timeoutMs)

    function onMessage(raw) {
      let event
      try {
        event = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (!predicate(event)) return
      clearTimeout(timer)
      socket.off('message', onMessage)
      resolve(event)
    }

    socket.on('message', onMessage)
  })
}

function expectNoEvent(socket, predicate, timeoutMs = 200) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onMessage)
      resolve()
    }, timeoutMs)

    function onMessage(raw) {
      let event
      try {
        event = JSON.parse(raw.toString())
      } catch {
        return
      }

      if (!predicate(event)) return
      clearTimeout(timer)
      socket.off('message', onMessage)
      reject(new Error(`Unexpected WebSocket event: ${event.type}`))
    }

    socket.on('message', onMessage)
  })
}

async function createTestApp(t) {
  const database = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  const sockets = new Set()
  app.decorate('db', database)

  await app.register(cookie)
  await app.register(websocket)
  await authPlugin(app, {
    db: database,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(realtimeRoutes)
  await app.ready()

  t.after(async () => {
    for (const socket of sockets) socket.terminate()
    await app.close()
    database.close()
  })

  return {
    app,
    database,
    async connect(path) {
      const socket = await app.injectWS(path)
      sockets.add(socket)
      return socket
    }
  }
}

async function issueTicket(app, classroomId, user) {
  const response = await app.inject({
    method: 'POST',
    url: `/api/v1/classrooms/${classroomId}/ticket`,
    headers: bearer(user.token)
  })
  return { response, body: readBody(response) }
}

test('only classroom participants can issue tickets or read history', async (t) => {
  const { app, database } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '课堂学生'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '课堂教师'
  })
  const outsider = addUser(database, {
    role: 'student',
    displayName: '无关学生'
  })
  const classroomId = addClassroom(database, student.id, teacher.id)

  const ticket = await issueTicket(app, classroomId, outsider)
  assert.equal(ticket.response.statusCode, 403)

  const history = await app.inject({
    method: 'GET',
    url: `/api/v1/classrooms/${classroomId}/messages`,
    headers: bearer(outsider.token)
  })
  assert.equal(history.statusCode, 403)

  const participantHistory = await app.inject({
    method: 'GET',
    url: `/api/v1/classrooms/${classroomId}/messages`,
    headers: bearer(student.token)
  })
  assert.equal(participantHistory.statusCode, 200)
  assert.deepEqual(readBody(participantHistory).data.items, [])
})

test('a short-lived WebSocket ticket is consumed exactly once', async (t) => {
  const { app, database, connect } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '一次性票据学生'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '一次性票据教师'
  })
  const classroomId = addClassroom(database, student.id, teacher.id)
  const issued = await issueTicket(app, classroomId, student)

  assert.equal(issued.response.statusCode, 201)
  assert.match(issued.body.data.ticket, /^[A-Za-z0-9_-]{40,}$/)
  assert.ok(Date.parse(issued.body.data.expiresAt) > Date.now())

  const path = `/ws/classroom?ticket=${encodeURIComponent(
    issued.body.data.ticket
  )}`
  const socket = await connect(path)
  assert.equal(socket.readyState, 1)

  await assert.rejects(app.injectWS(path), /Unexpected server response: 401/)
})

test('two participants exchange a deduplicated message that remains in history', async (t) => {
  const { app, database, connect } = await createTestApp(t)
  const student = addUser(database, {
    role: 'student',
    displayName: '消息学生'
  })
  const teacher = addUser(database, {
    role: 'teacher',
    displayName: '消息教师'
  })
  const classroomId = addClassroom(database, student.id, teacher.id)
  const teacherTicket = await issueTicket(app, classroomId, teacher)
  const studentTicket = await issueTicket(app, classroomId, student)

  const teacherSocket = await connect(teacherTicket.body.data.websocketPath)
  const joined = waitForEvent(
    teacherSocket,
    (event) => event.type === 'presence.joined' && event.user.id === student.id
  )
  const studentSocket = await connect(studentTicket.body.data.websocketPath)
  assert.equal((await joined).classroomId, classroomId)

  const clientMessageId = randomUUID()
  const received = waitForEvent(
    teacherSocket,
    (event) =>
      event.type === 'chat.message' &&
      event.message.clientMessageId === clientMessageId
  )
  studentSocket.send(
    JSON.stringify({
      type: 'chat.message',
      clientMessageId,
      content: '老师好，我们开始练习吧。'
    })
  )

  const messageEvent = await received
  assert.equal(messageEvent.classroomId, classroomId)
  assert.equal(messageEvent.message.sender.id, student.id)
  assert.equal(messageEvent.message.content, '老师好，我们开始练习吧。')
  assert.equal(messageEvent.duplicate, false)

  const duplicate = waitForEvent(
    studentSocket,
    (event) =>
      event.type === 'chat.message' &&
      event.message.clientMessageId === clientMessageId &&
      event.duplicate === true
  )
  studentSocket.send(
    JSON.stringify({
      type: 'chat.message',
      clientMessageId,
      content: '客户端重试不会重复写入。'
    })
  )
  assert.equal((await duplicate).message.id, messageEvent.message.id)

  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM chat_messages
         WHERE classroom_id = ? AND client_message_id = ?`
      )
      .get(classroomId, clientMessageId).count,
    1
  )

  const history = await app.inject({
    method: 'GET',
    url: `/api/v1/classrooms/${classroomId}/messages`,
    headers: bearer(teacher.token)
  })
  assert.equal(history.statusCode, 200)
  assert.equal(readBody(history).data.items.length, 1)
  assert.equal(
    readBody(history).data.items[0].content,
    '老师好，我们开始练习吧。'
  )
})

test('chat broadcasts and RTC signalling never cross classroom boundaries', async (t) => {
  const { app, database, connect } = await createTestApp(t)
  const firstStudent = addUser(database, {
    role: 'student',
    displayName: '第一课堂学生'
  })
  const firstTeacher = addUser(database, {
    role: 'teacher',
    displayName: '第一课堂教师'
  })
  const secondStudent = addUser(database, {
    role: 'student',
    displayName: '第二课堂学生'
  })
  const secondTeacher = addUser(database, {
    role: 'teacher',
    displayName: '第二课堂教师'
  })
  const firstClassroomId = addClassroom(
    database,
    firstStudent.id,
    firstTeacher.id
  )
  const secondClassroomId = addClassroom(
    database,
    secondStudent.id,
    secondTeacher.id
  )

  const firstTicket = await issueTicket(app, firstClassroomId, firstStudent)
  const secondTicket = await issueTicket(app, secondClassroomId, secondTeacher)
  const firstSocket = await connect(firstTicket.body.data.websocketPath)
  const secondSocket = await connect(secondTicket.body.data.websocketPath)

  const noRtcLeak = expectNoEvent(
    secondSocket,
    (event) => event.type === 'rtc.offer'
  )
  const rejectedRtc = waitForEvent(
    firstSocket,
    (event) => event.type === 'error' && event.code === 'INVALID_RTC_TARGET'
  )
  firstSocket.send(
    JSON.stringify({
      type: 'rtc.offer',
      targetUserId: secondTeacher.id,
      description: { type: 'offer', sdp: 'v=0' }
    })
  )
  assert.equal((await rejectedRtc).code, 'INVALID_RTC_TARGET')
  await noRtcLeak

  const clientMessageId = randomUUID()
  const noChatLeak = expectNoEvent(
    secondSocket,
    (event) => event.type === 'chat.message'
  )
  firstSocket.send(
    JSON.stringify({
      type: 'chat.message',
      clientMessageId,
      content: '只属于第一课堂的内容'
    })
  )
  await noChatLeak

  assert.equal(
    database
      .prepare(
        'SELECT COUNT(*) AS count FROM chat_messages WHERE classroom_id = ?'
      )
      .get(secondClassroomId).count,
    0
  )
  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM chat_messages
         WHERE classroom_id = ? AND client_message_id = ?`
      )
      .get(firstClassroomId, clientMessageId).count,
    1
  )
})
