import { db, JSONGroup } from './db'
import { decryptToken } from './crypto'
import { getChatInfo } from './telegram'

/**
 * Resiliently resolves a group by:
 * 1. Internal numeric database ID (`id: 1, 2, ...`)
 * 2. Telegram chat ID (`chatId: "-100148291024"`, `"@channel"`)
 * 3. Auto-registers the chat with Telegram `getChat` if a valid chat ID was passed
 *    but not yet saved in the local database.
 */
export async function resolveGroup(idOrChatId: string | number): Promise<JSONGroup | null> {
  const str = String(idOrChatId ?? '').trim()
  if (!str) return null

  // 1. Try finding by database numeric ID
  const num = Number(str)
  if (!isNaN(num) && num > 0) {
    const group = await db.getGroupById(num)
    if (group) return group
  }

  // 2. Try finding by exact Telegram chatId
  const byChatId = await db.getGroupByChatId(str)
  if (byChatId) return byChatId

  // 3. If str looks like a Telegram chat ID or handle (-100..., @channel, etc.)
  if (str.startsWith('-') || str.startsWith('@') || /^\d{6,}$/.test(str)) {
    const bot = await db.getBot()
    if (bot) {
      try {
        const token = await decryptToken(bot.token)
        const info = await getChatInfo(token, str)
        const name =
          info.title ||
          info.username ||
          [info.first_name, info.last_name].filter(Boolean).join(' ') ||
          `Chat ${str}`

        const newGroup = await db.createGroup(name, str, (info.type as any) || 'group', true)
        console.log(`[Group Resolver] Auto-registered chat ${str} ("${name}")`)
        return newGroup
      } catch (err: any) {
        console.warn(`[Group Resolver] Could not auto-fetch chat info for ${str}:`, err.message)
      }
    }
  }

  return null
}

