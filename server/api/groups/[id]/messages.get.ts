import { db } from '../../../utils/db'
import { resolveGroup } from '../../../utils/group-resolver'

/**
 * Return the stored conversation history for a group (Telegram-style chat view).
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Group ID is required' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    // If chat has no messages and group not found, return empty array rather than crashing
    return {
      groupId: idStr,
      chatId: idStr,
      name: `Chat ${idStr}`,
      messages: []
    }
  }

  const limitRaw = Number(getQuery(event).limit)
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200

  const messages = await db.getChatMessagesByChatId(group.chatId, limit)

  return {
    groupId: String(group.id),
    chatId: group.chatId,
    name: group.name,
    messages
  }
})
