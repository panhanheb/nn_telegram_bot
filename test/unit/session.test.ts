import { describe, it, expect } from 'vitest'
import { generateSecureToken, requireRole } from '../../server/utils/session'

describe('Session & RBAC Utilities', () => {
  it('generates secure 32-byte hex tokens', () => {
    const token1 = generateSecureToken(32)
    const token2 = generateSecureToken(32)

    expect(token1).toHaveLength(64)
    expect(token2).toHaveLength(64)
    expect(token1).not.toBe(token2)
    expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true)
  })

  it('enforces RBAC permissions with requireRole', () => {
    // 1. Missing authentication
    const emptyEvent = { context: {} } as any
    expect(() => requireRole(emptyEvent, 'Admin')).toThrowError(/Authentication required/)

    // 2. Insufficient role
    const viewerEvent = {
      context: {
        user: { id: 'user-1', username: 'viewer_user', role: 'Viewer' }
      }
    } as any
    expect(() => requireRole(viewerEvent, 'Admin', 'Owner')).toThrowError(/lacks permission/)

    // 3. Sufficient role (Admin)
    const adminEvent = {
      context: {
        user: { id: 'user-2', username: 'admin_user', role: 'Admin' }
      }
    } as any
    expect(() => requireRole(adminEvent, 'Admin', 'Owner')).not.toThrow()

    // 4. Sufficient role (Owner)
    const ownerEvent = {
      context: {
        user: { id: 'user-3', username: 'owner_user', role: 'Owner' }
      }
    } as any
    expect(() => requireRole(ownerEvent, 'Owner')).not.toThrow()
  })
})
