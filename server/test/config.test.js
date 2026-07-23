import assert from 'node:assert/strict'
import test from 'node:test'

import { loadConfig } from '../config.js'

function productionEnv(overrides = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://example.invalid/platform',
    DATABASE_SSL: 'false',
    APP_ORIGINS: 'https://platform.example',
    PUBLIC_WEBSOCKET_ORIGIN: 'https://api.example',
    VERIFICATION_CODE_SECRET: 'test-secret-that-is-at-least-32-characters',
    SECURE_COOKIES: 'true',
    ALLOW_BEARER_AUTH: 'false',
    TRUST_PROXY: '1',
    SEED_ON_START: 'false',
    ...overrides
  }
}

test('production configuration rejects automatic demo seeding', () => {
  assert.throws(
    () => loadConfig(productionEnv({ SEED_ON_START: 'true' })),
    /SEED_ON_START cannot be enabled in production/
  )
})

test('production configuration normalizes HTTPS into an absolute WSS origin', () => {
  const config = loadConfig(productionEnv())
  assert.equal(config.publicWebsocketOrigin, 'wss://api.example')
  assert.equal(config.seedOnStart, false)
})

test('public production rejects all-proxy trust', () => {
  assert.throws(
    () => loadConfig(productionEnv({ TRUST_PROXY: 'true' })),
    /TRUST_PROXY must be an explicit hop count/
  )
})

test('mail relay configuration requires HTTPS and a strong paired secret', () => {
  assert.throws(
    () =>
      loadConfig(
        productionEnv({
          MAIL_RELAY_URL: 'http://platform.example/api/mail-relay',
          MAIL_RELAY_SECRET: 'x'.repeat(32)
        })
      ),
    /credential-free HTTPS URL/
  )
  assert.throws(
    () =>
      loadConfig(
        productionEnv({
          MAIL_RELAY_URL: 'https://platform.example/api/mail-relay',
          MAIL_RELAY_SECRET: 'too-short'
        })
      ),
    /at least 32 characters/
  )
  assert.throws(
    () =>
      loadConfig(
        productionEnv({
          MAIL_RELAY_URL: 'https://platform.example/api/mail-relay'
        })
      ),
    /must be configured together/
  )
})

test('valid production mail relay configuration is exposed to the provider', () => {
  const config = loadConfig(
    productionEnv({
      MAIL_RELAY_URL: 'https://platform.example/api/mail-relay',
      MAIL_RELAY_SECRET: 'x'.repeat(32)
    })
  )
  assert.equal(config.mailRelayUrl, 'https://platform.example/api/mail-relay')
  assert.equal(config.mailRelaySecret, 'x'.repeat(32))
})
