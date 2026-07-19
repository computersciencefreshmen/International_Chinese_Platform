/* global process */

import { existsSync } from 'node:fs'

import cookie from '@fastify/cookie'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'

import { defaultConfig, loadConfig } from './config.js'
import { errorDescriptor, sendFailure, sendSuccess } from './lib/http.js'
import authPlugin from './plugins/auth.js'
import authRoutes from './routes/auth.js'
import profileRoutes from './routes/profile.js'

function resolveConfig(overrides = {}) {
  const nodeEnv = overrides.nodeEnv || defaultConfig.nodeEnv

  return Object.freeze({
    ...defaultConfig,
    ...overrides,
    nodeEnv,
    isProduction: overrides.isProduction ?? nodeEnv === 'production'
  })
}

function isSpaNavigation(request) {
  const pathname = request.url.split('?', 1)[0]
  const accept = request.headers.accept || ''

  return (
    request.method === 'GET' &&
    accept.includes('text/html') &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/uploads/') &&
    !pathname.startsWith('/ws/')
  )
}

function probeDatabase(database) {
  if (!database) return 'not_configured'
  const result = database.prepare('SELECT 1 AS ok').get()
  return result?.ok === 1 ? 'up' : 'down'
}

export async function buildApp({
  database = null,
  config: configOverrides = {}
} = {}) {
  const config = resolveConfig(configOverrides)
  const app = Fastify({
    bodyLimit: config.bodyLimit,
    logger: config.logger,
    trustProxy: config.trustProxy
  })

  app.decorate('config', config)
  app.decorate('db', database)
  app.decorate('database', database)

  await app.register(cookie)
  await app.register(helmet, {
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:'],
        scriptSrc: config.isProduction
          ? ["'self'"]
          : ["'self'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  })
  await app.register(rateLimit, {
    global: true,
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindow
  })
  await app.register(websocket)

  if (database) {
    await authPlugin(app, {
      db: database,
      allowBearer: config.allowBearer,
      secureCookies: config.secureCookies,
      sessionTtlSeconds: config.sessionTtlSeconds
    })
    await app.register(authRoutes)
    await app.register(profileRoutes)
  }

  app.get('/api/v1/health', async (_request, reply) =>
    sendSuccess(
      reply,
      {
        status: 'ok',
        service: 'international-chinese-platform-api',
        uptimeSeconds: Math.round(process.uptime() * 1000) / 1000,
        timestamp: new Date().toISOString()
      },
      { msg: 'healthy' }
    )
  )

  app.get('/api/v1/ready', async (request, reply) => {
    let databaseStatus

    try {
      databaseStatus = probeDatabase(database)
    } catch (error) {
      databaseStatus = 'down'
      request.log.warn({ err: error }, 'Database readiness probe failed')
    }

    if (databaseStatus !== 'up') {
      return sendFailure(reply, {
        statusCode: 503,
        code: 'SERVICE_UNAVAILABLE',
        msg: 'Service is not ready',
        data: {
          status: 'not_ready',
          checks: { database: databaseStatus }
        }
      })
    }

    return sendSuccess(
      reply,
      {
        status: 'ready',
        checks: { database: databaseStatus }
      },
      { msg: 'ready' }
    )
  })

  if (config.isProduction && existsSync(config.distDir)) {
    await app.register(fastifyStatic, {
      root: config.distDir,
      decorateReply: true,
      wildcard: false
    })
  }

  app.setNotFoundHandler(async (request, reply) => {
    if (
      config.isProduction &&
      existsSync(config.distDir) &&
      isSpaNavigation(request)
    ) {
      return reply.sendFile('index.html')
    }

    return sendFailure(reply, {
      statusCode: 404,
      code: 'NOT_FOUND',
      msg: 'Route not found'
    })
  })

  app.setErrorHandler((error, request, reply) => {
    const descriptor = errorDescriptor(error)

    if (descriptor.statusCode >= 500) {
      request.log.error({ err: error }, 'Unhandled request error')
    } else {
      request.log.info({ err: error }, 'Request rejected')
    }

    return sendFailure(reply, descriptor)
  })

  return app
}

export { loadConfig }

export default buildApp
