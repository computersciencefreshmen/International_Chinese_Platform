import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

import { z } from 'zod'

import { createDatabase, DEFAULT_DATABASE_FILE } from './database.js'
import { hashPassword } from '../lib/password.js'

const bootstrapSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(12, '管理员密码至少需要 12 个字符')
      .max(128)
      .regex(/[a-z]/, '管理员密码必须包含小写字母')
      .regex(/[A-Z]/, '管理员密码必须包含大写字母')
      .regex(/\d/, '管理员密码必须包含数字')
      .regex(/[^A-Za-z0-9]/, '管理员密码必须包含特殊字符'),
    displayName: z.string().trim().min(1).max(100)
  })
  .strict()

function bootstrapError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

export async function bootstrapAdministrator(database, input) {
  if (!database?.open) {
    throw new TypeError('bootstrapAdministrator requires an open database')
  }

  const result = bootstrapSchema.safeParse(input)
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('；')
    throw bootstrapError('INVALID_ADMIN_INPUT', message)
  }

  const existingAdministrator = database
    .prepare("SELECT id FROM users WHERE role = 'administrator' LIMIT 1")
    .get()
  if (existingAdministrator) {
    throw bootstrapError(
      'ADMIN_ALREADY_EXISTS',
      '管理员已存在；引导命令不会覆盖现有账号'
    )
  }

  const existingEmail = database
    .prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE LIMIT 1')
    .get(result.data.email)
  if (existingEmail) {
    throw bootstrapError('EMAIL_IN_USE', '该邮箱已被其他账号使用')
  }

  const id = randomUUID()
  const passwordHash = await hashPassword(result.data.password)
  const timestamp = new Date().toISOString()

  const create = database.transaction(() => {
    if (
      database
        .prepare("SELECT id FROM users WHERE role = 'administrator' LIMIT 1")
        .get()
    ) {
      throw bootstrapError(
        'ADMIN_ALREADY_EXISTS',
        '管理员已存在；引导命令不会覆盖现有账号'
      )
    }

    database
      .prepare(
        `INSERT INTO users (
          id, email, password_hash, role, display_name, status, created_at, updated_at
        ) VALUES (?, ?, ?, 'administrator', ?, 'active', ?, ?)`
      )
      .run(
        id,
        result.data.email,
        passwordHash,
        result.data.displayName,
        timestamp,
        timestamp
      )
    database
      .prepare(
        `INSERT INTO audit_logs (
          id, actor_id, action, entity_type, entity_id, details_json, created_at
        ) VALUES (?, ?, 'administrator.bootstrapped', 'user', ?, ?, ?)`
      )
      .run(
        randomUUID(),
        id,
        id,
        JSON.stringify({ source: 'admin:bootstrap' }),
        timestamp
      )
  })
  create()

  return {
    id,
    email: result.data.email,
    displayName: result.data.displayName,
    role: 'administrator'
  }
}

function isMainModule() {
  return (
    Boolean(process.argv[1]) &&
    pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  )
}

if (isMainModule()) {
  const database = createDatabase({
    filename: process.env.DATABASE_PATH || DEFAULT_DATABASE_FILE
  })
  try {
    const administrator = await bootstrapAdministrator(database, {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      displayName: process.env.ADMIN_DISPLAY_NAME || '平台管理员'
    })
    process.stdout.write(
      `Administrator created: ${administrator.email} (${administrator.id})\n`
    )
  } catch (error) {
    process.stderr.write(`Administrator bootstrap failed: ${error.message}\n`)
    process.exitCode = 1
  } finally {
    database.close()
  }
}

export default bootstrapAdministrator
