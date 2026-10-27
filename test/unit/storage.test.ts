import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { SqliteStorageRepository } from '../../server/db/sqlite-repository'

describe('Relational Storage Repository (SQLite / D1 abstraction)', () => {
  const testDbPath = path.resolve(process.cwd(), 'data/test-storage.db')
  let repo: SqliteStorageRepository

  beforeAll(async () => {
    // Clean any previous test run
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
    repo = new SqliteStorageRepository(testDbPath)
    await repo.initialize()
  })

  afterAll(() => {
    repo.close()
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath)
    if (fs.existsSync(`${testDbPath}-wal`)) fs.unlinkSync(`${testDbPath}-wal`)
    if (fs.existsSync(`${testDbPath}-shm`)) fs.unlinkSync(`${testDbPath}-shm`)
  })

  it('manages Users with RBAC and prevents demoting the last Owner', async () => {
    expect(await repo.isSetupRequired()).toBe(true)

    // 1. Create primary Owner
    const owner = await repo.createOwner('primary_owner', 'pbkdf2_hash_owner')
    expect(owner.role).toBe('Owner')
    expect(await repo.hasOwner()).toBe(true)
    expect(await repo.isSetupRequired()).toBe(false)

    // Cannot create second owner via createOwner
    await expect(repo.createOwner('second_owner', 'hash')).rejects.toThrow(/already been initialized/)

    // 2. Create Admin and Moderator
    const admin = await repo.createUser('sys_admin', 'hash_admin', 'Admin')
    expect(admin.role).toBe('Admin')

    // 3. Prevent demoting the last remaining Owner
    await expect(repo.updateUserRole(owner.id, 'Viewer')).rejects.toThrow(/Cannot demote the primary Owner account/)

    // 4. Prevent deleting the last remaining Owner
    await expect(repo.deleteUser(owner.id)).rejects.toThrow(/Cannot delete the primary Owner account/)

    // Deleting admin succeeds
    expect(await repo.deleteUser(admin.id)).toBe(true)
  })

  it('handles server-side sessions with CSRF tokens and touch', async () => {
    const owner = (await repo.getUsers())[0]!
    const sessionToken = 'session_test_token_1234567890abcdef'
    const csrfToken = 'csrf_test_token_1234567890abcdef'
    const now = new Date()

    await repo.saveSession({
      id: sessionToken,
      userId: owner.id,
      username: owner.username,
      role: owner.role,
      csrfToken,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
      lastActiveAt: now.toISOString()
    })

    const retrieved = await repo.getSession(sessionToken)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.username).toBe(owner.username)
    expect(retrieved?.csrfToken).toBe(csrfToken)

    // Touch session
    await repo.touchSession(sessionToken)

    // Delete session
    expect(await repo.deleteSession(sessionToken)).toBe(true)
    expect(await repo.getSession(sessionToken)).toBeNull()
  })

  it('atomically claims schedule run slots preventing duplicate execution', async () => {
    const schedule = await repo.createSchedule({
      title: 'Daily Report',
      message: 'Hello World',
      messageType: 'text',
      parseMode: 'HTML',
      type: 'daily',
      time: '08:00',
      timezone: 'UTC',
      active: true
    })

    const slot = '2026-10-27T08:00:00Z'

    // First claim should succeed
    const claimedFirst = await repo.claimScheduleRun(schedule.id, slot)
    expect(claimedFirst).toBe(true)

    // Second claim for identical schedule & minute slot MUST fail
    const claimedSecond = await repo.claimScheduleRun(schedule.id, slot)
    expect(claimedSecond).toBe(false)

    // Mark completed
    await repo.completeScheduleRun(schedule.id, slot, 'SUCCESS', 5, 0)
  })

  it('deduplicates chat updates for idempotency', async () => {
    const updateId = 987654321

    expect(await repo.isUpdateProcessed(updateId)).toBe(false)
    await repo.markUpdateProcessed(updateId)
    expect(await repo.isUpdateProcessed(updateId)).toBe(true)
  })
})
