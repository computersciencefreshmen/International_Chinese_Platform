import assert from 'node:assert/strict'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createTestDatabase } from './support/database.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import authRoutes from '../routes/auth.js'
import profileRoutes from '../routes/profile.js'

function readBody(response) {
  return JSON.parse(response.body)
}

function cookieHeader(response) {
  const setCookie = response.headers['set-cookie']
  const value = Array.isArray(setCookie) ? setCookie[0] : setCookie
  assert.equal(typeof value, 'string')
  return value.split(';', 1)[0]
}

function cookieToken(cookieValue) {
  return decodeURIComponent(cookieValue.slice(cookieValue.indexOf('=') + 1))
}

async function createAuthTestApp(t) {
  const db = await createTestDatabase()
  const app = Fastify({ logger: false })
  app.decorate('db', db)

  await app.register(cookie)
  await authPlugin(app, {
    appOrigin: 'http://localhost:5173',
    db,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(authRoutes)
  await app.register(profileRoutes)

  app.get(
    '/test/teacher-only',
    { preHandler: app.requireRole('teacher') },
    async () => ({ code: 0, msg: 'ok', data: true })
  )

  await app.ready()
  t.after(async () => {
    await app.close()
    await db.close()
  })

  return { app, db }
}

async function register(app, overrides = {}) {
  const email = overrides.email ?? 'student@example.com'
  const role = overrides.role ?? 'student'
  const codeResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verification-code',
    payload: { email, role }
  })
  assert.equal(codeResponse.statusCode, 200)
  const verificationCode = readBody(codeResponse).data.developmentCode

  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email,
      password: 'Secure123!',
      role,
      displayName: '测试学生',
      verificationCode,
      ...overrides
    }
  })
}

test('register creates a cookie session without exposing its token', async (t) => {
  const { app, db } = await createAuthTestApp(t)
  const response = await register(app)

  assert.equal(response.statusCode, 201)
  const payload = readBody(response)
  assert.equal(payload.code, 0)
  assert.equal(payload.data.email, 'student@example.com')
  assert.equal(payload.data.role, 'student')
  assert.equal(Object.hasOwn(payload.data, 'token'), false)
  assert.equal(Object.hasOwn(payload.data, 'password_hash'), false)

  const rawSetCookie = response.headers['set-cookie']
  assert.match(rawSetCookie, /HttpOnly/i)
  assert.match(rawSetCookie, /SameSite=Lax/i)

  const sessionCookie = cookieHeader(response)
  const rawToken = cookieToken(sessionCookie)
  const storedSession = await db
    .prepare('SELECT token_hash FROM sessions LIMIT 1')
    .get()

  assert.equal(storedSession.token_hash.length, 64)
  assert.notEqual(storedSession.token_hash, rawToken)

  const authenticated = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: sessionCookie }
  })

  assert.equal(authenticated.statusCode, 200)
  assert.equal(readBody(authenticated).data.id, payload.data.id)

  const anonymous = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session'
  })
  assert.equal(anonymous.statusCode, 401)
})

test('teacher registration creates an active account pending administrator verification', async (t) => {
  const { app, db } = await createAuthTestApp(t)
  const response = await register(app, {
    email: 'new-teacher@example.com',
    role: 'teacher',
    displayName: '新教师',
    school: '国际中文学院',
    certificates: ['国际中文教师证书']
  })

  assert.equal(response.statusCode, 201)
  const teacher = await db
    .prepare(
      `SELECT u.status, tp.verified_at
       FROM users AS u
       INNER JOIN teacher_profiles AS tp ON tp.user_id = u.id
       WHERE u.email = ?`
    )
    .get('new-teacher@example.com')

  assert.equal(teacher.status, 'active')
  assert.equal(teacher.verified_at, null)
})

test('register rejects duplicate accounts and administrator self-registration', async (t) => {
  const { app } = await createAuthTestApp(t)
  const first = await register(app)
  assert.equal(first.statusCode, 201)

  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      email: 'student@example.com',
      password: 'Secure123!',
      role: 'student',
      verificationCode: '000000'
    }
  })
  assert.equal(duplicate.statusCode, 409)
  assert.equal(readBody(duplicate).code, 409)

  const administrator = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/verification-code',
    payload: {
      email: 'admin-signup@example.com',
      role: 'administrator'
    }
  })
  assert.equal(administrator.statusCode, 400)
})

test('login validates the selected role and returns only the public profile', async (t) => {
  const { app } = await createAuthTestApp(t)
  await register(app)

  const wrongPassword = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'student@example.com',
      password: 'Wrong123!',
      role: 'student'
    }
  })
  assert.equal(wrongPassword.statusCode, 401)

  const wrongRole = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'student@example.com',
      password: 'Secure123!',
      role: 'teacher'
    }
  })
  assert.equal(wrongRole.statusCode, 401)

  const authenticated = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'STUDENT@example.com',
      password: 'Secure123!',
      role: 'student'
    }
  })

  assert.equal(authenticated.statusCode, 200)
  const payload = readBody(authenticated)
  assert.equal(payload.code, 0)
  assert.equal(payload.data.role, 'student')
  assert.equal(Object.hasOwn(payload.data, 'token'), false)
})

test('profile updates are scoped to the authenticated account', async (t) => {
  const { app, db } = await createAuthTestApp(t)
  const first = await register(app)
  const firstCookie = cookieHeader(first)
  const firstId = readBody(first).data.id
  const second = await register(app, {
    email: 'second@example.com',
    displayName: '第二位学生'
  })
  const secondId = readBody(second).data.id

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers: { cookie: firstCookie },
    payload: {
      displayName: '更新后的昵称',
      country: 'China',
      age: 20,
      chineseLevel: 'HSK4'
    }
  })

  assert.equal(response.statusCode, 200)
  assert.equal(readBody(response).data.displayName, '更新后的昵称')
  assert.equal(
    (
      await db
        .prepare('SELECT display_name FROM users WHERE id = ?')
        .get(firstId)
    ).display_name,
    '更新后的昵称'
  )
  assert.equal(
    (
      await db
        .prepare('SELECT display_name FROM users WHERE id = ?')
        .get(secondId)
    ).display_name,
    '第二位学生'
  )
})

test('role guard rejects students and permits teachers', async (t) => {
  const { app } = await createAuthTestApp(t)
  const student = await register(app)
  const studentResponse = await app.inject({
    method: 'GET',
    url: '/test/teacher-only',
    headers: { cookie: cookieHeader(student) }
  })
  assert.equal(studentResponse.statusCode, 403)

  const teacher = await register(app, {
    email: 'teacher@example.com',
    role: 'teacher',
    displayName: '测试教师'
  })
  const teacherResponse = await app.inject({
    method: 'GET',
    url: '/test/teacher-only',
    headers: { cookie: cookieHeader(teacher) }
  })
  assert.equal(teacherResponse.statusCode, 200)
})

test('changing a password rotates the current session and revokes other sessions', async (t) => {
  const { app } = await createAuthTestApp(t)
  const registration = await register(app)
  const registrationCookie = cookieHeader(registration)

  const secondLogin = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'student@example.com',
      password: 'Secure123!',
      role: 'student'
    }
  })
  const secondCookie = cookieHeader(secondLogin)

  const changed = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me/password',
    headers: { cookie: registrationCookie },
    payload: {
      currentPassword: 'Secure123!',
      newPassword: 'NewSecure456!',
      confirmPassword: 'NewSecure456!'
    }
  })

  assert.equal(changed.statusCode, 200)
  const replacementCookie = cookieHeader(changed)
  assert.notEqual(replacementCookie, registrationCookie)

  const revokedSession = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: secondCookie }
  })
  assert.equal(revokedSession.statusCode, 401)

  const replacementSession = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: replacementCookie }
  })
  assert.equal(replacementSession.statusCode, 200)

  const oldPassword = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'student@example.com',
      password: 'Secure123!'
    }
  })
  assert.equal(oldPassword.statusCode, 401)

  const newPassword = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: {
      email: 'student@example.com',
      password: 'NewSecure456!'
    }
  })
  assert.equal(newPassword.statusCode, 200)
})

test('logout revokes the session and bearer authentication remains API-compatible', async (t) => {
  const { app, db } = await createAuthTestApp(t)
  const registration = await register(app)
  const user = readBody(registration).data
  const browserCookie = cookieHeader(registration)

  const loggedOut = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/logout',
    headers: { cookie: browserCookie }
  })
  assert.equal(loggedOut.statusCode, 200)

  const revoked = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: browserCookie }
  })
  assert.equal(revoked.statusCode, 401)

  const apiSession = await createSession(db, user.id, { ttlSeconds: 3600 })
  const bearerResponse = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { authorization: `Bearer ${apiSession.token}` }
  })

  assert.equal(bearerResponse.statusCode, 200)
  assert.equal(readBody(bearerResponse).data.id, user.id)
  assert.equal(Object.hasOwn(readBody(bearerResponse).data, 'token'), false)
})

test('cookie-authenticated writes reject an untrusted Origin', async (t) => {
  const { app } = await createAuthTestApp(t)
  const registration = await register(app)

  const response = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me',
    headers: {
      cookie: cookieHeader(registration),
      origin: 'https://attacker.example'
    },
    payload: { displayName: '不应被写入' }
  })

  assert.equal(response.statusCode, 403)
  assert.equal(readBody(response).msg, '请求来源不受信任')
})

test('temporary credentials require a password reset after session restore', async (t) => {
  const { app, db } = await createAuthTestApp(t)
  const registration = await register(app)
  const user = readBody(registration).data
  const sessionCookie = cookieHeader(registration)

  await db
    .prepare('UPDATE users SET must_reset_password = true WHERE id = ?')
    .run(user.id)

  const restored = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: sessionCookie }
  })
  assert.equal(restored.statusCode, 200)
  assert.equal(readBody(restored).data.mustResetPassword, true)

  const blocked = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { cookie: sessionCookie }
  })
  assert.equal(blocked.statusCode, 403)
  assert.equal(readBody(blocked).data.reason, 'PASSWORD_RESET_REQUIRED')

  const changed = await app.inject({
    method: 'PATCH',
    url: '/api/v1/me/password',
    headers: { cookie: sessionCookie },
    payload: {
      currentPassword: 'Secure123!',
      newPassword: 'NewSecure456!',
      confirmPassword: 'NewSecure456!'
    }
  })
  assert.equal(changed.statusCode, 200)
  assert.equal(readBody(changed).data.mustResetPassword, false)

  const replacementCookie = cookieHeader(changed)
  const replacementSession = await app.inject({
    method: 'GET',
    url: '/api/v1/auth/session',
    headers: { cookie: replacementCookie }
  })
  assert.equal(replacementSession.statusCode, 200)
  assert.equal(readBody(replacementSession).data.mustResetPassword, false)

  const allowed = await app.inject({
    method: 'GET',
    url: '/api/v1/me',
    headers: { cookie: replacementCookie }
  })
  assert.equal(allowed.statusCode, 200)
})
