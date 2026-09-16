import { db } from '../../utils/db'
import { decryptToken, encryptToken } from '../../utils/crypto'
import {
  verifyTelegramBot,
  getChatInfo,
  getChatMemberCount,
  getChatAdministrators,
  setTelegramWebhook,
  getTelegramWebhookInfo
} from '../../utils/telegram'
import { handleTelegramUpdate } from '../../utils/moderation'

/**
 * Real-time synchronization endpoint:
 * Fetches all live data directly from the Telegram Bot API:
 * 1. Live Bot Profile & Status (getMe)
 * 2. Live Groups, Titles, Types, and Admin Permissions (getChat)
 * 3. Live Member Counts (getChatMemberCount) & Live Administrators (getChatAdministrators)
 * 4. Ingests any pending updates from Telegram into messages/chats/members
 * 5. Verifies and activates the Telegram Webhook for continuous real-time push
 */
export default defineEventHandler(async (event) => {
  try {
    const config = useRuntimeConfig()
  let bot = await db.getBot()

  // Resolve bot token from DB, runtimeConfig, or environment
  let token = ''
  if (bot?.token) {
    try {
      token = await decryptToken(bot.token)
    } catch {
      token = bot.token
    }
  }

  if (!token) {
    token = (config.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || '').trim()
  }

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'No Telegram bot token is configured. Please configure your bot token first.'
    })
  }

  // 1. Fetch live bot identity from Telegram
  let botInfo: any
  try {
    botInfo = await verifyTelegramBot(token)
  } catch (err: any) {
    throw createError({
      statusCode: 400,
      statusMessage: `Telegram Bot Verification Failed: ${err.message}`
    })
  }

  // Update or initialize bot in database
  const encrypted = await encryptToken(token)
  bot = {
    id: 1,
    token: encrypted,
    username: botInfo.username || bot?.username || '',
    firstName: botInfo.first_name || bot?.firstName || 'Telegram Bot',
    active: true,
    status: 'ONLINE',
    permissions: {
      can_join_groups: !!botInfo.can_join_groups,
      can_read_all_group_messages: !!botInfo.can_read_all_group_messages,
      supports_inline_queries: !!botInfo.supports_inline_queries
    },
    createdAt: bot?.createdAt || new Date().toISOString()
  }
  await db.saveBot(bot)

  const botUserId = botInfo.id

  // 2. Fetch pending Telegram updates (if webhook is not yet active or was empty)
  // This extracts groups and chat messages that users sent to the bot!
  let pendingProcessed = 0
  try {
    const webhookInfo = await getTelegramWebhookInfo(token).catch(() => null)
    if (!webhookInfo?.url) {
      // Direct fetch of pending updates before binding webhook
      const updatesRes = await $fetch<{ ok: boolean; result: any[] }>(
        `https://api.telegram.org/bot${token}/getUpdates`,
        { method: 'GET', query: { limit: 100 } }
      ).catch(() => null)

      if (updatesRes?.ok && Array.isArray(updatesRes.result)) {
        for (const update of updatesRes.result) {
          try {
            await handleTelegramUpdate(token, botUserId, update)
            pendingProcessed++
          } catch (e: any) {
            console.warn('[Sync] Failed to process update:', e.message)
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[Sync] Update check notice:', err.message)
  }

  // 3. Register / refresh Telegram Webhook for real-time streaming
  let webhookUrl = ''
  try {
    const base = config.publicUrl || getRequestURL(event).origin
    if (base && !base.includes('localhost') && !base.includes('127.0.0.1')) {
      webhookUrl = `${base.replace(/\/$/, '')}/api/telegram/webhook`
      await setTelegramWebhook(token, webhookUrl, config.webhookSecret)
    }
  } catch (err: any) {
    console.warn('[Sync] Webhook registration notice:', err.message)
  }

  // 4. Discover default group from env if configured (e.g. TELEGRAM_GROUP_CHAT_ID)
  const envChatId = (config.telegramGroupChatId || process.env.TELEGRAM_GROUP_CHAT_ID || '').trim()
  if (envChatId) {
    let resolvedId = envChatId
    let resolvedInfo: any = null
    try {
      resolvedInfo = await getChatInfo(token, envChatId)
      if (resolvedInfo?.id) resolvedId = String(resolvedInfo.id)
    } catch {}

    const existing = (await db.getGroupByChatId(resolvedId)) || (await db.getGroupByChatId(envChatId))
    if (!existing) {
      const name =
        resolvedInfo?.title ||
        [resolvedInfo?.first_name, resolvedInfo?.last_name].filter(Boolean).join(' ') ||
        (resolvedInfo?.username ? `@${resolvedInfo.username}` : `Chat ${envChatId}`)
      await db.createGroup(name, resolvedId, resolvedInfo?.type || 'group', true)
    }
  }

  // 5. Query Telegram API for every group: refresh title, type, members, and admin permissions
  const rawGroups = await db.getGroups()
  const seenChatIds = new Set<string>()
  const uniqueGroups: any[] = []
  for (const g of rawGroups) {
    const key = (g.chatId || '').trim()
    if (!key || seenChatIds.has(key)) continue
    seenChatIds.add(key)
    uniqueGroups.push(g)
  }
  if (uniqueGroups.length !== rawGroups.length) {
    await db.saveGroups(uniqueGroups)
  }
  let groups = uniqueGroups
  let syncedGroupsCount = 0
  let totalAdminsCount = 0

  await Promise.allSettled(
    groups.map(async (g) => {
      try {
        // Fetch live chat metadata
        const info = await getChatInfo(token, g.chatId)
        const newTitle =
          info.title ||
          [info.first_name, info.last_name].filter(Boolean).join(' ') ||
          (info.username ? `@${info.username}` : '')

        // Fetch live administrators
        let isAdmin = false
        let permissionsVerified = false
        try {
          const admins = await getChatAdministrators(token, g.chatId)
          const botAdmin = admins.find((a: any) => a.user.id === botUserId)
          if (botAdmin) {
            isAdmin = true
            permissionsVerified = !!botAdmin.can_delete_messages
          }

          // Record each administrator in member registry
          for (const a of admins) {
            await db.recordMember(g.chatId, a.user, false)
            totalAdminsCount++
          }
        } catch {}

        const updates: Record<string, any> = {
          isAdmin,
          permissionsVerified
        }
        if (newTitle && newTitle !== g.name) updates.name = newTitle
        if (info.type && info.type !== g.type) updates.type = info.type
        if (info.id && String(info.id) !== g.chatId) updates.chatId = String(info.id)

        await db.updateGroup(g.id, updates)
        syncedGroupsCount++
      } catch (err: any) {
        console.warn(`[Sync] Could not refresh chat ${g.chatId}:`, err.message)
      }
    })
  )

  // Re-fetch final data from DB and deduplicate
  const finalRaw = await db.getGroups()
  const seenIds = new Set<string>()
  const updatedGroups: any[] = []
  for (const g of finalRaw) {
    const key = String(g.chatId || '').trim()
    if (!key || seenIds.has(key)) continue
    seenIds.add(key)
    updatedGroups.push(g)
  }
  if (updatedGroups.length !== finalRaw.length) {
    await db.saveGroups(updatedGroups)
  }
  const allMembers = await db.getMembers()
  const allMessages = await db.getChatMessages()

    return {
      success: true,
      bot: {
        id: bot.id,
        username: bot.username,
        firstName: bot.firstName,
        status: bot.status,
        active: bot.active
      },
      syncedGroupsCount,
      totalGroups: updatedGroups.length,
      totalMembers: allMembers.length,
      totalMessages: allMessages.length,
      pendingUpdatesProcessed: pendingProcessed,
      webhookUrl: webhookUrl || null
    }
  } catch (err: any) {
    console.error('[Sync API Error]', err)
    return {
      success: false,
      error: err.message || String(err),
      stack: err.stack || null
    }
  }
})

