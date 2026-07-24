import { createHash, randomBytes, randomUUID } from 'node:crypto'

export const SESSION_COOKIE_NAME = 'icp_session'
export const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7

function nowIso() {
  return new Date().toISOString()
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) {
    return null
  }

  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function publicUser(user) {
  if (!user) {
    return null
  }

  return {
    id: user.id ?? user.user_id,
    email: user.email,
    role: user.role,
    displayName: user.display_name ?? user.displayName ?? '',
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
    country: user.country ?? null,
    region: user.region ?? null,
    age: user.age ?? null,
    chineseLevel: user.chinese_level ?? user.chineseLevel ?? null,
    bio: user.bio ?? '',
    status: user.status,
    mustResetPassword:
      user.must_reset_password ?? user.mustResetPassword ?? false,
    createdAt: user.created_at ?? user.createdAt,
    updatedAt: user.updated_at ?? user.updatedAt
  }
}

export async function createSession(
  db,
  userId,
  {
    ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
    userAgent = null,
    ipAddress = null
  } = {}
) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TypeError('A database connection is required')
  }

  if (typeof userId !== 'string' || userId.length === 0) {
    throw new TypeError('A user id is required')
  }

  const boundedTtl = Math.max(
    60,
    Math.min(
      Number(ttlSeconds) || DEFAULT_SESSION_TTL_SECONDS,
      60 * 60 * 24 * 30
    )
  )
  const id = randomUUID()
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + boundedTtl * 1000).toISOString()

  await db
    .prepare(
      `INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at,
      created_at,
      last_seen_at,
      user_agent,
      ip_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      userId,
      tokenHash,
      expiresAt,
      createdAt,
      createdAt,
      userAgent?.slice(0, 512) ?? null,
      ipAddress?.slice(0, 64) ?? null
    )

  return {
    id,
    userId,
    token,
    expiresAt,
    ttlSeconds: boundedTtl
  }
}

export async function findSessionByToken(db, token, { touch = true } = {}) {
  const tokenHash = hashSessionToken(token)
  if (!tokenHash) {
    return null
  }

  const currentTime = nowIso()
  const row = await db
    .prepare(
      `SELECT
        s.id AS session_id,
        s.user_id AS session_user_id,
        s.expires_at AS session_expires_at,
        s.last_seen_at AS session_last_seen_at,
        u.id,
        u.email,
        u.role,
        u.display_name,
        u.avatar_url,
        u.country,
        u.region,
        u.age,
        u.chinese_level,
        u.bio,
        u.status,
        u.must_reset_password,
        u.created_at,
        u.updated_at
      FROM sessions AS s
      INNER JOIN users AS u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?
        AND u.status = 'active'
      LIMIT 1`
    )
    .get(tokenHash, currentTime)

  if (!row) {
    return null
  }

  if (touch) {
    await db
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
      .run(currentTime, row.session_id)
  }

  return {
    sessionId: row.session_id,
    userId: row.session_user_id,
    expiresAt: row.session_expires_at,
    user: publicUser(row)
  }
}

export async function revokeSession(db, sessionId) {
  if (!sessionId) {
    return false
  }

  const result = await db
    .prepare(
      `UPDATE sessions
      SET revoked_at = ?
      WHERE id = ? AND revoked_at IS NULL`
    )
    .run(nowIso(), sessionId)

  return result.changes > 0
}

export async function revokeSessionByToken(db, token) {
  const tokenHash = hashSessionToken(token)
  if (!tokenHash) {
    return false
  }

  const result = await db
    .prepare(
      `UPDATE sessions
      SET revoked_at = ?
      WHERE token_hash = ? AND revoked_at IS NULL`
    )
    .run(nowIso(), tokenHash)

  return result.changes > 0
}

export async function revokeUserSessions(
  db,
  userId,
  { exceptSessionId = null } = {}
) {
  const revokedAt = nowIso()

  if (exceptSessionId) {
    return (
      await db
        .prepare(
          `UPDATE sessions
        SET revoked_at = ?
        WHERE user_id = ? AND id <> ? AND revoked_at IS NULL`
        )
        .run(revokedAt, userId, exceptSessionId)
    ).changes
  }

  return (
    await db
      .prepare(
        `UPDATE sessions
      SET revoked_at = ?
      WHERE user_id = ? AND revoked_at IS NULL`
      )
      .run(revokedAt, userId)
  ).changes
}

export function extractSessionToken(request, { allowBearer = true } = {}) {
  const cookieToken = request.cookies?.[SESSION_COOKIE_NAME]
  if (typeof cookieToken === 'string' && cookieToken.length > 0) {
    return { token: cookieToken, source: 'cookie' }
  }

  if (!allowBearer) {
    return null
  }

  const authorization = request.headers?.authorization
  if (typeof authorization !== 'string') {
    return null
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization)
  if (!match) {
    return null
  }

  return { token: match[1], source: 'bearer' }
}
