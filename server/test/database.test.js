import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'

import { MIGRATION_IDS, migrateDatabase } from '../db/database.js'
import {
  DEMO_ACCOUNTS,
  DEMO_PASSWORD,
  seedDatabase,
  verifyPasswordHash
} from '../db/seed-data.js'
import { createTestDatabase } from './support/database.js'

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
  'upload_intents',
  'object_cleanup_jobs',
  'dialogue_sessions',
  'dialogue_turns'
]

test('database migration creates the complete PostgreSQL schema', async (t) => {
  const database = await createTestDatabase()
  t.after(async () => database.close())

  const tables = await database
    .prepare(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`
    )
    .all(database.testSchema)
  const names = new Set(tables.map((row) => row.table_name))
  for (const table of requiredTables) assert.ok(names.has(table), table)

  const migrations = await database
    .prepare('SELECT id FROM schema_migrations ORDER BY id')
    .all()
  assert.deepEqual(
    migrations.map((row) => row.id),
    MIGRATION_IDS
  )

  const columns = await database
    .prepare(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = 'users'`
    )
    .all(database.testSchema)
  const byName = Object.fromEntries(
    columns.map((row) => [row.column_name, row])
  )
  assert.equal(byName.id.udt_name, 'uuid')
  assert.equal(byName.email.udt_name, 'citext')
  assert.equal(byName.created_at.udt_name, 'timestamptz')
  assert.equal(byName.must_reset_password.udt_name, 'bool')
})

test('numbered migrations are idempotent', async (t) => {
  const database = await createTestDatabase()
  t.after(async () => database.close())
  await migrateDatabase(database)
  await migrateDatabase(database)
  const row = await database
    .prepare('SELECT COUNT(*) AS count FROM schema_migrations')
    .get()
  assert.equal(row.count, MIGRATION_IDS.length)
})

test('demo seed is idempotent and stores all account passwords as scrypt hashes', async (t) => {
  const database = await createTestDatabase()
  t.after(async () => database.close())
  const first = await seedDatabase(database)
  const second = await seedDatabase(database)
  assert.deepEqual(second, first)
  assert.equal(first.users, DEMO_ACCOUNTS.length)

  const rows = await database
    .prepare('SELECT email, password_hash FROM users ORDER BY email')
    .all()
  for (const row of rows) {
    assert.match(row.password_hash, /^scrypt\$/)
    assert.equal(verifyPasswordHash(DEMO_PASSWORD, row.password_hash), true)
  }
})

test('foreign keys and domain checks reject invalid records', async (t) => {
  const database = await createTestDatabase()
  t.after(async () => database.close())

  await assert.rejects(
    database
      .prepare(
        `INSERT INTO users (
           id, email, password_hash, role, display_name
         ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        randomUUID(),
        'invalid@example.com',
        'x'.repeat(64),
        'owner',
        'Invalid'
      ),
    (error) => error.code === '23514'
  )

  await assert.rejects(
    database
      .prepare(
        `INSERT INTO courses (
           id, teacher_id, title, level, category
         ) VALUES (?, ?, ?, 'beginner', 'general')`
      )
      .run(randomUUID(), randomUUID(), 'Orphan course'),
    (error) => error.code === '23503'
  )
})
