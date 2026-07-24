import { randomUUID } from 'node:crypto'
import process from 'node:process'

import pg from 'pg'

import { createDatabase, DEFAULT_DATABASE_URL } from '../../db/database.js'
import { seedDatabase } from '../../db/seed-data.js'

const { Client } = pg

export async function createTestDatabase({
  seed = false,
  migrate = true
} = {}) {
  const connectionString =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    DEFAULT_DATABASE_URL
  const schema = `test_${randomUUID().replaceAll('-', '')}`
  const administrator = new Client({ connectionString })
  await administrator.connect()
  await administrator.query(`CREATE SCHEMA "${schema}"`)
  await administrator.end()

  const database = await createDatabase({
    connectionString,
    ssl: false,
    max: 4,
    schema,
    migrate
  })
  if (seed) await seedDatabase(database)

  const close = database.close.bind(database)
  database.close = async () => {
    if (!database.open) return
    await close()
    const cleanup = new Client({ connectionString })
    await cleanup.connect()
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
    } finally {
      await cleanup.end()
    }
  }
  database.testSchema = schema
  return database
}

export default createTestDatabase
