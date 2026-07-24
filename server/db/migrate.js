import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import {
  createDatabase,
  DEFAULT_DATABASE_URL,
  migrateDatabase
} from './database.js'

export { migrateDatabase }

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL
  const database = await createDatabase({ connectionString })
  await database.close()
  process.stdout.write('PostgreSQL migration complete\n')
}
