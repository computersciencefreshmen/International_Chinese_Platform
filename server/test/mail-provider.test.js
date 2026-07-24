import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import { createMailProvider } from '../services/mail-provider.js'

test('SMTP mail provider sends the registration code with hardened transport options', async () => {
  let transportOptions
  let message
  const provider = createMailProvider({
    smtpUrl: 'smtps://mailer:secret@smtp.example.test:465',
    mailFrom: 'Platform <no-reply@example.test>',
    transportFactory(options) {
      transportOptions = options
      return {
        async sendMail(payload) {
          message = payload
          return { messageId: 'test-message-id' }
        }
      }
    }
  })

  const result = await provider.sendVerificationCode({
    email: 'student@example.test',
    code: '123456',
    expiresAt: '2030-01-01T12:00:00.000Z'
  })

  assert.equal(result.messageId, 'test-message-id')
  assert.equal(transportOptions.disableFileAccess, true)
  assert.equal(transportOptions.disableUrlAccess, true)
  assert.equal(transportOptions.requireTLS, true)
  assert.equal(message.to, 'student@example.test')
  assert.equal(message.from, 'Platform <no-reply@example.test>')
  assert.match(message.text, /123456/)
  assert.match(message.html, /123456/)
})

test('HTTPS relay takes priority and signs the exact JSON request body', async () => {
  const secret = 'relay-secret-that-is-at-least-32-characters'
  const now = Date.parse('2030-01-01T12:00:00.000Z')
  let captured
  const provider = createMailProvider({
    mailRelayUrl: 'https://platform.example/api/mail-relay',
    mailRelaySecret: secret,
    smtpUrl: 'smtps://unused.example.test',
    now: () => now,
    transportFactory() {
      throw new Error('SMTP must not be used when relay is configured')
    },
    async fetchImpl(url, options) {
      captured = { url, options }
      return { ok: true, status: 202 }
    }
  })

  const payload = {
    email: 'student@example.test',
    code: '123456',
    expiresAt: '2030-01-01T12:10:00.000Z'
  }
  const result = await provider.sendVerificationCode(payload)
  const timestamp = String(Math.floor(now / 1000))
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.`, 'utf8')
    .update(captured.options.body, 'utf8')
    .digest('hex')

  assert.equal(captured.url, 'https://platform.example/api/mail-relay')
  assert.deepEqual(JSON.parse(captured.options.body), payload)
  assert.equal(captured.options.headers['x-mail-relay-timestamp'], timestamp)
  assert.equal(
    captured.options.headers['x-mail-relay-signature'],
    `sha256=${expected}`
  )
  assert.deepEqual(result, { relayed: true, status: 202 })
})

test('mail provider stays disabled when neither relay nor SMTP is configured', () => {
  assert.equal(createMailProvider({ smtpUrl: '' }), null)
})
