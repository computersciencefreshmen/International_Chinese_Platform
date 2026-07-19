import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

import { z } from 'zod'

import { createMailProvider } from '../services/mail-provider.js'

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
  school: z.string().trim().max(160).optional(),
  title: z.string().trim().max(120).optional(),
  experienceYears: z.coerce.number().int().min(0).max(80).optional(),
  specialties: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  certificates: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
  teachingStyle: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  languages: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  verificationCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, '请输入 6 位验证码')
})

const verificationRequestSchema = z.object({
  email: emailSchema,
  role: publicRegistrationRoleSchema.default('student')
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

function verificationDigest(secret, email, code) {
  return createHmac('sha256', secret)
    .update(`${email}:${code}`, 'utf8')
    .digest('hex')
}

function safeDigestEqual(left, right) {
  try {
    const leftBuffer = Buffer.from(left, 'hex')
    const rightBuffer = Buffer.from(right, 'hex')
    return (
      leftBuffer.length === rightBuffer.length &&
      timingSafeEqual(leftBuffer, rightBuffer)
    )
  } catch {
    return false
  }
}

export async function authRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('authRoutes requires app.db')
  }

  const isProduction = app.config?.isProduction === true
  const verificationSecret =
    app.config?.verificationCodeSecret || 'local-development-only-secret'
  const mailProvider = createMailProvider({
    smtpUrl: app.config?.smtpUrl,
    mailFrom: app.config?.mailFrom
  })

  app.post(
    '/api/v1/auth/verification-code',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '10 minutes'
        }
      }
    },
    async (request, reply) => {
      const result = verificationRequestSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!result.success) {
        return validationError(reply, result)
      }

      if (
        isProduction &&
        (!app.config?.verificationCodeSecret || !app.config?.smtpUrl)
      ) {
        return responseError(reply, 503, '注册邮件服务尚未配置')
      }

      const { email } = result.data
      const existingUser = db
        .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
        .get(email)
      if (existingUser) {
        return responseError(reply, 409, '该邮箱已注册')
      }

      const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
      const now = new Date().toISOString()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const id = randomUUID()

      const replaceCode = db.transaction(() => {
        db.prepare(
          `UPDATE verification_codes
          SET consumed_at = ?
          WHERE email = ? COLLATE NOCASE
            AND purpose = 'register'
            AND consumed_at IS NULL`
        ).run(now, email)
        db.prepare(
          `INSERT INTO verification_codes (
            id, email, purpose, code_hash, expires_at, created_at
          ) VALUES (?, ?, 'register', ?, ?, ?)`
        ).run(
          id,
          email,
          verificationDigest(verificationSecret, email, code),
          expiresAt,
          now
        )
      })
      replaceCode()

      if (isProduction) {
        try {
          await mailProvider.sendVerificationCode({ email, code, expiresAt })
        } catch (error) {
          db.prepare(
            `UPDATE verification_codes
             SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL`
          ).run(new Date().toISOString(), id)
          request.log.error(
            { err: error },
            'Registration verification email delivery failed'
          )
          return responseError(reply, 503, '验证码邮件发送失败，请稍后重试')
        }
      }

      // Local development intentionally exposes the code so the repository
      // remains self-contained. Production sends it through SMTP only.
      return responseData(
        reply,
        isProduction ? { expiresAt } : { expiresAt, developmentCode: code },
        '验证码已发送'
      )
    }
  )

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

      const verification = db
        .prepare(
          `SELECT id, code_hash, expires_at, attempts
          FROM verification_codes
          WHERE email = ? COLLATE NOCASE
            AND purpose = 'register'
            AND consumed_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1`
        )
        .get(input.email)
      const providedDigest = verificationDigest(
        verificationSecret,
        input.email,
        input.verificationCode
      )
      const verificationValid =
        verification &&
        verification.expires_at > new Date().toISOString() &&
        verification.attempts < 10 &&
        safeDigestEqual(providedDigest, verification.code_hash)

      if (!verificationValid) {
        if (verification) {
          db.prepare(
            `UPDATE verification_codes
            SET attempts = MIN(attempts + 1, 10)
            WHERE id = ?`
          ).run(verification.id)
        }
        return responseError(reply, 400, '验证码无效或已过期')
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

          if (input.role === 'teacher') {
            db.prepare(
              `INSERT INTO teacher_profiles (
                user_id, school, title, experience_years,
                specialties_json, certificates_json, teaching_style_json,
                languages_json, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(
              userId,
              input.school ?? '',
              input.title ?? '国际中文教师',
              input.experienceYears ?? 0,
              JSON.stringify(input.specialties ?? []),
              JSON.stringify(input.certificates ?? []),
              JSON.stringify(input.teachingStyle ?? []),
              JSON.stringify(input.languages ?? ['中文']),
              createdAt,
              createdAt
            )
          }

          const consumeResult = db
            .prepare(
              `UPDATE verification_codes
              SET consumed_at = ?
              WHERE id = ? AND consumed_at IS NULL`
            )
            .run(createdAt, verification.id)
          if (consumeResult.changes !== 1) {
            throw new Error('VERIFICATION_CODE_ALREADY_USED')
          }

          return createSession(db, userId, {
            ttlSeconds: app.sessionTtlSeconds,
            ...sessionMetadata(request)
          })
        })

        session = createUserAndSession()
      } catch (error) {
        if (error?.message === 'VERIFICATION_CODE_ALREADY_USED') {
          return responseError(reply, 409, '验证码已被使用，请重新获取')
        }
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
