import assert from 'node:assert/strict'
import test from 'node:test'

import { bootstrapAdministrator } from '../db/bootstrap-admin.js'
import { createDatabase } from '../db/database.js'
import { verifyPassword } from '../lib/password.js'

test('one-time administrator bootstrap creates a hashed privileged account and audit', async (t) => {
  const database = createDatabase({ filename: ':memory:' })
  t.after(() => database.close())

  const administrator = await bootstrapAdministrator(database, {
    email: 'OWNER@EXAMPLE.TEST',
    password: 'Strong-Admin-2026!',
    displayName: '平台负责人'
  })
  assert.equal(administrator.email, 'owner@example.test')
  assert.equal(administrator.role, 'administrator')

  const row = database
    .prepare('SELECT * FROM users WHERE id = ?')
    .get(administrator.id)
  assert.match(row.password_hash, /^scrypt\$/)
  assert.equal(
    await verifyPassword('Strong-Admin-2026!', row.password_hash),
    true
  )
  assert.equal(
    database
      .prepare(
        `SELECT COUNT(*) AS count FROM audit_logs
         WHERE action = 'administrator.bootstrapped' AND actor_id = ?`
      )
      .get(administrator.id).count,
    1
  )
})

test('bootstrap refuses weak input and never overwrites an existing administrator', async (t) => {
  const database = createDatabase({ filename: ':memory:' })
  t.after(() => database.close())

  await assert.rejects(
    bootstrapAdministrator(database, {
      email: 'admin@example.test',
      password: 'weak-password',
      displayName: '管理员'
    }),
    (error) => error.code === 'INVALID_ADMIN_INPUT'
  )

  const first = await bootstrapAdministrator(database, {
    email: 'first@example.test',
    password: 'Strong-Admin-2026!',
    displayName: '第一位管理员'
  })
  const originalHash = database
    .prepare('SELECT password_hash FROM users WHERE id = ?')
    .get(first.id).password_hash

  await assert.rejects(
    bootstrapAdministrator(database, {
      email: 'second@example.test',
      password: 'Another-Admin-2026!',
      displayName: '第二位管理员'
    }),
    (error) => error.code === 'ADMIN_ALREADY_EXISTS'
  )
  assert.equal(
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM users WHERE role = 'administrator'"
      )
      .get().count,
    1
  )
  assert.equal(
    database
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(first.id).password_hash,
    originalHash
  )
})
