import { describe, it, expect, beforeEach } from 'vitest'
import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  clearAllRateLimits
} from '../../server/utils/rate-limiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits()
  })

  it('allows initial attempts within max threshold', () => {
    const key = 'test-ip-1'
    const status = checkRateLimit(key, { maxAttempts: 3, windowMs: 1000, lockoutMs: 5000 })
    expect(status.allowed).toBe(true)
    expect(status.remainingAttempts).toBe(3)
  })

  it('decrements remaining attempts on failure', () => {
    const key = 'test-ip-2'
    const attempt1 = recordFailedAttempt(key, { maxAttempts: 3, windowMs: 1000, lockoutMs: 5000 })
    expect(attempt1.locked).toBe(false)
    expect(attempt1.remainingAttempts).toBe(2)

    const attempt2 = recordFailedAttempt(key, { maxAttempts: 3, windowMs: 1000, lockoutMs: 5000 })
    expect(attempt2.locked).toBe(false)
    expect(attempt2.remainingAttempts).toBe(1)
  })

  it('locks out when maxAttempts is reached', () => {
    const key = 'test-ip-3'
    const opts = { maxAttempts: 3, windowMs: 10000, lockoutMs: 5000 }

    recordFailedAttempt(key, opts)
    recordFailedAttempt(key, opts)
    const finalAttempt = recordFailedAttempt(key, opts)

    expect(finalAttempt.locked).toBe(true)
    expect(finalAttempt.remainingAttempts).toBe(0)
    expect(finalAttempt.retryAfterSeconds).toBeGreaterThan(0)

    const check = checkRateLimit(key, opts)
    expect(check.allowed).toBe(false)
    expect(check.remainingAttempts).toBe(0)
    expect(check.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets attempts after resetRateLimit is called', () => {
    const key = 'test-ip-4'
    const opts = { maxAttempts: 3, windowMs: 10000, lockoutMs: 5000 }

    recordFailedAttempt(key, opts)
    recordFailedAttempt(key, opts)
    resetRateLimit(key)

    const check = checkRateLimit(key, opts)
    expect(check.allowed).toBe(true)
    expect(check.remainingAttempts).toBe(3)
  })
})
