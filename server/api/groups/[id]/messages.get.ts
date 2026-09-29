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

  // Fingerprint of the thread (covers new, edited and deleted messages). The
  // dashboard polls every ~1.5s with ?version=; when nothing changed we skip
  // sending the whole history again.
  const version = fingerprint(messages)
  if (getQuery(event).version === version) {
    return { groupId: String(group.id), chatId: group.chatId, name: group.name, version, unchanged: true }
  }

  return {
    groupId: String(group.id),
    chatId: group.chatId,
    name: group.name,
    version,
    messages
  }
})

// FNV-1a over the fields that affect how the thread renders.
function fingerprint(messages: Array<{ id: string; text: string; mediaFileId?: string }>): string {
  let hash = 0x811c9dc5
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      hash ^= s.charCodeAt(i)
      hash = Math.imul(hash, 0x01000193)
    }
  }
  for (const m of messages) {
    feed(m.id)
    feed(m.text || '')
    feed(m.mediaFileId || '')
  }
  return `${messages.length}-${(hash >>> 0).toString(36)}`
}
