// ==============================================================================
// TeleFlow Pro — Hardened Cryptographic Engine
// WebCrypto implementation for Cloudflare Workers & Node 20+
// ==============================================================================

const GCM_IV_LENGTH = 12 // 96 bits recommended for AES-GCM
const CBC_IV_LENGTH = 16
const PBKDF2_ITERATIONS = 210000
const PBKDF2_KEY_LENGTH = 32 // 256 bits

export interface DecryptedTokenResult {
  token: string
  keyId: string
  isLegacy: boolean
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * Constant-time string equality check to mitigate timing side-channel attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const aBuf = enc.encode(a)
  const bBuf = enc.encode(b)
  if (aBuf.byteLength !== bBuf.byteLength) {
    let dummy = 0
    for (let i = 0; i < aBuf.byteLength; i++) {
      dummy |= (aBuf[i] ?? 0) ^ (aBuf[i] ?? 0)
    }
    return false
  }
  let diff = 0
  for (let i = 0; i < aBuf.byteLength; i++) {
    diff |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0)
  }
  return diff === 0
}

/**
 * Returns available encryption keys mapped by key ID.
 */
export function getEncryptionKeysConfig(): Record<string, string> {
  const config = useRuntimeConfig()
  const primary = (config.encryptionKey || process.env.ENCRYPTION_KEY || '').trim()
  const keys: Record<string, string> = {}
  
  if (primary) {
    keys.primary = primary
  }

  // Parse additional keys if configured as JSON or env e.g. ENCRYPTION_KEYS='{"k2":"secret..."}'
  const additionalRaw = process.env.ENCRYPTION_KEYS || (config as any).encryptionKeys
  if (typeof additionalRaw === 'string' && additionalRaw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(additionalRaw)
      Object.assign(keys, parsed)
    } catch {
      // Ignore malformed JSON
    }
  }

  // Fallback if no keys defined (only for dev warning)
  if (Object.keys(keys).length === 0) {
    keys.primary = 'teleflow-ultra-secure-secret-encryption-key-32b'
  }

  return keys
}

async function getAesGcmKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

async function getAesCbcKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
}

/**
 * Encrypt plaintext using authenticated AES-256-GCM.
 * Wire format: `v1:<keyId>:<ivHex>:<ciphertextAndTagHex>`
 */
export async function encryptToken(text: string, keyId = 'primary'): Promise<string> {
  if (!text) return ''
  const keys = getEncryptionKeysConfig()
  const secret = keys[keyId] || keys.primary
  if (!secret) {
    throw new Error(`Encryption key "${keyId}" not found`)
  }

  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH))
  const key = await getAesGcmKey(secret)
  const encoded = new TextEncoder().encode(text)

  const ciphertextAndTag = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return `v1:${keyId}:${toHex(iv)}:${toHex(new Uint8Array(ciphertextAndTag))}`
}

/**
 * Decrypt token ciphertext, supporting both authenticated v1 (AES-256-GCM)
 * and legacy v0 (AES-256-CBC) formats.
 */
export async function decryptToken(encryptedText: string): Promise<string> {
  if (!encryptedText) return ''
  const trimmed = encryptedText.trim()

  // 1. If already raw Telegram Bot Token (1234567:ABC-DEF...)
  if (/^\d+:[A-Za-z0-9_-]{30,}$/.test(trimmed)) {
    return trimmed
  }

  const keys = getEncryptionKeysConfig()

  // 2. Authenticated v1 format: `v1:<keyId>:<ivHex>:<ciphertextAndTagHex>`
  if (trimmed.startsWith('v1:')) {
    const parts = trimmed.split(':')
    if (parts.length === 4 && parts[1] && parts[2] && parts[3]) {
      const keyId = parts[1]
      const ivHex = parts[2]
      const cipherHex = parts[3]
      const secret = keys[keyId] || keys.primary
      if (secret) {
        try {
          const key = await getAesGcmKey(secret)
          const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: fromHex(ivHex) },
            key,
            fromHex(cipherHex)
          )
          return new TextDecoder().decode(decrypted)
        } catch (err: any) {
          throw new Error(`Failed to decrypt AES-GCM token with keyId "${keyId}": ${err.message}`)
        }
      }
    }
  }

  // 3. Legacy AES-256-CBC format: `<ivHex>:<cipherHex>`
  const parts = trimmed.split(':')
  if (parts.length === 2 && parts[0] && parts[1]) {
    const ivHex = parts[0]
    const cipherHex = parts[1]
    const candidateSecrets = Array.from(new Set([
      ...Object.values(keys),
      'teleflow-ultra-secure-secret-encryption-key-32b',
      'default-secret-key-32-chars-long!'
    ])).filter(Boolean)

    for (const secret of candidateSecrets) {
      try {
        const key = await getAesCbcKey(secret)
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-CBC', iv: fromHex(ivHex) },
          key,
          fromHex(cipherHex)
        )
        const result = new TextDecoder().decode(decrypted)
        if (result) return result
      } catch {
        // Continue to next secret
      }
    }
  }

  throw new Error('Failed to decrypt token with available keys')
}

/**
 * Checks whether an encrypted token is in the legacy AES-CBC format and needs re-encryption.
 */
export function isLegacyEncryptedToken(ciphertext: string): boolean {
  if (!ciphertext) return false
  if (/^\d+:[A-Za-z0-9_-]{35,}$/.test(ciphertext.trim())) return true
  return !ciphertext.trim().startsWith('v1:')
}

// ==============================================================================
// Password Hashing — PBKDF2-SHA256 (210,000 Iterations)
// ==============================================================================

/**
 * Hash password using PBKDF2-SHA256 with a unique 16-byte random salt.
 * Storage format: `pbkdf2$<iterations>$<saltHex>$<derivedHex>`
 */
export async function hashPassword(password: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    baseKey,
    PBKDF2_KEY_LENGTH * 8
  )

  return `pbkdf2$${iterations}$${toHex(salt)}$${toHex(new Uint8Array(derived))}`
}

/**
 * Legacy SHA-256 hashing for backward compatibility during password migration.
 */
export async function hashPasswordLegacy(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return toHex(new Uint8Array(hashBuffer))
}

/**
 * Verify a password against a stored hash.
 * Supports PBKDF2-SHA256 natively, and detects legacy SHA-256 hashes to trigger
 * transparent auto-rehash upon successful login.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!password || !storedHash) {
    return { valid: false, needsRehash: false }
  }

  // 1. Modern PBKDF2 hash verification
  if (storedHash.startsWith('pbkdf2$')) {
    const parts = storedHash.split('$')
    if (parts.length === 4 && parts[1] && parts[2] && parts[3]) {
      const iterations = parseInt(parts[1], 10)
      const salt = fromHex(parts[2])
      const expectedHash = parts[3]

      if (!Number.isFinite(iterations) || iterations < 1000) {
        return { valid: false, needsRehash: false }
      }

      const baseKey = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      )

      const derived = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations,
          hash: 'SHA-256'
        },
        baseKey,
        PBKDF2_KEY_LENGTH * 8
      )

      const actualHash = toHex(new Uint8Array(derived))
      const isValid = timingSafeEqual(actualHash, expectedHash)
      return {
        valid: isValid,
        needsRehash: isValid && iterations < PBKDF2_ITERATIONS
      }
    }
  }

  // 2. Legacy SHA-256 hash transparent migration
  const keys = getEncryptionKeysConfig()
  const candidateSalts = Array.from(new Set([
    ...Object.values(keys),
    'teleflow-ultra-secure-secret-encryption-key-32b',
    'default-secret-key-32-chars-long!'
  ])).filter(Boolean)

  for (const salt of candidateSalts) {
    const legacyHash = await hashPasswordLegacy(password, salt)
    if (timingSafeEqual(storedHash, legacyHash)) {
      return { valid: true, needsRehash: true }
    }
  }

  return { valid: false, needsRehash: false }
}
