import { describe, it, expect, vi } from 'vitest'
import {
  hashPassword,
  verifyPassword,
  encryptToken,
  decryptToken,
  timingSafeEqual,
  isLegacyEncryptedToken,
  hashPasswordLegacy
} from '../../server/utils/crypto'

// Mock useRuntimeConfig for standalone Vitest execution
vi.stubGlobal('useRuntimeConfig', () => ({
  encryptionKey: 'test-secret-encryption-key-for-unit-testing!'
}))

describe('Cryptographic Engine', () => {
  describe('timingSafeEqual', () => {
    it('returns true for identical strings', () => {
      expect(timingSafeEqual('my-secret-token', 'my-secret-token')).toBe(true)
    })

    it('returns false for different strings', () => {
      expect(timingSafeEqual('my-secret-token', 'my-wrong-token')).toBe(false)
    })

    it('returns false for strings of different lengths', () => {
      expect(timingSafeEqual('short', 'much-longer-string')).toBe(false)
    })
  })

  describe('PBKDF2 Password Hashing', () => {
    it('generates a valid pbkdf2 hash format with 210,000 iterations', async () => {
      const hash = await hashPassword('MySecretP@ssw0rd!')
      expect(hash.startsWith('pbkdf2$210000$')).toBe(true)
      const parts = hash.split('$')
      expect(parts.length).toBe(4)
      expect(parts[2].length).toBe(32) // 16 bytes hex salt
      expect(parts[3].length).toBe(64) // 32 bytes hex derived key
    })

    it('generates unique salts on successive hashes of identical password', async () => {
      const hash1 = await hashPassword('password123')
      const hash2 = await hashPassword('password123')
      expect(hash1).not.toBe(hash2)
    })

    it('correctly verifies a valid password against PBKDF2 hash', async () => {
      const password = 'CorrectHorseBatteryStaple!'
      const hash = await hashPassword(password)
      const result = await verifyPassword(password, hash)
      expect(result.valid).toBe(true)
      expect(result.needsRehash).toBe(false)
    })

    it('rejects an invalid password', async () => {
      const hash = await hashPassword('CorrectPassword')
      const result = await verifyPassword('WrongPassword', hash)
      expect(result.valid).toBe(false)
    })

    it('identifies and verifies legacy SHA-256 hash, signaling needsRehash', async () => {
      const password = 'LegacyPassword123'
      const legacySalt = 'test-secret-encryption-key-for-unit-testing!'
      const legacyHash = await hashPasswordLegacy(password, legacySalt)

      const result = await verifyPassword(password, legacyHash)
      expect(result.valid).toBe(true)
      expect(result.needsRehash).toBe(true)
    })

    it('does NOT authenticate backdoor passwords', async () => {
      const hash = await hashPassword('SuperStrongPassword!')
      const resultAdmin = await verifyPassword('admin', hash)
      const resultAbc = await verifyPassword('abc@123', hash)
      expect(resultAdmin.valid).toBe(false)
      expect(resultAbc.valid).toBe(false)
    })
  })

  describe('AES-256-GCM Token Encryption & Key Rotation', () => {
    it('encrypts token into v1 authenticated format', async () => {
      const token = '123456789:AAHSjsCHbrha09fWkfkqfFX3ioWtXpSJoZg'
      const ciphertext = await encryptToken(token, 'primary')
      expect(ciphertext.startsWith('v1:primary:')).toBe(true)
      expect(isLegacyEncryptedToken(ciphertext)).toBe(false)
    })

    it('decrypts v1 AES-GCM token correctly', async () => {
      const token = '8564410304:AAHSjsCHbrha09fWkfkqfFX3ioWtXpSJoZg'
      const encrypted = await encryptToken(token)
      const decrypted = await decryptToken(encrypted)
      expect(decrypted).toBe(token)
    })

    it('rejects tampered AES-GCM ciphertext due to authentication tag mismatch', async () => {
      const token = 'my-sensitive-bot-token'
      const encrypted = await encryptToken(token)
      const parts = encrypted.split(':')
      // Tamper last hex character of ciphertext/tag
      const tamperedHex = parts[3].slice(0, -2) + (parts[3].slice(-2) === 'aa' ? 'bb' : 'aa')
      const tamperedCiphertext = `v1:${parts[1]}:${parts[2]}:${tamperedHex}`

      await expect(decryptToken(tamperedCiphertext)).rejects.toThrow()
    })

    it('passes through raw unencrypted token directly', async () => {
      const rawToken = '123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ1234567'
      const result = await decryptToken(rawToken)
      expect(result).toBe(rawToken)
    })
  })
})
