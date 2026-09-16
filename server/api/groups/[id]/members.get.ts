import { db } from '../../../utils/db'
import { decryptToken } from '../../../utils/crypto'
import { resolveGroup } from '../../../utils/group-resolver'
import { getChatAdministrators, getChatMemberCount } from '../../../utils/telegram'

/**
 * Return the members the bot knows about in a group: everyone it has observed
 * posting a message, merged with the live administrator list.
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Group ID' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    return {
      groupId: idStr,
      chatId: idStr,
      name: `Chat ${idStr}`,
      totalCount: null,
      knownCount: 0,
      adminError: null,
      members: []
    }
  }

  // Members discovered from incoming messages
  const seen = await db.getMembersByChatId(group.chatId)
  const byId = new Map<number, (typeof seen)[number]>()
  for (const m of seen) byId.set(m.userId, { ...m })

  // Merge live admin data (status + any users we haven't seen post yet)
  let totalCount: number | null = null
  let adminError: string | null = null
  const bot = await db.getBot()
  if (bot) {
    try {
      const token = await decryptToken(bot.token)
      const [admins, count] = await Promise.all([
        getChatAdministrators(token, group.chatId),
        getChatMemberCount(token, group.chatId).catch(() => null)
      ])
      totalCount = count

      for (const a of admins) {
        const now = new Date().toISOString()
        const existing = byId.get(a.user.id)
        if (existing) {
          existing.status = a.status
          existing.username = a.user.username ?? existing.username
          existing.firstName = a.user.first_name ?? existing.firstName
          existing.lastName = a.user.last_name ?? existing.lastName
        } else {
          byId.set(a.user.id, {
            chatId: group.chatId,
            userId: a.user.id,
            firstName: a.user.first_name,
            lastName: a.user.last_name,
            username: a.user.username,
            isBot: a.user.is_bot,
            status: a.status,
            messageCount: 0,
            firstSeen: now,
            lastSeen: now
          })
          // Persist newly discovered admins so they survive without a message
          await db.recordMember(group.chatId, a.user, false)
        }
      }
    } catch (err: any) {
      adminError = err.message
    }
  }

  const statusRank: Record<string, number> = { creator: 0, administrator: 1, member: 2 }
  const members = Array.from(byId.values()).sort((a, b) => {
    const ra = statusRank[a.status || 'member'] ?? 3
    const rb = statusRank[b.status || 'member'] ?? 3
    if (ra !== rb) return ra - rb
    return b.messageCount - a.messageCount
  })

  return {
    groupId: String(group.id),
    chatId: group.chatId,
    name: group.name,
    totalCount,
    knownCount: members.length,
    adminError,
    members
  }
})
