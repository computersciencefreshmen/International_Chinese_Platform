import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'

import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import Fastify from 'fastify'

import { createDatabase } from '../db/database.js'
import { hashPassword } from '../lib/password.js'
import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import fileRoutes from '../routes/files.js'

function authorization(token) {
  return { authorization: `Bearer ${token}` }
}

function multipartBody({ content, filename, mimeType }) {
  const boundary = `test-${randomUUID()}`
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  return {
    body: Buffer.concat([prefix, content, suffix]),
    contentType: `multipart/form-data; boundary=${boundary}`
  }
}

async function createTestApp(t) {
  const uploadDir = await mkdtemp(join(tmpdir(), 'chinese-platform-files-'))
  const db = createDatabase({ filename: ':memory:' })
  const app = Fastify({ logger: false })
  app.decorate('db', db)
  app.decorate('config', { uploadDir })

  await app.register(cookie)
  await app.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024, fields: 10 }
  })
  await authPlugin(app, {
    db,
    allowBearer: true,
    secureCookies: false,
    sessionTtlSeconds: 3600
  })
  await app.register(fileRoutes)

  const now = new Date().toISOString()
  const passwordHash = await hashPassword('FileTest123!')
  const users = {}
  for (const name of ['owner', 'other']) {
    const id = randomUUID()
    db.prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'teacher', ?, 'active', ?, ?)`
    ).run(id, `${name}@file.test`, passwordHash, name, now, now)
    users[name] = {
      id,
      token: createSession(db, id, { ttlSeconds: 3600 }).token
    }
  }

  await app.ready()
  t.after(async () => {
    await app.close()
    db.close()
    await rm(uploadDir, { recursive: true, force: true })
  })

  return { app, db, users }
}

test('validated image upload is public while metadata and deletion remain owned', async (t) => {
  const { app, db, users } = await createTestApp(t)
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('portfolio-image')
  ])
  const form = multipartBody({
    content: png,
    filename: '课程封面.png',
    mimeType: 'image/png'
  })

  const upload = await app.inject({
    method: 'POST',
    url: '/api/v1/files?category=course_cover',
    headers: {
      ...authorization(users.owner.token),
      'content-type': form.contentType
    },
    payload: form.body
  })
  assert.equal(upload.statusCode, 201)
  assert.equal(upload.json().data.mimeType, 'image/png')
  assert.equal(upload.json().data.ownerId, users.owner.id)
  assert.equal(upload.json().data.sha256.length, 64)
  const fileId = upload.json().data.id

  const content = await app.inject({
    method: 'GET',
    url: `/api/v1/files/${fileId}/content`
  })
  assert.equal(content.statusCode, 200)
  assert.equal(content.headers['content-type'], 'image/png')
  assert.deepEqual(content.rawPayload, png)

  const otherMetadata = await app.inject({
    method: 'GET',
    url: `/api/v1/files/${fileId}`,
    headers: authorization(users.other.token)
  })
  assert.equal(otherMetadata.statusCode, 403)

  const otherDelete = await app.inject({
    method: 'DELETE',
    url: `/api/v1/files/${fileId}`,
    headers: authorization(users.other.token)
  })
  assert.equal(otherDelete.statusCode, 403)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM files').get().count, 1)

  const ownerDelete = await app.inject({
    method: 'DELETE',
    url: `/api/v1/files/${fileId}`,
    headers: authorization(users.owner.token)
  })
  assert.equal(ownerDelete.statusCode, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM files').get().count, 0)
})

test('magic-byte validation rejects disguised files and protects private material', async (t) => {
  const { app, db, users } = await createTestApp(t)
  const disguised = multipartBody({
    content: Buffer.from('%PDF-1.7 disguised as an image'),
    filename: 'avatar.png',
    mimeType: 'image/png'
  })
  const invalid = await app.inject({
    method: 'POST',
    url: '/api/v1/files?category=avatar',
    headers: {
      ...authorization(users.owner.token),
      'content-type': disguised.contentType
    },
    payload: disguised.body
  })
  assert.equal(invalid.statusCode, 415)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM files').get().count, 0)

  const pdf = Buffer.from('%PDF-1.7 portfolio material')
  const material = multipartBody({
    content: pdf,
    filename: 'lesson.pdf',
    mimeType: 'application/pdf'
  })
  const upload = await app.inject({
    method: 'POST',
    url: '/api/v1/files?category=course_material',
    headers: {
      ...authorization(users.owner.token),
      'content-type': material.contentType
    },
    payload: material.body
  })
  assert.equal(upload.statusCode, 201)

  const anonymousContent = await app.inject({
    method: 'GET',
    url: upload.json().data.url
  })
  assert.equal(anonymousContent.statusCode, 401)

  const authenticatedContent = await app.inject({
    method: 'GET',
    url: upload.json().data.url,
    headers: authorization(users.other.token)
  })
  assert.equal(authenticatedContent.statusCode, 200)
  assert.deepEqual(authenticatedContent.rawPayload, pdf)
})
