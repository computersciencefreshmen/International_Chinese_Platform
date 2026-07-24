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

const teacherVerificationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(12),
    status: z.enum(['pending', 'verified']).default('pending'),
    search: z.string().trim().max(100).optional()
  })
  .strict()

const teacherIdParamsSchema = z.object({
  teacherId: z.string().uuid('教师 ID 格式不正确')
})

const teacherVerificationActionSchema = z
  .object({
    action: z.enum(['approve', 'revoke']),
    note: z.string().trim().max(2000).default('')
  })
  .strict()
  .superRefine((value, context) => {
    if (value.action === 'revoke' && value.note.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['note'],
        message: '撤销教师认证时必须填写原因'
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

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const adminTeacherSelect = `
  SELECT
    u.id,
    u.email,
    u.display_name,
    u.avatar_url,
    u.country,
    u.region,
    u.status AS account_status,
    u.created_at,
    u.updated_at,
    tp.school,
    tp.title,
    tp.experience_years,
    tp.specialties_json,
    tp.certificates_json,
    tp.languages_json,
    tp.verified_at,
    tp.updated_at AS profile_updated_at
  FROM users AS u
  LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
`

function teacherVerificationFromRow(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? null,
    country: row.country ?? null,
    region: row.region ?? null,
    accountStatus: row.account_status,
    school: row.school ?? '',
    title: row.title ?? '',
    experienceYears: Number(row.experience_years ?? 0),
    specialties: parseJsonArray(row.specialties_json),
    certificates: parseJsonArray(row.certificates_json),
    languages: parseJsonArray(row.languages_json),
    verificationStatus: row.verified_at ? 'verified' : 'pending',
    verifiedAt: row.verified_at ?? null,
    registeredAt: row.created_at,
    updatedAt: row.profile_updated_at ?? row.updated_at
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
      const total = (
        await db
          .prepare(
            `SELECT COUNT(*) AS count
          FROM courses AS c
          INNER JOIN users AS u ON u.id = c.teacher_id
          ${whereClause}`
          )
          .get(...parameters)
      ).count
      const rows = await db
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

      const reviewCourse = db.transaction(async () => {
        const course = await db
          .prepare(
            `SELECT c.*, u.status AS teacher_account_status,
                    tp.verified_at AS teacher_verified_at
             FROM courses AS c
             INNER JOIN users AS u ON u.id = c.teacher_id
             LEFT JOIN teacher_profiles AS tp ON tp.user_id = c.teacher_id
             WHERE c.id = ?
             LIMIT 1`
          )
          .get(courseId)

        if (!course) {
          throw new Error('COURSE_NOT_FOUND')
        }
        if (course.status !== 'pending') {
          const error = new Error('COURSE_NOT_PENDING')
          error.currentStatus = course.status
          throw error
        }
        if (
          action === 'approve' &&
          (course.teacher_account_status !== 'active' ||
            !course.teacher_verified_at)
        ) {
          throw new Error('COURSE_TEACHER_NOT_VERIFIED')
        }

        const updateResult = await db
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

        await db
          .prepare(
            `INSERT INTO course_reviews (
            id, course_id, reviewer_id, decision, review_note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run(
            reviewId,
            courseId,
            request.auth.user.id,
            decision,
            note,
            reviewedAt
          )

        await db
          .prepare(
            `INSERT INTO notifications (
            id, user_id, type, title, body, resource_type, resource_id, link,
            dedupe_key, created_at
          ) VALUES (?, ?, ?, ?, ?, 'course', ?, ?, ?, ?)`
          )
          .run(
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

        await db
          .prepare(
            `INSERT INTO audit_logs (
            id, actor_id, action, entity_type, entity_id, details_json,
            request_id, ip_address, user_agent, created_at
          ) VALUES (?, ?, ?, 'course', ?, ?, ?, ?, ?, ?)`
          )
          .run(
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
        await reviewCourse()
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
        if (error?.message === 'COURSE_TEACHER_NOT_VERIFIED') {
          return responseError(
            reply,
            409,
            '课程教师当前未通过平台认证，不能批准发布'
          )
        }
        if (error?.message === 'COURSE_STATE_CHANGED') {
          return responseError(reply, 409, '课程状态已变化，请刷新后重试')
        }
        throw error
      }

      const course = await db
        .prepare(`${adminCourseSelect} WHERE c.id = ? LIMIT 1`)
        .get(courseId)
      const review = await db
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
    '/api/v1/admin/teacher-verifications',
    { preHandler: app.requireRole('administrator') },
    async (request, reply) => {
      const result = teacherVerificationQuerySchema.safeParse(
        request.query ?? {}
      )
      if (!result.success) {
        return validationError(reply, result)
      }

      const { page, pageSize, status, search } = result.data
      const where = ["u.role = 'teacher'", "u.status = 'active'"]
      const parameters = []
      where.push(
        status === 'verified'
          ? 'tp.verified_at IS NOT NULL'
          : 'tp.verified_at IS NULL'
      )
      if (search) {
        const pattern = `%${escapeLike(search)}%`
        where.push(
          "(u.display_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR COALESCE(tp.school, '') LIKE ? ESCAPE '\\' OR COALESCE(tp.title, '') LIKE ? ESCAPE '\\')"
        )
        parameters.push(pattern, pattern, pattern, pattern)
      }

      const whereClause = `WHERE ${where.join(' AND ')}`
      const total = (
        await db
          .prepare(
            `SELECT COUNT(*) AS count
           FROM users AS u
           LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
           ${whereClause}`
          )
          .get(...parameters)
      ).count
      const rows = await db
        .prepare(
          `${adminTeacherSelect}
           ${whereClause}
           ORDER BY COALESCE(tp.updated_at, u.updated_at) ASC, u.id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        items: rows.map(teacherVerificationFromRow),
        pagination: pagination(page, pageSize, total)
      })
    }
  )

  app.post(
    '/api/v1/admin/teacher-verifications/:teacherId',
    { preHandler: app.requireRole('administrator') },
    async (request, reply) => {
      const paramsResult = teacherIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) {
        return validationError(reply, paramsResult)
      }

      const bodyResult = teacherVerificationActionSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!bodyResult.success) {
        return validationError(reply, bodyResult)
      }

      const teacherId = paramsResult.data.teacherId
      const { action, note } = bodyResult.data
      const decidedAt = new Date().toISOString()
      const auditId = randomUUID()
      const notificationId = randomUUID()
      const nextStatus = action === 'approve' ? 'verified' : 'pending'

      const decideVerification = db.transaction(async () => {
        const teacher = await db
          .prepare(
            `SELECT u.id, u.status, u.display_name, tp.verified_at
             FROM users AS u
             LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
             WHERE u.id = ? AND u.role = 'teacher'
             LIMIT 1`
          )
          .get(teacherId)

        if (!teacher) {
          throw new Error('TEACHER_NOT_FOUND')
        }
        if (teacher.status !== 'active') {
          throw new Error('TEACHER_DISABLED')
        }

        const currentStatus = teacher.verified_at ? 'verified' : 'pending'
        if (currentStatus === nextStatus) {
          const error = new Error('VERIFICATION_STATE_UNCHANGED')
          error.currentStatus = currentStatus
          throw error
        }

        if (action === 'approve') {
          await db
            .prepare(
              `INSERT INTO teacher_profiles (
              user_id, verified_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              verified_at = excluded.verified_at,
              updated_at = excluded.updated_at`
            )
            .run(teacherId, decidedAt, decidedAt, decidedAt)
        } else {
          await db
            .prepare(
              `UPDATE teacher_profiles
             SET verified_at = NULL, updated_at = ?
             WHERE user_id = ? AND verified_at IS NOT NULL`
            )
            .run(decidedAt, teacherId)
        }

        await db
          .prepare(
            `INSERT INTO notifications (
            id, user_id, type, title, body, resource_type, resource_id,
            link, dedupe_key, created_at
          ) VALUES (?, ?, ?, ?, ?, 'teacher', ?, ?, ?, ?)`
          )
          .run(
            notificationId,
            teacherId,
            `teacher.verification.${action === 'approve' ? 'approved' : 'revoked'}`,
            action === 'approve' ? '教师身份认证已通过' : '教师身份认证已撤销',
            action === 'approve'
              ? `您的教师身份已通过平台认证。${note ? `审核备注：${note}` : ''}`
              : `您的教师身份认证已撤销。原因：${note}`,
            teacherId,
            '/teacher/user',
            `teacher:${teacherId}:verification:${auditId}`,
            decidedAt
          )

        await db
          .prepare(
            `INSERT INTO audit_logs (
            id, actor_id, action, entity_type, entity_id, details_json,
            request_id, ip_address, user_agent, created_at
          ) VALUES (?, ?, ?, 'teacher', ?, ?, ?, ?, ?, ?)`
          )
          .run(
            auditId,
            request.auth.user.id,
            `teacher.verification.${action === 'approve' ? 'approved' : 'revoked'}`,
            teacherId,
            JSON.stringify({
              previousStatus: currentStatus,
              nextStatus,
              note
            }),
            request.id ?? null,
            request.ip ?? null,
            request.headers['user-agent'] ?? null,
            decidedAt
          )
      })

      try {
        await decideVerification()
      } catch (error) {
        if (error?.message === 'TEACHER_NOT_FOUND') {
          return responseError(reply, 404, '教师不存在')
        }
        if (error?.message === 'TEACHER_DISABLED') {
          return responseError(reply, 409, '教师账号已停用，不能变更认证状态')
        }
        if (error?.message === 'VERIFICATION_STATE_UNCHANGED') {
          return responseError(reply, 409, '教师认证状态未发生变化', {
            currentStatus: error.currentStatus,
            requiredAction:
              error.currentStatus === 'verified' ? 'revoke' : 'approve'
          })
        }
        throw error
      }

      const teacher = await db
        .prepare(`${adminTeacherSelect} WHERE u.id = ? LIMIT 1`)
        .get(teacherId)

      return responseData(
        reply,
        teacherVerificationFromRow(teacher),
        action === 'approve' ? '教师认证已通过' : '教师认证已撤销'
      )
    }
  )

  app.get(
    '/api/v1/admin/metrics',
    { preHandler: app.requireRole('administrator') },
    async (_request, reply) => {
      const users = await db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE role = 'student') AS students,
            COUNT(*) FILTER (WHERE role = 'teacher') AS teachers,
            COUNT(*) FILTER (WHERE role = 'administrator') AS administrators,
            COUNT(*) FILTER (WHERE status = 'active') AS active,
            COUNT(*) FILTER (WHERE status = 'disabled') AS disabled
          FROM users`
        )
        .get()
      const courses = await db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'draft') AS draft,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending,
            COUNT(*) FILTER (WHERE status = 'published') AS published,
            COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
            COUNT(*) FILTER (WHERE status = 'archived') AS archived
          FROM courses`
        )
        .get()
      const learning = await db
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
      const reviews = await db
        .prepare(
          `SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE decision = 'approved') AS approved,
            COUNT(*) FILTER (WHERE decision = 'rejected') AS rejected
          FROM course_reviews`
        )
        .get()
      const recentActivity = (
        await db
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
      ).map((row) => ({
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
