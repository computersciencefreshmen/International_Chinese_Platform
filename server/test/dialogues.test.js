import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import dialogueRoutes from '../routes/dialogues.js'

function authorization(token) {
  return { authorization: `Bearer ${token}` }
}

async function createTestApp(t) {
  const db = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  app.decorate('db', db)
  app.decorate('config', { aiApiUrl: '', aiApiKey: '' })

  await app.register(cookie)
  await authPlugin(app, {
    db,
    allowBearer: true,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(dialogueRoutes)

  const now = new Date().toISOString()
  const passwordHash = await hashPassword('DialogueTest123!')
  const users = {}
  for (const [name, role] of [
    ['student', 'student'],
    ['other', 'student'],
    ['teacher', 'teacher']
  ]) {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, `${name}@dialogue.test`, passwordHash, role, name, now, now)
    users[name] = {
      id,
      token: createSession(db, id, { ttlSeconds: 3600 }).token
    }
  }

  await app.ready()
  t.after(async () => {
    await app.close()
    db.close()
  })
  return { app, db, users }
}

test('student can generate, continue and revisit a persistent local dialogue', async (t) => {
  const { app, db, users } = await createTestApp(t)
  const headers = authorization(users.student.token)

  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/dialogues',
    headers,
    payload: { keywords: ['点餐', '餐厅', '价格'] }
  })
  assert.equal(created.statusCode, 201)
  assert.equal(created.json().data.provider, 'local')
  assert.deepEqual(created.json().data.keywords, ['点餐', '餐厅', '价格'])
  assert.equal(created.json().data.turns.length, 2)
  const dialogueId = created.json().data.id

  const continued = await app.inject({
    method: 'POST',
    url: `/api/v1/dialogues/${dialogueId}/messages`,
    headers,
    payload: { message: '我想在餐厅练习点餐。' }
  })
  assert.equal(continued.statusCode, 200)
  assert.equal(continued.json().data.turns.length, 2)
  assert.equal(continued.json().data.turns[0].speaker, 'student')
  assert.equal(continued.json().data.turns[1].speaker, 'tutor')
  assert.match(continued.json().data.turns[1].content, /点餐/)

  const detail = await app.inject({
    method: 'GET',
    url: `/api/v1/dialogues/${dialogueId}`,
    headers
  })
  assert.equal(detail.statusCode, 200)
  assert.equal(detail.json().data.turns.length, 4)
  assert.deepEqual(
    detail.json().data.turns.map((turn) => turn.position),
    [1, 2, 3, 4]
  )

  const list = await app.inject({
    method: 'GET',
    url: '/api/v1/dialogues',
    headers
  })
  assert.equal(list.statusCode, 200)
  assert.equal(list.json().data.items.length, 1)
  assert.equal(list.json().data.items[0].turnCount, 4)
  assert.equal(
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM dialogue_turns WHERE session_id = ?'
      )
      .get(dialogueId).count,
    4
  )
})

test('dialogue ownership and student role are enforced without leaking existence', async (t) => {
  const { app, users } = await createTestApp(t)
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/dialogues',
    headers: authorization(users.student.token),
    payload: { title: '机场练习', keywords: ['机场', '行李'] }
  })
  const dialogueId = created.json().data.id

  for (const request of [
    {
      method: 'GET',
      url: `/api/v1/dialogues/${dialogueId}`,
      headers: authorization(users.other.token)
    },
    {
      method: 'POST',
      url: `/api/v1/dialogues/${dialogueId}/messages`,
      headers: authorization(users.other.token),
      payload: { message: '尝试越权写入' }
    }
  ]) {
    const response = await app.inject(request)
    assert.equal(response.statusCode, 404)
  }

  const teacher = await app.inject({
    method: 'GET',
    url: '/api/v1/dialogues',
    headers: authorization(users.teacher.token)
  })
  assert.equal(teacher.statusCode, 403)
})
