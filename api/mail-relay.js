/* global process */

import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { TextDecoder } from 'node:util'

import { createMailProvider } from '../server/services/mail-provider.js'

const BODY_LIMIT = 4096
const CLOCK_SKEW_SECONDS = 5 * 60
const decoder = new TextDecoder('utf-8', { fatal: true })

class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function json(status, body, extraHeaders = {}) {
  return new globalThis.Response(JSON.stringify(body), {
    status,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders
    }
  })
}

function singleHeader(request, name) {
  const value = request.headers.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

async function readBoundedBody(request) {
  const declared = singleHeader(request, 'content-length')
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > BODY_LIMIT)) {
    throw new RequestError(413, 'Request body is too large')
  }

  if (!request.body) return Buffer.alloc(0)
  const reader = request.body.getReader()
  const chunks = []
  let length = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > BODY_LIMIT) {
        await reader.cancel()
        throw new RequestError(413, 'Request body is too large')
      }
      chunks.push(Buffer.from(value))
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, length)
}

function secureEqualHex(actual, expected) {
  if (!/^[a-f0-9]{64}$/i.test(actual)) return false
  const actualBytes = Buffer.from(actual, 'hex')
  const expectedBytes = Buffer.from(expected, 'hex')
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

function validateSignature(request, rawBody, secret, now) {
  const timestampText = singleHeader(request, 'x-mail-relay-timestamp')
  const signatureHeader = singleHeader(request, 'x-mail-relay-signature')
  if (!/^\d{10,11}$/.test(timestampText)) return false

  const timestamp = Number(timestampText)
  const current = Math.floor(now() / 1000)
  if (Math.abs(current - timestamp) > CLOCK_SKEW_SECONDS) return false

  const signature = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice(7)
    : ''
  const expected = createHmac('sha256', secret)
    .update(`${timestampText}.`, 'utf8')
    .update(rawBody)
    .digest('hex')
  return secureEqualHex(signature, expected)
}

function parsePayload(rawBody) {
  let payload
  try {
    payload = JSON.parse(decoder.decode(rawBody))
  } catch {
    throw new RequestError(400, 'Request body must be valid UTF-8 JSON')
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new RequestError(400, 'Request body is invalid')
  }
  const keys = Object.keys(payload).sort()
  if (keys.join(',') !== 'code,email,expiresAt') {
    throw new RequestError(400, 'Request body is invalid')
  }
  if (
    typeof payload.email !== 'string' ||
    payload.email.length > 254 ||
    payload.email !== payload.email.trim().toLowerCase() ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email) ||
    typeof payload.code !== 'string' ||
    !/^\d{6}$/.test(payload.code) ||
    typeof payload.expiresAt !== 'string' ||
    payload.expiresAt.length > 40 ||
    !Number.isFinite(Date.parse(payload.expiresAt))
  ) {
    throw new RequestError(400, 'Request body is invalid')
  }
  return payload
}

function relayConfig(env) {
  const secret = env.MAIL_RELAY_SECRET || ''
  if (secret.length < 32) {
    throw new Error('MAIL_RELAY_SECRET must contain at least 32 characters')
  }
  const missing = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'].filter(
    (name) => !env[name]
  )
  if (missing.length > 0) {
    throw new Error(
      `SMTP relay configuration is missing: ${missing.join(', ')}`
    )
  }

  const port = Number(env.SMTP_PORT || 465)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('SMTP_PORT is invalid')
  }
  const secureText = String(env.SMTP_SECURE ?? 'true').toLowerCase()
  if (!['true', 'false'].includes(secureText)) {
    throw new Error('SMTP_SECURE is invalid')
  }

  return {
    secret,
    smtpHost: env.SMTP_HOST,
    smtpPort: port,
    smtpSecure: secureText === 'true',
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    mailFrom: env.MAIL_FROM
  }
}

export function createMailRelayHandler({
  env = process.env,
  now = Date.now,
  transportFactory
} = {}) {
  let provider

  return async function mailRelay(request) {
    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed' }, { allow: 'POST' })
    }
    if (
      singleHeader(request, 'content-type').split(';', 1)[0].toLowerCase() !==
      'application/json'
    ) {
      return json(415, { error: 'Content-Type must be application/json' })
    }

    let config
    try {
      config = relayConfig(env)
    } catch (error) {
      console.error('Mail relay configuration invalid', {
        message: error?.message
      })
      return json(503, { error: 'Mail relay is not configured' })
    }

    try {
      const rawBody = await readBoundedBody(request)
      if (!validateSignature(request, rawBody, config.secret, now)) {
        return json(401, { error: 'Invalid or expired signature' })
      }
      const payload = parsePayload(rawBody)
      provider ??= createMailProvider({ ...config, transportFactory })
      await provider.sendVerificationCode(payload)
      return json(202, { accepted: true })
    } catch (error) {
      if (error instanceof RequestError) {
        return json(error.status, { error: error.message })
      }
      console.error('Mail relay delivery failed', {
        name: error?.name,
        code: error?.code,
        command: error?.command
      })
      return json(502, { error: 'Mail delivery failed' })
    }
  }
}

const handler = createMailRelayHandler()

export default { fetch: handler }
