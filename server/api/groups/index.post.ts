import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { getChatInfo } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.chatId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Chat ID is required'
      })
    }

    const chatId = body.chatId.trim()
    let name = body.name ? body.name.trim() : ''
    let type: 'group' | 'channel' | 'supergroup' | 'private' = body.type || 'group'
    const isActive = body.isActive !== undefined ? !!body.isActive : true

    // Validate the chat ID format. Telegram only accepts a numeric ID
    // (e.g. -1001234567890) or a public @username — not invite links or tokens.
    const isNumericId = /^-?\d+$/.test(chatId)
    const isUsername = /^@[A-Za-z0-9_]{3,}$/.test(chatId)
    if (!isNumericId && !isUsername) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Chat ID. Use a numeric ID like -1001234567890 or a public @username — not an invite link (t.me/...) or a bot token.'
      })
    }

    // Check if group already exists
    const existingGroup = await db.getGroupByChatId(chatId)
    if (existingGroup) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A group/channel with this Chat ID already exists'
      })
    }

    let isAdmin = false
    let permissionsVerified = false

    // Auto-detect metadata using the configured bot if its token is readable
    const bot = await db.getBot()
    if (bot) {
      try {
        const token = await decryptToken(bot.token)
        const info = await getChatInfo(token, chatId)

        // Auto fill name if empty or dynamically refresh it
        name = info.title || info.first_name || info.username || name || `Chat ${chatId}`
        type = info.type
        permissionsVerified = true
        isAdmin = true
      } catch (botError: any) {
        console.warn(`[Groups API] Bot failed to auto-detect chat info: ${botError.message}`)
        // Don't fail the request, just fallback to manual details
      }
    }

    // Set fallback name if still empty
    if (!name) {
      name = `Chat (${chatId})`
    }

    const group = await db.createGroup(name, chatId, type, isActive)

    // Save verification flags
    if (permissionsVerified) {
      await db.updateGroup(group.id, { isAdmin, permissionsVerified })
    }

    return {
      success: true,
      group: {
        id: String(group.id),
        chatId: group.chatId,
        name: name,
        isActive: group.active,
        type: type,
        isAdmin: isAdmin,
        permissionsVerified: permissionsVerified,
        createdAt: group.createdAt
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to create group: ${error.message}`
    })
  }
})
