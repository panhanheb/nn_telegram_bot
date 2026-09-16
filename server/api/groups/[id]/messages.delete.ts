import { db } from '../../../utils/db'
import { resolveGroup } from '../../../utils/group-resolver'

/**
 * Clear a group's stored conversation history from the dashboard.
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Group ID' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const messages = await db.getChatMessages()
  const remaining = messages.filter(m => m.chatId !== group.chatId)
  const removed = messages.length - remaining.length

  if (removed > 0) {
    await db.saveChatMessages(remaining)
  }

  await db.createLog(group.id, group.name, null, `🧹 Cleared chat history (${removed} messages) from dashboard`, 'SUCCESS', null, null)

  return { success: true, removed }
})
