import { existsSync, lstatSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { createDatabase, DEFAULT_DATABASE_FILE } from './database.js'

function removeDatabaseFile(filename) {
  for (const candidate of [filename, `${filename}-shm`, `${filename}-wal`]) {
    if (!existsSync(candidate)) {
      continue
    }

    if (!lstatSync(candidate).isFile()) {
      throw new Error(`Refusing to remove non-file database path: ${candidate}`)
    }

    unlinkSync(candidate)
  }
}

export function resetDatabase({ filename = DEFAULT_DATABASE_FILE } = {}) {
  if (typeof filename !== 'string' || filename.length === 0) {
    throw new TypeError('Database filename must be a non-empty string')
  }

  if (filename === ':memory:') {
    return createDatabase({ filename, seed: true })
  }

  const resolvedFilename = resolve(filename)
  removeDatabaseFile(resolvedFilename)
  return createDatabase({ filename: resolvedFilename, seed: true })
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  const filename = process.argv[2] || DEFAULT_DATABASE_FILE
  const database = resetDatabase({ filename })
  database.close()
  process.stdout.write(`Database reset complete: ${filename}\n`)
}
