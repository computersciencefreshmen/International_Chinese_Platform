import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import profileRoutes from '../routes/profile.js'

function authorization(token) {
  return { authorization: `Bearer ${token}` }
}

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
  await app.register(profileRoutes)

  const now = new Date().toISOString()
  const passwordHash = await hashPassword('ProfileTest123!')
  const users = {}
  for (const [name, role] of [
    ['student', 'student'],
    ['teacher', 'teacher']
  ]) {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(id, `${name}@profile.test`, passwordHash, role, name, now, now)
    users[name] = {
      id,
      token: createSession(db, id, { ttlSeconds: 3600 }).token
    }
  }
  db.prepare(
    `INSERT INTO teacher_profiles (
      user_id, school, title, experience_years, specialties_json,
      certificates_json, teaching_style_json, languages_json,
      created_at, updated_at
    ) VALUES (?, '初始学校', '讲师', 2, '["口语"]', '[]', '[]', '["中文"]', ?, ?)`
  ).run(users.teacher.id, now, now)

  await app.ready()
  t.after(async () => {
    await app.close()
    db.close()
  })
  return { app, db, users }
}

test('teacher can read and update professional profile fields atomically', async (t) => {
  const { app, db, users } = await createTestApp(t)
  const headers = authorization(users.teacher.token)

  const initial = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers
  })
  assert.equal(initial.statusCode, 200)
  assert.equal(initial.json().data.teacherProfile.school, '初始学校')
  assert.deepEqual(initial.json().data.teacherProfile.specialties, ['口语'])

  const updated = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers,
    payload: {
      displayName: '林老师',
      bio: '帮助学习者自信表达。',
      teacherProfile: {
        school: '国际中文学院',
        experienceYears: 6,
        hourlyRateCents: 18800,
        specialties: ['HSK', '商务中文'],
        teachingStyle: ['任务驱动'],
        languages: ['中文', '英语']
      }
    }
  })
  assert.equal(updated.statusCode, 200)
  assert.equal(updated.json().data.displayName, '林老师')
  assert.equal(updated.json().data.teacherProfile.experienceYears, 6)
  assert.deepEqual(updated.json().data.teacherProfile.specialties, [
    'HSK',
    '商务中文'
  ])
  assert.equal(
    db
      .prepare(
        'SELECT hourly_rate_cents FROM teacher_profiles WHERE user_id = ?'
      )
      .get(users.teacher.id).hourly_rate_cents,
    18800
  )
})

test('student cannot write teacher profile fields', async (t) => {
  const { app, db, users } = await createTestApp(t)
  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers: authorization(users.student.token),
    payload: { teacherProfile: { school: '伪造学校' } }
  })
  assert.equal(response.statusCode, 403)
  assert.equal(
    db
      .prepare(
        'SELECT COUNT(*) AS count FROM teacher_profiles WHERE user_id = ?'
      )
      .get(users.student.id).count,
    0
  )
})
