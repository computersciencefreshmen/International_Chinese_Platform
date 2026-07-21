/* global process */

import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = fileURLToPath(new URL('..', import.meta.url))

function integer(
  value,
  fallback,
  name,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {}
) {
  const normalized = String(value ?? '').trim()
  const parsed =
    value === undefined || value === '' || normalized === ''
      ? fallback
      : /^\d+$/.test(normalized)
        ? Number(normalized)
        : Number.NaN

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}`)
  }

  return parsed
}

function boolean(value, fallback, name) {
  if (value === undefined || value === '') return fallback
  const normalized = String(value).toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  throw new TypeError(`${name} must be a boolean value`)
}

function proxyTrust(value, fallback = false) {
  if (value === undefined || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (normalized === '0') return false
  if (/^[1-9]\d*$/.test(normalized)) {
    const hops = Number(normalized)
    if (hops <= 10) return hops
    throw new TypeError('TRUST_PROXY hop count must be between 1 and 10')
  }
  return boolean(value, fallback, 'TRUST_PROXY')
}

function localPath(value, fallback) {
  const target = value || fallback
  if (target === ':memory:') return target
  return isAbsolute(target) ? target : resolve(PROJECT_ROOT, target)
}

function httpOrigin(value, name, { production = false } = {}) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new TypeError(`${name} must be a valid HTTP(S) origin`)
  }
  if (
    !['http:', 'https:'].includes(parsed.protocol) ||
    parsed.origin !== value.replace(/\/$/, '')
  ) {
    throw new TypeError(`${name} must contain only an HTTP(S) origin`)
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  if (production && parsed.protocol !== 'https:' && !loopback) {
    throw new TypeError(`${name} must use HTTPS in production`)
  }
  return parsed.origin
}

function websocketOrigin(value, { production = false } = {}) {
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    throw new TypeError('PUBLIC_WEBSOCKET_ORIGIN must be a valid origin')
  }
  if (['http:', 'https:'].includes(parsed.protocol)) {
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
  }
  if (
    !['ws:', 'wss:'].includes(parsed.protocol) ||
    parsed.pathname !== '/' ||
    parsed.search ||
    parsed.hash
  ) {
    throw new TypeError(
      'PUBLIC_WEBSOCKET_ORIGIN must contain only a WS(S) origin'
    )
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)
  if (production && parsed.protocol !== 'wss:' && !loopback) {
    throw new TypeError('PUBLIC_WEBSOCKET_ORIGIN must use WSS in production')
  }
  return parsed.origin
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new TypeError(
      'NODE_ENV must be one of development, test, or production'
    )
  }
  const isProduction = nodeEnv === 'production'
  const appOrigins = (
    env.APP_ORIGINS ||
    env.APP_ORIGIN ||
    'http://localhost:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) =>
      httpOrigin(origin, 'APP_ORIGINS', { production: isProduction })
    )
  if (
    appOrigins.length === 0 ||
    new Set(appOrigins).size !== appOrigins.length
  ) {
    throw new TypeError('APP_ORIGINS must contain unique HTTP(S) origins')
  }
  const loopbackOrigin = appOrigins.every((origin) => {
    const hostname = new URL(origin).hostname
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  })

  const publicWebsocketOrigin = websocketOrigin(
    env.PUBLIC_WEBSOCKET_ORIGIN || appOrigins[0],
    { production: isProduction }
  )

  if (isProduction && !env.DATABASE_URL) {
    throw new TypeError('DATABASE_URL is required in production')
  }

  const verificationCodeSecret = env.VERIFICATION_CODE_SECRET || ''
  if (isProduction && verificationCodeSecret.length < 32) {
    throw new TypeError(
      'VERIFICATION_CODE_SECRET must contain at least 32 characters in production'
    )
  }

  const secureCookies = boolean(
    env.SECURE_COOKIES,
    isProduction,
    'SECURE_COOKIES'
  )
  if (isProduction && !loopbackOrigin && !secureCookies) {
    throw new TypeError('SECURE_COOKIES cannot be disabled for a public origin')
  }
  const allowBearer = boolean(
    env.ALLOW_BEARER_AUTH,
    !isProduction,
    'ALLOW_BEARER_AUTH'
  )
  if (isProduction && allowBearer) {
    throw new TypeError('ALLOW_BEARER_AUTH must be disabled in production')
  }

  const aiApiUrl = env.AI_API_URL || ''
  if (isProduction && aiApiUrl) {
    let parsedAiUrl
    try {
      parsedAiUrl = new URL(aiApiUrl)
    } catch {
      throw new TypeError('AI_API_URL must be a valid URL')
    }
    if (parsedAiUrl.protocol !== 'https:') {
      throw new TypeError('Production AI_API_URL must use HTTPS')
    }
  }

  const smtpUrl = env.SMTP_URL || ''
  if (smtpUrl) {
    let parsedSmtpUrl
    try {
      parsedSmtpUrl = new URL(smtpUrl)
    } catch {
      throw new TypeError('SMTP_URL must be a valid SMTP URL')
    }
    if (!['smtp:', 'smtps:'].includes(parsedSmtpUrl.protocol)) {
      throw new TypeError('SMTP_URL must use smtp:// or smtps://')
    }
  }

  const sessionTtlHours = integer(
    env.SESSION_TTL_HOURS,
    12,
    'SESSION_TTL_HOURS',
    {
      max: 24 * 365
    }
  )
  const uploadOwnerQuotaBytes = integer(
    env.UPLOAD_OWNER_QUOTA_BYTES,
    250 * 1024 * 1024,
    'UPLOAD_OWNER_QUOTA_BYTES'
  )
  const uploadTotalQuotaBytes = integer(
    env.UPLOAD_TOTAL_QUOTA_BYTES,
    5 * 1024 * 1024 * 1024,
    'UPLOAD_TOTAL_QUOTA_BYTES'
  )
  if (uploadTotalQuotaBytes < uploadOwnerQuotaBytes) {
    throw new TypeError(
      'UPLOAD_TOTAL_QUOTA_BYTES must be greater than or equal to UPLOAD_OWNER_QUOTA_BYTES'
    )
  }
  const seedOnStart = boolean(
    env.SEED_ON_START,
    nodeEnv !== 'production',
    'SEED_ON_START'
  )
  if (isProduction && seedOnStart) {
    throw new TypeError(
      'SEED_ON_START cannot be enabled in production; seed test data explicitly before startup'
    )
  }

  const trustProxy = proxyTrust(env.TRUST_PROXY)
  if (isProduction && !loopbackOrigin && !Number.isInteger(trustProxy)) {
    throw new TypeError(
      'TRUST_PROXY must be an explicit hop count for a public production origin'
    )
  }

  return Object.freeze({
    nodeEnv,
    isProduction,
    host: env.HOST || '127.0.0.1',
    port: integer(env.PORT, 7777, 'PORT', { max: 65_535 }),
    appOrigin: appOrigins[0],
    appOrigins: Object.freeze(appOrigins),
    publicWebsocketOrigin,
    databaseUrl:
      env.DATABASE_URL ||
      'postgresql://platform:platform@127.0.0.1:5432/platform',
    databaseSsl: boolean(env.DATABASE_SSL, isProduction, 'DATABASE_SSL'),
    databasePoolMax: integer(env.DATABASE_POOL_MAX, 10, 'DATABASE_POOL_MAX', {
      max: 50
    }),
    uploadOwnerQuotaBytes,
    uploadTotalQuotaBytes,
    uploadMaxConcurrent: integer(
      env.UPLOAD_MAX_CONCURRENT,
      4,
      'UPLOAD_MAX_CONCURRENT',
      { max: 32 }
    ),
    distDir: localPath(env.DIST_DIR, 'dist'),
    bodyLimit: integer(env.BODY_LIMIT_BYTES, 1_048_576, 'BODY_LIMIT_BYTES'),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 300, 'RATE_LIMIT_MAX'),
    rateLimitWindow: env.RATE_LIMIT_WINDOW || '1 minute',
    sessionTtlHours,
    sessionTtlSeconds: sessionTtlHours * 60 * 60,
    verificationCodeSecret,
    secureCookies,
    allowBearer,
    trustProxy,
    logger: boolean(env.LOGGER, nodeEnv !== 'test', 'LOGGER'),
    seedOnStart,
    smtpUrl,
    smtpHost: env.SMTP_HOST || '',
    smtpPort: integer(env.SMTP_PORT, 465, 'SMTP_PORT', { max: 65_535 }),
    smtpSecure: boolean(env.SMTP_SECURE, true, 'SMTP_SECURE'),
    smtpUser: env.SMTP_USER || '',
    smtpPass: env.SMTP_PASS || '',
    mailFrom:
      env.MAIL_FROM || 'International Chinese Platform <no-reply@localhost>',
    s3Endpoint: env.S3_ENDPOINT || '',
    s3Region: env.S3_REGION || 'auto',
    s3Bucket: env.S3_BUCKET || '',
    s3AccessKeyId: env.S3_ACCESS_KEY_ID || '',
    s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
    s3ForcePathStyle: boolean(
      env.S3_FORCE_PATH_STYLE,
      !isProduction,
      'S3_FORCE_PATH_STYLE'
    ),
    aiApiUrl,
    aiApiKey: env.AI_API_KEY || '',
    turnUrl: env.TURN_URL || '',
    turnUsername: env.TURN_USERNAME || '',
    turnCredential: env.TURN_CREDENTIAL || ''
  })
}

export const defaultConfig = loadConfig()

export default defaultConfig
