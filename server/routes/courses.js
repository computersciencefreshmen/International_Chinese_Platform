import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { SESSION_COOKIE_NAME } from '../lib/session.js'

const courseStatuses = ['draft', 'pending', 'published', 'rejected', 'archived']

const courseStatusSchema = z.enum(courseStatuses)
const courseLevelSchema = z.enum([
  'beginner',
  'elementary',
  'intermediate',
  'advanced',
  'all'
])

const nullablePathSchema = z
  .union([z.string().trim().max(2048), z.null()])
  .transform((value) => (value === '' ? null : value))

const courseFields = {
  title: z.string().trim().min(1, '课程名称不能为空').max(160),
  summary: z.string().trim().max(500).default(''),
  description: z.string().trim().max(30000).default(''),
  level: courseLevelSchema.default('beginner'),
  category: z.string().trim().min(1).max(80).default('general'),
  coverUrl: nullablePathSchema.optional(),
  durationMinutes: z.coerce.number().int().min(1).max(1440).default(60),
  priceCents: z.coerce.number().int().min(0).max(100000000).default(0),
  capacity: z.coerce.number().int().min(1).max(10000).default(30)
}

const createCourseSchema = z.object(courseFields).strict()

const updateCourseSchema = z
  .object({
    title: courseFields.title.optional(),
    summary: z.string().trim().max(500).optional(),
    description: z.string().trim().max(30000).optional(),
    level: courseLevelSchema.optional(),
    category: z.string().trim().min(1).max(80).optional(),
    coverUrl: nullablePathSchema.optional(),
    durationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    priceCents: z.coerce.number().int().min(0).max(100000000).optional(),
    capacity: z.coerce.number().int().min(1).max(10000).optional()
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: '至少需要提供一个可修改字段'
  })

const listCoursesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().min(1).max(80).optional(),
    status: courseStatusSchema.optional()
  })
  .strict()

const courseIdParamsSchema = z.object({
  id: z.string().uuid('课程 ID 格式不正确')
})

const courseSelect = `
  SELECT
    c.*,
    u.display_name AS teacher_name,
    u.avatar_url AS teacher_avatar_url,
    tp.school AS teacher_school,
    tp.title AS teacher_title,
    tp.rating AS teacher_rating
  FROM courses AS c
  INNER JOIN users AS u ON u.id = c.teacher_id
  LEFT JOIN teacher_profiles AS tp ON tp.user_id = c.teacher_id
`

function responseData(reply, data, message = '操作成功', statusCode = 200) {
  return reply.code(statusCode).send({ code: 0, msg: message, data })
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

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&')
}

function pagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
  }
}

export function courseFromRow(row) {
  if (!row) return null

  return {
    id: row.id,
    teacherId: row.teacher_id,
    teacher: {
      id: row.teacher_id,
      displayName: row.teacher_name ?? '',
      avatarUrl: row.teacher_avatar_url ?? null,
      school: row.teacher_school ?? '',
      title: row.teacher_title ?? '',
      rating: row.teacher_rating ?? null
    },
    title: row.title,
    summary: row.summary,
    description: row.description,
    level: row.level,
    category: row.category,
    coverUrl: row.cover_url ?? null,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    capacity: row.capacity,
    status: row.status,
    rejectionReason: row.rejection_reason ?? null,
    publishedAt: row.published_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function reviewFromRow(row) {
  if (!row) return null

  return {
    id: row.id,
    courseId: row.course_id,
    reviewerId: row.reviewer_id,
    decision: row.decision,
    note: row.review_note,
    createdAt: row.created_at
  }
}

function hasAuthenticationCredential(request) {
  return Boolean(
    request.cookies?.[SESSION_COOKIE_NAME] || request.headers.authorization
  )
}

function optionalAuthentication(app) {
  return async (request, reply) => {
    if (hasAuthenticationCredential(request)) {
      await app.authenticate(request, reply)
    }
  }
}

function findCourse(db, courseId) {
  return db.prepare(`${courseSelect} WHERE c.id = ? LIMIT 1`).get(courseId)
}

function canReadUnpublishedCourse(request, course) {
  const user = request.auth?.user
  if (!user) return false
  if (user.role === 'administrator') return true

  return user.role === 'teacher' && user.id === course.teacher_id
}

export async function courseRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('courseRoutes requires app.db')
  }

  app.get(
    '/api/v1/courses',
    { preHandler: optionalAuthentication(app) },
    async (request, reply) => {
      const result = listCoursesQuerySchema.safeParse(request.query ?? {})
      if (!result.success) {
        return validationError(reply, result)
      }

      const { page, pageSize, search, category, status } = result.data
      const user = request.auth?.user
      const where = []
      const parameters = []

      if (!user || user.role === 'student') {
        where.push("c.status = 'published'")
      } else if (user.role === 'teacher') {
        where.push('c.teacher_id = ?')
        parameters.push(user.id)
        if (status) {
          where.push('c.status = ?')
          parameters.push(status)
        }
      } else if (status) {
        where.push('c.status = ?')
        parameters.push(status)
      }

      if (category) {
        where.push('c.category = ?')
        parameters.push(category)
      }

      if (search) {
        const pattern = `%${escapeLike(search)}%`
        where.push(
          "(c.title LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')"
        )
        parameters.push(pattern, pattern, pattern)
      }

      const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
      const total = db
        .prepare(
          `SELECT COUNT(*) AS count
          FROM courses AS c
          INNER JOIN users AS u ON u.id = c.teacher_id
          ${whereClause}`
        )
        .get(...parameters).count
      const items = db
        .prepare(
          `${courseSelect}
          ${whereClause}
          ORDER BY
            CASE c.status
              WHEN 'pending' THEN 0
              WHEN 'rejected' THEN 1
              WHEN 'draft' THEN 2
              WHEN 'published' THEN 3
              ELSE 4
            END,
            COALESCE(c.published_at, c.updated_at) DESC,
            c.id DESC
          LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)
        .map(courseFromRow)

      return responseData(reply, {
        items,
        pagination: pagination(page, pageSize, total)
      })
    }
  )

  app.get(
    '/api/v1/courses/:id',
    { preHandler: optionalAuthentication(app) },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return validationError(reply, paramsResult)
      }

      const course = findCourse(db, paramsResult.data.id)
      if (!course) {
        return responseError(reply, 404, '课程不存在')
      }

      if (
        course.status !== 'published' &&
        !canReadUnpublishedCourse(request, course)
      ) {
        if (request.auth?.user?.role === 'teacher') {
          return responseError(reply, 403, '没有权限访问该课程')
        }

        return responseError(reply, 404, '课程不存在')
      }

      const data = courseFromRow(course)
      if (canReadUnpublishedCourse(request, course)) {
        const latestReview = db
          .prepare(
            `SELECT * FROM course_reviews
            WHERE course_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1`
          )
          .get(course.id)
        data.latestReview = reviewFromRow(latestReview)
      }

      return responseData(reply, data)
    }
  )

  app.post(
    '/api/v1/courses',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const result = createCourseSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const input = result.data
      const id = randomUUID()
      const now = new Date().toISOString()
      db.prepare(
        `INSERT INTO courses (
          id, teacher_id, title, summary, description, level, category,
          cover_url, duration_minutes, price_cents, capacity, status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
      ).run(
        id,
        request.auth.user.id,
        input.title,
        input.summary,
        input.description,
        input.level,
        input.category,
        input.coverUrl ?? null,
        input.durationMinutes,
        input.priceCents,
        input.capacity,
        now,
        now
      )

      return responseData(
        reply,
        courseFromRow(findCourse(db, id)),
        '课程草稿已创建',
        201
      )
    }
  )

  app.patch(
    '/api/v1/courses/:id',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return validationError(reply, paramsResult)
      }

      const result = updateCourseSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const course = findCourse(db, paramsResult.data.id)
      if (!course) {
        return responseError(reply, 404, '课程不存在')
      }
      if (course.teacher_id !== request.auth.user.id) {
        return responseError(reply, 403, '只能修改自己的课程')
      }
      if (!['draft', 'rejected'].includes(course.status)) {
        return responseError(reply, 409, '当前状态不允许修改课程', {
          currentStatus: course.status,
          allowedStatuses: ['draft', 'rejected']
        })
      }

      const columnMap = {
        title: 'title',
        summary: 'summary',
        description: 'description',
        level: 'level',
        category: 'category',
        coverUrl: 'cover_url',
        durationMinutes: 'duration_minutes',
        priceCents: 'price_cents',
        capacity: 'capacity'
      }
      const assignments = []
      const values = []

      for (const [field, column] of Object.entries(columnMap)) {
        if (result.data[field] !== undefined) {
          assignments.push(`${column} = ?`)
          values.push(result.data[field])
        }
      }

      assignments.push('updated_at = ?')
      values.push(new Date().toISOString(), course.id)
      db.prepare(
        `UPDATE courses SET ${assignments.join(', ')} WHERE id = ?`
      ).run(...values)

      return responseData(
        reply,
        courseFromRow(findCourse(db, course.id)),
        '课程已更新'
      )
    }
  )

  app.post(
    '/api/v1/courses/:id/submit',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return validationError(reply, paramsResult)
      }

      const course = findCourse(db, paramsResult.data.id)
      if (!course) {
        return responseError(reply, 404, '课程不存在')
      }
      if (course.teacher_id !== request.auth.user.id) {
        return responseError(reply, 403, '只能提交自己的课程')
      }
      if (!['draft', 'rejected'].includes(course.status)) {
        return responseError(reply, 409, '当前状态不允许提交审核', {
          currentStatus: course.status,
          allowedStatuses: ['draft', 'rejected']
        })
      }

      const submittedAt = new Date().toISOString()
      const auditId = randomUUID()
      const notifyAdministrators = db.transaction(() => {
        const updated = db
          .prepare(
            `UPDATE courses
            SET status = 'pending', rejection_reason = NULL, updated_at = ?
            WHERE id = ? AND teacher_id = ? AND status IN ('draft', 'rejected')`
          )
          .run(submittedAt, course.id, request.auth.user.id)

        if (updated.changes !== 1) {
          throw new Error('COURSE_STATE_CHANGED')
        }

        db.prepare(
          `INSERT INTO audit_logs (
            id, actor_id, action, entity_type, entity_id, details_json,
            request_id, ip_address, user_agent, created_at
          ) VALUES (?, ?, 'course.submitted', 'course', ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          request.auth.user.id,
          course.id,
          JSON.stringify({
            previousStatus: course.status,
            nextStatus: 'pending'
          }),
          request.id ?? null,
          request.ip ?? null,
          request.headers['user-agent'] ?? null,
          submittedAt
        )

        const administrators = db
          .prepare(
            "SELECT id FROM users WHERE role = 'administrator' AND status = 'active'"
          )
          .all()
        const insertNotification = db.prepare(
          `INSERT INTO notifications (
            id, user_id, type, title, body, resource_type, resource_id, link,
            dedupe_key, created_at
          ) VALUES (?, ?, 'course.submitted', ?, ?, 'course', ?, ?, ?, ?)`
        )

        for (const administrator of administrators) {
          const notificationId = randomUUID()
          insertNotification.run(
            notificationId,
            administrator.id,
            '有新课程待审核',
            `课程「${course.title}」已提交审核。`,
            course.id,
            `/administrator/auditCenter?courseId=${course.id}`,
            `course:${course.id}:submitted:${auditId}:${administrator.id}`,
            submittedAt
          )
        }
      })

      try {
        notifyAdministrators()
      } catch (error) {
        if (error?.message === 'COURSE_STATE_CHANGED') {
          return responseError(reply, 409, '课程状态已变化，请刷新后重试')
        }
        throw error
      }

      return responseData(
        reply,
        courseFromRow(findCourse(db, course.id)),
        '课程已提交审核'
      )
    }
  )
}

export default courseRoutes
