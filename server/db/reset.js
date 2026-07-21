import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { createDatabase, DEFAULT_DATABASE_URL } from './database.js'
import { seedDatabase } from './seed-data.js'

export async function resetDatabase({
  connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  seed = true
} = {}) {
  const database = await createDatabase({ connectionString, migrate: false })
  await database.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;')
  await database.close()

  const recreated = await createDatabase({ connectionString })
  if (seed) await seedDatabase(recreated)
  return recreated
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:reset is disabled in production')
  }
  const database = await resetDatabase()
  await database.close()
  process.stdout.write('PostgreSQL database reset complete\n')
}
