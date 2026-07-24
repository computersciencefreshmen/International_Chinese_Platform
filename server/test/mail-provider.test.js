import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import {
  createMailProvider,
  createVerificationMessage
} from '../services/mail-provider.js'

test('verification message renders a premium self-contained email', () => {
  const message = createVerificationMessage({
    email: 'student@example.test',
    code: '123456',
    expiresAt: '2030-01-01T12:10:00.000Z',
    mailFrom: 'Platform <no-reply@example.test>'
  })

  assert.equal(message.subject, '国际中文学习平台注册验证码')
  assert.doesNotMatch(message.subject, /123456/)
  assert.doesNotMatch(message.subject, /student@example\.test/)
  assert.match(message.text, /123456/)
  assert.match(message.text, /北京时间/)
  assert.match(message.text, /请勿向任何人透露/)

  assert.match(message.html, /<!doctype html>/i)
  assert.match(message.html, /<html lang="zh-CN">/)
  assert.match(message.html, /INTERNATIONAL CHINESE EDUCATION/)
  assert.match(message.html, /完成你的平台注册/)
  assert.match(message.html, /123456/)
  assert.match(message.html, /有效期 10 分钟/)
  assert.match(message.html, /北京时间/)
  assert.match(message.html, /请勿向任何人透露/)
  assert.match(message.html, /role="presentation"/)
  assert.match(message.html, /dir="ltr"/)
  assert.doesNotMatch(message.html, /<img\b/i)
  assert.doesNotMatch(
    message.html,
    /<(script|form|iframe|object|embed|video)\b/i
  )
  assert.doesNotMatch(message.html, /\burl\s*\(/i)
  assert.doesNotMatch(message.html, /https?:\/\//i)
  assert.ok(Buffer.byteLength(message.html, 'utf8') < 50 * 1024)
  assert.equal(message.headers['Auto-Submitted'], 'auto-generated')
  assert.equal(message.headers['X-Auto-Response-Suppress'], 'All')
})

test('verification message escapes renderer-owned dynamic content', () => {
  const message = createVerificationMessage({
    email: 'student@example.test',
    code: '<img src=x onerror=alert(1)>',
    expiresAt: '2030-01-01T12:10:00.000Z',
    mailFrom: 'Platform <no-reply@example.test>'
  })

  assert.doesNotMatch(message.html, /<img\b/i)
  assert.match(message.html, /&lt;img src=x onerror=alert\(1\)&gt;/)
})

test('verification message rejects an invalid expiry', () => {
  assert.throws(
    () =>
      createVerificationMessage({
        email: 'student@example.test',
        code: '123456',
        expiresAt: 'not-a-date',
        mailFrom: 'Platform <no-reply@example.test>'
      }),
    /expiry is invalid/
  )
})

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
