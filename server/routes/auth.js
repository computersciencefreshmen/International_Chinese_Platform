import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import {
  hashPassword,
  needsPasswordRehash,
  verifyPassword
} from '../lib/password.js'
import {
  createSession,
  extractSessionToken,
  publicUser,
  revokeSessionByToken,
  SESSION_COOKIE_NAME
} from '../lib/session.js'

const roleSchema = z.enum(['student', 'teacher', 'administrator'])
const publicRegistrationRoleSchema = z.enum(['student', 'teacher'])
const emailSchema = z
  .string()
  .trim()
  .email('请输入有效邮箱地址')
  .max(254, '邮箱地址过长')
  .transform((email) => email.toLowerCase())
const passwordSchema = z
  .string()
  .min(8, '密码至少需要 8 个字符')
  .max(128, '密码不能超过 128 个字符')
  .regex(/[A-Za-z]/, '密码至少需要包含一个字母')
  .regex(/\d/, '密码至少需要包含一个数字')

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '请输入密码').max(128, '密码过长'),
  role: roleSchema.optional()
})

const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  role: publicRegistrationRoleSchema.default('student'),
  displayName: z.string().trim().min(1).max(80).optional(),
  avatarUrl: z.string().trim().url().max(2048).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  age: z.coerce.number().int().min(6).max(120).nullable().optional(),
  chineseLevel: z
    .enum(['beginner', 'HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'])
    .nullable()
    .optional(),
  bio: z.string().trim().max(500).optional(),
  verificationCode: z.string().trim().max(20).optional()
})

const dummyPasswordHashPromise = hashPassword('invalid-password-123456')

function responseData(reply, data, message = '操作成功', statusCode = 200) {
  return reply.code(statusCode).send({
    code: 0,
    msg: message,
    data
  })
}

function responseError(reply, statusCode, message, data = null) {
  return reply.code(statusCode).send({
    code: statusCode,
    msg: message,
    data
  })
}

function validationError(reply, result) {
  return responseError(reply, 400, '请求参数不正确', {
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
  })
}

function unwrapBody(body) {
  if (body && typeof body === 'object' && body.data) {
    return body.data
  }

  return body ?? {}
}

function sessionMetadata(request) {
  return {
    userAgent: request.headers['user-agent'] ?? null,
    ipAddress: request.ip ?? null
  }
}

export async function authRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('authRoutes requires app.db')
  }

  app.post(
    '/api/v1/auth/register',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const rawBody = unwrapBody(request.body)
      const result = registerSchema.safeParse({
        ...rawBody,
        displayName: rawBody.displayName ?? rawBody.name
      })

      if (!result.success) {
        return validationError(reply, result)
      }

      const input = result.data
      const existingUser = db
        .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
        .get(input.email)

      if (existingUser) {
        return responseError(reply, 409, '该邮箱已注册')
      }

      const userId = randomUUID()
      const createdAt = new Date().toISOString()
      const passwordHash = await hashPassword(input.password)
      let session

      try {
        const createUserAndSession = db.transaction(() => {
          db.prepare(
            `INSERT INTO users (
              id,
              email,
              password_hash,
              role,
              display_name,
              avatar_url,
              country,
              region,
              age,
              chinese_level,
              bio,
              status,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
          ).run(
            userId,
            input.email,
            passwordHash,
            input.role,
            input.displayName ?? input.email.split('@')[0],
            input.avatarUrl ?? null,
            input.country ?? null,
            input.region ?? null,
            input.age ?? null,
            input.chineseLevel ?? null,
            input.bio ?? '',
            createdAt,
            createdAt
          )

          return createSession(db, userId, {
            ttlSeconds: app.sessionTtlSeconds,
            ...sessionMetadata(request)
          })
        })

        session = createUserAndSession()
      } catch (error) {
        if (
          error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
          error?.code === 'SQLITE_CONSTRAINT'
        ) {
          return responseError(reply, 409, '该邮箱已注册')
        }

        throw error
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
      reply.setCookie(
        SESSION_COOKIE_NAME,
        session.token,
        app.sessionCookieOptions(session.ttlSeconds)
      )

      return responseData(reply, publicUser(user), '注册成功', 201)
    }
  )

  app.post(
    '/api/v1/auth/login',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const result = loginSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const input = result.data
      const user = db
        .prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
        .get(input.email)
      const hashToCheck =
        user?.password_hash ?? (await dummyPasswordHashPromise)
      const passwordMatches = await verifyPassword(input.password, hashToCheck)

      if (
        !user ||
        !passwordMatches ||
        user.status !== 'active' ||
        (input.role && input.role !== user.role)
      ) {
        return responseError(reply, 401, '邮箱、密码或身份不正确')
      }

      if (needsPasswordRehash(user.password_hash)) {
        const replacementHash = await hashPassword(input.password)
        db.prepare(
          'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
        ).run(replacementHash, new Date().toISOString(), user.id)
      }

      const session = createSession(db, user.id, {
        ttlSeconds: app.sessionTtlSeconds,
        ...sessionMetadata(request)
      })

      reply.setCookie(
        SESSION_COOKIE_NAME,
        session.token,
        app.sessionCookieOptions(session.ttlSeconds)
      )

      return responseData(reply, publicUser(user), '登录成功')
    }
  )

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const credential = extractSessionToken(request)
    if (credential) {
      revokeSessionByToken(db, credential.token)
    }

    reply.clearCookie(SESSION_COOKIE_NAME, {
      ...app.sessionCookieOptions(),
      maxAge: 0
    })

    return responseData(reply, null, '已安全退出')
  })

  app.get(
    '/api/v1/auth/session',
    { preHandler: app.authenticate },
    async (request, reply) =>
      responseData(reply, request.auth.user, '登录状态有效')
  )
}

export default authRoutes
