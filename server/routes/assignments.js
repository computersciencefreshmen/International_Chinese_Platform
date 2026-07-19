import { randomUUID } from 'node:crypto'

import { z } from 'zod'

const identifierSchema = z.string().uuid('ID 格式不正确')
const assignmentStatusSchema = z.enum(['draft', 'published', 'closed'])
const submissionStatusSchema = z.enum(['draft', 'submitted', 'graded'])

const assignmentIdParamsSchema = z.object({ id: identifierSchema }).strict()
const courseIdParamsSchema = z.object({ courseId: identifierSchema }).strict()
const submissionIdParamsSchema = z.object({ id: identifierSchema }).strict()

const nullableDateTimeSchema = z.preprocess(
  (value) => (value === '' ? null : value),
  z
    .union([
      z.null(),
      z
        .string()
        .trim()
        .refine(
          (value) => Number.isFinite(Date.parse(value)),
          '日期时间格式不正确'
        )
    ])
    .transform((value) =>
      value === null ? null : new Date(value).toISOString()
    )
)

const questionSchema = z
  .preprocess(
    (value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value
      }

      const { questionType, ...question } = value
      return {
        ...question,
        type: value.type ?? questionType
      }
    },
    z
      .object({
        type: z.enum(['single_choice', 'multiple_choice', 'text']),
        prompt: z.string().trim().min(1).max(4000),
        options: z
          .array(z.string().trim().min(1).max(500))
          .min(2)
          .max(20)
          .nullable()
          .optional(),
        correctAnswer: z.unknown().nullable().optional(),
        points: z.coerce.number().finite().positive().max(10000),
        explanation: z.string().trim().max(4000).default('')
      })
      .strict()
  )
  .superRefine((question, context) => {
    if (!question || typeof question !== 'object') return

    if (question.type === 'text') {
      if (
        question.correctAnswer !== undefined &&
        question.correctAnswer !== null &&
        (typeof question.correctAnswer !== 'string' ||
          question.correctAnswer.length > 10000)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: '文本题参考答案必须是字符串'
        })
      }
      return
    }

    const options = question.options ?? []
    if (options.length < 2) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: '选择题至少需要两个选项'
      })
      return
    }
    if (new Set(options).size !== options.length) {
      context.addIssue({
        code: 'custom',
        path: ['options'],
        message: '选择题选项不能重复'
      })
    }

    if (question.type === 'single_choice') {
      if (
        typeof question.correctAnswer !== 'string' ||
        !options.includes(question.correctAnswer)
      ) {
        context.addIssue({
          code: 'custom',
          path: ['correctAnswer'],
          message: '单选题正确答案必须是已有选项'
        })
      }
      return
    }

    if (
      !Array.isArray(question.correctAnswer) ||
      question.correctAnswer.length === 0 ||
      question.correctAnswer.some(
        (answer) => typeof answer !== 'string' || !options.includes(answer)
      ) ||
      new Set(question.correctAnswer).size !== question.correctAnswer.length
    ) {
      context.addIssue({
        code: 'custom',
        path: ['correctAnswer'],
        message: '多选题正确答案必须是互不重复的已有选项'
      })
    }
  })

const createAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    instructions: z.string().trim().max(10000).default(''),
    dueAt: nullableDateTimeSchema.optional().default(null),
    maxScore: z.coerce.number().finite().positive().max(10000),
    questions: z.array(questionSchema).min(1).max(100)
  })
  .strict()
  .superRefine((value, context) => {
    const total = value.questions.reduce(
      (sum, question) => sum + question.points,
      0
    )
    if (!scoresEqual(total, value.maxScore)) {
      context.addIssue({
        code: 'custom',
        path: ['questions'],
        message: '题目分值总和必须等于作业满分'
      })
    }
  })

const updateAssignmentSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    instructions: z.string().trim().max(10000).optional(),
    dueAt: nullableDateTimeSchema.optional(),
    maxScore: z.coerce.number().finite().positive().max(10000).optional(),
    questions: z.array(questionSchema).min(1).max(100).optional()
  })
  .strict()
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: '至少需要提供一个可修改字段'
  })

const saveSubmissionSchema = z
  .object({
    answers: z.record(identifierSchema, z.unknown()),
    action: z.enum(['save', 'submit']).default('submit')
  })
  .strict()

const gradeSubmissionSchema = z
  .object({
    score: z.coerce.number().finite().min(0),
    feedback: z.string().trim().max(5000).default('')
  })
  .strict()

const submissionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: submissionStatusSchema.optional()
  })
  .strict()

const teacherSubmissionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(['submitted', 'graded']).optional()
  })
  .strict()

function scoresEqual(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.001
}

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

function parseJson(value, fallback) {
  if (typeof value !== 'string') return fallback

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function conflictError(error) {
  return (
    error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
    error?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
    /UNIQUE constraint failed/i.test(error?.message ?? '')
  )
}

function pagination(page, pageSize, total) {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
  }
}

const assignmentSelect = `
  SELECT
    a.*,
    c.status AS course_status,
    c.title AS course_title,
    c.teacher_id AS course_teacher_id
  FROM assignments AS a
  INNER JOIN courses AS c ON c.id = a.course_id
`

function findAssignment(db, assignmentId) {
  return db
    .prepare(`${assignmentSelect} WHERE a.id = ? LIMIT 1`)
    .get(assignmentId)
}

function findQuestions(db, assignmentId) {
  return db
    .prepare(
      `SELECT * FROM assignment_questions
       WHERE assignment_id = ?
       ORDER BY position ASC, id ASC`
    )
    .all(assignmentId)
}

function questionData(row, { includeCorrectAnswer = false } = {}) {
  const question = {
    id: row.id,
    position: Number(row.position),
    type: row.question_type,
    prompt: row.prompt,
    options: parseJson(row.options_json, null),
    points: Number(row.points)
  }

  if (includeCorrectAnswer) {
    question.correctAnswer = parseJson(row.correct_answer_json, null)
    question.explanation = row.explanation
  }

  return question
}

function submissionSummaryFromJoinedRow(row) {
  if (!row.submission_id) return null

  return {
    id: row.submission_id,
    status: row.submission_status,
    submittedAt: row.submission_submitted_at ?? null,
    score:
      row.submission_score === null || row.submission_score === undefined
        ? null
        : Number(row.submission_score),
    feedback: row.submission_feedback ?? '',
    gradedAt: row.submission_graded_at ?? null
  }
}

function assignmentSummary(row) {
  const summary = {
    id: row.id,
    courseId: row.course_id,
    teacherId: row.teacher_id,
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at ?? null,
    maxScore: Number(row.max_score),
    status: assignmentStatusSchema.parse(row.status),
    questionCount: Number(row.question_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if ('submission_id' in row) {
    summary.submission = submissionSummaryFromJoinedRow(row)
  }

  return summary
}

function submissionData(row, { includeStudent = false } = {}) {
  const submission = {
    id: row.id,
    assignmentId: row.assignment_id,
    studentId: row.student_id,
    answers: parseJson(row.answers_json, {}),
    status: submissionStatusSchema.parse(row.status),
    submittedAt: row.submitted_at ?? null,
    score: row.score === null ? null : Number(row.score),
    feedback: row.feedback,
    gradedBy: row.graded_by ?? null,
    gradedAt: row.graded_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (includeStudent) {
    submission.student = {
      id: row.student_id,
      displayName: row.student_display_name,
      avatarUrl: row.student_avatar_url ?? null
    }
  }

  if (row.assignment_title) {
    submission.assignment = {
      id: row.assignment_id,
      title: row.assignment_title,
      courseId: row.course_id,
      courseTitle: row.course_title,
      dueAt: row.due_at ?? null,
      maxScore: Number(row.max_score)
    }
  }

  return submission
}

function assignmentDetail(db, row, { includeCorrectAnswer, studentId }) {
  const questions = findQuestions(db, row.id)
  const detail = {
    ...assignmentSummary(row),
    questionCount: questions.length,
    course: {
      id: row.course_id,
      title: row.course_title,
      status: row.course_status
    },
    questions: questions.map((question) =>
      questionData(question, { includeCorrectAnswer })
    )
  }

  if (studentId) {
    const submission = db
      .prepare(
        `SELECT * FROM submissions
         WHERE assignment_id = ? AND student_id = ?
         LIMIT 1`
      )
      .get(row.id, studentId)
    detail.submission = submission ? submissionData(submission) : null
  }

  return detail
}

function insertQuestions(db, assignmentId, questions) {
  const insert = db.prepare(
    `INSERT INTO assignment_questions (
      id, assignment_id, position, question_type, prompt, options_json,
      correct_answer_json, points, explanation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )

  questions.forEach((question, index) => {
    insert.run(
      randomUUID(),
      assignmentId,
      index + 1,
      question.type,
      question.prompt,
      question.type === 'text' ? null : JSON.stringify(question.options ?? []),
      JSON.stringify(question.correctAnswer ?? null),
      question.points,
      question.explanation
    )
  })
}

function insertAudit(db, request, { action, entityType, entityId, details }) {
  db.prepare(
    `INSERT INTO audit_logs (
      id, actor_id, action, entity_type, entity_id, details_json,
      request_id, ip_address, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    randomUUID(),
    request.auth.user.id,
    action,
    entityType,
    entityId,
    JSON.stringify(details ?? {}),
    String(request.id ?? '').slice(0, 128) || null,
    String(request.ip ?? '').slice(0, 64) || null,
    String(request.headers['user-agent'] ?? '').slice(0, 512) || null
  )
}

function answerErrors(questions, answers, requireComplete) {
  const issues = []
  const questionsById = new Map(
    questions.map((question) => [question.id, question])
  )

  for (const questionId of Object.keys(answers)) {
    if (!questionsById.has(questionId)) {
      issues.push({ field: `answers.${questionId}`, message: '题目不存在' })
    }
  }

  for (const question of questions) {
    const answer = answers[question.id]
    const empty =
      answer === undefined ||
      answer === null ||
      answer === '' ||
      (Array.isArray(answer) && answer.length === 0)

    if (empty) {
      if (requireComplete) {
        issues.push({
          field: `answers.${question.id}`,
          message: '提交前必须完成所有题目'
        })
      }
      continue
    }

    const options = parseJson(question.options_json, [])
    if (question.question_type === 'single_choice') {
      if (typeof answer !== 'string' || !options.includes(answer)) {
        issues.push({
          field: `answers.${question.id}`,
          message: '单选题答案必须是已有选项'
        })
      }
    } else if (question.question_type === 'multiple_choice') {
      if (
        !Array.isArray(answer) ||
        answer.some(
          (item) => typeof item !== 'string' || !options.includes(item)
        ) ||
        new Set(answer).size !== answer.length
      ) {
        issues.push({
          field: `answers.${question.id}`,
          message: '多选题答案必须是互不重复的已有选项'
        })
      }
    } else if (typeof answer !== 'string' || answer.length > 10000) {
      issues.push({
        field: `answers.${question.id}`,
        message: '文本题答案必须是不超过 10000 字符的字符串'
      })
    }
  }

  return issues
}

export async function assignmentRoutes(app) {
  const db = app.db
  if (!db) {
    throw new Error('assignmentRoutes requires app.db')
  }

  app.get(
    '/api/v1/courses/:courseId/assignments',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const course = db
        .prepare('SELECT * FROM courses WHERE id = ? LIMIT 1')
        .get(paramsResult.data.courseId)
      if (!course) return responseError(reply, 404, '课程不存在')

      const { role, id: userId } = request.auth.user
      if (role === 'student' && course.status !== 'published') {
        return responseError(reply, 404, '课程不存在')
      }
      if (role === 'teacher' && course.teacher_id !== userId) {
        return responseError(reply, 403, '只能查看自己课程的作业')
      }
      if (!['student', 'teacher', 'administrator'].includes(role)) {
        return responseError(reply, 403, '没有权限查看作业')
      }

      let rows
      if (role === 'student') {
        rows = db
          .prepare(
            `SELECT
              a.*,
              COUNT(q.id) AS question_count,
              s.id AS submission_id,
              s.status AS submission_status,
              s.submitted_at AS submission_submitted_at,
              s.score AS submission_score,
              s.feedback AS submission_feedback,
              s.graded_at AS submission_graded_at
            FROM assignments AS a
            LEFT JOIN assignment_questions AS q ON q.assignment_id = a.id
            LEFT JOIN submissions AS s
              ON s.assignment_id = a.id AND s.student_id = ?
            WHERE a.course_id = ? AND a.status = 'published'
            GROUP BY a.id
            ORDER BY a.due_at IS NULL, a.due_at ASC, a.created_at DESC`
          )
          .all(userId, course.id)
      } else {
        rows = db
          .prepare(
            `SELECT a.*, COUNT(q.id) AS question_count
             FROM assignments AS a
             LEFT JOIN assignment_questions AS q ON q.assignment_id = a.id
             WHERE a.course_id = ?
             GROUP BY a.id
             ORDER BY a.created_at DESC, a.id ASC`
          )
          .all(course.id)
      }

      return responseData(reply, { items: rows.map(assignmentSummary) })
    }
  )

  app.post(
    '/api/v1/courses/:courseId/assignments',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = courseIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const bodyResult = createAssignmentSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!bodyResult.success) return validationError(reply, bodyResult)

      const input = bodyResult.data
      const assignmentId = randomUUID()
      const timestamp = new Date().toISOString()
      const create = db.transaction(() => {
        const course = db
          .prepare('SELECT * FROM courses WHERE id = ? LIMIT 1')
          .get(paramsResult.data.courseId)
        if (!course) return { error: 'NOT_FOUND' }
        if (course.teacher_id !== request.auth.user.id) {
          return { error: 'FORBIDDEN' }
        }
        if (course.status === 'archived') {
          return { error: 'COURSE_ARCHIVED' }
        }

        db.prepare(
          `INSERT INTO assignments (
            id, course_id, teacher_id, title, instructions, due_at,
            max_score, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`
        ).run(
          assignmentId,
          course.id,
          request.auth.user.id,
          input.title,
          input.instructions,
          input.dueAt,
          input.maxScore,
          timestamp,
          timestamp
        )
        insertQuestions(db, assignmentId, input.questions)
        insertAudit(db, request, {
          action: 'assignment.created',
          entityType: 'assignment',
          entityId: assignmentId,
          details: { courseId: course.id, status: 'draft' }
        })
        return { assignmentId }
      })

      let outcome
      try {
        outcome = create()
      } catch (error) {
        if (conflictError(error)) {
          return responseError(reply, 409, '该课程中已存在同名作业')
        }
        throw error
      }

      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '课程不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能为自己的课程创建作业')
      }
      if (outcome.error === 'COURSE_ARCHIVED') {
        return responseError(reply, 409, '归档课程不能创建作业')
      }

      return responseData(
        reply,
        assignmentDetail(db, findAssignment(db, assignmentId), {
          includeCorrectAnswer: true
        }),
        '作业草稿已创建',
        201
      )
    }
  )

  app.patch(
    '/api/v1/assignments/:id',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = assignmentIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const bodyResult = updateAssignmentSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!bodyResult.success) return validationError(reply, bodyResult)

      const input = bodyResult.data
      const update = db.transaction(() => {
        const assignment = findAssignment(db, paramsResult.data.id)
        if (!assignment) return { error: 'NOT_FOUND' }
        if (assignment.teacher_id !== request.auth.user.id) {
          return { error: 'FORBIDDEN' }
        }
        if (assignment.status !== 'draft') {
          return { error: 'INVALID_STATE', status: assignment.status }
        }

        const nextMaxScore = input.maxScore ?? Number(assignment.max_score)
        const questionTotal = input.questions
          ? input.questions.reduce((sum, question) => sum + question.points, 0)
          : Number(
              db
                .prepare(
                  `SELECT COALESCE(SUM(points), 0) AS total
                   FROM assignment_questions WHERE assignment_id = ?`
                )
                .get(assignment.id).total
            )
        if (!scoresEqual(questionTotal, nextMaxScore)) {
          return {
            error: 'INVALID_POINTS',
            maxScore: nextMaxScore,
            questionTotal
          }
        }

        const columns = {
          title: 'title',
          instructions: 'instructions',
          dueAt: 'due_at',
          maxScore: 'max_score'
        }
        const assignments = []
        const values = []
        for (const [field, column] of Object.entries(columns)) {
          if (input[field] !== undefined) {
            assignments.push(`${column} = ?`)
            values.push(input[field])
          }
        }
        const timestamp = new Date().toISOString()
        assignments.push('updated_at = ?')
        values.push(timestamp, assignment.id)
        db.prepare(
          `UPDATE assignments SET ${assignments.join(', ')} WHERE id = ?`
        ).run(...values)

        if (input.questions) {
          db.prepare(
            'DELETE FROM assignment_questions WHERE assignment_id = ?'
          ).run(assignment.id)
          insertQuestions(db, assignment.id, input.questions)
        }

        insertAudit(db, request, {
          action: 'assignment.updated',
          entityType: 'assignment',
          entityId: assignment.id,
          details: { fields: Object.keys(input) }
        })
        return { assignmentId: assignment.id }
      })

      let outcome
      try {
        outcome = update()
      } catch (error) {
        if (conflictError(error)) {
          return responseError(reply, 409, '该课程中已存在同名作业')
        }
        throw error
      }

      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '作业不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能修改自己的作业')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '只有草稿状态的作业可以修改', {
          currentStatus: outcome.status,
          requiredStatus: 'draft'
        })
      }
      if (outcome.error === 'INVALID_POINTS') {
        return responseError(reply, 400, '题目分值总和必须等于作业满分', {
          maxScore: outcome.maxScore,
          questionTotal: outcome.questionTotal
        })
      }

      return responseData(
        reply,
        assignmentDetail(db, findAssignment(db, outcome.assignmentId), {
          includeCorrectAnswer: true
        }),
        '作业草稿已更新'
      )
    }
  )

  app.post(
    '/api/v1/assignments/:id/publish',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = assignmentIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const publish = db.transaction(() => {
        const assignment = findAssignment(db, paramsResult.data.id)
        if (!assignment) return { error: 'NOT_FOUND' }
        if (assignment.teacher_id !== request.auth.user.id) {
          return { error: 'FORBIDDEN' }
        }
        if (assignment.status !== 'draft') {
          return { error: 'INVALID_STATE', status: assignment.status }
        }

        const questions = db
          .prepare(
            `SELECT COUNT(*) AS count, COALESCE(SUM(points), 0) AS total
             FROM assignment_questions WHERE assignment_id = ?`
          )
          .get(assignment.id)
        if (
          questions.count === 0 ||
          !scoresEqual(questions.total, assignment.max_score)
        ) {
          return {
            error: 'INCOMPLETE',
            questionCount: questions.count,
            questionTotal: Number(questions.total),
            maxScore: Number(assignment.max_score)
          }
        }

        const timestamp = new Date().toISOString()
        const updated = db
          .prepare(
            `UPDATE assignments
             SET status = 'published', updated_at = ?
             WHERE id = ? AND teacher_id = ? AND status = 'draft'`
          )
          .run(timestamp, assignment.id, request.auth.user.id)
        if (updated.changes !== 1) return { error: 'STATE_CHANGED' }

        insertAudit(db, request, {
          action: 'assignment.published',
          entityType: 'assignment',
          entityId: assignment.id,
          details: { previousStatus: 'draft', status: 'published' }
        })
        return { assignmentId: assignment.id }
      })

      const outcome = publish()
      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '作业不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能发布自己的作业')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '只有草稿状态的作业可以发布', {
          currentStatus: outcome.status,
          requiredStatus: 'draft'
        })
      }
      if (outcome.error === 'INCOMPLETE') {
        return responseError(reply, 400, '作业题目与分值配置不完整', {
          questionCount: outcome.questionCount,
          questionTotal: outcome.questionTotal,
          maxScore: outcome.maxScore
        })
      }
      if (outcome.error === 'STATE_CHANGED') {
        return responseError(reply, 409, '作业状态已变化，请刷新后重试')
      }

      return responseData(
        reply,
        assignmentDetail(db, findAssignment(db, outcome.assignmentId), {
          includeCorrectAnswer: true
        }),
        '作业已发布'
      )
    }
  )

  app.get(
    '/api/v1/assignments/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const paramsResult = assignmentIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const assignment = findAssignment(db, paramsResult.data.id)
      if (!assignment) return responseError(reply, 404, '作业不存在')

      const { role, id: userId } = request.auth.user
      if (role === 'student') {
        if (
          assignment.status !== 'published' ||
          assignment.course_status !== 'published'
        ) {
          return responseError(reply, 404, '作业不存在')
        }
        return responseData(
          reply,
          assignmentDetail(db, assignment, {
            includeCorrectAnswer: false,
            studentId: userId
          })
        )
      }

      if (role === 'teacher' && assignment.teacher_id !== userId) {
        return responseError(reply, 403, '只能查看自己的作业')
      }
      if (!['teacher', 'administrator'].includes(role)) {
        return responseError(reply, 403, '没有权限查看作业')
      }

      return responseData(
        reply,
        assignmentDetail(db, assignment, { includeCorrectAnswer: true })
      )
    }
  )

  app.post(
    '/api/v1/assignments/:id/submissions',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const paramsResult = assignmentIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const bodyResult = saveSubmissionSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!bodyResult.success) return validationError(reply, bodyResult)

      const input = bodyResult.data
      const save = db.transaction(() => {
        const assignment = findAssignment(db, paramsResult.data.id)
        if (!assignment) return { error: 'NOT_FOUND' }
        if (
          assignment.status !== 'published' ||
          assignment.course_status !== 'published'
        ) {
          return { error: 'NOT_AVAILABLE', status: assignment.status }
        }

        const questions = findQuestions(db, assignment.id)
        const issues = answerErrors(
          questions,
          input.answers,
          input.action === 'submit'
        )
        if (issues.length > 0) return { error: 'INVALID_ANSWERS', issues }

        const existing = db
          .prepare(
            `SELECT * FROM submissions
             WHERE assignment_id = ? AND student_id = ? LIMIT 1`
          )
          .get(assignment.id, request.auth.user.id)
        if (existing && existing.status !== 'draft') {
          return { error: 'INVALID_STATE', status: existing.status }
        }

        const submissionId = existing?.id ?? randomUUID()
        const timestamp = new Date().toISOString()
        const nextStatus = input.action === 'submit' ? 'submitted' : 'draft'
        const submittedAt = nextStatus === 'submitted' ? timestamp : null

        if (existing) {
          const updated = db
            .prepare(
              `UPDATE submissions
               SET answers_json = ?, status = ?, submitted_at = ?, updated_at = ?
               WHERE id = ? AND student_id = ? AND status = 'draft'`
            )
            .run(
              JSON.stringify(input.answers),
              nextStatus,
              submittedAt,
              timestamp,
              existing.id,
              request.auth.user.id
            )
          if (updated.changes !== 1) return { error: 'STATE_CHANGED' }
        } else {
          db.prepare(
            `INSERT INTO submissions (
              id, assignment_id, student_id, answers_json, status,
              submitted_at, feedback, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, '', ?, ?)`
          ).run(
            submissionId,
            assignment.id,
            request.auth.user.id,
            JSON.stringify(input.answers),
            nextStatus,
            submittedAt,
            timestamp,
            timestamp
          )
        }

        if (nextStatus === 'submitted') {
          db.prepare(
            `INSERT INTO notifications (
              id, user_id, type, title, body, resource_type, resource_id,
              link, dedupe_key, created_at
            ) VALUES (?, ?, 'assignment.submitted', ?, ?, 'submission', ?, ?, ?, ?)`
          ).run(
            randomUUID(),
            assignment.teacher_id,
            '有新的作业提交',
            `学生提交了作业「${assignment.title}」。`,
            submissionId,
            `/teacher/courseDetails?assignmentId=${assignment.id}`,
            `submission:${submissionId}:submitted:${assignment.teacher_id}`,
            timestamp
          )
          insertAudit(db, request, {
            action: 'submission.submitted',
            entityType: 'submission',
            entityId: submissionId,
            details: { assignmentId: assignment.id }
          })
        }

        return { submissionId, created: !existing }
      })

      const outcome = save()
      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '作业不存在')
      }
      if (outcome.error === 'NOT_AVAILABLE') {
        return responseError(reply, 409, '作业当前不可提交', {
          assignmentStatus: outcome.status
        })
      }
      if (outcome.error === 'INVALID_ANSWERS') {
        return responseError(reply, 400, '答案内容不正确', {
          errors: outcome.issues
        })
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '作业已经提交，不能重复修改', {
          currentStatus: outcome.status
        })
      }
      if (outcome.error === 'STATE_CHANGED') {
        return responseError(reply, 409, '提交状态已变化，请刷新后重试')
      }

      const submission = db
        .prepare('SELECT * FROM submissions WHERE id = ? LIMIT 1')
        .get(outcome.submissionId)
      return responseData(
        reply,
        submissionData(submission),
        input.action === 'submit' ? '作业已提交' : '作业草稿已保存',
        outcome.created ? 201 : 200
      )
    }
  )

  app.get(
    '/api/v1/me/submissions',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const queryResult = submissionListQuerySchema.safeParse(
        request.query ?? {}
      )
      if (!queryResult.success) return validationError(reply, queryResult)

      const { page, pageSize, status } = queryResult.data
      const conditions = ['s.student_id = ?']
      const parameters = [request.auth.user.id]
      if (status) {
        conditions.push('s.status = ?')
        parameters.push(status)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      const total = db
        .prepare(`SELECT COUNT(*) AS count FROM submissions AS s ${where}`)
        .get(...parameters).count
      const rows = db
        .prepare(
          `SELECT
            s.*,
            a.title AS assignment_title,
            a.course_id,
            a.due_at,
            a.max_score,
            c.title AS course_title
          FROM submissions AS s
          INNER JOIN assignments AS a ON a.id = s.assignment_id
          INNER JOIN courses AS c ON c.id = a.course_id
          ${where}
          ORDER BY s.updated_at DESC, s.id ASC
          LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        items: rows.map((row) => submissionData(row)),
        pagination: pagination(page, pageSize, total)
      })
    }
  )

  app.get(
    '/api/v1/assignments/:id/submissions',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = assignmentIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)
      const queryResult = teacherSubmissionListQuerySchema.safeParse(
        request.query ?? {}
      )
      if (!queryResult.success) return validationError(reply, queryResult)

      const assignment = findAssignment(db, paramsResult.data.id)
      if (!assignment) return responseError(reply, 404, '作业不存在')
      if (assignment.teacher_id !== request.auth.user.id) {
        return responseError(reply, 403, '只能查看自己作业的提交记录')
      }

      const { page, pageSize, status } = queryResult.data
      const conditions = [
        's.assignment_id = ?',
        "s.status IN ('submitted', 'graded')"
      ]
      const parameters = [assignment.id]
      if (status) {
        conditions.push('s.status = ?')
        parameters.push(status)
      }
      const where = `WHERE ${conditions.join(' AND ')}`
      const total = db
        .prepare(`SELECT COUNT(*) AS count FROM submissions AS s ${where}`)
        .get(...parameters).count
      const rows = db
        .prepare(
          `SELECT
            s.*,
            u.display_name AS student_display_name,
            u.avatar_url AS student_avatar_url
          FROM submissions AS s
          INNER JOIN users AS u ON u.id = s.student_id
          ${where}
          ORDER BY
            s.status = 'submitted' DESC,
            s.submitted_at DESC,
            s.updated_at DESC,
            s.id ASC
          LIMIT ? OFFSET ?`
        )
        .all(...parameters, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        assignment: assignmentSummary(assignment),
        items: rows.map((row) => submissionData(row, { includeStudent: true })),
        pagination: pagination(page, pageSize, total)
      })
    }
  )

  app.patch(
    '/api/v1/submissions/:id/grade',
    { preHandler: app.requireRole('teacher') },
    async (request, reply) => {
      const paramsResult = submissionIdParamsSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)

      const bodyResult = gradeSubmissionSchema.safeParse(
        unwrapBody(request.body)
      )
      if (!bodyResult.success) return validationError(reply, bodyResult)

      const input = bodyResult.data
      const grade = db.transaction(() => {
        const submission = db
          .prepare(
            `SELECT
              s.*,
              a.teacher_id,
              a.title AS assignment_title,
              a.max_score
            FROM submissions AS s
            INNER JOIN assignments AS a ON a.id = s.assignment_id
            WHERE s.id = ?
            LIMIT 1`
          )
          .get(paramsResult.data.id)
        if (!submission) return { error: 'NOT_FOUND' }
        if (submission.teacher_id !== request.auth.user.id) {
          return { error: 'FORBIDDEN' }
        }
        if (submission.status !== 'submitted') {
          return { error: 'INVALID_STATE', status: submission.status }
        }
        if (input.score > Number(submission.max_score)) {
          return {
            error: 'SCORE_TOO_HIGH',
            maxScore: Number(submission.max_score)
          }
        }

        const timestamp = new Date().toISOString()
        const updated = db
          .prepare(
            `UPDATE submissions
             SET status = 'graded', score = ?, feedback = ?, graded_by = ?,
                 graded_at = ?, updated_at = ?
             WHERE id = ? AND status = 'submitted'`
          )
          .run(
            input.score,
            input.feedback,
            request.auth.user.id,
            timestamp,
            timestamp,
            submission.id
          )
        if (updated.changes !== 1) return { error: 'STATE_CHANGED' }

        db.prepare(
          `INSERT INTO notifications (
            id, user_id, type, title, body, resource_type, resource_id,
            link, dedupe_key, created_at
          ) VALUES (?, ?, 'submission.graded', ?, ?, 'submission', ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          submission.student_id,
          '作业已批阅',
          `作业「${submission.assignment_title}」已批阅，得分 ${input.score}/${Number(submission.max_score)}。`,
          submission.id,
          `/student/homeWork?submissionId=${submission.id}`,
          `submission:${submission.id}:graded:${submission.student_id}`,
          timestamp
        )
        insertAudit(db, request, {
          action: 'submission.graded',
          entityType: 'submission',
          entityId: submission.id,
          details: {
            assignmentId: submission.assignment_id,
            score: input.score,
            maxScore: Number(submission.max_score)
          }
        })

        return { submissionId: submission.id }
      })

      const outcome = grade()
      if (outcome.error === 'NOT_FOUND') {
        return responseError(reply, 404, '提交记录不存在')
      }
      if (outcome.error === 'FORBIDDEN') {
        return responseError(reply, 403, '只能批阅自己作业的提交记录')
      }
      if (outcome.error === 'INVALID_STATE') {
        return responseError(reply, 409, '只有已提交状态的作业可以批阅', {
          currentStatus: outcome.status,
          requiredStatus: 'submitted'
        })
      }
      if (outcome.error === 'SCORE_TOO_HIGH') {
        return responseError(reply, 400, '得分不能超过作业满分', {
          maxScore: outcome.maxScore
        })
      }
      if (outcome.error === 'STATE_CHANGED') {
        return responseError(reply, 409, '提交状态已变化，请刷新后重试')
      }

      const submission = db
        .prepare(
          `SELECT
            s.*,
            u.display_name AS student_display_name,
            u.avatar_url AS student_avatar_url
          FROM submissions AS s
          INNER JOIN users AS u ON u.id = s.student_id
          WHERE s.id = ? LIMIT 1`
        )
        .get(outcome.submissionId)
      return responseData(
        reply,
        submissionData(submission, { includeStudent: true }),
        '作业已批阅'
      )
    }
  )
}

export default assignmentRoutes
