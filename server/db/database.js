import { AsyncLocalStorage } from 'node:async_hooks'
import { readdir, readFile } from 'node:fs/promises'
import process from 'node:process'

import pg from 'pg'

const { Pool, types } = pg
const transactionStorage = new AsyncLocalStorage()
const migrationsDirectory = new URL('./migrations/', import.meta.url)
const migrationLockNamespace = 'international-chinese-platform'
const migrationLockName = 'schema-migrations'

// Preserve the existing API wire format while PostgreSQL stores native types.
types.setTypeParser(20, (value) => Number(value))
types.setTypeParser(1082, (value) => value)
types.setTypeParser(1114, (value) => `${value.replace(' ', 'T')}Z`)
types.setTypeParser(1184, (value) => new Date(value).toISOString())
types.setTypeParser(114, (value) => value)
types.setTypeParser(3802, (value) => value)

export const DEFAULT_DATABASE_URL =
  'postgresql://platform:platform@127.0.0.1:5432/platform'
export const MIGRATION_IDS = Object.freeze([
  '001_initial_schema',
  '002_secure_object_promotion'
])

function postgresPlaceholders(sql) {
  let parameter = 0
  let singleQuoted = false
  let doubleQuoted = false
  let dollarTag = null
  let output = ''

  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    const next = sql[index + 1]

    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        output += dollarTag
        index += dollarTag.length - 1
        dollarTag = null
      } else output += character
      continue
    }

    if (!singleQuoted && !doubleQuoted && character === '$') {
      const match = sql.slice(index).match(/^\$[A-Za-z0-9_]*\$/)
      if (match) {
        dollarTag = match[0]
        output += dollarTag
        index += dollarTag.length - 1
        continue
      }
    }

    if (!doubleQuoted && character === "'") {
      output += character
      if (singleQuoted && next === "'") {
        output += next
        index += 1
      } else singleQuoted = !singleQuoted
      continue
    }
    if (!singleQuoted && character === '"') {
      doubleQuoted = !doubleQuoted
      output += character
      continue
    }

    if (!singleQuoted && !doubleQuoted && character === '?') {
      parameter += 1
      output += `$${parameter}`
    } else output += character
  }

  output = output.replace(/\s+COLLATE\s+NOCASE/gi, '')
  const names = []
  output = output.replace(/@([A-Za-z][A-Za-z0-9_]*)/g, (_match, name) => {
    names.push(name)
    parameter += 1
    return `$${parameter}`
  })
  if (/^\s*INSERT\s+OR\s+IGNORE\s+INTO\b/i.test(output)) {
    output = output.replace(/INSERT\s+OR\s+IGNORE\s+INTO/i, 'INSERT INTO')
    output = `${output.trim().replace(/;$/, '')} ON CONFLICT DO NOTHING`
  }
  return { names, sql: output }
}

function parameters(values, names) {
  if (values.length === 1 && Array.isArray(values[0])) return values[0]
  if (
    values.length === 1 &&
    names.length > 0 &&
    values[0] &&
    typeof values[0] === 'object'
  ) {
    return names.map((name) => values[0][name])
  }
  return values
}

class PreparedStatement {
  constructor(database, sql) {
    this.database = database
    const compiled = postgresPlaceholders(sql)
    this.sql = compiled.sql
    this.parameterNames = compiled.names
  }

  async all(...values) {
    const result = await this.database.query(
      this.sql,
      parameters(values, this.parameterNames)
    )
    return result.rows
  }

  async get(...values) {
    const result = await this.database.query(
      this.sql,
      parameters(values, this.parameterNames)
    )
    return result.rows[0]
  }

  async run(...values) {
    const result = await this.database.query(
      this.sql,
      parameters(values, this.parameterNames)
    )
    return {
      changes: result.rowCount ?? 0,
      lastInsertRowid: result.rows[0]?.id ?? null
    }
  }
}

export class PostgresDatabase {
  constructor({ connectionString, ssl = false, max = 10, schema } = {}) {
    this.pool = new Pool({
      connectionString,
      options: schema ? `-c search_path=${schema},public` : undefined,
      max,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: ssl ? { rejectUnauthorized: false } : false
    })
    this.open = true
  }

  prepare(sql) {
    if (!this.open) throw new Error('Database is closed')
    return new PreparedStatement(this, sql)
  }

  async query(sql, values = []) {
    if (!this.open) throw new Error('Database is closed')
    const client = transactionStorage.getStore()
    return (client ?? this.pool).query(sql, values)
  }

  async exec(sql) {
    return this.query(sql)
  }

  transaction(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('transaction requires a callback')
    }

    return async (...args) => {
      if (transactionStorage.getStore()) return callback(...args)

      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        const result = await transactionStorage.run(client, () =>
          callback(...args)
        )
        await client.query('COMMIT')
        return result
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    }
  }

  async close() {
    if (!this.open) return
    this.open = false
    await this.pool.end()
  }
}

async function migrationFiles() {
  return (await readdir(migrationsDirectory))
    .filter((file) => /^\d{3}_[a-z0-9_]+\.sql$/.test(file))
    .sort()
}

export async function migrateDatabase(database) {
  if (!database?.open) {
    throw new TypeError('migrateDatabase requires an open PostgreSQL database')
  }

  const migrate = database.transaction(async () => {
    // Extensions are database-global while test/application schemas are not.
    // Serialize the entire migration sequence so parallel pools cannot race on
    // CREATE EXTENSION or observe a partially applied schema.
    await database
      .prepare(
        'SELECT pg_advisory_xact_lock(hashtext(?), hashtext(?)) AS locked'
      )
      .get(migrationLockNamespace, migrationLockName)

    await database.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `)
    const applied = new Set(
      (
        await database
          .prepare('SELECT id FROM schema_migrations ORDER BY applied_at, id')
          .all()
      ).map((row) => row.id)
    )

    for (const file of await migrationFiles()) {
      const id = file.replace(/\.sql$/, '')
      if (applied.has(id)) continue
      const sql = await readFile(new URL(file, migrationsDirectory), 'utf8')
      await database.exec(sql)
      await database
        .prepare('INSERT INTO schema_migrations (id) VALUES (?)')
        .run(id)
      applied.add(id)
    }
  })

  await migrate()

  return database
}

export async function createDatabase({
  connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  ssl = String(process.env.DATABASE_SSL || '').toLowerCase() === 'true',
  max = Number(process.env.DATABASE_POOL_MAX || 10),
  schema,
  migrate = true
} = {}) {
  if (!connectionString) throw new TypeError('DATABASE_URL is required')
  const database = new PostgresDatabase({
    connectionString,
    ssl,
    max,
    schema
  })
  try {
    if (migrate) await migrateDatabase(database)
    return database
  } catch (error) {
    await database.close()
    throw error
  }
}

export default createDatabase
