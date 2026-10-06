import { db, BotMenuSettings, BotMenuButton } from './db'
import {
  sendTelegramMessage,
  answerCallbackQuery,
  editTelegramMessageText,
  setMyCommands,
  setChatMenuButton,
  TelegramCallbackQuery,
  TelegramIncomingMessage,
  TelegramBotCommand
} from './telegram'

function escapeHtml(text: string): string {
  return (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Builds the Telegram inline_keyboard structure from BotMenuSettings.
 */
export function buildInlineMenuKeyboard(settings: BotMenuSettings, publicUrl?: string) {
  if (!settings.enabled || !Array.isArray(settings.buttons) || settings.buttons.length === 0) {
    return []
  }

  const rows: Array<Array<{ text: string; url?: string; callback_data?: string }>> = []
  let currentRow: Array<{ text: string; url?: string; callback_data?: string }> = []

  for (const btn of settings.buttons) {
    if (!btn.text?.trim()) continue

    let item: { text: string; url?: string; callback_data?: string }
    if (btn.type === 'url') {
      const url = (btn.value?.trim() || publicUrl || '').replace(/^http:/, 'https:')
      if (url && (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('tg://'))) {
        item = { text: btn.text, url }
      } else {
        item = { text: btn.text, callback_data: 'menu:dashboard' }
      }
    } else if (btn.type === 'command') {
      const cmd = (btn.value || '').replace(/^\//, '').trim()
      item = { text: btn.text, callback_data: `cmd:${cmd}` }
    } else {
      item = { text: btn.text, callback_data: btn.value?.trim() || 'menu:main' }
    }

    currentRow.push(item)
    // 2 buttons per row
    if (currentRow.length >= 2) {
      rows.push(currentRow)
      currentRow = []
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
}

/**
 * Builds Telegram persistent reply keyboard structure for private chats.
 */
export function buildReplyMenuKeyboard(settings: BotMenuSettings) {
  if (!settings.enabled || !settings.persistentKeyboard || !Array.isArray(settings.buttons) || settings.buttons.length === 0) {
    return undefined
  }

  const rows: Array<Array<{ text: string }>> = []
  let currentRow: Array<{ text: string }> = []

  for (const btn of settings.buttons) {
    if (!btn.text?.trim()) continue
    currentRow.push({ text: btn.text })
    if (currentRow.length >= 2) {
      rows.push(currentRow)
      currentRow = []
    }
  }

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return {
    keyboard: rows,
    resize_keyboard: true,
    is_persistent: true,
    one_time_keyboard: false
  }
}

/**
 * Generates the welcoming menu text.
 */
export function buildMenuText(chatTitle?: string, isPrivate = false): string {
  const titlePart = chatTitle ? `\n📍 <b>${escapeHtml(chatTitle)}</b>` : ''
  return [
    '🤖 <b>Interactive Bot Menu</b>' + titlePart,
    '',
    'Click any button below to check your status, explore group rules, talk with AI, or get instant help:'
  ].join('\n')
}

/**
 * Handles callback_query events triggered when a user clicks an inline button.
 */
export async function handleCallbackQuery(
  token: string,
  botUserId: number,
  query: TelegramCallbackQuery
): Promise<boolean> {
  const queryId = query.id
  const data = query.data || ''
  const msg = query.message
  const user = query.from

  // Always acknowledge the callback query so Telegram's loading spinner disappears
  await answerCallbackQuery(token, queryId)

  if (!msg) return true

  const chatId = msg.chat.id
  const messageId = msg.message_id
  const settings = await db.getMenuSettings()

  const backButton = [{ text: '🔙 Back to Menu', callback_data: 'menu:back' }]

  try {
    if (data === 'menu:back' || data === 'menu:main') {
      const text = buildMenuText(msg.chat.title, msg.chat.type === 'private')
      const inlineKeyboard = buildInlineMenuKeyboard(settings)
      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', { inline_keyboard: inlineKeyboard })
      return true
    }

    if (data === 'menu:rules' || data === 'cmd:rules') {
      const modSettings = await db.getModerationSettings()
      const group = await db.getGroupByChatId(String(chatId))
      const rules = modSettings.rulesText?.trim() || 'No specific rules set for this chat. Please remain respectful and keep discussions constructive!'
      const text = [
        '📜 <b>Group Rules & Guidelines</b>',
        group ? `📍 <i>${escapeHtml(group.name)}</i>` : '',
        '',
        escapeHtml(rules),
        '',
        '⚠️ <i>Violating rules may result in automated warnings or mute strikes.</i>'
      ].filter(Boolean).join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    if (data === 'menu:warns' || data === 'cmd:warns') {
      const modSettings = await db.getModerationSettings()
      const count = await db.getWarningCount(String(chatId), user.id)
      const limit = modSettings.warnLimit > 0 ? modSettings.warnLimit : 3
      const statusText = count >= limit
        ? '🔴 Restricted / Muted'
        : count > 0
          ? `🟡 In Warning Period (${count}/${limit})`
          : '🟢 Clean Record (0 strikes)'

      const text = [
        '⚠️ <b>Warning Status</b>',
        '',
        `👤 User: <b>${escapeHtml(user.first_name || 'User')}</b> ${user.username ? `(@${escapeHtml(user.username)})` : ''}`,
        `📊 Active strikes: <b>${count} / ${limit}</b>`,
        `🛡️ Status: <b>${statusText}</b>`,
        '',
        '<i>Strikes expire automatically after 24 hours without further violations.</i>'
      ].join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    if (data === 'menu:status' || data === 'cmd:status') {
      const groups = await db.getGroups()
      const ai = await db.getAiSettings()
      const bot = await db.getBot()

      const text = [
        '📊 <b>Bot System Status</b>',
        '',
        `🤖 Bot: <b>${escapeHtml(bot?.firstName || 'NN Bot')}</b> (@${escapeHtml(bot?.username || 'bot')})`,
        `👥 Monitored Groups: <b>${groups.length}</b>`,
        `🧠 AI Assistant: <b>${ai.enabled ? '🟢 Online' : '⚪ Disabled'}</b> (${escapeHtml(ai.model || 'Gemini')})`,
        `🌐 Edge Runtime: <b>Cloudflare Workers (Active)</b>`,
        `⚡ Realtime Sync: <b>Operational ✅</b>`
      ].join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    if (data === 'menu:ai' || data === 'cmd:ask') {
      const bot = await db.getBot()
      const ai = await db.getAiSettings()
      const botHandle = bot?.username ? `@${escapeHtml(bot.username)}` : 'the bot'

      const text = [
        '🤖 <b>Ask AI Assistant</b>',
        ai.enabled ? '🟢 <i>AI Assistant is online and ready!</i>' : '⚪ <i>AI Assistant is currently paused.</i>',
        '',
        '<b>How to interact:</b>',
        `• <b>In Groups:</b> Mention ${botHandle} followed by your query, or reply directly to any message from the bot.`,
        '• <b>In Private Chat:</b> Send any message or question directly here.',
        '• <b>Command:</b> Use <code>/ask &lt;your question&gt;</code> anywhere.',
        '',
        '💡 <i>Example:</i> <code>@' + (bot?.username || 'bot') + ' how do I set up a Telegram bot?</code>'
      ].join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    if (data === 'menu:help' || data === 'cmd:help') {
      const text = [
        '❓ <b>Commands & Assistance</b>',
        '',
        '• <code>/menu</code> - Open the interactive button menu',
        '• <code>/rules</code> - Read group guidelines & rules',
        '• <code>/warns</code> - View your current warning count',
        '• <code>/status</code> - View bot status & uptime metrics',
        '• <code>/ask &lt;question&gt;</code> - Ask the AI assistant directly',
        '• <code>/resetwarns</code> - (Admins) Reply to a member to clear warnings',
        '',
        'Tap <b>Back to Menu</b> below to return.'
      ].join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    if (data === 'menu:dashboard') {
      const text = [
        '🌐 <b>Web Dashboard</b>',
        '',
        'You can configure the bot, view real-time chat logs, manage group members, and tweak AI parameters directly from your web dashboard.'
      ].join('\n')

      await editTelegramMessageText(token, chatId, messageId, text, 'HTML', {
        inline_keyboard: [backButton]
      })
      return true
    }

    // Default fallback: show main menu
    const text = buildMenuText(msg.chat.title, msg.chat.type === 'private')
    const inlineKeyboard = buildInlineMenuKeyboard(settings)
    await editTelegramMessageText(token, chatId, messageId, text, 'HTML', { inline_keyboard: inlineKeyboard })
    return true
  } catch (err: any) {
    console.error(`[Menu] Error handling callback query ${data}:`, err?.message || err)
    return false
  }
}

/**
 * Syncs menu settings, command list, and chat menu button to Telegram API.
 */
export async function syncBotMenuToTelegram(
  token: string,
  settings: BotMenuSettings,
  publicUrl?: string
) {
  const commands: TelegramBotCommand[] = [
    { command: 'menu', description: '📱 Open interactive button menu' },
    { command: 'start', description: '🚀 Start bot & open menu' },
    { command: 'help', description: '❓ Bot commands & assistance' },
    { command: 'ask', description: '🤖 Ask AI assistant anything' },
    { command: 'rules', description: '📜 View community guidelines & rules' },
    { command: 'status', description: '📊 Bot status & statistics' },
    { command: 'warns', description: '⚠️ Check warning strikes' },
    { command: 'resetwarns', description: '🛡️ (Admins) Clear warnings for replied user' }
  ]

  // Register commands with Telegram
  await setMyCommands(token, commands)

  // Configure bottom-left [Menu] button
  const webAppTarget = (settings.webAppUrl?.trim() || publicUrl || '').replace(/^http:/, 'https:')
  if (settings.chatMenuButton === 'web_app' && webAppTarget && webAppTarget.startsWith('https://')) {
    await setChatMenuButton(token, {
      type: 'web_app',
      text: 'Dashboard',
      web_app: { url: webAppTarget }
    })
  } else if (settings.chatMenuButton === 'commands') {
    await setChatMenuButton(token, { type: 'commands' })
  } else {
    await setChatMenuButton(token, { type: 'default' })
  }

  return { ok: true, commands, menuButton: settings.chatMenuButton }
}

