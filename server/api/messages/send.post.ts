import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramVideo,
  sendTelegramDocument
} from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.chatId || !body.message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'chatId and message are required fields'
      })
    }

    const bot = await db.getBot()
    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No bot is configured'
      })
    }

    const chatId = body.chatId.trim()
    const isValidChatId = /^-?\d+$/.test(chatId) || /^@[A-Za-z0-9_]{3,}$/.test(chatId)
    if (!isValidChatId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid target chat ID. Use a numeric group ID like -1001234567890 or a public @username.'
      })
    }

    const message = body.message.trim()
    const messageType = body.messageType || 'text'
    const mediaUrl = body.mediaUrl ? body.mediaUrl.trim() : ''
    const parseMode = body.parseMode || 'HTML'

    // Resolve the group (if this chat is a registered target) for accurate logging
    const group = await db.getGroupByChatId(chatId)
    const chatTitle = group ? group.name : `Chat ID: ${chatId}`

    let response: any = null
    try {
      const token = await decryptToken(bot.token)
      if (messageType === 'photo' && mediaUrl) {
        response = await sendTelegramPhoto(token, chatId, mediaUrl, message, parseMode)
      } else if (messageType === 'video' && mediaUrl) {
        response = await sendTelegramVideo(token, chatId, mediaUrl, message, parseMode)
      } else if (messageType === 'document' && mediaUrl) {
        response = await sendTelegramDocument(token, chatId, mediaUrl, message, parseMode)
      } else {
        response = await sendTelegramMessage(token, chatId, message, parseMode)
      }
    } catch (err: any) {
      await db.createLog(group ? group.id : null, chatTitle, null, message, 'FAILED', err.message)
      throw createError({
        statusCode: 400,
        statusMessage: `Failed to send message: ${err.message}`
      })
    }

    const log = await db.createLog(group ? group.id : null, chatTitle, null, message, 'SUCCESS', null, response)

    return {
      success: true,
      message: 'Message sent successfully',
      log
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to send message: ${error.message}`
    })
  }
})
