import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { getChatInfo } from '../../utils/telegram'

let lastSyncTimestamp = 0
const SYNC_COOLDOWN_MS = 3000

export default defineEventHandler(async (event) => {
  try {
    let groups = await db.getGroups()
    const query = getQuery(event)
    const forceSync = query.sync === 'true' || query.sync === '1'
    const now = Date.now()

    if ((forceSync || now - lastSyncTimestamp > SYNC_COOLDOWN_MS) && groups.length > 0) {
      lastSyncTimestamp = now
      try {
        const bot = await db.getBot()
        if (bot && bot.active) {
          const token = await decryptToken(bot.token)
          let hasChanges = false

          await Promise.allSettled(
            groups.map(async (g) => {
              try {
                const info = await getChatInfo(token, g.chatId)
                const newTitle =
                  info.title ||
                  [info.first_name, info.last_name].filter(Boolean).join(' ') ||
                  (info.username ? `@${info.username}` : '')
                const updates: Record<string, any> = {}

                if (newTitle && newTitle !== g.name) {
                  updates.name = newTitle
                }
                if (info.type && info.type !== g.type) {
                  updates.type = info.type
                }
                if (info.id && String(info.id) !== g.chatId) {
                  updates.chatId = String(info.id)
                }

                if (Object.keys(updates).length > 0) {
                  await db.updateGroup(g.id, updates)
                  hasChanges = true
                  console.log(`[Groups API] Synced Telegram chat info for "${g.name}":`, updates)
                }
              } catch {
                // Ignore transient lookup failures for individual chats
              }
            })
          )

          if (hasChanges) {
            groups = await db.getGroups()
          }
        }
      } catch {
        // Continue with stored groups if Telegram sync fails
      }
    }

    const logs = await db.getLogs()

    // Map each group to format expected by UI, sorting by ID desc
    const sortedGroups = [...groups].sort((a, b) => b.id - a.id)

    return sortedGroups.map(g => {
      // Find logs associated with this group
      const groupLogs = logs
        .filter(l => l.groupId === g.id || (l.groupId === null && l.chatTitle.includes(g.chatId)))
        .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())

      return {
        id: String(g.id),
        chatId: g.chatId,
        name: g.name,
        isActive: g.active,
        type: g.type || 'group',
        isAdmin: g.isAdmin || false,
        permissionsVerified: g.permissionsVerified || false,
        createdAt: g.createdAt || new Date().toISOString(),
        lastMessageTime: groupLogs[0]?.sentAt || null
      }
    })
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch groups: ${error.message}`
    })
  }
})
