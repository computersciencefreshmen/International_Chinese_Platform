import { Buffer } from 'node:buffer'
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { z } from 'zod'

const TICKET_TTL_MS = 60_000
const TICKET_SWEEP_INTERVAL_MS = 30_000
const CONNECTION_SWEEP_INTERVAL_MS = 10_000
const CLASSROOM_JOIN_EARLY_MS = 30 * 60 * 1000
const CLASSROOM_JOIN_GRACE_MS = 2 * 60 * 60 * 1000
const MAX_EVENT_BYTES = 64 * 1024
const MAX_CHAT_LENGTH = 4000
const MAX_CONNECTIONS_PER_USER = 3
const EVENT_RATE_WINDOW_MS = 10_000
const MAX_EVENTS_PER_WINDOW = 120

const classroomParamsSchema = z
  .object({ id: z.string().uuid('课堂 ID 格式不正确') })
  .strict()

const historyQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z
      .string()
      .trim()
      .refine((value) => Number.isFinite(Date.parse(value)), '时间格式不正确')
      .optional()
  })
  .strict()

const ticketQuerySchema = z
  .object({
    ticket: z.string().trim().min(32).max(256)
  })
  .strict()

const chatEventSchema = z
  .object({
    type: z.literal('chat.message'),
    clientMessageId: z.string().trim().min(1).max(128),
    content: z.string().trim().min(1).max(MAX_CHAT_LENGTH)
  })
  .strict()

const handRaiseEventSchema = z
  .object({
    type: z.literal('hand.raise'),
    raised: z.boolean().default(true)
  })
  .strict()

const rtcDescriptionSchema = z
  .object({
    type: z.enum(['offer', 'answer']),
    sdp: z.string().min(1).max(50_000)
  })
  .strict()

const rtcCandidateSchema = z
  .object({
    candidate: z.string().max(50_000),
    sdpMid: z.string().max(256).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(65_535).nullable().optional(),
    usernameFragment: z.string().max(256).nullable().optional()
  })
  .strict()

const rtcOfferEventSchema = z
  .object({
    type: z.literal('rtc.offer'),
    targetUserId: z.string().uuid(),
    description: rtcDescriptionSchema
  })
  .strict()

const rtcAnswerEventSchema = z
  .object({
    type: z.literal('rtc.answer'),
    targetUserId: z.string().uuid(),
    description: rtcDescriptionSchema
  })
  .strict()

const rtcCandidateEventSchema = z
  .object({
    type: z.literal('rtc.candidate'),
    targetUserId: z.string().uuid(),
    candidate: rtcCandidateSchema.nullable()
  })
  .strict()

const pingEventSchema = z
  .object({
    type: z.literal('ping'),
    nonce: z.string().max(128).optional()
  })
  .strict()

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

function ticketHash(ticket) {
  return createHash('sha256').update(ticket).digest('hex')
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {}
  } catch {
    return {}
  }
}

function userData(row, prefix = '') {
  return {
    id: row[`${prefix}id`],
    displayName: row[`${prefix}display_name`],
    avatarUrl: row[`${prefix}avatar_url`] ?? null,
    role: row[`${prefix}role`]
  }
}

function messageData(row) {
  return {
    id: row.id,
    classroomId: row.classroom_id,
    senderId: row.sender_id ?? null,
    sender: row.sender_id
      ? {
          id: row.sender_id,
          displayName: row.sender_display_name,
          avatarUrl: row.sender_avatar_url ?? null,
          role: row.sender_role
        }
      : null,
    messageType: row.message_type,
    content: row.content,
    metadata: parseJsonObject(row.metadata_json),
    clientMessageId: row.client_message_id ?? null,
    createdAt: row.created_at,
    editedAt: row.edited_at ?? null,
    deletedAt: row.deleted_at ?? null
  }
}

const messageSelect = `
  SELECT
    message.*,
    sender.display_name AS sender_display_name,
    sender.avatar_url AS sender_avatar_url,
    sender.role AS sender_role
  FROM chat_messages AS message
  LEFT JOIN users AS sender ON sender.id = message.sender_id
`

async function findClassroom(db, classroomId) {
  return await db
    .prepare(
      `SELECT
        classroom.id,
        classroom.room_code,
        classroom.status,
        appointment.status AS appointment_status,
        appointment.scheduled_start,
        appointment.scheduled_end,
        appointment.student_id,
        appointment.teacher_id,
        student.display_name AS student_display_name,
        student.avatar_url AS student_avatar_url,
        student.role AS student_role,
        student.status AS student_status,
        teacher.display_name AS teacher_display_name,
        teacher.avatar_url AS teacher_avatar_url,
        teacher.role AS teacher_role,
        teacher.status AS teacher_status
      FROM classrooms AS classroom
      INNER JOIN appointments AS appointment
        ON appointment.id = classroom.appointment_id
      INNER JOIN users AS student ON student.id = appointment.student_id
      INNER JOIN users AS teacher ON teacher.id = appointment.teacher_id
      WHERE classroom.id = ?
      LIMIT 1`
    )
    .get(classroomId)
}

function participantFor(classroom, userId) {
  if (classroom.student_id === userId) {
    return userData(classroom, 'student_')
  }
  if (classroom.teacher_id === userId) {
    return userData(classroom, 'teacher_')
  }
  return null
}

function isActiveParticipant(classroom, userId) {
  if (classroom.student_id === userId) {
    return classroom.student_status === 'active'
  }
  if (classroom.teacher_id === userId) {
    return classroom.teacher_status === 'active'
  }
  return false
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

function safeSend(socket, event) {
  if (socket.readyState !== 1) return false

  try {
    socket.send(JSON.stringify(event))
    return true
  } catch {
    return false
  }
}

function protocolError(socket, code, message, data = null) {
  safeSend(socket, {
    type: 'error',
    code,
    message,
    data,
    sentAt: new Date().toISOString()
  })
}

function uniqueTicket(ticketStore) {
  for (;;) {
    const ticket = randomBytes(32).toString('base64url')
    const hash = ticketHash(ticket)
    if (!ticketStore.has(hash)) return { ticket, hash }
  }
}

export async function realtimeRoutes(app) {
  const db = app.db
  if (!db) throw new Error('realtimeRoutes requires app.db')

  const tickets = new Map()
  const rooms = new Map()
  const connectionClaims = new WeakMap()
  const ticketClaim = Symbol('realtimeTicketClaim')

  function removeExpiredTickets(now = Date.now()) {
    for (const [hash, ticket] of tickets) {
      if (ticket.expiresAt <= now) tickets.delete(hash)
    }
  }

  function consumeTicket(rawTicket) {
    if (typeof rawTicket !== 'string') return null

    const hash = ticketHash(rawTicket)
    const ticket = tickets.get(hash)
    tickets.delete(hash)

    if (!ticket || ticket.expiresAt <= Date.now()) return null
    return ticket
  }

  function roomUsers(classroomId) {
    let users = rooms.get(classroomId)
    if (!users) {
      users = new Map()
      rooms.set(classroomId, users)
    }
    return users
  }

  function addSocket(claim, socket) {
    const users = roomUsers(claim.classroomId)
    let sockets = users.get(claim.user.id)
    const firstForUser = !sockets
    if (!sockets) {
      sockets = new Set()
      users.set(claim.user.id, sockets)
    }
    sockets.add(socket)
    connectionClaims.set(socket, claim)
    return firstForUser
  }

  function removeSocket(claim, socket) {
    const users = rooms.get(claim.classroomId)
    const sockets = users?.get(claim.user.id)
    if (!sockets) return false

    sockets.delete(socket)
    connectionClaims.delete(socket)
    if (sockets.size > 0) return false

    users.delete(claim.user.id)
    if (users.size === 0) rooms.delete(claim.classroomId)
    return true
  }

  function broadcast(classroomId, event) {
    const users = rooms.get(classroomId)
    if (!users) return

    for (const sockets of users.values()) {
      for (const socket of sockets) safeSend(socket, event)
    }
  }

  function sendToUser(classroomId, userId, event) {
    const sockets = rooms.get(classroomId)?.get(userId)
    if (!sockets) return false

    let sent = false
    for (const socket of sockets) sent = safeSend(socket, event) || sent
    return sent
  }

  function onlineParticipants(classroomId) {
    return [...(rooms.get(classroomId)?.keys() ?? [])]
  }

  function connectionCount(classroomId, userId) {
    return rooms.get(classroomId)?.get(userId)?.size ?? 0
  }

  async function claimCanAccessClassroom(claim) {
    const now = new Date().toISOString()
    const session = await db
      .prepare(
        `SELECT session.id
         FROM sessions AS session
         INNER JOIN users AS account ON account.id = session.user_id
         WHERE session.id = ?
           AND session.user_id = ?
           AND session.revoked_at IS NULL
           AND session.expires_at > ?
           AND account.status = 'active'
           AND account.must_reset_password = false
         LIMIT 1`
      )
      .get(claim.sessionId, claim.user.id, now)
    if (!session) return false

    const classroom = await findClassroom(db, claim.classroomId)
    if (
      !classroom ||
      classroom.appointment_status !== 'accepted' ||
      classroom.status === 'closed' ||
      !isActiveParticipant(classroom, claim.user.id)
    ) {
      return false
    }

    return (
      classroomJoinWindow(classroom).allowed ||
      isDevelopmentDemoClassroom(app, classroom)
    )
  }

  async function closeStaleConnections() {
    for (const users of rooms.values()) {
      for (const sockets of users.values()) {
        for (const socket of sockets) {
          const claim = connectionClaims.get(socket)
          if (!claim || !(await claimCanAccessClassroom(claim))) {
            protocolError(
              socket,
              'CLASSROOM_ACCESS_REVOKED',
              '课堂访问权限已失效'
            )
            socket.close(1008, 'Classroom access revoked')
          }
        }
      }
    }
  }

  async function loadMessage(messageId) {
    const row = await db
      .prepare(`${messageSelect} WHERE message.id = ? LIMIT 1`)
      .get(messageId)
    return row ? messageData(row) : null
  }

  async function existingClientMessage(senderId, clientMessageId) {
    const row = await db
      .prepare(
        `${messageSelect}
         WHERE message.sender_id = ? AND message.client_message_id = ?
         LIMIT 1`
      )
      .get(senderId, clientMessageId)
    return row ? messageData(row) : null
  }

  async function persistChatMessage(claim, event) {
    const existing = await existingClientMessage(
      claim.user.id,
      event.clientMessageId
    )
    if (existing) {
      if (existing.classroomId !== claim.classroomId) {
        return { error: 'CLIENT_MESSAGE_ID_CONFLICT' }
      }
      return { message: existing, duplicate: true }
    }

    const id = randomUUID()
    const createdAt = new Date().toISOString()

    try {
      await db
        .prepare(
          `INSERT INTO chat_messages (
          id, classroom_id, sender_id, message_type, content,
          metadata_json, client_message_id, created_at
        ) VALUES (?, ?, ?, 'text', ?, '{}', ?, ?)`
        )
        .run(
          id,
          claim.classroomId,
          claim.user.id,
          event.content,
          event.clientMessageId,
          createdAt
        )
    } catch (error) {
      const isUniqueConflict =
        error?.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
        /UNIQUE constraint failed/i.test(error?.message ?? '')
      if (!isUniqueConflict) throw error

      const duplicate = await existingClientMessage(
        claim.user.id,
        event.clientMessageId
      )
      if (!duplicate || duplicate.classroomId !== claim.classroomId) {
        return { error: 'CLIENT_MESSAGE_ID_CONFLICT' }
      }
      return { message: duplicate, duplicate: true }
    }

    return { message: await loadMessage(id), duplicate: false }
  }

  function forwardRtc(socket, claim, event) {
    if (
      event.targetUserId === claim.user.id ||
      !claim.participantIds.includes(event.targetUserId)
    ) {
      return protocolError(
        socket,
        'INVALID_RTC_TARGET',
        '只能向同一课堂的另一位参与者发送 RTC 信令'
      )
    }

    const forwarded = sendToUser(claim.classroomId, event.targetUserId, {
      ...event,
      classroomId: claim.classroomId,
      fromUserId: claim.user.id,
      sentAt: new Date().toISOString()
    })

    if (!forwarded) {
      protocolError(socket, 'RTC_TARGET_OFFLINE', '目标参与者当前不在线')
    }
  }

  async function handleEvent(socket, claim, rawData, isBinary) {
    if (isBinary) {
      socket.close(1003, 'Binary events are not supported')
      return
    }

    const size = Buffer.byteLength(rawData)
    if (size > MAX_EVENT_BYTES) {
      socket.close(1009, 'Event exceeds size limit')
      return
    }

    let event
    try {
      event = JSON.parse(rawData.toString('utf8'))
    } catch {
      protocolError(socket, 'INVALID_JSON', '消息必须是有效的 JSON')
      return
    }

    if (!event || typeof event !== 'object' || Array.isArray(event)) {
      protocolError(socket, 'INVALID_EVENT', '消息事件格式不正确')
      return
    }

    if (event.type === 'chat.message') {
      const result = chatEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(socket, 'INVALID_CHAT_MESSAGE', '聊天消息格式不正确')
        return
      }

      try {
        const outcome = await persistChatMessage(claim, result.data)
        if (outcome.error) {
          protocolError(
            socket,
            outcome.error,
            'clientMessageId 已在其他课堂中使用'
          )
          return
        }

        const outgoing = {
          type: 'chat.message',
          classroomId: claim.classroomId,
          message: outcome.message,
          duplicate: outcome.duplicate,
          sentAt: new Date().toISOString()
        }

        if (outcome.duplicate) safeSend(socket, outgoing)
        else broadcast(claim.classroomId, outgoing)
      } catch (error) {
        app.log.error({ err: error }, 'Failed to persist classroom message')
        protocolError(socket, 'MESSAGE_PERSISTENCE_FAILED', '消息发送失败')
      }
      return
    }

    if (event.type === 'hand.raise') {
      const result = handRaiseEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(socket, 'INVALID_HAND_RAISE', '举手事件格式不正确')
        return
      }

      broadcast(claim.classroomId, {
        type: 'hand.raise',
        classroomId: claim.classroomId,
        user: claim.user,
        raised: result.data.raised,
        sentAt: new Date().toISOString()
      })
      return
    }

    if (event.type === 'rtc.offer') {
      const result = rtcOfferEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(socket, 'INVALID_RTC_OFFER', 'RTC offer 格式不正确')
        return
      }
      if (result.data.description.type !== 'offer') {
        protocolError(socket, 'INVALID_RTC_OFFER', 'RTC offer 类型不正确')
        return
      }
      forwardRtc(socket, claim, result.data)
      return
    }

    if (event.type === 'rtc.answer') {
      const result = rtcAnswerEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(socket, 'INVALID_RTC_ANSWER', 'RTC answer 格式不正确')
        return
      }
      if (result.data.description.type !== 'answer') {
        protocolError(socket, 'INVALID_RTC_ANSWER', 'RTC answer 类型不正确')
        return
      }
      forwardRtc(socket, claim, result.data)
      return
    }

    if (event.type === 'rtc.candidate') {
      const result = rtcCandidateEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(
          socket,
          'INVALID_RTC_CANDIDATE',
          'RTC candidate 格式不正确'
        )
        return
      }
      forwardRtc(socket, claim, result.data)
      return
    }

    if (event.type === 'ping') {
      const result = pingEventSchema.safeParse(event)
      if (!result.success) {
        protocolError(socket, 'INVALID_PING', 'ping 事件格式不正确')
        return
      }

      safeSend(socket, {
        type: 'pong',
        nonce: result.data.nonce ?? null,
        sentAt: new Date().toISOString()
      })
      return
    }

    protocolError(socket, 'UNKNOWN_EVENT', '不支持的课堂事件类型')
  }

  const ticketSweepTimer = setInterval(
    removeExpiredTickets,
    TICKET_SWEEP_INTERVAL_MS
  )
  const connectionSweepTimer = setInterval(
    closeStaleConnections,
    CONNECTION_SWEEP_INTERVAL_MS
  )
  ticketSweepTimer.unref()
  connectionSweepTimer.unref()

  app.addHook('onClose', async () => {
    clearInterval(ticketSweepTimer)
    clearInterval(connectionSweepTimer)
    tickets.clear()
    rooms.clear()
  })

  app.post(
    '/api/v1/classrooms/:id/ticket',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = classroomParamsSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)

      const classroom = await findClassroom(db, params.data.id)
      if (!classroom) return responseError(reply, 404, '课堂不存在')

      const participant = participantFor(classroom, request.auth.user.id)
      if (!participant) {
        return responseError(reply, 403, '只有课堂参与者可以获取连接票据')
      }
      if (!isActiveParticipant(classroom, request.auth.user.id)) {
        return responseError(reply, 403, '当前账号无法加入课堂')
      }
      if (
        classroom.appointment_status !== 'accepted' ||
        classroom.status === 'closed'
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

      removeExpiredTickets()
      const { ticket, hash } = uniqueTicket(tickets)
      const expiresAt = Date.now() + TICKET_TTL_MS
      tickets.set(hash, {
        classroomId: classroom.id,
        sessionId: request.auth.sessionId,
        user: participant,
        participantIds: [classroom.student_id, classroom.teacher_id],
        expiresAt
      })
      const websocketPath = `/ws/classroom?ticket=${encodeURIComponent(ticket)}`
      const websocketOrigin =
        app.config?.publicWebsocketOrigin ?? 'ws://localhost'
      const websocketUrl = new URL(
        websocketPath,
        `${websocketOrigin.replace(/\/$/, '')}/`
      ).toString()

      return responseData(
        reply,
        {
          classroomId: classroom.id,
          ticket,
          expiresAt: new Date(expiresAt).toISOString(),
          accessWindow: {
            opensAt: accessWindow.opensAt ?? null,
            closesAt: accessWindow.closesAt ?? null,
            demoBypass:
              !accessWindow.allowed &&
              isDevelopmentDemoClassroom(app, classroom)
          },
          websocketUrl,
          websocketPath
        },
        '连接票据已创建',
        201
      )
    }
  )

  app.get(
    '/api/v1/classrooms/:id/messages',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = classroomParamsSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)

      const query = historyQuerySchema.safeParse(request.query ?? {})
      if (!query.success) return validationError(reply, query)

      const classroom = await findClassroom(db, params.data.id)
      if (!classroom) return responseError(reply, 404, '课堂不存在')
      if (!participantFor(classroom, request.auth.user.id)) {
        return responseError(reply, 403, '只有课堂参与者可以查看课堂消息')
      }

      const conditions = [
        'message.classroom_id = ?',
        'message.deleted_at IS NULL'
      ]
      const parameters = [classroom.id]
      if (query.data.before) {
        conditions.push('message.created_at < ?')
        parameters.push(new Date(query.data.before).toISOString())
      }

      const rows = await db
        .prepare(
          `${messageSelect}
           WHERE ${conditions.join(' AND ')}
           ORDER BY message.created_at DESC, message.id DESC
           LIMIT ?`
        )
        .all(...parameters, query.data.limit + 1)

      const hasMore = rows.length > query.data.limit
      const items = rows.slice(0, query.data.limit).reverse().map(messageData)

      return responseData(reply, {
        items,
        hasMore,
        nextBefore: hasMore && items.length > 0 ? items[0].createdAt : null
      })
    }
  )

  app.get(
    '/ws/classroom',
    {
      websocket: true,
      preValidation: async (request, reply) => {
        const query = ticketQuerySchema.safeParse(request.query ?? {})
        if (!query.success) {
          return responseError(reply, 401, '课堂连接票据无效')
        }

        const claim = consumeTicket(query.data.ticket)
        if (!claim) return responseError(reply, 401, '课堂连接票据无效或已过期')

        const classroom = await findClassroom(db, claim.classroomId)
        const accessWindow = classroom
          ? classroomJoinWindow(classroom)
          : { allowed: false }
        if (
          !classroom ||
          classroom.appointment_status !== 'accepted' ||
          classroom.status === 'closed' ||
          (!accessWindow.allowed &&
            !isDevelopmentDemoClassroom(app, classroom)) ||
          !isActiveParticipant(classroom, claim.user.id) ||
          !(await claimCanAccessClassroom(claim))
        ) {
          return responseError(reply, 403, '当前无法加入课堂')
        }

        claim.user = participantFor(classroom, claim.user.id)
        claim.participantIds = [classroom.student_id, classroom.teacher_id]
        request[ticketClaim] = claim
      }
    },
    async (socket, request) => {
      const claim = request[ticketClaim]
      let cleanedUp = false
      let eventWindowStartedAt = Date.now()
      let eventCount = 0

      if (
        connectionCount(claim.classroomId, claim.user.id) >=
        MAX_CONNECTIONS_PER_USER
      ) {
        protocolError(socket, 'CONNECTION_LIMIT', '课堂连接数量已达到上限')
        socket.close(1008, 'Connection limit reached')
        return
      }

      socket.on('message', async (data, isBinary) => {
        const now = Date.now()
        if (now - eventWindowStartedAt >= EVENT_RATE_WINDOW_MS) {
          eventWindowStartedAt = now
          eventCount = 0
        }
        eventCount += 1
        if (eventCount > MAX_EVENTS_PER_WINDOW) {
          protocolError(socket, 'EVENT_RATE_LIMIT', '课堂事件发送过于频繁')
          socket.close(1008, 'Event rate limit exceeded')
          return
        }
        if (!(await claimCanAccessClassroom(claim))) {
          protocolError(
            socket,
            'CLASSROOM_ACCESS_REVOKED',
            '课堂访问权限已失效'
          )
          socket.close(1008, 'Classroom access revoked')
          return
        }
        await handleEvent(socket, claim, data, isBinary)
      })

      const cleanup = () => {
        if (cleanedUp) return
        cleanedUp = true

        if (removeSocket(claim, socket)) {
          broadcast(claim.classroomId, {
            type: 'presence.left',
            classroomId: claim.classroomId,
            user: claim.user,
            onlineUserIds: onlineParticipants(claim.classroomId),
            sentAt: new Date().toISOString()
          })
        }
      }

      socket.once('close', cleanup)
      socket.once('error', cleanup)

      const firstForUser = addSocket(claim, socket)
      await db
        .prepare(
          `UPDATE classrooms
         SET status = 'open',
             opened_at = COALESCE(opened_at, ?),
             updated_at = ?
         WHERE id = ? AND status = 'scheduled'`
        )
        .run(
          new Date().toISOString(),
          new Date().toISOString(),
          claim.classroomId
        )

      safeSend(socket, {
        type: 'presence.snapshot',
        classroomId: claim.classroomId,
        user: claim.user,
        onlineUserIds: onlineParticipants(claim.classroomId),
        sentAt: new Date().toISOString()
      })

      if (firstForUser) {
        broadcast(claim.classroomId, {
          type: 'presence.joined',
          classroomId: claim.classroomId,
          user: claim.user,
          onlineUserIds: onlineParticipants(claim.classroomId),
          sentAt: new Date().toISOString()
        })
      }
    }
  )
}

export default realtimeRoutes
