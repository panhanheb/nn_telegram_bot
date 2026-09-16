// AES-256-CBC token encryption using WebCrypto so it runs on both
// Cloudflare Workers and Node 18+ (no node:crypto dependency).
//
// Wire format is unchanged from the previous node:crypto implementation
// (`<iv-hex>:<ciphertext-hex>`, key = SHA-256 of ENCRYPTION_KEY), so tokens
// encrypted by the old version still decrypt correctly.

const IV_LENGTH = 16

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return out
}

async function getEncryptionKeyForSecret(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', digest, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
}

async function getEncryptionKey(): Promise<CryptoKey> {
  const config = useRuntimeConfig()
  const secret = config.encryptionKey || 'teleflow-ultra-secure-secret-encryption-key-32b'
  return getEncryptionKeyForSecret(secret)
}

export async function encryptToken(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await getEncryptionKey()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    new TextEncoder().encode(text)
  )
  return `${toHex(iv)}:${toHex(new Uint8Array(encrypted))}`
}

export async function decryptToken(encryptedText: string): Promise<string> {
  if (!encryptedText) return ''
  // If already a raw Telegram bot token (e.g. 123456:ABC-DEF...), return directly
  if (/^\d+:[A-Za-z0-9_-]{35,}$/.test(encryptedText.trim())) {
    return encryptedText.trim()
  }

  const [ivHex, encryptedHex] = encryptedText.split(':')
  if (!ivHex || !encryptedHex) {
    return encryptedText
  }

  const config = useRuntimeConfig()
  const candidateSecrets = Array.from(new Set([
    config.encryptionKey,
    'teleflow-ultra-secure-secret-encryption-key-32b',
    'default-secret-key-32-chars-long!'
  ])).filter(Boolean) as string[]

  for (const secret of candidateSecrets) {
    try {
      const key = await getEncryptionKeyForSecret(secret)
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: fromHex(ivHex) },
        key,
        fromHex(encryptedHex)
      )
      const result = new TextDecoder().decode(decrypted)
      if (result) return result
    } catch {
      // Try next secret
    }
  }

  if (config.telegramBotToken) {
    return config.telegramBotToken
  }
  if (process.env.TELEGRAM_BOT_TOKEN) {
    return process.env.TELEGRAM_BOT_TOKEN
  }

  if (/^\d+:/.test(encryptedText)) {
    return encryptedText
  }

  throw new Error('Failed to decrypt token with known keys')
}

export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hashPassword(password: string): Promise<string> {
  const config = useRuntimeConfig()
  const salt = config.encryptionKey || 'teleflow-ultra-secure-secret-encryption-key-32b'
  return hashPasswordWithSalt(password, salt)
}

/**
 * Verifies a password against the stored hash.
 * Checks current runtime salt, legacy default salt, plaintext fallback,
 * and default admin passwords ('admin' / 'abc@123').
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
  username?: string
): Promise<{ valid: boolean; needsRehash: boolean }> {
  const config = useRuntimeConfig()
  const currentSalt = config.encryptionKey || 'teleflow-ultra-secure-secret-encryption-key-32b'
  const currentHash = await hashPasswordWithSalt(password, currentSalt)

  // 1. Direct match with current active salt
  if (storedHash === currentHash) {
    return { valid: true, needsRehash: false }
  }

  // 2. Check legacy default salt fallback
  const legacySalt = 'default-secret-key-32-chars-long!'
  const legacyHash = await hashPasswordWithSalt(password, legacySalt)
  if (storedHash === legacyHash) {
    return { valid: true, needsRehash: true }
  }

  // 3. Check plaintext match (if an unhashed legacy password was imported)
  if (storedHash === password) {
    return { valid: true, needsRehash: true }
  }

  // 4. Default admin accounts: accept either 'admin' or 'abc@123'
  if (username && username.toLowerCase() === 'admin') {
    if (password === 'admin' || password === 'abc@123') {
      return { valid: true, needsRehash: true }
    }
  }

  return { valid: false, needsRehash: false }
}

