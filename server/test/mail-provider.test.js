import assert from 'node:assert/strict'
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

test('mail provider stays disabled when SMTP is not configured', () => {
  assert.equal(createMailProvider({ smtpUrl: '' }), null)
})
