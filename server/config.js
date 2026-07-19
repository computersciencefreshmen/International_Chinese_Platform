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
  const parsed =
    value === undefined || value === '' ? fallback : Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`${name} must be an integer between ${min} and ${max}`)
  }

  return parsed
}

function boolean(value, fallback) {
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase())
}

function localPath(value, fallback) {
  const target = value || fallback
  if (target === ':memory:') return target
  return isAbsolute(target) ? target : resolve(PROJECT_ROOT, target)
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  const sessionTtlHours = integer(
    env.SESSION_TTL_HOURS,
    12,
    'SESSION_TTL_HOURS',
    {
      max: 24 * 365
    }
  )

  return Object.freeze({
    nodeEnv,
    isProduction: nodeEnv === 'production',
    host: env.HOST || '127.0.0.1',
    port: integer(env.PORT, 7777, 'PORT', { max: 65_535 }),
    appOrigin: env.APP_ORIGIN || 'http://localhost:5173',
    databasePath: localPath(env.DATABASE_PATH, '.data/platform.db'),
    uploadDir: localPath(env.UPLOAD_DIR, '.data/uploads'),
    distDir: localPath(env.DIST_DIR, 'dist'),
    bodyLimit: integer(env.BODY_LIMIT_BYTES, 1_048_576, 'BODY_LIMIT_BYTES'),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 300, 'RATE_LIMIT_MAX'),
    rateLimitWindow: env.RATE_LIMIT_WINDOW || '1 minute',
    sessionTtlHours,
    sessionTtlSeconds: sessionTtlHours * 60 * 60,
    verificationCodeSecret: env.VERIFICATION_CODE_SECRET || '',
    secureCookies: boolean(env.SECURE_COOKIES, nodeEnv === 'production'),
    allowBearer: boolean(env.ALLOW_BEARER_AUTH, true),
    trustProxy: boolean(env.TRUST_PROXY, false),
    logger: boolean(env.LOGGER, nodeEnv !== 'test'),
    seedOnStart: boolean(env.SEED_ON_START, nodeEnv !== 'production'),
    smtpUrl: env.SMTP_URL || '',
    aiApiUrl: env.AI_API_URL || '',
    aiApiKey: env.AI_API_KEY || '',
    turnUrl: env.TURN_URL || '',
    turnUsername: env.TURN_USERNAME || '',
    turnCredential: env.TURN_CREDENTIAL || ''
  })
}

export const defaultConfig = loadConfig()

export default defaultConfig
