import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { sendTelegramMessage } from '../../utils/telegram'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.chatId || !body.message) {
      throw createError({
        statusCode: 400,
        statusMessage: 'chatId and message are required'
      })
    }

    const bot = await db.getBot()
    if (!bot) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No bot is configured'
      })
    }

    // Guard against invalid targets (bot links, tokens, invite URLs)
    const chatId = body.chatId.trim()
    const isValidChatId = /^-?\d+$/.test(chatId) || /^@[A-Za-z0-9_]{3,}$/.test(chatId)
    if (!isValidChatId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid target chat ID. Add the bot to your group and pick the group here — its ID looks like -1001234567890, not a t.me link or token.'
      })
    }

    const group = await db.getGroupByChatId(chatId)
    const chatTitle = group ? group.name : `Test Chat ID: ${chatId}`

    let response
    try {
      const token = await decryptToken(bot.token)
      response = await sendTelegramMessage(token, chatId, body.message, 'HTML')
    } catch (err: any) {
      // Create failure log
      await db.createLog(
        group ? group.id : null,
        chatTitle,
        null,
        body.message,
        'FAILED',
        err.message
      )

      throw createError({
        statusCode: 400,
        statusMessage: `Failed to send test message: ${err.message}`
      })
    }

    // Create success log
    const log = await db.createLog(
      group ? group.id : null,
      chatTitle,
      null,
      body.message,
      'SUCCESS',
      null,
      response
    )

    return {
      success: true,
      log
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Test message failed: ${error.message}`
    })
  }
})
