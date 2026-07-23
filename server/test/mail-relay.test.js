import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { createMailRelayHandler } from '../../api/mail-relay.js'

const NOW = Date.parse('2030-01-01T12:00:00.000Z')
const SECRET = 'relay-secret-that-is-at-least-32-characters'
const ENV = {
  MAIL_RELAY_SECRET: SECRET,
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'owner@example.test',
  SMTP_PASS: 'application-password',
  MAIL_FROM: 'Platform <owner@example.test>'
}

function signedRequest(payload, { timestamp, signature } = {}) {
  const rawBody = JSON.stringify(payload)
  const timestampText = String(timestamp ?? Math.floor(NOW / 1000))
  const digest =
    signature ??
    createHmac('sha256', SECRET)
      .update(`${timestampText}.`, 'utf8')
      .update(rawBody, 'utf8')
      .digest('hex')
  return new globalThis.Request('https://platform.example/api/mail-relay', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-mail-relay-timestamp': timestampText,
      'x-mail-relay-signature': `sha256=${digest}`
    },
    body: rawBody
  })
}

test('mail relay accepts a valid signed verification payload', async () => {
  let message
  const handler = createMailRelayHandler({
    env: ENV,
    now: () => NOW,
    transportFactory() {
      return {
        async sendMail(payload) {
          message = payload
          return { messageId: 'accepted' }
        }
      }
    }
  })
  const response = await handler(
    signedRequest({
      email: 'student@example.test',
      code: '123456',
      expiresAt: '2030-01-01T12:10:00.000Z'
    })
  )

  assert.equal(response.status, 202)
  assert.deepEqual(await response.json(), { accepted: true })
  assert.equal(message.to, 'student@example.test')
  assert.equal(message.subject, '国际中文学习平台注册验证码')
  assert.match(message.text, /123456/)
})

test('mail relay rejects expired and invalid signatures before SMTP', async () => {
  let transportCalls = 0
  const handler = createMailRelayHandler({
    env: ENV,
    now: () => NOW,
    transportFactory() {
      transportCalls += 1
      return { sendMail: async () => ({}) }
    }
  })
  const payload = {
    email: 'student@example.test',
    code: '123456',
    expiresAt: '2030-01-01T12:10:00.000Z'
  }

  const expired = await handler(
    signedRequest(payload, {
      timestamp: Math.floor(NOW / 1000) - 301
    })
  )
  const invalid = await handler(
    signedRequest(payload, { signature: '0'.repeat(64) })
  )

  assert.equal(expired.status, 401)
  assert.equal(invalid.status, 401)
  assert.equal(transportCalls, 0)
})

test('mail relay rejects extra fields instead of sending arbitrary content', async () => {
  const handler = createMailRelayHandler({
    env: ENV,
    now: () => NOW,
    transportFactory() {
      throw new Error('Invalid payload must not construct SMTP')
    }
  })
  const response = await handler(
    signedRequest({
      email: 'student@example.test',
      code: '123456',
      expiresAt: '2030-01-01T12:10:00.000Z',
      subject: 'arbitrary subject'
    })
  )

  assert.equal(response.status, 400)
})
