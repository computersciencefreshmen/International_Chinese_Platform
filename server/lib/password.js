import { Buffer } from 'node:buffer'
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'

const SCRYPT_PREFIX = 'scrypt'
const SCRYPT_COST = 16384
const SCRYPT_BLOCK_SIZE = 8
const SCRYPT_PARALLELIZATION = 1
const SCRYPT_KEY_LENGTH = 64
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024
const SALT_BYTES = 16

function deriveKey(password, salt, keyLength, options) {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error)
        return
      }

      resolve(derivedKey)
    })
  })
}

function parsePasswordHash(encodedHash) {
  if (typeof encodedHash !== 'string') {
    return null
  }

  const parts = encodedHash.split('$')
  if (parts.length !== 7 || parts[0] !== SCRYPT_PREFIX) {
    return null
  }

  const [, costValue, blockSizeValue, parallelizationValue, keyLengthValue] =
    parts
  const cost = Number(costValue)
  const blockSize = Number(blockSizeValue)
  const parallelization = Number(parallelizationValue)
  const keyLength = Number(keyLengthValue)

  if (
    !Number.isSafeInteger(cost) ||
    !Number.isSafeInteger(blockSize) ||
    !Number.isSafeInteger(parallelization) ||
    !Number.isSafeInteger(keyLength) ||
    cost < 2 ||
    cost > 1048576 ||
    (cost & (cost - 1)) !== 0 ||
    blockSize < 1 ||
    blockSize > 32 ||
    parallelization < 1 ||
    parallelization > 16 ||
    keyLength < 32 ||
    keyLength > 128
  ) {
    return null
  }

  try {
    const salt = Buffer.from(parts[5], 'base64url')
    const digest = Buffer.from(parts[6], 'base64url')

    if (salt.length < 16 || digest.length !== keyLength) {
      return null
    }

    return {
      cost,
      blockSize,
      parallelization,
      keyLength,
      salt,
      digest
    }
  } catch {
    return null
  }
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new TypeError('Password must be a non-empty string')
  }

  const salt = randomBytes(SALT_BYTES)
  const digest = await deriveKey(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY
  })

  return [
    SCRYPT_PREFIX,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    SCRYPT_KEY_LENGTH,
    salt.toString('base64url'),
    digest.toString('base64url')
  ].join('$')
}

export async function verifyPassword(password, encodedHash) {
  if (typeof password !== 'string') {
    return false
  }

  const parsed = parsePasswordHash(encodedHash)
  if (!parsed) {
    return false
  }

  try {
    const candidate = await deriveKey(password, parsed.salt, parsed.keyLength, {
      N: parsed.cost,
      r: parsed.blockSize,
      p: parsed.parallelization,
      maxmem: SCRYPT_MAX_MEMORY
    })

    return timingSafeEqual(candidate, parsed.digest)
  } catch {
    return false
  }
}

export function needsPasswordRehash(encodedHash) {
  const parsed = parsePasswordHash(encodedHash)

  return (
    !parsed ||
    parsed.cost !== SCRYPT_COST ||
    parsed.blockSize !== SCRYPT_BLOCK_SIZE ||
    parsed.parallelization !== SCRYPT_PARALLELIZATION ||
    parsed.keyLength !== SCRYPT_KEY_LENGTH
  )
}
