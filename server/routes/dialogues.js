import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { createDialogueProvider } from '../services/dialogue-provider.js'

const idSchema = z
  .object({ id: z.string().uuid('对话 ID 格式不正确') })
  .strict()
const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(12)
  })
  .strict()
const createSchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    keywords: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(5)
      .refine((items) => new Set(items).size === items.length, '关键词不能重复')
  })
  .strict()
const messageSchema = z
  .object({ message: z.string().trim().min(1).max(2000) })
  .strict()

function responseData(reply, data, message = '操作成功', statusCode = 200) {
  return reply.code(statusCode).send({ code: 0, msg: message, data })
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

function unwrapBody(body) {
  if (body && typeof body === 'object' && body.data) return body.data
  return body ?? {}
}

function parseKeywords(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function turnData(row) {
  return {
    id: row.id,
    position: Number(row.position),
    speaker: row.speaker,
    content: row.content,
    createdAt: row.created_at
  }
}

function sessionData(row) {
  return {
    id: row.id,
    title: row.title,
    keywords: parseKeywords(row.keywords_json),
    provider: row.provider,
    turnCount: Number(row.turn_count ?? 0),
    lastMessage: row.last_message ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function findOwnedSession(db, sessionId, studentId) {
  return await db
    .prepare(
      `SELECT * FROM dialogue_sessions
       WHERE id = ? AND student_id = ? LIMIT 1`
    )
    .get(sessionId, studentId)
}

async function getTurns(db, sessionId) {
  return await db
    .prepare(
      `SELECT * FROM dialogue_turns
       WHERE session_id = ? ORDER BY position ASC`
    )
    .all(sessionId)
}

export async function dialogueRoutes(app) {
  const db = app.db
  if (!db) throw new Error('dialogueRoutes requires app.db')

  const provider = createDialogueProvider({
    apiUrl: app.config?.aiApiUrl,
    apiKey: app.config?.aiApiKey,
    logger: app.log
  })

  app.get(
    '/api/v1/dialogues',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const result = listSchema.safeParse(request.query ?? {})
      if (!result.success) return validationError(reply, result)
      const { page, pageSize } = result.data
      const studentId = request.auth.user.id
      const total = Number(
        (
          await db
            .prepare(
              'SELECT COUNT(*) AS count FROM dialogue_sessions WHERE student_id = ?'
            )
            .get(studentId)
        ).count
      )
      const rows = await db
        .prepare(
          `SELECT
            s.*,
            COUNT(t.id) AS turn_count,
            (
              SELECT content FROM dialogue_turns
              WHERE session_id = s.id
              ORDER BY position DESC LIMIT 1
            ) AS last_message
           FROM dialogue_sessions AS s
           LEFT JOIN dialogue_turns AS t ON t.session_id = s.id
           WHERE s.student_id = ?
           GROUP BY s.id
           ORDER BY s.updated_at DESC, s.id ASC
           LIMIT ? OFFSET ?`
        )
        .all(studentId, pageSize, (page - 1) * pageSize)

      return responseData(reply, {
        items: rows.map(sessionData),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / pageSize)
        }
      })
    }
  )

  app.post(
    '/api/v1/dialogues',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const result = createSchema.safeParse(unwrapBody(request.body))
      if (!result.success) return validationError(reply, result)

      const generated = await provider.generate(result.data)
      const sessionId = randomUUID()
      const timestamp = new Date().toISOString()
      const create = db.transaction(async () => {
        await db
          .prepare(
            `INSERT INTO dialogue_sessions (
            id, student_id, title, keywords_json, provider, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            sessionId,
            request.auth.user.id,
            generated.title,
            JSON.stringify(result.data.keywords),
            generated.provider,
            timestamp,
            timestamp
          )

        const insertTurn = db.prepare(
          `INSERT INTO dialogue_turns (
            id, session_id, position, speaker, content, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        for (const [index, turn] of generated.turns.entries()) {
          await insertTurn.run(
            randomUUID(),
            sessionId,
            index + 1,
            turn.speaker,
            turn.content,
            timestamp
          )
        }
      })
      await create()

      const session = await findOwnedSession(
        db,
        sessionId,
        request.auth.user.id
      )
      return responseData(
        reply,
        {
          ...sessionData(session),
          turns: (await getTurns(db, sessionId)).map(turnData)
        },
        '对话练习已生成',
        201
      )
    }
  )

  app.get(
    '/api/v1/dialogues/:id',
    { preHandler: app.requireRole('student') },
    async (request, reply) => {
      const result = idSchema.safeParse(request.params)
      if (!result.success) return validationError(reply, result)

      const session = await findOwnedSession(
        db,
        result.data.id,
        request.auth.user.id
      )
      if (!session) return responseError(reply, 404, '对话练习不存在')
      const turns = await getTurns(db, session.id)
      return responseData(reply, {
        ...sessionData({ ...session, turn_count: turns.length }),
        turns: turns.map(turnData)
      })
    }
  )

  app.post(
    '/api/v1/dialogues/:id/messages',
    {
      preHandler: app.requireRole('student'),
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
    },
    async (request, reply) => {
      const paramsResult = idSchema.safeParse(request.params)
      if (!paramsResult.success) return validationError(reply, paramsResult)
      const bodyResult = messageSchema.safeParse(unwrapBody(request.body))
      if (!bodyResult.success) return validationError(reply, bodyResult)

      const session = await findOwnedSession(
        db,
        paramsResult.data.id,
        request.auth.user.id
      )
      if (!session) return responseError(reply, 404, '对话练习不存在')

      const turns = await getTurns(db, session.id)
      if (turns.length >= 100) {
        return responseError(reply, 409, '本轮对话已达到上限，请创建新的练习')
      }
      const generated = await provider.reply({
        keywords: parseKeywords(session.keywords_json),
        history: turns
          .slice(-20)
          .map(({ speaker, content }) => ({ speaker, content })),
        message: bodyResult.data.message
      })
      const timestamp = new Date().toISOString()
      const append = db.transaction(async () => {
        const current = await findOwnedSession(
          db,
          session.id,
          request.auth.user.id
        )
        if (!current) return null
        const position = Number(
          (
            await db
              .prepare(
                `SELECT COALESCE(MAX(position), 0) AS position
               FROM dialogue_turns WHERE session_id = ?`
              )
              .get(session.id)
          ).position
        )
        const studentTurn = {
          id: randomUUID(),
          position: position + 1,
          speaker: 'student',
          content: bodyResult.data.message
        }
        const tutorTurn = {
          id: randomUUID(),
          position: position + 2,
          speaker: 'tutor',
          content: generated.content
        }
        const insert = db.prepare(
          `INSERT INTO dialogue_turns (
            id, session_id, position, speaker, content, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)`
        )
        for (const turn of [studentTurn, tutorTurn]) {
          await insert.run(
            turn.id,
            session.id,
            turn.position,
            turn.speaker,
            turn.content,
            timestamp
          )
        }
        await db
          .prepare(
            `UPDATE dialogue_sessions
           SET provider = ?, updated_at = ? WHERE id = ?`
          )
          .run(generated.provider, timestamp, session.id)
        return { studentTurn, tutorTurn }
      })

      const appended = await append()
      if (!appended)
        return responseError(reply, 409, '对话状态已变化，请刷新重试')
      return responseData(reply, {
        provider: generated.provider,
        turns: [
          { ...appended.studentTurn, createdAt: timestamp },
          { ...appended.tutorTurn, createdAt: timestamp }
        ]
      })
    }
  )
}

export default dialogueRoutes
