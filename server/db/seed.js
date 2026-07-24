import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { createDatabase } from './database.js'
import {
  DEMO_ACCOUNTS,
  DEMO_IDS,
  DEMO_PASSWORD,
  hashPassword,
  seedDatabase,
  verifyPasswordHash
} from './seed-data.js'

export {
  DEMO_ACCOUNTS,
  DEMO_IDS,
  DEMO_PASSWORD,
  hashPassword,
  seedDatabase,
  verifyPasswordHash
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('db:seed is disabled in production')
  }
  const database = await createDatabase()
  const result = await seedDatabase(database)
  await database.close()
  process.stdout.write(
    `Demo data seeded (${result.users} users, ${result.courses} courses)\n`
  )
}
