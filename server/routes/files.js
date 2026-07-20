import { createHash, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { basename, extname, join, relative, resolve } from 'node:path'
import { createReadStream } from 'node:fs'
import { mkdir, open, rename, stat, unlink } from 'node:fs/promises'

import { z } from 'zod'

const idSchema = z
  .object({ id: z.string().uuid('文件 ID 格式不正确') })
  .strict()
const uploadQuerySchema = z
  .object({
    category: z.enum([
      'avatar',
      'course_cover',
      'course_video',
      'course_material'
    ])
  })
  .strict()

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

const DEFAULT_OWNER_STORAGE_BYTES = 250 * 1024 * 1024
const DEFAULT_PLATFORM_STORAGE_BYTES = 5 * 1024 * 1024 * 1024
const DEFAULT_MAX_CONCURRENT_UPLOADS = 4
const MULTIPART_OVERHEAD_BYTES = 1024 * 1024
const HEADER_INSPECTION_BYTES = 512

const extensions = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'application/pdf': '.pdf'
})

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

function startsWith(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

function detectMimeType(buffer) {
  if (
    startsWith(buffer, [0xff, 0xd8, 0xff]) &&
    buffer.length >= 4 &&
    buffer[3] >= 0xc0 &&
    buffer[3] !== 0xff
  ) {
    return 'image/jpeg'
  }
  if (
    startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) &&
    startsWith(buffer, [0x49, 0x48, 0x44, 0x52], 12)
  ) {
    return 'image/png'
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8) &&
    ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.subarray(12, 16).toString('ascii'))
  ) {
    return 'image/webp'
  }
  if (/^%PDF-[12]\.\d/.test(buffer.subarray(0, 8).toString('ascii'))) {
    return 'application/pdf'
  }
  if (
    buffer.length >= 16 &&
    startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4) &&
    buffer.readUInt32BE(0) >= 16 &&
    /^[\x20-\x7e]{4}$/.test(buffer.subarray(8, 12).toString('ascii'))
  ) {
    return 'video/mp4'
  }
  if (
    startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3]) &&
    buffer.indexOf(Buffer.from('webm'), 4) !== -1
  ) {
    return 'video/webm'
  }
  return null
}

class UploadRejectedError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.name = 'UploadRejectedError'
    this.statusCode = statusCode
  }
}

function positiveSafeInteger(value, fallback, name) {
  const candidate = value ?? fallback
  if (!Number.isSafeInteger(candidate) || candidate < 1) {
    throw new TypeError(`${name} must be a positive safe integer`)
  }
  return candidate
}

function resolveUploadLimits(config) {
  const ownerQuotaBytes = positiveSafeInteger(
    config.uploadOwnerQuotaBytes,
    DEFAULT_OWNER_STORAGE_BYTES,
    'uploadOwnerQuotaBytes'
  )
  const totalQuotaBytes = positiveSafeInteger(
    config.uploadTotalQuotaBytes,
    DEFAULT_PLATFORM_STORAGE_BYTES,
    'uploadTotalQuotaBytes'
  )
  const maxConcurrent = positiveSafeInteger(
    config.uploadMaxConcurrent,
    DEFAULT_MAX_CONCURRENT_UPLOADS,
    'uploadMaxConcurrent'
  )
  if (maxConcurrent > 32) {
    throw new TypeError('uploadMaxConcurrent must not exceed 32')
  }
  if (totalQuotaBytes < ownerQuotaBytes) {
    throw new TypeError(
      'uploadTotalQuotaBytes must be greater than or equal to uploadOwnerQuotaBytes'
    )
  }
  return { ownerQuotaBytes, totalQuotaBytes, maxConcurrent }
}

function createUploadCoordinator(db, limits) {
  let ownerUsage
  let platformUsage
  const reservedByOwner = new Map()
  let activeUploads = 0
  let totalReservedBytes = 0

  function committedOwnerBytes(ownerId) {
    ownerUsage ??= db.prepare(
      `SELECT COALESCE(SUM(size_bytes), 0) AS total
       FROM files
       WHERE owner_id = ?`
    )
    return Number(ownerUsage.get(ownerId).total)
  }

  function committedPlatformBytes() {
    platformUsage ??= db.prepare(
      'SELECT COALESCE(SUM(size_bytes), 0) AS total FROM files'
    )
    return Number(platformUsage.get().total)
  }

  return {
    tryStart(ownerId) {
      if (activeUploads >= limits.maxConcurrent) return null

      activeUploads += 1
      let released = false
      let tokenReservedBytes = 0

      function assertOpen() {
        if (released)
          throw new Error('Upload admission has already been released')
      }

      return {
        assertCapacityAvailable() {
          assertOpen()
          const ownerReservedBytes = reservedByOwner.get(ownerId) ?? 0
          if (
            committedOwnerBytes(ownerId) + ownerReservedBytes >=
            limits.ownerQuotaBytes
          ) {
            throw new UploadRejectedError(413, '账户文件存储空间已用尽')
          }
          if (
            committedPlatformBytes() + totalReservedBytes >=
            limits.totalQuotaBytes
          ) {
            throw new UploadRejectedError(507, '平台文件存储空间已用尽')
          }
        },
        reserve(bytes) {
          assertOpen()
          if (!Number.isSafeInteger(bytes) || bytes < 0) {
            throw new TypeError('Reserved upload bytes must be a safe integer')
          }

          const ownerReservedBytes = reservedByOwner.get(ownerId) ?? 0
          if (
            committedOwnerBytes(ownerId) + ownerReservedBytes + bytes >
            limits.ownerQuotaBytes
          ) {
            throw new UploadRejectedError(413, '账户文件存储空间不足')
          }
          if (
            committedPlatformBytes() + totalReservedBytes + bytes >
            limits.totalQuotaBytes
          ) {
            throw new UploadRejectedError(507, '平台文件存储空间不足')
          }

          reservedByOwner.set(ownerId, ownerReservedBytes + bytes)
          totalReservedBytes += bytes
          tokenReservedBytes += bytes
        },
        assertWithinQuota() {
          assertOpen()
          const ownerReservedBytes = reservedByOwner.get(ownerId) ?? 0
          if (
            committedOwnerBytes(ownerId) + ownerReservedBytes >
            limits.ownerQuotaBytes
          ) {
            throw new UploadRejectedError(413, '账户文件存储空间不足')
          }
          if (
            committedPlatformBytes() + totalReservedBytes >
            limits.totalQuotaBytes
          ) {
            throw new UploadRejectedError(507, '平台文件存储空间不足')
          }
        },
        release() {
          if (released) return
          released = true
          activeUploads -= 1
          totalReservedBytes -= tokenReservedBytes

          const remainingOwnerBytes =
            (reservedByOwner.get(ownerId) ?? 0) - tokenReservedBytes
          if (remainingOwnerBytes === 0) reservedByOwner.delete(ownerId)
          else reservedByOwner.set(ownerId, remainingOwnerBytes)
        }
      }
    }
  }
}

async function writeAll(fileHandle, chunk, position) {
  let offset = 0
  while (offset < chunk.length) {
    const { bytesWritten } = await fileHandle.write(
      chunk,
      offset,
      chunk.length - offset,
      position + offset
    )
    if (bytesWritten === 0)
      throw new Error('Unable to make progress writing upload')
    offset += bytesWritten
  }
}

async function unlinkIfPresent(targetFile) {
  try {
    await unlink(targetFile)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function streamPartToFile(part, targetFile, maxBytes, admission) {
  const hash = createHash('sha256')
  const header = Buffer.alloc(HEADER_INSPECTION_BYTES)
  let headerLength = 0
  let sizeBytes = 0
  let fileHandle
  let created = false

  try {
    fileHandle = await open(targetFile, 'wx', 0o600)
    created = true

    for await (const value of part.file) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
      if (sizeBytes + chunk.length > maxBytes) {
        throw new UploadRejectedError(413, '文件超过该类型允许的大小')
      }

      admission.reserve(chunk.length)
      hash.update(chunk)

      if (headerLength < HEADER_INSPECTION_BYTES) {
        const bytesToCopy = Math.min(
          chunk.length,
          HEADER_INSPECTION_BYTES - headerLength
        )
        chunk.copy(header, headerLength, 0, bytesToCopy)
        headerLength += bytesToCopy
      }

      await writeAll(fileHandle, chunk, sizeBytes)
      sizeBytes += chunk.length
    }

    if (part.file.truncated) {
      throw new UploadRejectedError(413, '文件超过该类型允许的大小')
    }
    if (sizeBytes === 0) throw new UploadRejectedError(400, '文件不能为空')

    await fileHandle.sync()
    await fileHandle.close()
    fileHandle = null
    return {
      header: header.subarray(0, headerLength),
      sha256: hash.digest('hex'),
      sizeBytes
    }
  } catch (error) {
    if (fileHandle) await fileHandle.close().catch(() => {})
    if (created) await unlinkIfPresent(targetFile)
    throw error
  }
}

function safeOriginalName(value) {
  const candidate = basename(String(value || 'upload').normalize('NFC'))
    .split('')
    .filter((character) => {
      const codePoint = character.codePointAt(0)
      return codePoint > 31 && codePoint !== 127
    })
    .join('')
    .trim()
  if (!candidate) return 'upload'
  if (candidate.length <= 255) return candidate

  const extension = extname(candidate).slice(0, 20)
  return `${candidate.slice(0, Math.max(1, 255 - extension.length))}${extension}`
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

function resolveStoredFile(uploadDir, storageKey) {
  const root = resolve(uploadDir)
  const target = resolve(root, storageKey)
  const pathWithinRoot = relative(root, target)
  if (
    !pathWithinRoot ||
    pathWithinRoot.startsWith('..') ||
    pathWithinRoot.includes(':')
  ) {
    return null
  }
  return target
}

function contentDisposition(originalName) {
  const encoded = encodeURIComponent(originalName).replaceAll("'", '%27')
  return `inline; filename*=UTF-8''${encoded}`
}

export async function fileRoutes(app) {
  const db = app.db
  if (!db) throw new Error('fileRoutes requires app.db')

  const uploadDir = app.config?.uploadDir
  if (!uploadDir) throw new Error('fileRoutes requires app.config.uploadDir')
  const uploadLimits = resolveUploadLimits(app.config)
  const uploadCoordinator = createUploadCoordinator(db, uploadLimits)
  const temporaryUploadDir = join(uploadDir, '.tmp')

  app.post(
    '/api/v1/files',
    {
      preHandler: app.authenticate,
      config: { rateLimit: { max: 12, timeWindow: '1 minute' } }
    },
    async (request, reply) => {
      const queryResult = uploadQuerySchema.safeParse(request.query ?? {})
      if (!queryResult.success) return validationError(reply, queryResult)

      const category = queryResult.data.category
      const policy = categories[category]
      if (policy.roles && !policy.roles.has(request.auth.user.role)) {
        return responseError(reply, 403, '当前角色不能上传该类型文件')
      }

      const declaredLength = Number(request.headers['content-length'])
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > policy.maxBytes + MULTIPART_OVERHEAD_BYTES
      ) {
        return responseError(reply, 413, '文件超过该类型允许的大小')
      }

      let admission = uploadCoordinator.tryStart(request.auth.user.id)
      if (!admission) {
        reply.header('Retry-After', '1')
        return responseError(reply, 503, '上传任务繁忙，请稍后重试')
      }

      let cleanupFile = null
      try {
        admission.assertCapacityAvailable()

        const part = await request.file({
          limits: { files: 1, fileSize: policy.maxBytes }
        })
        if (!part) throw new UploadRejectedError(400, '请选择需要上传的文件')

        await mkdir(temporaryUploadDir, { recursive: true })
        const temporaryFile = join(temporaryUploadDir, `${randomUUID()}.upload`)
        const streamed = await streamPartToFile(
          part,
          temporaryFile,
          policy.maxBytes,
          admission
        )
        cleanupFile = temporaryFile

        const detectedMimeType = detectMimeType(streamed.header)
        if (!detectedMimeType || !policy.mimeTypes.has(detectedMimeType)) {
          throw new UploadRejectedError(415, '文件内容与所选类型不匹配')
        }

        admission.assertWithinQuota()

        const id = randomUUID()
        const storageName = `${randomUUID()}${extensions[detectedMimeType]}`
        const storageKey = `${category}/${storageName}`
        const targetDir = join(uploadDir, category)
        const targetFile = join(targetDir, storageName)
        const originalName = safeOriginalName(part.filename)
        const createdAt = new Date().toISOString()

        await mkdir(targetDir, { recursive: true })
        await rename(temporaryFile, targetFile)
        cleanupFile = targetFile

        db.prepare(
          `INSERT INTO files (
            id, owner_id, storage_key, original_name, mime_type, size_bytes,
            sha256, category, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          request.auth.user.id,
          storageKey,
          originalName,
          detectedMimeType,
          streamed.sizeBytes,
          streamed.sha256,
          category,
          createdAt
        )
        cleanupFile = null
        admission.release()
        admission = null
        const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
        return responseData(reply, fileData(row), '文件已上传', 201)
      } catch (error) {
        if (
          error instanceof UploadRejectedError ||
          error?.code === 'FST_REQ_FILE_TOO_LARGE'
        ) {
          const statusCode = error.statusCode ?? 413
          const message =
            error instanceof UploadRejectedError
              ? error.message
              : '文件超过该类型允许的大小'
          if (cleanupFile) {
            await unlinkIfPresent(cleanupFile)
            cleanupFile = null
          }
          admission?.release()
          admission = null
          return responseError(reply, statusCode, message)
        }
        throw error
      } finally {
        if (cleanupFile) await unlinkIfPresent(cleanupFile)
        admission?.release()
      }
    }
  )

  app.get('/api/v1/files/:id/content', async (request, reply) => {
    const result = idSchema.safeParse(request.params)
    if (!result.success) return validationError(reply, result)

    const row = db
      .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
      .get(result.data.id)
    if (!row) return responseError(reply, 404, '文件不存在')

    const policy = categories[row.category]
    if (!policy?.public) {
      await app.authenticate(request, reply)
      if (reply.sent) return
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      ) {
        return responseError(reply, 403, '没有权限读取该文件')
      }
    }

    const targetFile = resolveStoredFile(uploadDir, row.storage_key)
    if (!targetFile) return responseError(reply, 404, '文件不存在')

    let fileStats
    try {
      fileStats = await stat(targetFile)
    } catch (error) {
      if (error?.code === 'ENOENT')
        return responseError(reply, 404, '文件不存在')
      throw error
    }

    reply
      .type(row.mime_type)
      .header('Content-Length', String(fileStats.size))
      .header('Content-Disposition', contentDisposition(row.original_name))
      .header('X-Content-Type-Options', 'nosniff')
      .header(
        'Cache-Control',
        policy.public
          ? 'public, max-age=31536000, immutable'
          : 'private, no-store'
      )
    return reply.send(createReadStream(targetFile))
  })

  app.get(
    '/api/v1/files/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = idSchema.safeParse(request.params)
      if (!result.success) return validationError(reply, result)

      const row = db
        .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
        .get(result.data.id)
      if (!row) return responseError(reply, 404, '文件不存在')
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      ) {
        return responseError(reply, 403, '没有权限查看文件信息')
      }

      return responseData(reply, fileData(row))
    }
  )

  app.delete(
    '/api/v1/files/:id',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const result = idSchema.safeParse(request.params)
      if (!result.success) return validationError(reply, result)

      const row = db
        .prepare('SELECT * FROM files WHERE id = ? LIMIT 1')
        .get(result.data.id)
      if (!row) return responseError(reply, 404, '文件不存在')
      if (
        row.owner_id !== request.auth.user.id &&
        request.auth.user.role !== 'administrator'
      ) {
        return responseError(reply, 403, '没有权限删除文件')
      }

      const targetFile = resolveStoredFile(uploadDir, row.storage_key)
      if (targetFile) await unlinkIfPresent(targetFile)
      db.prepare('DELETE FROM files WHERE id = ?').run(row.id)
      return responseData(reply, { id: row.id }, '文件已删除')
    }
  )
}

export default fileRoutes
