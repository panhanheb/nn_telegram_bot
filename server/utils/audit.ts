import { H3Event, getRequestHeader } from 'h3'
import { db } from './db'
import type { JSONAuditEntry } from './db'

export async function logAudit(
  event: H3Event,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: any
): Promise<JSONAuditEntry | null> {
  try {
    const user = event.context.user
    const ipAddress = getRequestHeader(event, 'cf-connecting-ip') ||
      getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      event.node?.req?.socket?.remoteAddress ||
      '127.0.0.1'
    const userAgent = getRequestHeader(event, 'user-agent') || 'Unknown'

    return await db.createAuditEntry({
      userId: user?.id || null,
      username: user?.username || 'anonymous',
      role: user?.role || 'Guest',
      action,
      entityType,
      entityId,
      ipAddress,
      userAgent,
      details
    })
  } catch (err) {
    console.warn('[Audit] Failed to record audit entry:', err)
    return null
  }
}
