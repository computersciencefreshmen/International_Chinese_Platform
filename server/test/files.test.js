import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHash, randomUUID } from 'node:crypto'
import test from 'node:test'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'

import { createSession } from '../lib/session.js'
import authPlugin from '../plugins/auth.js'
import fileRoutes from '../routes/files.js'
import { createTestDatabase } from './support/database.js'

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44,
  0x52, 1, 2, 3, 4
])
const PDF = Buffer.from('%PDF-1.7\nexample')

function objectEtag(body) {
  return `"${createHash('sha256').update(body).digest('hex')}"`
}

function createFakeStorage() {
  const objects = new Map()
  const promotions = []
  let readCalls = 0
  return {
    objects,
    promotions,
    get readCalls() {
      return readCalls
    },
    async probe() {
      return 'up'
    },
    async createUploadUrl({ key }) {
      return `https://objects.test/${encodeURIComponent(key)}`
    },
    putFromUrl(url, body) {
      const key = decodeURIComponent(new URL(url).pathname.slice(1))
      objects.set(key, Buffer.from(body))
      return key
    },
    async read(key) {
      readCalls += 1
      const body = objects.get(key)
      if (!body)
        throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
      return {
        ETag: objectEtag(body),
        Body: (async function* () {
          yield body
        })()
      }
    },
    async copy({ sourceKey, destinationKey, sourceEtag }) {
      const body = objects.get(sourceKey)
      if (!body)
        throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
      if (objectEtag(body) !== sourceEtag) {
        throw Object.assign(new Error('changed'), {
          name: 'PreconditionFailed',
          $metadata: { httpStatusCode: 412 }
        })
      }
      objects.set(destinationKey, Buffer.from(body))
      promotions.push({ sourceKey, destinationKey })
    },
    async createDownloadUrl({ key }) {
      if (!objects.has(key))
        throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
      return `https://objects.test/download/${encodeURIComponent(key)}`
    },
    async delete(key) {
      objects.delete(key)
    }
  }
}

async function addUser(database, role) {
  const id = randomUUID()
  await database
    .prepare(
      `INSERT INTO users (
         id, email, password_hash, role, display_name
       ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(id, `${id}@example.com`, 'x'.repeat(64), role, role)
  const session = await createSession(database, id, { ttlSeconds: 3600 })
  return { id, headers: { cookie: `icp_session=${session.token}` } }
}

async function createTestApp(t, limits = {}) {
  const db = await createTestDatabase()
  const storage = createFakeStorage()
  const app = Fastify({ logger: false })
  app.decorate('db', db)
  app.decorate('objectStorage', storage)
  app.decorate('config', {
    uploadOwnerQuotaBytes: 250 * 1024 * 1024,
    uploadTotalQuotaBytes: 5 * 1024 * 1024 * 1024,
    uploadMaxConcurrent: 4,
    ...limits
  })
  await app.register(cookie)
  await authPlugin(app, { db, secureCookies: false, sessionTtlSeconds: 3600 })
  await app.register(fileRoutes)
  await app.ready()
  t.after(async () => {
    await app.close()
    await db.close()
  })
  return { app, db, storage }
}

async function createIntent(app, user, input = {}) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/v1/files/upload-intents',
    headers: user.headers,
    payload: {
      category: 'avatar',
      originalName: 'avatar.png',
      mimeType: 'image/png',
      sizeBytes: PNG.length,
      ...input
    }
  })
  return { response, body: response.json() }
}

test('validated image upload is public while metadata and deletion remain owned', async (t) => {
  const { app, storage } = await createTestApp(t)
  const owner = await addUser(app.db, 'student')
  const outsider = await addUser(app.db, 'student')
  const intent = await createIntent(app, owner)
  assert.equal(intent.response.statusCode, 201)
  storage.putFromUrl(intent.body.data.uploadUrl, PNG)

  const completed = await app.inject({
    method: 'POST',
    url: `/api/v1/files/upload-intents/${intent.body.data.id}/complete`,
    headers: owner.headers
  })
  assert.equal(completed.statusCode, 201)
  const file = completed.json().data

  const content = await app.inject({ method: 'GET', url: file.url })
  assert.equal(content.statusCode, 302)
  assert.match(content.headers.location, /^https:\/\/objects\.test\/download\//)
  const forbidden = await app.inject({
    method: 'GET',
    url: `/api/v1/files/${file.id}`,
    headers: outsider.headers
  })
  assert.equal(forbidden.statusCode, 403)
  const removed = await app.inject({
    method: 'DELETE',
    url: `/api/v1/files/${file.id}`,
    headers: owner.headers
  })
  assert.equal(removed.statusCode, 200)
  assert.equal(storage.objects.has(storage.promotions[0].destinationKey), false)
})

test('magic-byte validation rejects disguised files and protects private material', async (t) => {
  const { app, storage } = await createTestApp(t)
  const teacher = await addUser(app.db, 'teacher')
  const student = await addUser(app.db, 'student')
  const disguised = await createIntent(app, teacher)
  storage.putFromUrl(disguised.body.data.uploadUrl, Buffer.alloc(PNG.length, 1))
  const rejected = await app.inject({
    method: 'POST',
    url: `/api/v1/files/upload-intents/${disguised.body.data.id}/complete`,
    headers: teacher.headers
  })
  assert.equal(rejected.statusCode, 415)

  const material = await createIntent(app, teacher, {
    category: 'course_material',
    originalName: 'lesson.pdf',
    mimeType: 'application/pdf',
    sizeBytes: PDF.length
  })
  storage.putFromUrl(material.body.data.uploadUrl, PDF)
  const completed = await app.inject({
    method: 'POST',
    url: `/api/v1/files/upload-intents/${material.body.data.id}/complete`,
    headers: teacher.headers
  })
  assert.equal(completed.statusCode, 201)
  const denied = await app.inject({
    method: 'GET',
    url: completed.json().data.url,
    headers: student.headers
  })
  assert.equal(denied.statusCode, 403)
})

test('transactional reservations prevent account and platform quota bypass', async (t) => {
  const { app } = await createTestApp(t, {
    uploadOwnerQuotaBytes: PNG.length + 5,
    uploadTotalQuotaBytes: PNG.length + 5
  })
  const owner = await addUser(app.db, 'student')
  const results = await Promise.all([
    createIntent(app, owner),
    createIntent(app, owner)
  ])
  assert.deepEqual(
    results.map(({ response }) => response.statusCode).sort(),
    [201, 413]
  )
})

test('the per-account upload admission limit is fail-fast and released by cancellation', async (t) => {
  const { app } = await createTestApp(t, { uploadMaxConcurrent: 1 })
  const owner = await addUser(app.db, 'student')
  const first = await createIntent(app, owner)
  assert.equal(first.response.statusCode, 201)
  const blocked = await createIntent(app, owner)
  assert.equal(blocked.response.statusCode, 429)
  const cancelled = await app.inject({
    method: 'DELETE',
    url: `/api/v1/files/upload-intents/${first.body.data.id}`,
    headers: owner.headers
  })
  assert.equal(cancelled.statusCode, 200)
  assert.equal((await createIntent(app, owner)).response.statusCode, 201)
})

test('upload resource configuration rejects malformed or unsafe limits', async () => {
  const app = Fastify({ logger: false })
  app.decorate('db', {})
  app.decorate('objectStorage', createFakeStorage())

  app.decorate('config', {
    uploadOwnerQuotaBytes: 0,
    uploadTotalQuotaBytes: 1,
    uploadMaxConcurrent: 99
  })
  await assert.rejects(async () => {
    await app.register(fileRoutes)
    await app.ready()
  }, /uploadOwnerQuotaBytes/)
  await app.close()
})

test('a reusable presigned URL cannot overwrite the promoted file', async (t) => {
  const { app, db, storage } = await createTestApp(t)
  const owner = await addUser(db, 'student')
  const intent = await createIntent(app, owner)
  const temporaryKey = storage.putFromUrl(intent.body.data.uploadUrl, PNG)

  const completed = await app.inject({
    method: 'POST',
    url: `/api/v1/files/upload-intents/${intent.body.data.id}/complete`,
    headers: owner.headers
  })
  assert.equal(completed.statusCode, 201)
  const file = completed.json().data
  const row = await db.prepare('SELECT * FROM files WHERE id = ?').get(file.id)
  assert.match(row.storage_key, /^files\//)
  assert.notEqual(row.storage_key, temporaryKey)
  assert.deepEqual(storage.objects.get(row.storage_key), PNG)

  storage.putFromUrl(intent.body.data.uploadUrl, Buffer.alloc(PNG.length, 1))
  assert.deepEqual(storage.objects.get(row.storage_key), PNG)
})

test('source changes during validation fail the conditional promotion', async (t) => {
  const { app, db, storage } = await createTestApp(t)
  const owner = await addUser(db, 'student')
  const intent = await createIntent(app, owner)
  storage.putFromUrl(intent.body.data.uploadUrl, PNG)
  const copy = storage.copy.bind(storage)
  storage.copy = async (input) => {
    storage.objects.set(input.sourceKey, Buffer.alloc(PNG.length, 1))
    return copy(input)
  }

  const completed = await app.inject({
    method: 'POST',
    url: `/api/v1/files/upload-intents/${intent.body.data.id}/complete`,
    headers: owner.headers
  })
  assert.equal(completed.statusCode, 409)
  assert.equal(
    (
      await db
        .prepare('SELECT status FROM upload_intents WHERE id = ?')
        .get(intent.body.data.id)
    ).status,
    'cancelled'
  )
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS count FROM files').get()).count,
    0
  )
})

test('concurrent completion claims inspect an intent only once', async (t) => {
  const { app, db, storage } = await createTestApp(t)
  const owner = await addUser(db, 'student')
  const intent = await createIntent(app, owner)
  storage.putFromUrl(intent.body.data.uploadUrl, PNG)
  const url = `/api/v1/files/upload-intents/${intent.body.data.id}/complete`

  const responses = await Promise.all([
    app.inject({ method: 'POST', url, headers: owner.headers }),
    app.inject({ method: 'POST', url, headers: owner.headers })
  ])
  const statusCodes = responses.map((response) => response.statusCode)
  assert.equal(statusCodes.filter((statusCode) => statusCode === 201).length, 1)
  assert.ok(
    statusCodes.every((statusCode) => [200, 201, 409].includes(statusCode))
  )
  assert.equal(storage.readCalls, 1)
})
