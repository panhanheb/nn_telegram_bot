import { db } from '../../../../utils/db'
import { decryptToken } from '../../../../utils/crypto'
import { resolveGroup } from '../../../../utils/group-resolver'
import { deleteMessage } from '../../../../utils/telegram'

/**
 * Delete a message from the group (and from stored history).
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  const msgIdStr = getRouterParam(event, 'msgId')
  const msgId = Number(msgIdStr)

  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Group ID' })
  }
  if (!msgIdStr || isNaN(msgId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Message ID' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  }

  const bot = await db.getBot()
  if (!bot) {
    throw createError({ statusCode: 404, statusMessage: 'No bot is configured' })
  }

  // Try to delete on Telegram. If Telegram rejects it (too old, no permission),
  // surface the error and keep the local copy so the UI stays truthful.
  try {
    const token = await decryptToken(bot.token)
    await deleteMessage(token, group.chatId, msgId)
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to delete message: ${err.message}`
    })
  }

  // Remove every stored copy of this message from the group's history.
  const messages = await db.getChatMessages()
  const remaining = messages.filter(m => !(m.chatId === group.chatId && m.messageId === msgId))
  if (remaining.length !== messages.length) {
    await db.saveChatMessages(remaining)
  }

  await db.createLog(group.id, group.name, null, `🗑️ Deleted message #${msgId} from dashboard`, 'SUCCESS', null, null)

  return { success: true, deletedMessageId: msgId }
})
