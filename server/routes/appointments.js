import { randomBytes, randomUUID } from 'node:crypto'

import { z } from 'zod'

const identifierSchema = z.string().trim().min(1).max(128)
const CLASSROOM_JOIN_EARLY_MS = 30 * 60 * 1000
const CLASSROOM_JOIN_GRACE_MS = 2 * 60 * 60 * 1000
const dateTimeSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), '日期时间格式不正确')

const createAppointmentSchema = z.object({
  teacherId: identifierSchema,
  courseId: z.preprocess(
    (value) => (value === '' ? null : value),
    identifierSchema.nullable().optional()
  ),
  topic: z.string().trim().min(1).max(160),
  message: z.string().trim().max(2000).default(''),
  scheduledStart: dateTimeSchema,
  durationMinutes: z.coerce.number().int().min(15).max(240).default(60)
})

const listAppointmentsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['pending', 'accepted', 'rejected', 'cancelled', 'completed'])
    .optional(),
  teacherId: identifierSchema.optional(),
  studentId: identifierSchema.optional(),
  courseId: identifierSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional()
})

const respondSchema = z.object({
  action: z.enum(['accept', 'reject']),
  note: z.string().trim().max(2000).default('')
})

const cancelSchema = z.object({
  reason: z.string().trim().max(500).default('')
})

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

function userSummary(row, prefix) {
  return {
    id: row[`${prefix}_id`],
    displayName: row[`${prefix}_display_name`],
    avatarUrl: row[`${prefix}_avatar_url`] ?? null,
    role: prefix
  }
}

function appointmentData(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    teacherId: row.teacher_id,
    courseId: row.course_id ?? null,
    scheduledStart: row.scheduled_start,
    scheduledEnd: row.scheduled_end,
    durationMinutes: Math.round(
      (Date.parse(row.scheduled_end) - Date.parse(row.scheduled_start)) / 60_000
    ),
    topic: row.topic,
    message: row.message,
    status: row.status,
    responseNote: row.response_note,
    student: userSummary(row, 'student'),
    teacher: userSummary(row, 'teacher'),
    course: row.course_id
      ? {
          id: row.course_id,
          title: row.course_title,
          level: row.course_level,
          category: row.course_category
        }
      : null,
    classroom: row.classroom_id
      ? {
          id: row.classroom_id,
          roomCode: row.room_code,
          status: row.classroom_status
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const appointmentSelect = `
  SELECT
    a.id,
    a.student_id,
    a.teacher_id,
    a.course_id,
    a.scheduled_start,
    a.scheduled_end,
    a.topic,
    a.message,
    a.status,
    a.response_note,
    a.created_at,
    a.updated_at,
    student.display_name AS student_display_name,
    student.avatar_url AS student_avatar_url,
    teacher.display_name AS teacher_display_name,
    teacher.avatar_url AS teacher_avatar_url,
    c.title AS course_title,
    c.level AS course_level,
    c.category AS course_category,
    classroom.id AS classroom_id,
    classroom.room_code,
    classroom.status AS classroom_status
  FROM appointments AS a
  INNER JOIN users AS student ON student.id = a.student_id
  INNER JOIN users AS teacher ON teacher.id = a.teacher_id
  LEFT JOIN courses AS c ON c.id = a.course_id
  LEFT JOIN classrooms AS classroom ON classroom.appointment_id = a.id
`

function findAppointment(db, appointmentId) {
  return db
    .prepare(`${appointmentSelect} WHERE a.id = ? LIMIT 1`)
    .get(appointmentId)
}

function insertNotification(
  db,
  { userId, type, title, body, appointmentId, link = null, dedupeKey }
) {
  db.prepare(
    `INSERT INTO notifications (
      id, user_id, type, title, body, resource_type, resource_id,
      link, dedupe_key
    ) VALUES (?, ?, ?, ?, ?, 'appointment', ?, ?, ?)`
  ).run(randomUUID(), userId, type, title, body, appointmentId, link, dedupeKey)
}

function insertAudit(db, request, { action, appointmentId, details = {} }) {
  db.prepare(
    `INSERT INTO audit_logs (
      id, actor_id, action, entity_type, entity_id, details_json,
      request_id, ip_address, user_agent
    ) VALUES (?, ?, ?, 'appointment', ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    request.auth.user.id,
    action,
    appointmentId,
    JSON.stringify(details),
    String(request.id ?? '').slice(0, 128) || null,
    String(request.ip ?? '').slice(0, 64) || null,
    String(request.headers['user-agent'] ?? '').slice(0, 512) || null
  )
}

function roomCode() {
  return randomBytes(12).toString('base64url')
}

function conflictError(error) {
  return (
    error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    /UNIQUE constraint failed/i.test(error?.message ?? '')
  )
}

function classroomJoinWindow(classroom, now = Date.now()) {
  const scheduledStart = Date.parse(classroom.scheduled_start)
  const scheduledEnd = Date.parse(classroom.scheduled_end)
  const opensAt = scheduledStart - CLASSROOM_JOIN_EARLY_MS
  const closesAt = scheduledEnd + CLASSROOM_JOIN_GRACE_MS

  if (!Number.isFinite(opensAt) || !Number.isFinite(closesAt)) {
    return { allowed: false, reason: 'INVALID_SCHEDULE' }
  }

  const window = {
    opensAt: new Date(opensAt).toISOString(),
    closesAt: new Date(closesAt).toISOString()
  }
  if (now < opensAt) return { allowed: false, reason: 'TOO_EARLY', ...window }
  if (now > closesAt) return { allowed: false, reason: 'TOO_LATE', ...window }
  return { allowed: true, ...window }
}

function isDevelopmentDemoClassroom(app, classroom) {
  return (
    app.config?.nodeEnv === 'development' &&
    classroom.room_code?.startsWith('demo-')
  )
}

function lifecycleFailure(code) {
  const error = new Error(code)
  error.lifecycleCode = code
  return error
}

export async function appointmentRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('appointmentRoutes requires app.db')
  }

  app.post(
    '/api/v1/appointments',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const result = createAppointmentSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const startTime = new Date(result.data.scheduledStart)
      const latestAllowed = Date.now() + 366 * 24 * 60 * 60 * 1000
      if (startTime.getTime() <= Date.now()) {
        return responseError(reply, 400, '预约时间必须晚于当前时间')
      }
      if (startTime.getTime() > latestAllowed) {
        return responseError(reply, 400, '预约时间不能超过未来一年')
      }

      const teacher = db
        .prepare(
          `SELECT u.id, tp.verified_at
           FROM users AS u
           LEFT JOIN teacher_profiles AS tp ON tp.user_id = u.id
           WHERE u.id = ? AND u.role = 'teacher' AND u.status = 'active'
           LIMIT 1`
        )
        .get(result.data.teacherId)
      if (!teacher) {
        return responseError(reply, 404, '教师不存在或当前不可预约')
      }
      if (!teacher.verified_at) {
        return responseError(reply, 409, '该教师尚未通过平台认证，暂不可预约', {
          verificationStatus: 'pending'
        })
      }

      const courseId = result.data.courseId ?? null
      if (courseId) {
        const course = db
          .prepare(
            `SELECT id FROM courses
             WHERE id = ? AND teacher_id = ? AND status = 'published'
             LIMIT 1`
          )
          .get(courseId, teacher.id)
        if (!course) {
          return responseError(reply, 400, '课程不存在、未发布或不属于该教师')
        }
      }

      const appointmentId = randomUUID()
      const scheduledStart = startTime.toISOString()
      const scheduledEnd = new Date(
        startTime.getTime() + result.data.durationMinutes * 60_000
      ).toISOString()
      const timestamp = new Date().toISOString()

      const createAppointment = db.transaction(() => {
        db.prepare(
          `INSERT INTO appointments (
            id, student_id, teacher_id, course_id, scheduled_start,
            scheduled_end, topic, message, status, response_note,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', ?, ?)`
        ).run(
          appointmentId,
          request.auth.user.id,
          teacher.id,
          courseId,
          scheduledStart,
          scheduledEnd,
          result.data.topic,
          result.data.message,
          timestamp,
          timestamp
        )

        insertNotification(db, {
          userId: teacher.id,
          type: 'appointment.requested',
          title: '收到新的课堂预约',
          body: `${request.auth.user.displayName} 预约了「${result.data.topic}」。`,
          appointmentId,
          link: '/teacher/teachingDocking',
          dedupeKey: `appointment:${appointmentId}:requested:${teacher.id}`
        })
        insertAudit(db, request, {
          action: 'appointment.requested',
          appointmentId,
          details: {
            teacherId: teacher.id,
            courseId,
            scheduledStart,
            scheduledEnd
          }
        })
      })

      try {
        createAppointment()
      } catch (error) {
        if (conflictError(error)) {
          return responseError(reply, 409, '相同时间的预约已经存在')
        }
        throw error
      }

      return responseData(
        reply,
        appointmentData(findAppointment(db, appointmentId)),
        '预约申请已提交',
        201
      )
    }
  )

  app.get(
    '/api/v1/appointments',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = listAppointmentsSchema.safeParse(request.query ?? {})
      if (!result.success) {
        return validationError(reply, result)
      }

      const filters = result.data
      const role = request.auth.user.role
      const userId = request.auth.user.id
      const conditions = []
      const parameters = []

      if (role === 'student') {
        if (filters.studentId && filters.studentId !== userId) {
          return responseError(reply, 403, '不能查看其他学生的预约')
        }
        conditions.push('a.student_id = ?')
        parameters.push(userId)
      } else if (role === 'teacher') {
        if (filters.teacherId && filters.teacherId !== userId) {
          return responseError(reply, 403, '不能查看其他教师的预约')
        }
        conditions.push('a.teacher_id = ?')
        parameters.push(userId)
      } else if (role !== 'administrator') {
        return responseError(reply, 403, '没有权限查看预约')
      }

      if (filters.status) {
        conditions.push('a.status = ?')
        parameters.push(filters.status)
      }
      if (filters.teacherId && role !== 'teacher') {
        conditions.push('a.teacher_id = ?')
        parameters.push(filters.teacherId)
      }
      if (filters.studentId && role !== 'student') {
        conditions.push('a.student_id = ?')
        parameters.push(filters.studentId)
      }
      if (filters.courseId) {
        conditions.push('a.course_id = ?')
        parameters.push(filters.courseId)
      }

      const from = filters.from ? new Date(filters.from).toISOString() : null
      const to = filters.to ? new Date(filters.to).toISOString() : null
      if (from && to && from >= to) {
        return responseError(reply, 400, '筛选结束时间必须晚于开始时间')
      }
      if (from) {
        conditions.push('a.scheduled_end > ?')
        parameters.push(from)
      }
      if (to) {
        conditions.push('a.scheduled_start < ?')
        parameters.push(to)
      }

      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      const total = db
        .prepare(`SELECT COUNT(*) AS count FROM appointments AS a ${where}`)
        .get(...parameters).count
      const offset = (filters.page - 1) * filters.pageSize
      const appointments = db
        .prepare(
          `${appointmentSelect}
           ${where}
           ORDER BY a.scheduled_start ASC, a.created_at DESC, a.id ASC
           LIMIT ? OFFSET ?`
        )
        .all(...parameters, filters.pageSize, offset)

      return responseData(reply, {
        items: appointments.map(appointmentData),
        pagination: {
          page: filters.page,
          pageSize: filters.pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize)
        }
      })
    }
  )

  app.patch(
    '/api/v1/appointments/:id/respond',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const result = respondSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const respond = db.transaction(() => {
        const appointment = db
          .prepare('SELECT * FROM appointments WHERE id = ? LIMIT 1')
          .get(request.params.id)

        if (!appointment) {
          return { error: 'NOT_FOUND' }
        }
        if (appointment.teacher_id !== request.auth.user.id) {
          return { error: 'FORBIDDEN' }
        }
        if (appointment.status !== 'pending') {
          return { error: 'INVALID_STATE', status: appointment.status }
        }

        if (result.data.action === 'accept') {
          const eligibleTeacher = db
            .prepare(
              `SELECT 1
               FROM users AS u
               INNER JOIN teacher_profiles AS tp ON tp.user_id = u.id
               WHERE u.id = ?
                 AND u.status = 'active'
                 AND tp.verified_at IS NOT NULL
               LIMIT 1`
            )
            .get(appointment.teacher_id)
          if (!eligibleTeacher) {
            return { error: 'TEACHER_NOT_VERIFIED' }
          }

          const conflict = db
            .prepare(
              `SELECT id, teacher_id, student_id FROM appointments
               WHERE (teacher_id = ? OR student_id = ?)
                 AND status = 'accepted'
                 AND id <> ?
                 AND scheduled_start < ?
                 AND scheduled_end > ?
               ORDER BY scheduled_start ASC
               LIMIT 1`
            )
            .get(
              appointment.teacher_id,
              appointment.student_id,
              appointment.id,
              appointment.scheduled_end,
              appointment.scheduled_start
            )
          if (conflict) {
            return {
              error: 'SCHEDULE_CONFLICT',
              conflictingAppointmentId: conflict.id,
              conflictingParticipant:
                conflict.teacher_id === appointment.teacher_id
                  ? 'teacher'
                  : 'student'
            }
          }
        }

        const timestamp = new Date().toISOString()
        const status = result.data.action === 'accept' ? 'accepted' : 'rejected'
        const updated = db
          .prepare(
            `UPDATE appointments
             SET status = ?, response_note = ?, updated_at = ?
             WHERE id = ? AND status = 'pending'`
          )
          .run(status, result.data.note, timestamp, appointment.id)
        if (updated.changes !== 1) {
          return { error: 'INVALID_STATE' }
        }

        let classroomId = null
        if (status === 'accepted') {
          classroomId = randomUUID()
          db.prepare(
            `INSERT INTO classrooms (
              id, appointment_id, room_code, status, created_at, updated_at
            ) VALUES (?, ?, ?, 'scheduled', ?, ?)`
          ).run(classroomId, appointment.id, roomCode(), timestamp, timestamp)

          insertNotification(db, {
            userId: appointment.student_id,
            type: 'appointment.accepted',
            title: '预约已被教师接受',
            body: result.data.note || '教师已接受你的课堂预约。',
            appointmentId: appointment.id,
            link: `/student/liveClass?classroomId=${classroomId}`,
            dedupeKey: `appointment:${appointment.id}:accepted:${appointment.student_id}`
          })
          insertNotification(db, {
            userId: appointment.teacher_id,
            type: 'appointment.accepted',
            title: '课堂预约已确认',
            body: '课堂已进入排期，并已创建专属教室。',
            appointmentId: appointment.id,
            link: `/teacher/liveClass?classroomId=${classroomId}`,
            dedupeKey: `appointment:${appointment.id}:accepted:${appointment.teacher_id}`
          })
        } else {
          insertNotification(db, {
            userId: appointment.student_id,
            type: 'appointment.rejected',
            title: '预约未被接受',
            body: result.data.note || '教师当前无法接受该预约。',
            appointmentId: appointment.id,
            dedupeKey: `appointment:${appointment.id}:rejected:${appointment.student_id}`
          })
        }

        insertAudit(db, request, {
          action: `appointment.${status}`,
          appointmentId: appointment.id,
          details: {
            previousStatus: 'pending',
            status,
            note: result.data.note,
            classroomId
          }
        })

        return { appointmentId: appointment.id }
      })

      const outcome = respond()
      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '预约不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能处理分配给自己的预约')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '只有待处理预约可以接受或拒绝', {
          status: outcome.status ?? null
        })
      }
      if (outcome.error === 'TEACHER_NOT_VERIFIED') {
        return responseError(
          reply,
          409,
          '教师身份认证当前无效，不能接受新的课堂预约'
        )
      }
      if (outcome.error === 'SCHEDULE_CONFLICT') {
        return responseError(reply, 409, '该时间段与已接受的课堂冲突', {
          conflictingAppointmentId: outcome.conflictingAppointmentId,
          conflictingParticipant: outcome.conflictingParticipant
        })
      }

      const appointment = findAppointment(db, outcome.appointmentId)
      return responseData(
        reply,
        appointmentData(appointment),
        result.data.action === 'accept' ? '预约已接受' : '预约已拒绝'
      )
    }
  )

  app.patch(
    '/api/v1/appointments/:id/cancel',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = cancelSchema.safeParse(unwrapBody(request.body))
      if (!result.success) {
        return validationError(reply, result)
      }

      const cancel = db.transaction(() => {
        const appointment = db
          .prepare('SELECT * FROM appointments WHERE id = ? LIMIT 1')
          .get(request.params.id)
        if (!appointment) {
          return { error: 'NOT_FOUND' }
        }

        const role = request.auth.user.role
        const ownsAppointment =
          (role === 'student' &&
            appointment.student_id === request.auth.user.id) ||
          (role === 'teacher' &&
            appointment.teacher_id === request.auth.user.id)
        if (!ownsAppointment) {
          return { error: 'FORBIDDEN' }
        }
        if (!['pending', 'accepted'].includes(appointment.status)) {
          return { error: 'INVALID_STATE', status: appointment.status }
        }

        const timestamp = new Date().toISOString()
        const updated = db
          .prepare(
            `UPDATE appointments
             SET status = 'cancelled', updated_at = ?
             WHERE id = ? AND status IN ('pending', 'accepted')`
          )
          .run(timestamp, appointment.id)
        if (updated.changes !== 1) {
          return { error: 'INVALID_STATE' }
        }

        db.prepare(
          `UPDATE classrooms
           SET status = 'closed',
               opened_at = COALESCE(opened_at, ?),
               closed_at = ?,
               updated_at = ?
           WHERE appointment_id = ? AND status <> 'closed'`
        ).run(timestamp, timestamp, timestamp, appointment.id)

        const otherParticipantId =
          role === 'student' ? appointment.teacher_id : appointment.student_id
        insertNotification(db, {
          userId: otherParticipantId,
          type: 'appointment.cancelled',
          title: '课堂预约已取消',
          body: result.data.reason || '预约已由另一位参与者取消。',
          appointmentId: appointment.id,
          dedupeKey: `appointment:${appointment.id}:cancelled:${otherParticipantId}`
        })
        insertAudit(db, request, {
          action: 'appointment.cancelled',
          appointmentId: appointment.id,
          details: {
            previousStatus: appointment.status,
            cancelledBy: role,
            reason: result.data.reason
          }
        })

        return { appointmentId: appointment.id }
      })

      const outcome = cancel()
      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '预约不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能取消自己参与的预约')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '当前预约状态不能取消', {
          status: outcome.status ?? null
        })
      }

      return responseData(
        reply,
        appointmentData(findAppointment(db, outcome.appointmentId)),
        '预约已取消'
      )
    }
  )

  app.post(
    '/api/v1/classrooms/:id/complete',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const complete = db.transaction(() => {
        const classroom = db
          .prepare(
            `SELECT
              classroom.id AS classroom_id,
              classroom.status AS classroom_status,
              a.*
            FROM classrooms AS classroom
            INNER JOIN appointments AS a ON a.id = classroom.appointment_id
            WHERE classroom.id = ?
            LIMIT 1`
          )
          .get(request.params.id)

        if (!classroom) return { error: 'NOT_FOUND' }

        const role = request.auth.user.role
        const participates =
          (role === 'student' &&
            classroom.student_id === request.auth.user.id) ||
          (role === 'teacher' && classroom.teacher_id === request.auth.user.id)
        if (!participates) return { error: 'FORBIDDEN' }
        if (
          classroom.status !== 'accepted' ||
          classroom.classroom_status !== 'open'
        ) {
          return {
            error: 'INVALID_STATE',
            appointmentStatus: classroom.status,
            classroomStatus: classroom.classroom_status
          }
        }

        const timestamp = new Date().toISOString()
        const appointmentUpdated = db
          .prepare(
            `UPDATE appointments
             SET status = 'completed', updated_at = ?
             WHERE id = ? AND status = 'accepted'`
          )
          .run(timestamp, classroom.id)
        if (appointmentUpdated.changes !== 1) {
          throw lifecycleFailure('APPOINTMENT_UPDATE_FAILED')
        }

        const classroomUpdated = db
          .prepare(
            `UPDATE classrooms
             SET status = 'closed',
                 closed_at = ?,
                 updated_at = ?
             WHERE id = ? AND status = 'open'`
          )
          .run(timestamp, timestamp, classroom.classroom_id)
        if (classroomUpdated.changes !== 1) {
          throw lifecycleFailure('CLASSROOM_UPDATE_FAILED')
        }

        const otherParticipantId =
          role === 'student' ? classroom.teacher_id : classroom.student_id
        insertNotification(db, {
          userId: otherParticipantId,
          type: 'appointment.completed',
          title: '课堂已完成',
          body: `${request.auth.user.displayName} 已将「${classroom.topic}」标记为完成。`,
          appointmentId: classroom.id,
          link:
            role === 'student' ? '/teacher/teachingDocking' : '/student/home',
          dedupeKey: `appointment:${classroom.id}:completed:${otherParticipantId}`
        })
        insertAudit(db, request, {
          action: 'appointment.completed',
          appointmentId: classroom.id,
          details: {
            previousStatus: 'accepted',
            previousClassroomStatus: classroom.classroom_status,
            classroomId: classroom.classroom_id,
            completedBy: role
          }
        })

        return { appointmentId: classroom.id }
      })

      let outcome
      try {
        outcome = complete()
      } catch (error) {
        if (error.lifecycleCode) {
          request.log.error(
            { err: error, lifecycleCode: error.lifecycleCode },
            'Failed to complete classroom atomically'
          )
          return responseError(reply, 409, '课堂状态已发生变化，请刷新后重试')
        }
        throw error
      }

      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '课堂不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只有课堂参与者可以完成课堂')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '只有已进入且仍在进行的课堂可以完成', {
          appointmentStatus: outcome.appointmentStatus,
          classroomStatus: outcome.classroomStatus
        })
      }

      return responseData(
        reply,
        appointmentData(findAppointment(db, outcome.appointmentId)),
        '课堂已完成'
      )
    }
  )

  app.get(
    '/api/v1/classrooms/:id/join-info',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const classroom = db
        .prepare(
          `SELECT
            classroom.id,
            classroom.room_code,
            classroom.status AS classroom_status,
            a.status AS appointment_status,
            a.scheduled_start,
            a.scheduled_end,
            a.student_id,
            a.teacher_id,
            student.display_name AS student_display_name,
            student.avatar_url AS student_avatar_url,
            teacher.display_name AS teacher_display_name,
            teacher.avatar_url AS teacher_avatar_url
          FROM classrooms AS classroom
          INNER JOIN appointments AS a ON a.id = classroom.appointment_id
          INNER JOIN users AS student ON student.id = a.student_id
          INNER JOIN users AS teacher ON teacher.id = a.teacher_id
          WHERE classroom.id = ?
          LIMIT 1`
        )
        .get(request.params.id)

      if (!classroom) {
        return responseError(reply, 404, '课堂不存在')
      }
      if (
        request.auth.user.id !== classroom.student_id &&
        request.auth.user.id !== classroom.teacher_id
      ) {
        return responseError(reply, 403, '只有课堂参与者可以获取加入信息')
      }
      if (
        classroom.appointment_status !== 'accepted' ||
        classroom.classroom_status === 'closed'
      ) {
        return responseError(reply, 409, '课堂当前不可加入')
      }

      const accessWindow = classroomJoinWindow(classroom)
      if (
        !accessWindow.allowed &&
        !isDevelopmentDemoClassroom(app, classroom)
      ) {
        return responseError(reply, 409, '当前不在课堂可加入时间内', {
          reason: accessWindow.reason,
          opensAt: accessWindow.opensAt ?? null,
          closesAt: accessWindow.closesAt ?? null
        })
      }

      const iceServers = []
      if (app.config?.turnUrl) {
        iceServers.push({
          urls: app.config.turnUrl,
          ...(app.config.turnUsername
            ? { username: app.config.turnUsername }
            : {}),
          ...(app.config.turnCredential
            ? { credential: app.config.turnCredential }
            : {})
        })
      }

      return responseData(reply, {
        classroomId: classroom.id,
        roomCode: classroom.room_code,
        accessWindow: {
          opensAt: accessWindow.opensAt ?? null,
          closesAt: accessWindow.closesAt ?? null,
          demoBypass:
            !accessWindow.allowed && isDevelopmentDemoClassroom(app, classroom)
        },
        iceServers,
        participants: [
          {
            id: classroom.student_id,
            displayName: classroom.student_display_name,
            avatarUrl: classroom.student_avatar_url ?? null,
            role: 'student'
          },
          {
            id: classroom.teacher_id,
            displayName: classroom.teacher_display_name,
            avatarUrl: classroom.teacher_avatar_url ?? null,
            role: 'teacher'
          }
        ]
      })
    }
  )
}

export default appointmentRoutes
