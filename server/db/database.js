import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { seedDatabase } from './seed-data.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')

function tableExists(database, tableName) {
  return Boolean(
    database
      .prepare(
        `SELECT 1 FROM sqlite_master
         WHERE type = 'table' AND name = ? LIMIT 1`
      )
      .get(tableName)
  )
}

function columnExists(database, tableName, columnName) {
  if (!tableExists(database, tableName)) return false
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName)
}

const migrations = Object.freeze([
  {
    id: '001_initial_schema',
    up(database) {
      // A new installation gets the current canonical schema in one pass.
      // Existing pre-ledger databases are adopted and upgraded below.
      if (!tableExists(database, 'users')) database.exec(schemaSql)
    }
  },
  {
    id: '002_realtime_message_dedupe',
    up(database) {
      if (
        tableExists(database, 'chat_messages') &&
        !columnExists(database, 'chat_messages', 'client_message_id')
      ) {
        database.exec(
          'ALTER TABLE chat_messages ADD COLUMN client_message_id TEXT'
        )
      }
    }
  },
  {
    id: '003_platform_extensions',
    up(database) {
      // Creates domain tables introduced after the baseline and reconciles all
      // indexes only after their required columns have been added.
      database.exec(schemaSql)
    }
  }
])

export const MIGRATION_IDS = Object.freeze(
  migrations.map((migration) => migration.id)
)

export const DEFAULT_DATABASE_FILE = process.env.DATABASE_PATH
  ? resolve(process.env.DATABASE_PATH)
  : resolve(projectRoot, '.data', 'platform.db')

function configureDatabase(database) {
  database.pragma('foreign_keys = ON')
  database.pragma('busy_timeout = 5000')
  database.pragma('journal_mode = WAL')
  database.pragma('synchronous = NORMAL')
}

export function migrateDatabase(database) {
  if (!database || typeof database.exec !== 'function') {
    throw new TypeError(
      'migrateDatabase requires an open better-sqlite3 database'
    )
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    )
  `)

  const applied = new Set(
    database
      .prepare('SELECT id FROM schema_migrations ORDER BY applied_at, id')
      .all()
      .map((row) => row.id)
  )
  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (id) VALUES (?)'
  )

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue

    database.transaction(() => {
      migration.up(database)
      recordMigration.run(migration.id)
    })()
  }

  return database
}

export function createDatabase({
  filename = DEFAULT_DATABASE_FILE,
  seed = false
} = {}) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new TypeError('Database filename must be a non-empty string')
  }

  if (filename !== ':memory:') {
    mkdirSync(dirname(resolve(filename)), { recursive: true })
  }

  const database = new Database(filename)

  try {
    configureDatabase(database)
    migrateDatabase(database)

    if (seed) {
      seedDatabase(database)
    }

    return database
  } catch (error) {
    database.close()
    throw error
  }
}
