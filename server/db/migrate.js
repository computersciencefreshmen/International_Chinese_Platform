import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import process from 'node:process'

import {
  createDatabase,
  DEFAULT_DATABASE_FILE,
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
  const filename = process.argv[2] || DEFAULT_DATABASE_FILE
  const database = createDatabase({ filename })
  database.close()
  process.stdout.write(`Database migration complete: ${filename}\n`)
}
