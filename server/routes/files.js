import { createHash, randomUUID } from 'node:crypto'
import { basename, extname, join, relative, resolve } from 'node:path'
import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'

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
    public: true
  },
  course_cover: {
    maxBytes: 8 * 1024 * 1024,
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    public: true
  },
  course_video: {
    maxBytes: 50 * 1024 * 1024,
    mimeTypes: new Set(['video/mp4', 'video/webm']),
    public: false
  },
  course_material: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: new Set(['application/pdf']),
    public: false
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
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp'
  }
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return 'application/pdf'
  }
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return 'video/mp4'
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm'
  return null
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

  app.post(
    '/api/v1/files',
    { preHandler: app.authenticate },
    async (request, reply) => {
      const queryResult = uploadQuerySchema.safeParse(request.query ?? {})
      if (!queryResult.success) return validationError(reply, queryResult)

      const category = queryResult.data.category
      const policy = categories[category]
      let part
      try {
        part = await request.file({
          limits: { files: 1, fileSize: policy.maxBytes }
        })
      } catch (error) {
        if (error?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return responseError(reply, 413, '文件超过该类型允许的大小')
        }
        throw error
      }

      if (!part) return responseError(reply, 400, '请选择需要上传的文件')

      let buffer
      try {
        buffer = await part.toBuffer()
      } catch (error) {
        if (error?.code === 'FST_REQ_FILE_TOO_LARGE') {
          return responseError(reply, 413, '文件超过该类型允许的大小')
        }
        throw error
      }

      if (part.file.truncated || buffer.length > policy.maxBytes) {
        return responseError(reply, 413, '文件超过该类型允许的大小')
      }
      if (buffer.length === 0) return responseError(reply, 400, '文件不能为空')

      const detectedMimeType = detectMimeType(buffer)
      if (!detectedMimeType || !policy.mimeTypes.has(detectedMimeType)) {
        return responseError(reply, 415, '文件内容与所选类型不匹配')
      }

      const id = randomUUID()
      const storageName = `${randomUUID()}${extensions[detectedMimeType]}`
      const storageKey = `${category}/${storageName}`
      const targetDir = join(uploadDir, category)
      const targetFile = join(targetDir, storageName)
      const originalName = safeOriginalName(part.filename)
      const sha256 = createHash('sha256').update(buffer).digest('hex')
      const createdAt = new Date().toISOString()

      await mkdir(targetDir, { recursive: true })
      await writeFile(targetFile, buffer, { flag: 'wx' })

      try {
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
          buffer.length,
          sha256,
          category,
          createdAt
        )
      } catch (error) {
        await unlink(targetFile).catch(() => {})
        throw error
      }

      const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
      return responseData(reply, fileData(row), '文件已上传', 201)
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

      db.prepare('DELETE FROM files WHERE id = ?').run(row.id)
      const targetFile = resolveStoredFile(uploadDir, row.storage_key)
      if (targetFile) await unlink(targetFile).catch(() => {})
      return responseData(reply, { id: row.id }, '文件已删除')
    }
  )
}

export default fileRoutes
