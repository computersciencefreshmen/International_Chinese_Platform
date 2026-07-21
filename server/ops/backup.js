import { Buffer } from 'node:buffer'
import { createCipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'

import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3'

const MAGIC = Buffer.from('ICPBKP1')
const DAILY_KEEP = 7
const WEEKLY_KEEP = 4

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'inherit', 'inherit']
    })
    child.once('error', reject)
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`))
    )
  })
}

function s3Client() {
  return new S3Client({
    endpoint: required('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'auto',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY')
    }
  })
}

async function prune(client, bucket, prefix, keep) {
  const listed = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
  )
  const remove = (listed.Contents ?? [])
    .sort(
      (left, right) =>
        new Date(right.LastModified) - new Date(left.LastModified)
    )
    .slice(keep)
    .map(({ Key }) => ({ Key }))
  if (remove.length > 0) {
    await client.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: remove } })
    )
  }
}

const databaseUrl = required('DATABASE_URL')
const bucket = process.env.S3_BACKUP_BUCKET || required('S3_BUCKET')
const encryptionKey = Buffer.from(required('BACKUP_ENCRYPTION_KEY'), 'base64')
if (encryptionKey.length !== 32) {
  throw new Error('BACKUP_ENCRYPTION_KEY must be a base64 encoded 32-byte key')
}

const directory = await mkdtemp(join(tmpdir(), 'icp-backup-'))
const dumpFile = join(directory, 'database.dump')
const encryptedFile = join(directory, 'database.dump.enc')
const timestamp = new Date()
  .toISOString()
  .replaceAll(':', '-')
  .replaceAll('.', '-')

try {
  await run('pg_dump', [
    '--dbname',
    databaseUrl,
    '--format=custom',
    '--no-owner',
    '--file',
    dumpFile
  ])
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv)
  await writeFile(encryptedFile, Buffer.concat([MAGIC, iv]))
  await pipeline(
    createReadStream(dumpFile),
    cipher,
    createWriteStream(encryptedFile, { flags: 'a' })
  )
  await appendFile(encryptedFile, cipher.getAuthTag())

  const client = s3Client()
  const dailyKey = `backups/daily/${timestamp}.dump.enc`
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: dailyKey,
      Body: createReadStream(encryptedFile),
      ContentType: 'application/octet-stream',
      Metadata: { encryption: 'aes-256-gcm', format: 'pg-custom' }
    })
  )

  if (new Date().getUTCDay() === 0) {
    const weeklyKey = `backups/weekly/${timestamp}.dump.enc`
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: weeklyKey,
        Body: createReadStream(encryptedFile),
        ContentType: 'application/octet-stream',
        Metadata: { encryption: 'aes-256-gcm', format: 'pg-custom' }
      })
    )
  }

  await prune(client, bucket, 'backups/daily/', DAILY_KEEP)
  await prune(client, bucket, 'backups/weekly/', WEEKLY_KEEP)
  process.stdout.write(`Encrypted PostgreSQL backup uploaded: ${dailyKey}\n`)
} finally {
  await rm(directory, { recursive: true, force: true })
}
