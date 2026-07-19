import { URL } from 'node:url'

import { z } from 'zod'

import { hashPassword, verifyPassword } from '../lib/password.js'
import {
  createSession,
  publicUser,
  revokeUserSessions,
  SESSION_COOKIE_NAME
} from '../lib/session.js'

const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) => value.startsWith('/') || URL.canParse(value),
    '头像地址格式不正确'
  )

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1, '昵称不能为空').max(80).optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
    country: z.string().trim().max(80).nullable().optional(),
    region: z.string().trim().max(120).nullable().optional(),
    age: z.coerce.number().int().min(6).max(120).nullable().optional(),
    chineseLevel: z
      .enum(['beginner', 'HSK1', 'HSK2', 'HSK3', 'HSK4', 'HSK5', 'HSK6'])
      .nullable()
      .optional(),
    bio: z.string().trim().max(500).optional()
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: '至少需要提供一个可修改字段'
  })

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, '请输入当前密码').max(128),
    newPassword: z
      .string()
      .min(8, '新密码至少需要 8 个字符')
      .max(128, '新密码不能超过 128 个字符')
      .regex(/[A-Za-z]/, '新密码至少需要包含一个字母')
      .regex(/\d/, '新密码至少需要包含一个数字'),
    confirmPassword: z.string().max(128).optional()
  })
  .refine(
    (value) =>
      !value.confirmPassword || value.confirmPassword === value.newPassword,
    {
      path: ['confirmPassword'],
      message: '两次输入的新密码不一致'
    }
  )

const profileColumnMap = {
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  country: 'country',
  region: 'region',
  age: 'age',
  chineseLevel: 'chinese_level',
  bio: 'bio'
}

function responseData(reply, data, message = '操作成功') {
  return reply.send({
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

export async function profileRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('profileRoutes requires app.db')
  }

  app.get(
    '/api/v1/me',
    { preHandler: app.authenticate },
    async (request, reply) => responseData(reply, request.auth.user)
  )

  app.patch(
    '/api/v1/me',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const rawBody = unwrapBody(request.body)
      const result = profileSchema.safeParse({
        ...rawBody,
        displayName: rawBody.displayName ?? rawBody.name,
        country: rawBody.country ?? rawBody.nationality,
        chineseLevel: rawBody.chineseLevel ?? rawBody.level
      })

      if (!result.success) {
        return validationError(reply, result)
      }

      const assignments = []
      const values = []

      for (const [field, column] of Object.entries(profileColumnMap)) {
        if (result.data[field] !== undefined) {
          assignments.push(`${column} = ?`)
          values.push(result.data[field])
        }
      }

      const updatedAt = new Date().toISOString()
      assignments.push('updated_at = ?')
      values.push(updatedAt, request.auth.user.id)

      db.prepare(`UPDATE users SET ${assignments.join(', ')} WHERE id = ?`).run(
        ...values
      )

      const user = db
        .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
        .get(request.auth.user.id)

      return responseData(reply, publicUser(user), '个人资料已更新')
    }
  )

  app.patch(
    '/api/v1/me/password',
    {
      preHandler: app.authenticate,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute'
        }
      }
    },
    async (request, reply) => {
      const rawBody = unwrapBody(request.body)
      const result = passwordSchema.safeParse({
        ...rawBody,
        currentPassword: rawBody.currentPassword ?? rawBody.oldPassword
      })

      if (!result.success) {
        return validationError(reply, result)
      }

      const user = db
        .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
        .get(request.auth.user.id)

      if (
        !user ||
        !(await verifyPassword(result.data.currentPassword, user.password_hash))
      ) {
        return responseError(reply, 400, '当前密码不正确')
      }

      if (await verifyPassword(result.data.newPassword, user.password_hash)) {
        return responseError(reply, 400, '新密码不能与当前密码相同')
      }

      const passwordHash = await hashPassword(result.data.newPassword)
      const updatedAt = new Date().toISOString()
      let replacementSession

      const rotatePasswordAndSessions = db.transaction(() => {
        const updateResult = db
          .prepare(
            `UPDATE users
            SET password_hash = ?, updated_at = ?
            WHERE id = ? AND password_hash = ?`
          )
          .run(passwordHash, updatedAt, user.id, user.password_hash)

        if (updateResult.changes !== 1) {
          throw new Error('PASSWORD_CHANGED_CONCURRENTLY')
        }

        revokeUserSessions(db, user.id)
        return createSession(db, user.id, {
          ttlSeconds: app.sessionTtlSeconds,
          ...sessionMetadata(request)
        })
      })

      try {
        replacementSession = rotatePasswordAndSessions()
      } catch (error) {
        if (error?.message === 'PASSWORD_CHANGED_CONCURRENTLY') {
          return responseError(reply, 409, '密码已发生变化，请重新登录后再试')
        }

        throw error
      }

      reply.setCookie(
        SESSION_COOKIE_NAME,
        replacementSession.token,
        app.sessionCookieOptions(replacementSession.ttlSeconds)
      )

      const updatedUser = db
        .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
        .get(user.id)

      return responseData(reply, publicUser(updatedUser), '密码已更新')
    }
  )
}

export default profileRoutes
