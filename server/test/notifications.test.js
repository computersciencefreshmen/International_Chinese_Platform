import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import notificationRoutes from '../routes/notifications.js'

async function createTestApp(t) {
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
  await app.register(notificationRoutes)

  const now = new Date().toISOString()
  const passwordHash = await hashPassword('Notification123!')
  const users = {}
  for (const name of ['owner', 'other']) {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'student', ?, 'active', ?, ?)`
    ).run(id, `${name}@notification.test`, passwordHash, name, now, now)
    users[name] = {
      id,
      token: createSession(db, id, { ttlSeconds: 3600 }).token
    }
  }

  const ids = [randomUUID(), randomUUID(), randomUUID()]
  const insert = db.prepare(
    `INSERT INTO notifications (
      id, user_id, type, title, body, link, read_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
  insert.run(
    ids[0],
    users.owner.id,
    'course.approved',
    '课程审核通过',
    '你的课程已发布。',
    '/teacher/courses',
    null,
    now
  )
  insert.run(
    ids[1],
    users.owner.id,
    'submission.graded',
    '作业已批阅',
    '查看本次成绩。',
    '/student/homeWork',
    now,
    now
  )
  insert.run(
    ids[2],
    users.other.id,
    'private',
    '他人的通知',
    '不可见',
    null,
    null,
    now
  )

  await app.ready()
  t.after(async () => {
    await app.close()
    db.close()
  })

  return { app, db, users, ids }
}

function authorization(token) {
  return { authorization: `Bearer ${token}` }
}

test('notification list is paginated and scoped to the current user', async (t) => {
  const { app, users } = await createTestApp(t)

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/notifications?status=all&page=1&pageSize=20',
    headers: authorization(users.owner.token)
  })

  assert.equal(response.statusCode, 200)
  assert.equal(response.json().data.items.length, 2)
  assert.equal(response.json().data.unread, 1)
  assert.equal(response.json().data.pagination.total, 2)
  assert.equal(
    response.json().data.items.some((item) => item.title === '他人的通知'),
    false
  )
})

test('read operations are idempotent and cannot modify another user notification', async (t) => {
  const { app, db, users, ids } = await createTestApp(t)
  const headers = authorization(users.owner.token)

  const forbidden = await app.inject({
    method: 'PATCH',
    url: `/api/v1/notifications/${ids[2]}/read`,
    headers
  })
  assert.equal(forbidden.statusCode, 404)
  assert.equal(
    db.prepare('SELECT read_at FROM notifications WHERE id = ?').get(ids[2])
      .read_at,
    null
  )

  for (let index = 0; index < 2; index += 1) {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${ids[0]}/read`,
      headers
    })
    assert.equal(response.statusCode, 200)
    assert.equal(response.json().data.isRead, true)
  }

  const readAll = await app.inject({
    method: 'POST',
    url: '/api/v1/notifications/read-all',
    headers
  })
  assert.equal(readAll.statusCode, 200)
  assert.equal(readAll.json().data.unread, 0)
  assert.equal(
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL'
      )
      .get(users.owner.id).count,
    0
  )
})
