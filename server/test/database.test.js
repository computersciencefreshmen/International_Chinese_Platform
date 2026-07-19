import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createDatabase, migrateDatabase } from '../db/database.js'
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  seedDatabase,
  verifyPasswordHash
} from '../db/seed.js'

const requiredTables = [
  'users',
  'teacher_profiles',
  'sessions',
  'verification_codes',
  'courses',
  'course_reviews',
  'appointments',
  'classrooms',
  'assignments',
  'assignment_questions',
  'submissions',
  'chat_messages',
  'notifications',
  'audit_logs',
  'files',
  'dialogue_sessions',
  'dialogue_turns'
]

function createTemporaryDatabase(t, options = {}) {
  const directory = mkdtempSync(
    join(tmpdir(), 'international-chinese-platform-')
  )
  const filename = join(directory, 'test.db')
  const database = createDatabase({ filename, ...options })

  t.after(() => {
    if (database.open) {
      database.close()
    }
    rmSync(directory, { recursive: true, force: true })
  })

  return database
}

test('database migration creates the complete schema with safe pragmas', (t) => {
  const database = createTemporaryDatabase(t)

  assert.equal(database.pragma('foreign_keys', { simple: true }), 1)
  assert.equal(database.pragma('journal_mode', { simple: true }), 'wal')

  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => row.name)
  )

  for (const table of requiredTables) {
    assert.ok(tables.has(table), `expected migration to create ${table}`)
  }

  assert.equal(
    database
      .prepare(
        "SELECT COUNT(*) AS count FROM schema_migrations WHERE id = '001_initial_schema'"
      )
      .get().count,
    1
  )

  migrateDatabase(database)
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()
      .count,
    1,
    'migrations should be repeatable'
  )
})

test('demo seed is idempotent and stores all account passwords as scrypt hashes', (t) => {
  const database = createTemporaryDatabase(t)

  const firstResult = seedDatabase(database)
  const firstCounts = Object.fromEntries(
    requiredTables.map((table) => [
      table,
      database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
    ])
  )
  const firstHashes = database
    .prepare('SELECT email, password_hash FROM users ORDER BY email')
    .all()

  const secondResult = seedDatabase(database)
  const secondCounts = Object.fromEntries(
    requiredTables.map((table) => [
      table,
      database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count
    ])
  )
  const secondHashes = database
    .prepare('SELECT email, password_hash FROM users ORDER BY email')
    .all()

  assert.deepEqual(secondResult, firstResult)
  assert.deepEqual(secondCounts, firstCounts)
  assert.deepEqual(
    secondHashes,
    firstHashes,
    'rerunning seed must not rotate existing hashes'
  )

  for (const account of DEMO_ACCOUNTS) {
    const row = database
      .prepare('SELECT role, password_hash FROM users WHERE email = ?')
      .get(account.email)

    assert.equal(row.role, account.role)
    assert.notEqual(row.password_hash, DEMO_PASSWORD)
    assert.match(row.password_hash, /^scrypt\$/)
    assert.equal(verifyPasswordHash(DEMO_PASSWORD, row.password_hash), true)
    assert.equal(
      verifyPasswordHash('not-the-demo-password', row.password_hash),
      false
    )
  }

  assert.equal(firstCounts.courses, 2)
  assert.equal(firstCounts.appointments, 2)
  assert.equal(firstCounts.assignments, 1)
  assert.equal(firstCounts.assignment_questions, 2)
  assert.equal(firstCounts.submissions, 1)
})

test('foreign keys and domain checks reject invalid records', (t) => {
  const database = createTemporaryDatabase(t)

  assert.throws(
    () =>
      database
        .prepare(
          `
          INSERT INTO courses (id, teacher_id, title)
          VALUES (?, ?, ?)
        `
        )
        .run(
          'f0000000-0000-4000-8000-000000000001',
          'f0000000-0000-4000-8000-000000000002',
          'Orphan course'
        ),
    /FOREIGN KEY constraint failed/
  )

  assert.throws(
    () =>
      database
        .prepare(
          `
          INSERT INTO users (id, email, password_hash, role, display_name)
          VALUES (?, ?, ?, ?, ?)
        `
        )
        .run(
          'f0000000-0000-4000-8000-000000000003',
          'invalid-role@example.com',
          'x'.repeat(64),
          'owner',
          'Invalid role'
        ),
    /CHECK constraint failed/
  )
})
