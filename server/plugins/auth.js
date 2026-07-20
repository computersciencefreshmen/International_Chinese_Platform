import process from 'node:process'

import {
  DEFAULT_SESSION_TTL_SECONDS,
  extractSessionToken,
  findSessionByToken,
  SESSION_COOKIE_NAME
} from '../lib/session.js'

function sendError(reply, statusCode, message, data = null) {
  return reply.code(statusCode).send({
    code: statusCode,
    msg: message,
    data
  })
}

export async function authPlugin(app, options = {}) {
  const db = options.db ?? app.db
  if (!db) {
    throw new Error('authPlugin requires a database connection')
  }

  const allowBearer = options.allowBearer !== false
  const sessionTtlSeconds =
    Number(options.sessionTtlSeconds) || DEFAULT_SESSION_TTL_SECONDS
  const appOrigin = options.appOrigin ?? app.config?.appOrigin ?? null
  const secureCookies =
    options.secureCookies ?? process.env.NODE_ENV === 'production'

  if (!app.hasRequestDecorator('auth')) {
    app.decorateRequest('auth', null)
  }

  app.addHook('preHandler', async (request, reply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return
    }

    const hasSessionCookie = Boolean(request.cookies?.[SESSION_COOKIE_NAME])
    const origin = request.headers.origin
    if (hasSessionCookie && origin && appOrigin && origin !== appOrigin) {
      return sendError(reply, 403, '请求来源不受信任')
    }
  })

  const authenticate = async (request, reply) => {
    const credential = extractSessionToken(request, { allowBearer })
    if (!credential) {
      return sendError(reply, 401, '请先登录')
    }

    const session = findSessionByToken(db, credential.token)
    if (!session) {
      if (credential.source === 'cookie') {
        reply.clearCookie(SESSION_COOKIE_NAME, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: secureCookies
        })
      }

      return sendError(reply, 401, '登录状态已失效，请重新登录')
    }

    request.auth = {
      ...session,
      credentialSource: credential.source
    }
  }

  const requireRole = (...allowedRoles) => {
    const roles = new Set(allowedRoles.flat())

    return async (request, reply) => {
      if (!request.auth) {
        await authenticate(request, reply)
      }

      if (reply.sent) {
        return
      }

      if (!roles.has(request.auth.user.role)) {
        return sendError(reply, 403, '没有权限执行此操作')
      }
    }
  }

  const requireOwnership = (resolveOwnerId, privilegedRoles = []) => {
    const privileged = new Set(privilegedRoles)

    return async (request, reply) => {
      if (!request.auth) {
        await authenticate(request, reply)
      }

      if (reply.sent) {
        return
      }

      if (privileged.has(request.auth.user.role)) {
        return
      }

      const ownerId = await resolveOwnerId(request)
      if (!ownerId || ownerId !== request.auth.user.id) {
        return sendError(reply, 403, '没有权限访问该资源')
      }
    }
  }

  const sessionCookieOptions = (ttlSeconds = sessionTtlSeconds) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    maxAge: ttlSeconds
  })

  app.decorate('authenticate', authenticate)
  app.decorate('requireRole', requireRole)
  app.decorate('requireOwnership', requireOwnership)
  app.decorate('sessionCookieOptions', sessionCookieOptions)
  app.decorate('sessionTtlSeconds', sessionTtlSeconds)
}

export default authPlugin
