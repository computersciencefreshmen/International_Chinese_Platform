import { z } from 'zod'

const idSchema = z
  .object({ id: z.string().uuid('通知 ID 格式不正确') })
  .strict()

const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['all', 'unread', 'read']).default('all'),
    type: z.string().trim().min(1).max(80).optional()
  })
  .strict()

function responseData(reply, data, message = '操作成功') {
  return reply.send({ code: 0, msg: message, data })
}

function responseError(reply, statusCode, message, data = null) {
  return reply.code(statusCode).send({ code: statusCode, msg: message, data })
}

function validationError(reply, result) {
  return responseError(reply, 400, '请求参数不正确', {
    errors: result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }))
  })
}

function notificationData(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    resourceType: row.resource_type ?? null,
    resourceId: row.resource_id ?? null,
    link: row.link ?? null,
    readAt: row.read_at ?? null,
    isRead: Boolean(row.read_at),
    createdAt: row.created_at
  }
}

export async function notificationRoutes(app) {
  const db = app.db
  if (!db) throw new Error('notificationRoutes requires app.db')

  app.get(
    '/api/v1/notifications',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = listSchema.safeParse(request.query ?? {})
      if (!result.success) return validationError(reply, result)

      const { page, pageSize, status, type } = result.data
      const conditions = ['user_id = ?']
      const parameters = [request.auth.user.id]

      if (status === 'unread') conditions.push('read_at IS NULL')
      if (status === 'read') conditions.push('read_at IS NOT NULL')
      if (type) {
        conditions.push('type = ?')
        parameters.push(type)
      }

      const where = `WHERE ${conditions.join(' AND ')}`
      const total = Number(
        (
          await db
            .prepare(`SELECT COUNT(*) AS count FROM notifications ${where}`)
            .get(...parameters)
        ).count
      )
      const unread = Number(
        (
          await db
            .prepare(
              'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND read_at IS NULL'
            )
            .get(request.auth.user.id)
        ).count
      )
      const rows = await db
        .prepare(
          `SELECT * FROM notifications
           ${where}
           ORDER BY created_at DESC, id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        items: rows.map(notificationData),
        unread,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
        }
      })
    }
  )

  app.patch(
    '/api/v1/notifications/:id/read',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = idSchema.safeParse(request.params)
      if (!result.success) return validationError(reply, result)

      const notification = await db
        .prepare(
          'SELECT * FROM notifications WHERE id = ? AND user_id = ? LIMIT 1'
        )
        .get(result.data.id, request.auth.user.id)
      if (!notification) return responseError(reply, 404, '通知不存在')

      if (!notification.read_at) {
        const readAt = new Date().toISOString()
        await db
          .prepare(
            `UPDATE notifications
           SET read_at = ?
           WHERE id = ? AND user_id = ? AND read_at IS NULL`
          )
          .run(readAt, notification.id, request.auth.user.id)
        notification.read_at = readAt
      }

      return responseData(reply, notificationData(notification), '通知已读')
    }
  )

  app.post(
    '/api/v1/notifications/read-all',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const readAt = new Date().toISOString()
      const updated = await db
        .prepare(
          `UPDATE notifications
           SET read_at = ?
           WHERE user_id = ? AND read_at IS NULL`
        )
        .run(readAt, request.auth.user.id)

      return responseData(
        reply,
        { updated: updated.changes, unread: 0 },
        updated.changes > 0 ? '全部通知已读' : '没有未读通知'
      )
    }
  )
}

export default notificationRoutes
