import { Buffer } from 'node:buffer'
import { createDecipheriv } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('ICPBKP1')

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'inherit', 'inherit']
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? resolvePromise()
        : reject(new Error(`${command} exited with ${code}`))
    )
  })
}

if (process.env.CONFIRM_RESTORE !== 'RESTORE') {
  throw new Error(
    'Set CONFIRM_RESTORE=RESTORE to acknowledge the destructive restore'
  )
}
const source = resolve(required('BACKUP_FILE'))
const databaseUrl = required('DATABASE_URL')
const encryptionKey = Buffer.from(required('BACKUP_ENCRYPTION_KEY'), 'base64')
if (encryptionKey.length !== 32)
  throw new Error('Invalid BACKUP_ENCRYPTION_KEY')

const { size } = await stat(source)
const handle = await open(source, 'r')
const header = Buffer.alloc(MAGIC.length + 12)
const tag = Buffer.alloc(16)
await handle.read(header, 0, header.length, 0)
await handle.read(tag, 0, tag.length, size - tag.length)
await handle.close()
if (!header.subarray(0, MAGIC.length).equals(MAGIC))
  throw new Error('Invalid backup header')

const directory = await mkdtemp(join(tmpdir(), 'icp-restore-'))
const dumpFile = join(directory, 'database.dump')
try {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey,
    header.subarray(MAGIC.length)
  )
  decipher.setAuthTag(tag)
  await pipeline(
    createReadStream(source, {
      start: header.length,
      end: size - tag.length - 1
    }),
    decipher,
    createWriteStream(dumpFile)
  )
  await run('pg_restore', [
    '--dbname',
    databaseUrl,
    '--clean',
    '--if-exists',
    '--no-owner',
    dumpFile
  ])
  process.stdout.write('PostgreSQL restore completed\n')
} finally {
  await rm(directory, { recursive: true, force: true })
}
