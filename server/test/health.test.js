import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, test } from 'node:test'

import { buildApp } from '../app.js'

const apps = []
const tempDirectories = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()))
  await Promise.all(
    tempDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

async function createApp(options = {}) {
  const app = await buildApp({
    config: {
      logger: false,
      rateLimitMax: 1000,
      ...options.config
    },
    database: options.database,
    objectStorage: options.objectStorage ?? null
  })

  apps.push(app)
  return app
}

test('GET /api/v1/health returns the stable success envelope', async () => {
  const app = await createApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/health'
  })

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'], /^application\/json/)
  assert.equal(response.headers['x-content-type-options'], 'nosniff')

  const body = response.json()
  assert.equal(body.code, 0)
  assert.equal(body.msg, 'healthy')
  assert.equal(body.data.status, 'ok')
  assert.equal(body.data.service, 'international-chinese-platform-api')
  assert.equal(typeof body.data.uptimeSeconds, 'number')
  assert.ok(Number.isFinite(Date.parse(body.data.timestamp)))
})

test('GET /api/v1/ready checks the injected database', async () => {
  let probeCount = 0
  const database = {
    prepare(sql) {
      assert.equal(sql, 'SELECT 1 AS ok')
      return {
        get() {
          probeCount += 1
          return { ok: 1 }
        }
      }
    }
  }
  const app = await createApp({ database })

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/ready'
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json(), {
    code: 0,
    msg: 'degraded',
    data: {
      status: 'degraded',
      checks: { database: 'up', storage: 'not_configured' }
    }
  })
  assert.equal(probeCount, 1)
})

test('GET /api/v1/ready fails when no database is configured', async () => {
  const app = await createApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/ready'
  })

  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.json(), {
    code: 'SERVICE_UNAVAILABLE',
    msg: 'Service is not ready',
    data: {
      status: 'not_ready',
      checks: { database: 'not_configured', storage: 'not_configured' }
    }
  })
})

test('GET /api/v1/ready returns a sanitized failure when the database is down', async () => {
  const database = {
    prepare() {
      throw new Error('secret database path and stack details')
    }
  }
  const app = await createApp({ database })

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/ready'
  })

  assert.equal(response.statusCode, 503)
  assert.deepEqual(response.json(), {
    code: 'SERVICE_UNAVAILABLE',
    msg: 'Service is not ready',
    data: {
      status: 'not_ready',
      checks: { database: 'down', storage: 'not_configured' }
    }
  })
  assert.doesNotMatch(response.body, /secret|stack|\.data/i)
})

test('unknown API routes use the unified 404 envelope', async () => {
  const app = await createApp()

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/does-not-exist'
  })

  assert.equal(response.statusCode, 404)
  assert.deepEqual(response.json(), {
    code: 'NOT_FOUND',
    msg: 'Route not found',
    data: null
  })
})

test('unexpected errors use the unified envelope without leaking details', async () => {
  const app = await createApp()
  app.get('/api/v1/test-error', async () => {
    const error = new Error('sensitive implementation detail')
    error.stack = 'TOP_SECRET_STACK'
    throw error
  })

  const response = await app.inject({
    method: 'GET',
    url: '/api/v1/test-error'
  })

  assert.equal(response.statusCode, 500)
  assert.deepEqual(response.json(), {
    code: 'INTERNAL_ERROR',
    msg: 'Internal server error',
    data: null
  })
  assert.doesNotMatch(response.body, /sensitive|TOP_SECRET|stack/i)
})

test('the built SPA is served only in production', async () => {
  const distDir = await mkdtemp(join(tmpdir(), 'icp-dist-'))
  tempDirectories.push(distDir)
  await writeFile(
    join(distDir, 'index.html'),
    '<main>International Chinese</main>'
  )

  const developmentApp = await createApp({
    config: { distDir, nodeEnv: 'development' }
  })
  const developmentResponse = await developmentApp.inject({
    method: 'GET',
    url: '/student/home',
    headers: { accept: 'text/html' }
  })

  assert.equal(developmentResponse.statusCode, 404)
  assert.equal(developmentResponse.json().code, 'NOT_FOUND')

  const productionApp = await createApp({
    config: { distDir, nodeEnv: 'production', rateLimitMax: 1 }
  })
  const productionResponse = await productionApp.inject({
    method: 'GET',
    url: '/student/home',
    headers: { accept: 'text/html' }
  })

  assert.equal(productionResponse.statusCode, 200)
  assert.match(productionResponse.headers['content-type'], /^text\/html/)
  assert.equal(productionResponse.body, '<main>International Chinese</main>')

  const repeatedNavigation = await productionApp.inject({
    method: 'GET',
    url: '/student/home',
    headers: { accept: 'text/html' }
  })
  assert.equal(repeatedNavigation.statusCode, 200)

  const firstApiResponse = await productionApp.inject({
    method: 'GET',
    url: '/api/v1/health'
  })
  const rateLimitedApiResponse = await productionApp.inject({
    method: 'GET',
    url: '/api/v1/health'
  })

  assert.equal(firstApiResponse.statusCode, 200)
  assert.equal(rateLimitedApiResponse.statusCode, 429)
})
