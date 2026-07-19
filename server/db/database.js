import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { seedDatabase } from './seed-data.js'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8')
const initialMigration = '001_initial_schema'

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

  const migrate = database.transaction(() => {
    // The schema is intentionally idempotent. Executing it on every startup makes
    // newly added indexes available to existing development databases, while the
    // migration ledger still records which baseline was installed.
    database.exec(schemaSql)
    database
      .prepare('INSERT OR IGNORE INTO schema_migrations (id) VALUES (?)')
      .run(initialMigration)
  })

  migrate()
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
