import { db } from '../../utils/db'

const ROLES = ['creator', 'administrator', 'member', 'restricted', 'left', 'kicked'] as const
const MAX_LIMIT = 500

/**
 * List every member the bot has observed across all groups, from the local
 * member registry (built from incoming messages and admin syncs). Makes no
 * Telegram calls.
 *
 * Query: search (name/@username/user id), chatId, role, includeBots=true,
 *        limit (default 100, max 500), offset.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const search = String(query.search ?? '').trim().toLowerCase().replace(/^@/, '')
  const chatId = String(query.chatId ?? '').trim()
  const roleParam = String(query.role ?? '').trim()
  const role = (ROLES as readonly string[]).includes(roleParam) ? roleParam : ''
  const includeBots = query.includeBots === 'true' || query.includeBots === '1'
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit ?? '')) || 100))
  const offset = Math.max(0, parseInt(String(query.offset ?? '')) || 0)

  const [members, groups] = await Promise.all([db.getMembers(), db.getGroups()])
  const groupByChat = new Map(groups.map(g => [g.chatId, g]))

  let rows = members.map((m) => {
    const group = groupByChat.get(m.chatId)
    return {
      chatId: m.chatId,
      groupId: group ? String(group.id) : null,
      groupName: group?.name ?? null,
      userId: m.userId,
      firstName: m.firstName ?? null,
      lastName: m.lastName ?? null,
      username: m.username ?? null,
      isBot: m.isBot,
      status: m.status ?? 'member',
      messageCount: m.messageCount ?? 0,
      firstSeen: m.firstSeen,
      lastSeen: m.lastSeen
    }
  })

  if (!includeBots) rows = rows.filter(r => !r.isBot)
  if (chatId) rows = rows.filter(r => r.chatId === chatId)
  if (role) rows = rows.filter(r => r.status === role)
  if (search) {
    rows = rows.filter((r) => {
      const name = `${r.firstName ?? ''} ${r.lastName ?? ''}`.toLowerCase()
      return name.includes(search) ||
        (r.username ?? '').toLowerCase().includes(search) ||
        String(r.userId).includes(search)
    })
  }

  rows.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())

  return {
    total: rows.length,
    uniqueUsers: new Set(rows.map(r => r.userId)).size,
    limit,
    offset,
    members: rows.slice(offset, offset + limit)
  }
})
