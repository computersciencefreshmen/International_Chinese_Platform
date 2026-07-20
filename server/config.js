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

function localPath(value, fallback) {
  const target = value || fallback
  if (target === ':memory:') return target
  return isAbsolute(target) ? target : resolve(PROJECT_ROOT, target)
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new TypeError(
      'NODE_ENV must be one of development, test, or production'
    )
  }
  const isProduction = nodeEnv === 'production'
  const appOrigin = env.APP_ORIGIN || 'http://localhost:5173'
  let parsedOrigin
  try {
    parsedOrigin = new URL(appOrigin)
  } catch {
    throw new TypeError('APP_ORIGIN must be a valid HTTP(S) origin')
  }
  if (
    !['http:', 'https:'].includes(parsedOrigin.protocol) ||
    parsedOrigin.origin !== appOrigin.replace(/\/$/, '')
  ) {
    throw new TypeError('APP_ORIGIN must contain only an HTTP(S) origin')
  }
  const loopbackOrigin = ['localhost', '127.0.0.1', '::1'].includes(
    parsedOrigin.hostname
  )
  if (isProduction && parsedOrigin.protocol !== 'https:' && !loopbackOrigin) {
    throw new TypeError('Production APP_ORIGIN must use HTTPS')
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

  return Object.freeze({
    nodeEnv,
    isProduction,
    host: env.HOST || '127.0.0.1',
    port: integer(env.PORT, 7777, 'PORT', { max: 65_535 }),
    appOrigin: parsedOrigin.origin,
    databasePath: localPath(env.DATABASE_PATH, '.data/platform.db'),
    uploadDir: localPath(env.UPLOAD_DIR, '.data/uploads'),
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
    allowBearer: boolean(env.ALLOW_BEARER_AUTH, true, 'ALLOW_BEARER_AUTH'),
    trustProxy: boolean(env.TRUST_PROXY, false, 'TRUST_PROXY'),
    logger: boolean(env.LOGGER, nodeEnv !== 'test', 'LOGGER'),
    seedOnStart: boolean(
      env.SEED_ON_START,
      nodeEnv !== 'production',
      'SEED_ON_START'
    ),
    smtpUrl,
    mailFrom:
      env.MAIL_FROM || 'International Chinese Platform <no-reply@localhost>',
    aiApiUrl,
    aiApiKey: env.AI_API_KEY || '',
    turnUrl: env.TURN_URL || '',
    turnUsername: env.TURN_USERNAME || '',
    turnCredential: env.TURN_CREDENTIAL || ''
  })
}

export const defaultConfig = loadConfig()

export default defaultConfig
