import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { courseFromRow, reviewFromRow } from './courses.js'

const courseStatusSchema = z.enum([
  'draft',
  'pending',
  'published',
  'rejected',
  'archived'
])

const reviewQueueQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    status: courseStatusSchema.default('pending'),
    search: z.string().trim().max(100).optional()
  })
  .strict()

const courseIdParamsSchema = z.object({
  courseId: z.string().uuid('课程 ID 格式不正确')
})

const reviewActionSchema = z
  .object({
    action: z.enum(['approve', 'reject']),
    note: z.string().trim().max(2000).default('')
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'reject' && value.note.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: '驳回课程时必须填写审核意见'
      })
    }
  })

const adminCourseColumns = `
  c.*,
  u.display_name AS teacher_name,
  u.avatar_url AS teacher_avatar_url,
  tp.school AS teacher_school,
  tp.title AS teacher_title,
  tp.rating AS teacher_rating
`

const adminCourseFrom = `
  FROM courses AS c
  INNER JOIN users AS u ON u.id = c.teacher_id
  LEFT JOIN teacher_profiles AS tp ON tp.user_id = c.teacher_id
`

const adminCourseSelect = `SELECT ${adminCourseColumns} ${adminCourseFrom}`

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

function queueItemFromRow(row) {
  const latestReview = row.latest_review_id
    ? reviewFromRow({
        id: row.latest_review_id,
        course_id: row.id,
        reviewer_id: row.latest_reviewer_id,
        decision: row.latest_review_decision,
        review_note: row.latest_review_note,
        created_at: row.latest_review_created_at
      })
    : null

  return {
    course: courseFromRow(row),
    submittedAt: row.updated_at,
    latestReview
  }
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

export async function adminRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('adminRoutes requires app.db')
  }

  app.get(
    '/api/v1/admin/course-reviews',
    { preHandler: app.requireRole('administrator') },
    async (request, reply) => {
      const result = reviewQueueQuerySchema.safeParse(request.query ?? {})
      if (!result.success) {
        return validationError(reply, result)
      }

      const { page, pageSize, status, search } = result.data
      const where = ['c.status = ?']
      const parameters = [status]
      if (search) {
        const pattern = `%${escapeLike(search)}%`
        where.push(
          "(c.title LIKE ? ESCAPE '\\' OR c.summary LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')"
        )
        parameters.push(pattern, pattern, pattern)
      }

      const whereClause = `WHERE ${where.join(' AND ')}`
      const total = db
        .prepare(
          `SELECT COUNT(*) AS count
          FROM courses AS c
          INNER JOIN users AS u ON u.id = c.teacher_id
          ${whereClause}`
        )
        .get(...parameters).count
      const rows = db
        .prepare(
          `SELECT ${adminCourseColumns},
            (
              SELECT cr.id FROM course_reviews AS cr
              WHERE cr.course_id = c.id
              ORDER BY cr.created_at DESC, cr.id DESC LIMIT 1
            ) AS latest_review_id,
            (
              SELECT cr.reviewer_id FROM course_reviews AS cr
              WHERE cr.course_id = c.id
              ORDER BY cr.created_at DESC, cr.id DESC LIMIT 1
            ) AS latest_reviewer_id,
            (
              SELECT cr.decision FROM course_reviews AS cr
              WHERE cr.course_id = c.id
              ORDER BY cr.created_at DESC, cr.id DESC LIMIT 1
            ) AS latest_review_decision,
            (
              SELECT cr.review_note FROM course_reviews AS cr
              WHERE cr.course_id = c.id
              ORDER BY cr.created_at DESC, cr.id DESC LIMIT 1
            ) AS latest_review_note,
            (
              SELECT cr.created_at FROM course_reviews AS cr
              WHERE cr.course_id = c.id
              ORDER BY cr.created_at DESC, cr.id DESC LIMIT 1
            ) AS latest_review_created_at
          ${adminCourseFrom}
          ${whereClause}
          ORDER BY c.updated_at ASC, c.id ASC
          LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        items: rows.map(queueItemFromRow),
        pagination: pagination(page, pageSize, total)
      })
    }
  )

  app.post(
    '/api/v1/admin/course-reviews/:courseId',
    { preHandler: app.requireRole('administrator') },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return validationError(reply, paramsResult)
      }

      const bodyResult = reviewActionSchema.safeParse(unwrapBody(request.body))
      if (!bodyResult.success) {
        return validationError(reply, bodyResult)
      }

      const courseId = paramsResult.data.courseId
      const { action, note } = bodyResult.data
      const nextStatus = action === 'approve' ? 'published' : 'rejected'
      const decision = action === 'approve' ? 'approved' : 'rejected'
      const reviewedAt = new Date().toISOString()
      const reviewId = randomUUID()
      const notificationId = randomUUID()
      const auditId = randomUUID()

      const reviewCourse = db.transaction(() => {
        const course = db
          .prepare('SELECT * FROM courses WHERE id = ? LIMIT 1')
          .get(courseId)

        if (!course) {
          throw new Error('COURSE_NOT_FOUND')
        }
        if (course.status !== 'pending') {
          const error = new Error('COURSE_NOT_PENDING')
          error.currentStatus = course.status
          throw error
        }

        const updateResult = db
          .prepare(
            `UPDATE courses
            SET status = ?, rejection_reason = ?, published_at = ?, updated_at = ?
            WHERE id = ? AND status = 'pending'`
          )
          .run(
            nextStatus,
            action === 'reject' ? note : null,
            action === 'approve' ? reviewedAt : null,
            reviewedAt,
            courseId
          )

        if (updateResult.changes !== 1) {
          throw new Error('COURSE_STATE_CHANGED')
        }

        db.prepare(
          `INSERT INTO course_reviews (
            id, course_id, reviewer_id, decision, review_note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          reviewId,
          courseId,
          request.auth.user.id,
          decision,
          note,
          reviewedAt
        )

        db.prepare(
          `INSERT INTO notifications (
            id, user_id, type, title, body, resource_type, resource_id, link,
            dedupe_key, created_at
          ) VALUES (?, ?, ?, ?, ?, 'course', ?, ?, ?, ?)`
        ).run(
          notificationId,
          course.teacher_id,
          `course.${decision}`,
          action === 'approve' ? '课程审核已通过' : '课程审核未通过',
          action === 'approve'
            ? `课程「${course.title}」已发布，学生现在可以查看。`
            : `课程「${course.title}」需要修改：${note}`,
          courseId,
          `/teacher/onlineCourses?courseId=${courseId}`,
          `course:${courseId}:review:${reviewId}`,
          reviewedAt
        )

        db.prepare(
          `INSERT INTO audit_logs (
            id, actor_id, action, entity_type, entity_id, details_json,
            request_id, ip_address, user_agent, created_at
          ) VALUES (?, ?, ?, 'course', ?, ?, ?, ?, ?, ?)`
        ).run(
          auditId,
          request.auth.user.id,
          `course.${decision}`,
          courseId,
          JSON.stringify({
            previousStatus: 'pending',
            nextStatus,
            reviewId,
            note
          }),
          request.id ?? null,
          request.ip ?? null,
          request.headers['user-agent'] ?? null,
          reviewedAt
        )
      })

      try {
        reviewCourse()
      } catch (error) {
        if (error?.message === 'COURSE_NOT_FOUND') {
          return responseError(reply, 404, '课程不存在')
        }
        if (error?.message === 'COURSE_NOT_PENDING') {
          return responseError(reply, 409, '只能审核待审核状态的课程', {
            currentStatus: error.currentStatus,
            requiredStatus: 'pending'
          })
        }
        if (error?.message === 'COURSE_STATE_CHANGED') {
          return responseError(reply, 409, '课程状态已变化，请刷新后重试')
        }
        throw error
      }

      const course = db
        .prepare(`${adminCourseSelect} WHERE c.id = ? LIMIT 1`)
        .get(courseId)
      const review = db
        .prepare('SELECT * FROM course_reviews WHERE id = ? LIMIT 1')
        .get(reviewId)

      return responseData(
        reply,
        {
          course: courseFromRow(course),
          review: reviewFromRow(review)
        },
        action === 'approve' ? '课程已审核通过' : '课程已驳回'
      )
    }
  )

  app.get(
    '/api/v1/admin/metrics',
    { preHandler: app.requireRole('administrator') },
    async (_request, reply) => {
      const users = db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(role = 'student'), 0) AS students,
            COALESCE(SUM(role = 'teacher'), 0) AS teachers,
            COALESCE(SUM(role = 'administrator'), 0) AS administrators,
            COALESCE(SUM(status = 'active'), 0) AS active,
            COALESCE(SUM(status = 'disabled'), 0) AS disabled
          FROM users`
        )
        .get()
      const courses = db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(status = 'draft'), 0) AS draft,
            COALESCE(SUM(status = 'pending'), 0) AS pending,
            COALESCE(SUM(status = 'published'), 0) AS published,
            COALESCE(SUM(status = 'rejected'), 0) AS rejected,
            COALESCE(SUM(status = 'archived'), 0) AS archived
          FROM courses`
        )
        .get()
      const learning = db
        .prepare(
          `SELECT
            (SELECT COUNT(*) FROM appointments) AS appointments,
            (SELECT COUNT(*) FROM appointments
              WHERE status IN ('pending', 'accepted')) AS active_appointments,
            (SELECT COUNT(*) FROM assignments) AS assignments,
            (SELECT COUNT(*) FROM submissions) AS submissions,
            (SELECT COUNT(*) FROM submissions
              WHERE status = 'submitted') AS pending_grading`
        )
        .get()
      const reviews = db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(decision = 'approved'), 0) AS approved,
            COALESCE(SUM(decision = 'rejected'), 0) AS rejected
          FROM course_reviews`
        )
        .get()
      const recentActivity = db
        .prepare(
          `SELECT
            a.id,
            a.actor_id,
            a.action,
            a.entity_type,
            a.entity_id,
            a.details_json,
            a.created_at,
            u.display_name AS actor_name,
            u.role AS actor_role
          FROM audit_logs AS a
          LEFT JOIN users AS u ON u.id = a.actor_id
          ORDER BY a.created_at DESC, a.id DESC
          LIMIT 20`
        )
        .all()
        .map((row) => ({
          id: row.id,
          actorId: row.actor_id ?? null,
          actorName: row.actor_name ?? '系统',
          actorRole: row.actor_role ?? null,
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id ?? null,
          details: parseJsonObject(row.details_json),
          createdAt: row.created_at
        }))

      return responseData(reply, {
        users,
        courses,
        learning: {
          appointments: learning.appointments,
          activeAppointments: learning.active_appointments,
          assignments: learning.assignments,
          submissions: learning.submissions,
          pendingGrading: learning.pending_grading
        },
        reviews,
        recentActivity,
        generatedAt: new Date().toISOString()
      })
    }
  )
}

export default adminRoutes
