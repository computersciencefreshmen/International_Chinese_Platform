import { createHash, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { basename, extname } from 'node:path'

import { z } from 'zod'

const categories = Object.freeze({
  avatar: {
    maxBytes: 5 * 1024 * 1024,
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    public: true,
    roles: null
  },
  course_cover: {
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    public: true,
    roles: new Set(['teacher', 'administrator'])
  },
  course_video: {
    maxBytes: 25 * 1024 * 1024,
    mimeTypes: new Set(['video/mp4', 'video/webm']),
    public: false,
    roles: new Set(['teacher', 'administrator'])
  },
  course_material: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: new Set(['application/pdf']),
    public: false,
    roles: new Set(['teacher', 'administrator'])
  }
})

const extensions = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf'
})

const idSchema = z.object({ id: z.string().uuid('ID 格式不正确') }).strict()
const createIntentSchema = z
  .object({
    category: z.enum(Object.keys(categories)),
    originalName: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(120),
    sizeBytes: z.coerce
      .number()
      .int()
      .positive()
      .max(50 * 1024 * 1024)
  })
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

function safeOriginalName(value) {
  const name = basename(String(value || 'upload').normalize('NFC'))
    .split('')
    .filter((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint > 31 && codePoint !== 127
    })
    .join('')
    .trim()
  if (!name) return 'upload'
  if (name.length <= 255) return name
  const extension = extname(name).slice(0, 20)
  return `${name.slice(0, Math.max(1, 255 - extension.length))}${extension}`
}

function startsWith(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

function detectMimeType(buffer) {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    startsWith(buffer, [0x49, 0x48, 0x44, 0x52], 12)
  )
    return 'image/png'
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  )
    return 'image/webp'
  if (/^%PDF-[12]\.\d/.test(buffer.subarray(0, 8).toString('ascii')))
    return 'application/pdf'
  if (buffer.length >= 16 && startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4))
    return 'video/mp4'
  if (
    startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]) &&
    buffer.indexOf(Buffer.from('webm'), 4) !== -1
  )
    return 'video/webm'
  return null
}

function contentDisposition(originalName) {
  const encoded = encodeURIComponent(originalName).replaceAll("'", '%27')
  return `inline; filename*=UTF-8''${encoded}`
}

function fileData(row) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    sha256: row.sha256,
    category: row.category,
    url: `/api/v1/files/${row.id}/content`,
    createdAt: row.created_at
  }
}

function resolveLimits(config) {
  const ownerQuota = Number(config.uploadOwnerQuotaBytes)
  const platformQuota = Number(config.uploadTotalQuotaBytes)
  const maxConcurrent = Number(config.uploadMaxConcurrent)
  if (!Number.isSafeInteger(ownerQuota) || ownerQuota < 1)
    throw new TypeError('uploadOwnerQuotaBytes must be a positive safe integer')
  if (!Number.isSafeInteger(platformQuota) || platformQuota < ownerQuota)
    throw new TypeError(
      'uploadTotalQuotaBytes must be at least the owner quota'
    )
  if (
    !Number.isInteger(maxConcurrent) ||
    maxConcurrent < 1 ||
    maxConcurrent > 32
  )
    throw new TypeError(
      'uploadMaxConcurrent must be an integer between 1 and 32'
    )
  return { ownerQuota, platformQuota, maxConcurrent }
}

function isMissingObject(error) {
  return ['NoSuchKey', 'NotFound', '404'].includes(
    String(error?.name ?? error?.$metadata?.httpStatusCode)
  )
}

function isPreconditionFailed(error) {
  return ['PreconditionFailed', '412'].includes(
    String(error?.name ?? error?.$metadata?.httpStatusCode)
  )
}

async function inspectObject(storage, key, maxBytes) {
  const object = await storage.read(key)
  if (!object.ETag) {
    throw Object.assign(new Error('OBJECT_ETAG_MISSING'), {
      statusCode: 502
    })
  }
  const hash = createHash('sha256')
  const header = Buffer.alloc(512)
  let headerLength = 0
  let sizeBytes = 0

  for await (const value of object.Body) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    sizeBytes += chunk.length
    if (sizeBytes > maxBytes)
      throw Object.assign(new Error('FILE_TOO_LARGE'), { statusCode: 413 })
    hash.update(chunk)
    if (headerLength < header.length) {
      const count = Math.min(chunk.length, header.length - headerLength)
      chunk.copy(header, headerLength, 0, count)
      headerLength += count
    }
  }
  if (sizeBytes === 0)
    throw Object.assign(new Error('EMPTY_FILE'), { statusCode: 400 })
  return {
    detectedMimeType: detectMimeType(header.subarray(0, headerLength)),
    etag: object.ETag,
    sha256: hash.digest('hex'),
    sizeBytes
  }
}

export async function fileRoutes(app) {
  const db = app.db
  const storage = app.objectStorage
  if (!db) throw new Error('fileRoutes requires app.db')

  const { ownerQuota, platformQuota, maxConcurrent } = resolveLimits(app.config)

  let cleanupPromise = null

  async function enqueueCleanup(storageKey, reason, notBefore = new Date()) {
    const timestamp = new Date().toISOString()
    const nextAttemptAt = new Date(notBefore).toISOString()
    await db
      .prepare(
        `INSERT INTO object_cleanup_jobs (
           storage_key, reason, attempts, next_attempt_at, created_at, updated_at
         ) VALUES (?, ?, 0, ?, ?, ?)
         ON CONFLICT (storage_key) DO UPDATE SET
           reason = EXCLUDED.reason,
           next_attempt_at = GREATEST(
             object_cleanup_jobs.next_attempt_at,
             EXCLUDED.next_attempt_at
           ),
           updated_at = EXCLUDED.updated_at`
      )
      .run(storageKey, reason, nextAttemptAt, timestamp, timestamp)
  }

  async function enqueueIntentCleanup(intent, reason) {
    const expiresAt = Date.parse(intent.expires_at)
    const notBefore = new Date(
      Math.max(Date.now(), Number.isFinite(expiresAt) ? expiresAt + 60_000 : 0)
    )
    await enqueueCleanup(intent.storage_key, reason, notBefore)
  }

  async function runCleanupJobs() {
    if (!storage) return
    if (cleanupPromise) return cleanupPromise
    cleanupPromise = (async () => {
      const rows = await db
        .prepare(
          `SELECT * FROM object_cleanup_jobs
           WHERE next_attempt_at <= ?
           ORDER BY next_attempt_at, attempts
           LIMIT 25`
        )
        .all(new Date().toISOString())
      for (const row of rows) {
        try {
          await storage.delete(row.storage_key)
          await db
            .prepare('DELETE FROM object_cleanup_jobs WHERE storage_key = ?')
            .run(row.storage_key)
        } catch (error) {
          const attempts = Number(row.attempts) + 1
          const delaySeconds = Math.min(3600, 2 ** Math.min(attempts, 10))
          await db
            .prepare(
              `UPDATE object_cleanup_jobs
               SET attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ?
               WHERE storage_key = ?`
            )
            .run(
              attempts,
              new Date(Date.now() + delaySeconds * 1000).toISOString(),
              String(error?.message ?? error).slice(0, 1000),
              new Date().toISOString(),
              row.storage_key
            )
        }
      }
    })()
    try {
      return await cleanupPromise
    } finally {
      cleanupPromise = null
    }
  }

  async function cancelIntent(intent, reason) {
    const cancel = db.transaction(async () => {
      const result = await db
        .prepare(
          `UPDATE upload_intents
           SET status = 'cancelled', validation_started_at = NULL
           WHERE id = ? AND status IN ('pending', 'validating')`
        )
        .run(intent.id)
      if (result.changes === 1) await enqueueIntentCleanup(intent, reason)
      return result.changes === 1
    })
    return cancel()
  }

  async function resetIntent(intent) {
    const reset = await db
      .prepare(
        `UPDATE upload_intents
         SET status = 'pending', validation_started_at = NULL
         WHERE id = ? AND status = 'validating' AND expires_at > ?`
      )
      .run(intent.id, new Date().toISOString())
    if (reset.changes !== 1) await expireIntents()
  }

  async function expireIntents() {
    if (!storage) return
    const now = new Date()
    const staleValidation = new Date(now.getTime() - 5 * 60 * 1000)
    const expire = db.transaction(async () => {
      const rows = await db
        .prepare(
          `UPDATE upload_intents
           SET status = 'expired', validation_started_at = NULL
           WHERE (status = 'pending' AND expires_at <= ?)
              OR (status = 'validating' AND validation_started_at <= ?)
           RETURNING *`
        )
        .all(now.toISOString(), staleValidation.toISOString())
      for (const row of rows) {
        await enqueueIntentCleanup(row, 'expired_upload_intent')
      }
    })
    await expire()
    await runCleanupJobs()
  }

  const cleanupTimer = setInterval(() => {
    expireIntents().catch((error) =>
      app.log.warn({ err: error }, 'Upload cleanup cycle failed')
    )
  }, 60 * 1000)
  cleanupTimer.unref()
  app.addHook('onClose', async () => clearInterval(cleanupTimer))

  app.post(
    '/api/v1/files/upload-intents',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } }
    },
    async (request, reply) => {
      if (!storage) return responseError(reply, 503, '文件存储服务尚未配置')
      const result = createIntentSchema.safeParse(request.body ?? {})
      if (!result.success) return validationError(reply, result)
      const input = result.data
      const policy = categories[input.category]
      if (policy.roles && !policy.roles.has(request.auth.user.role))
        return responseError(reply, 403, '当前角色不能上传该类型文件')
      if (!policy.mimeTypes.has(input.mimeType))
        return responseError(reply, 415, '文件类型不受支持')
      if (input.sizeBytes > policy.maxBytes)
        return responseError(reply, 413, '文件超过该类型允许的大小')

      await expireIntents()
      const id = randomUUID()
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
      const storageKey = `tmp/uploads/${request.auth.user.id}/${id}${extensions[input.mimeType]}`
      const reserve = db.transaction(async () => {
        await db.exec(
          "SELECT pg_advisory_xact_lock(hashtext('file-upload-quota'))"
        )
        const usage = await db
          .prepare(
            `SELECT
               COALESCE((SELECT SUM(size_bytes) FROM files WHERE owner_id = ?), 0) +
               COALESCE((SELECT SUM(declared_size_bytes) FROM upload_intents
                         WHERE owner_id = ? AND status IN ('pending', 'validating')), 0) AS owner_total,
               COALESCE((SELECT SUM(size_bytes) FROM files), 0) +
               COALESCE((SELECT SUM(declared_size_bytes) FROM upload_intents
                         WHERE status IN ('pending', 'validating')), 0) AS platform_total,
               (SELECT COUNT(*) FROM upload_intents
                WHERE owner_id = ? AND status IN ('pending', 'validating')) AS active_count`
          )
          .get(request.auth.user.id, request.auth.user.id, request.auth.user.id)
        if (Number(usage.active_count) >= maxConcurrent)
          throw Object.assign(new Error('TOO_MANY_UPLOADS'), {
            statusCode: 429
          })
        if (Number(usage.owner_total) + input.sizeBytes > ownerQuota)
          throw Object.assign(new Error('OWNER_QUOTA'), { statusCode: 413 })
        if (Number(usage.platform_total) + input.sizeBytes > platformQuota)
          throw Object.assign(new Error('PLATFORM_QUOTA'), { statusCode: 507 })
        await db
          .prepare(
            `INSERT INTO upload_intents (
               id, owner_id, storage_key, original_name, declared_mime_type,
               declared_size_bytes, category, expires_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            id,
            request.auth.user.id,
            storageKey,
            safeOriginalName(input.originalName),
            input.mimeType,
            input.sizeBytes,
            input.category,
            expiresAt
          )
      })
      try {
        await reserve()
      } catch (error) {
        const messages = {
          TOO_MANY_UPLOADS: '并发上传数量已达上限',
          OWNER_QUOTA: '账户文件存储空间不足',
          PLATFORM_QUOTA: '平台文件存储空间不足'
        }
        if (error.statusCode)
          return responseError(
            reply,
            error.statusCode,
            messages[error.message] ?? '无法创建上传任务'
          )
        throw error
      }

      try {
        const uploadUrl = await storage.createUploadUrl({
          key: storageKey,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes
        })
        return responseData(
          reply,
          {
            id,
            uploadUrl,
            method: 'PUT',
            headers: { 'Content-Type': input.mimeType },
            expiresAt
          },
          '上传任务已创建',
          201
        )
      } catch (error) {
        await db
          .prepare(
            "UPDATE upload_intents SET status = 'cancelled' WHERE id = ?"
          )
          .run(id)
        throw error
      }
    }
  )

  app.post(
    '/api/v1/files/upload-intents/:id/complete',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 8, timeWindow: '1 minute' } }
    },
    async (request, reply) => {
      if (!storage) return responseError(reply, 503, '文件存储服务尚未配置')
      const params = idSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)
      const now = new Date().toISOString()
      const intent = await db
        .prepare(
          `UPDATE upload_intents
           SET status = 'validating', validation_started_at = ?
           WHERE id = ? AND owner_id = ? AND status = 'pending' AND expires_at > ?
           RETURNING *`
        )
        .get(now, params.data.id, request.auth.user.id, now)

      if (!intent) {
        const existing = await db
          .prepare('SELECT * FROM upload_intents WHERE id = ? LIMIT 1')
          .get(params.data.id)
        if (!existing || existing.owner_id !== request.auth.user.id)
          return responseError(reply, 404, '上传任务不存在')
        if (existing.status === 'completed' && existing.file_id) {
          const file = await db
            .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
            .get(existing.file_id)
          if (file) return responseData(reply, fileData(file), '文件已上传')
        }
        if (
          existing.status === 'expired' ||
          (existing.status === 'pending' && existing.expires_at <= now)
        ) {
          await expireIntents()
          return responseError(reply, 410, '上传任务已过期')
        }
        return responseError(reply, 409, '上传任务正在验证或已结束')
      }

      let inspected
      try {
        inspected = await inspectObject(
          storage,
          intent.storage_key,
          categories[intent.category].maxBytes
        )
      } catch (error) {
        if (isMissingObject(error)) {
          await resetIntent(intent)
          return responseError(reply, 409, '尚未收到上传文件')
        }
        if (error.statusCode) {
          await cancelIntent(intent, 'invalid_upload_object')
          return responseError(reply, error.statusCode, '文件验证失败')
        }
        await resetIntent(intent)
        throw error
      }

      if (
        inspected.sizeBytes !== Number(intent.declared_size_bytes) ||
        inspected.detectedMimeType !== intent.declared_mime_type
      ) {
        await cancelIntent(intent, 'upload_declaration_mismatch')
        return responseError(reply, 415, '文件内容与声明信息不一致')
      }

      const fileId = randomUUID()
      const finalKey = `files/${intent.owner_id}/${fileId}${extensions[intent.declared_mime_type]}`
      await enqueueCleanup(
        finalKey,
        'uncommitted_file_promotion',
        new Date(Date.now() + 10 * 60 * 1000)
      )

      try {
        await storage.copy({
          sourceKey: intent.storage_key,
          destinationKey: finalKey,
          sourceEtag: inspected.etag,
          mimeType: inspected.detectedMimeType,
          sha256: inspected.sha256
        })
      } catch (error) {
        if (isPreconditionFailed(error)) {
          await cancelIntent(intent, 'upload_changed_during_validation')
          return responseError(reply, 409, '上传文件在验证过程中发生变化')
        }
        await resetIntent(intent)
        throw error
      }

      const completedAt = new Date().toISOString()
      const complete = db.transaction(async () => {
        await db
          .prepare(
            `INSERT INTO files (
               id, owner_id, storage_key, original_name, mime_type,
               size_bytes, sha256, category, created_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            fileId,
            intent.owner_id,
            finalKey,
            intent.original_name,
            inspected.detectedMimeType,
            inspected.sizeBytes,
            inspected.sha256,
            intent.category,
            completedAt
          )
        const updated = await db
          .prepare(
            `UPDATE upload_intents
             SET status = 'completed', completed_at = ?, file_id = ?
             WHERE id = ? AND status = 'validating'`
          )
          .run(completedAt, fileId, intent.id)
        if (updated.changes !== 1) throw new Error('INTENT_STATE_CHANGED')
        await db
          .prepare('DELETE FROM object_cleanup_jobs WHERE storage_key = ?')
          .run(finalKey)
        await enqueueIntentCleanup(intent, 'promoted_upload_source')
      })

      try {
        await complete()
      } catch (error) {
        await resetIntent(intent)
        if (error.message === 'INTENT_STATE_CHANGED')
          return responseError(reply, 409, '上传任务状态已变化')
        throw error
      }

      runCleanupJobs().catch((error) =>
        request.log.warn({ err: error }, 'Post-promotion cleanup failed')
      )
      const row = await db
        .prepare('SELECT * FROM files WHERE id = ?')
        .get(fileId)
      return responseData(reply, fileData(row), '文件已上传', 201)
    }
  )

  app.delete(
    '/api/v1/files/upload-intents/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = idSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)
      const intent = await db
        .prepare('SELECT * FROM upload_intents WHERE id = ?')
        .get(params.data.id)
      if (!intent || intent.owner_id !== request.auth.user.id)
        return responseError(reply, 404, '上传任务不存在')
      await cancelIntent(intent, 'cancelled_upload_intent')
      runCleanupJobs().catch((error) =>
        request.log.warn({ err: error }, 'Cancelled upload cleanup failed')
      )
      return responseData(reply, { id: intent.id }, '上传任务已取消')
    }
  )

  app.get('/api/v1/files/:id/content', async (request, reply) => {
    if (!storage) return responseError(reply, 503, '文件存储服务尚未配置')
    const params = idSchema.safeParse(request.params)
    if (!params.success) return validationError(reply, params)
    const row = await db
      .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
      .get(params.data.id)
    if (!row) return responseError(reply, 404, '文件不存在')
    const policy = categories[row.category]
    if (!policy.public) {
      await app.authenticate(request, reply)
      if (reply.sent) return
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      )
        return responseError(reply, 403, '没有权限读取该文件')
    }
    try {
      const url = await storage.createDownloadUrl({
        key: row.storage_key,
        contentDisposition: contentDisposition(row.original_name),
        contentType: row.mime_type
      })
      return reply
        .header(
          'Cache-Control',
          policy.public ? 'public, max-age=300' : 'private, no-store'
        )
        .redirect(url, 302)
    } catch (error) {
      if (isMissingObject(error)) return responseError(reply, 404, '文件不存在')
      throw error
    }
  })

  app.get(
    '/api/v1/files/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = idSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)
      const row = await db
        .prepare('SELECT * FROM files WHERE id = ?')
        .get(params.data.id)
      if (!row) return responseError(reply, 404, '文件不存在')
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      )
        return responseError(reply, 403, '没有权限查看文件信息')
      return responseData(reply, fileData(row))
    }
  )

  app.delete(
    '/api/v1/files/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = idSchema.safeParse(request.params)
      if (!params.success) return validationError(reply, params)
      const row = await db
        .prepare('SELECT * FROM files WHERE id = ?')
        .get(params.data.id)
      if (!row) return responseError(reply, 404, '文件不存在')
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      )
        return responseError(reply, 403, '没有权限删除文件')
      const remove = db.transaction(async () => {
        await db.prepare('DELETE FROM files WHERE id = ?').run(row.id)
        await enqueueCleanup(row.storage_key, 'deleted_file')
      })
      await remove()
      try {
        await runCleanupJobs()
      } catch (error) {
        request.log.warn(
          { err: error, fileId: row.id },
          'Object cleanup failed'
        )
      }
      return responseData(reply, { id: row.id }, '文件已删除')
    }
  )
}

export { categories, detectMimeType }
export default fileRoutes
