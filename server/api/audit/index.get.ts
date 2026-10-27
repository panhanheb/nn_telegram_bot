import { db } from '../../utils/db'
import { requireRole } from '../../utils/session'

export default defineEventHandler(async (event) => {
  // Only Owner and Admin can inspect security audit logs
  requireRole(event, 'Owner', 'Admin')

  const query = getQuery(event)
  const limit = Math.min(500, Math.max(1, parseInt(query.limit as string || '100', 10) || 100))

  const entries = await db.getAuditEntries(limit)
  return {
    entries
  }
})
