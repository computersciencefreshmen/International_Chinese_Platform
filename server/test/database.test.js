import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import Database from 'better-sqlite3'

import {
  createDatabase,
  MIGRATION_IDS,
  migrateDatabase
} from '../db/database.js'
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

  assert.deepEqual(
    database
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all()
      .map((row) => row.id),
    [...MIGRATION_IDS]
  )

  migrateDatabase(database)
  assert.equal(
    database.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get()
      .count,
    MIGRATION_IDS.length,
    'migrations should be repeatable'
  )
})

test('legacy database upgrades in order without losing classroom messages', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'international-chinese-legacy-'))
  const filename = join(directory, 'legacy.db')
  const legacy = new Database(filename)
  legacy.pragma('foreign_keys = ON')
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      country TEXT,
      region TEXT,
      age INTEGER,
      chinese_level TEXT,
      bio TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE appointments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id),
      teacher_id TEXT NOT NULL REFERENCES users(id),
      course_id TEXT,
      scheduled_start TEXT NOT NULL,
      scheduled_end TEXT NOT NULL,
      topic TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      response_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE classrooms (
      id TEXT PRIMARY KEY,
      appointment_id TEXT NOT NULL UNIQUE REFERENCES appointments(id),
      room_code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'scheduled',
      opened_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE chat_messages (
      id TEXT PRIMARY KEY,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id),
      sender_id TEXT REFERENCES users(id),
      message_type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      edited_at TEXT,
      deleted_at TEXT
    );
  `)

  const now = '2025-01-01T00:00:00.000Z'
  const studentId = '10000000-0000-4000-8000-000000000001'
  const teacherId = '10000000-0000-4000-8000-000000000002'
  legacy
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      studentId,
      'legacy@student.test',
      'x'.repeat(64),
      'student',
      '旧学生',
      now,
      now
    )
  legacy
    .prepare(
      `INSERT INTO users (
        id, email, password_hash, role, display_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      teacherId,
      'legacy@teacher.test',
      'x'.repeat(64),
      'teacher',
      '旧教师',
      now,
      now
    )
  legacy
    .prepare(
      `INSERT INTO appointments (
        id, student_id, teacher_id, scheduled_start, scheduled_end, topic,
        status, created_at, updated_at
      ) VALUES ('20000000-0000-4000-8000-000000000001', ?, ?, ?, ?, '旧课堂',
        'accepted', ?, ?)`
    )
    .run(studentId, teacherId, now, '2025-01-01T01:00:00.000Z', now, now)
  legacy.exec(`
    INSERT INTO classrooms (
      id, appointment_id, room_code, status, created_at, updated_at
    ) VALUES (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'legacy-room', 'open', '${now}', '${now}'
    );
    INSERT INTO chat_messages (
      id, classroom_id, sender_id, content, created_at
    ) VALUES (
      '40000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001',
      '${studentId}', '迁移前的课堂消息', '${now}'
    );
  `)
  legacy.close()

  const upgraded = createDatabase({ filename })
  t.after(() => {
    if (upgraded.open) upgraded.close()
    rmSync(directory, { recursive: true, force: true })
  })

  assert.equal(
    upgraded
      .prepare('SELECT content FROM chat_messages WHERE id = ?')
      .get('40000000-0000-4000-8000-000000000001').content,
    '迁移前的课堂消息'
  )
  assert.ok(
    upgraded
      .prepare('PRAGMA table_info(chat_messages)')
      .all()
      .some((column) => column.name === 'client_message_id')
  )
  for (const table of ['teacher_profiles', 'files', 'dialogue_sessions']) {
    assert.ok(
      upgraded
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
        )
        .get(table),
      `expected legacy migration to create ${table}`
    )
  }
  assert.deepEqual(
    upgraded
      .prepare('SELECT id FROM schema_migrations ORDER BY id')
      .all()
      .map((row) => row.id),
    [...MIGRATION_IDS]
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
