import { db, ModerationSettings, JSONGroup } from './db'
import {
  deleteMessage,
  getChatMember,
  muteChatMember,
  sendTelegramMessage,
  TelegramIncomingMessage,
  TelegramUpdate
} from './telegram'
import { generateAiReply } from './ai'

// Escape text so it is safe inside an HTML-parse-mode Telegram message.
function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Build a tappable Telegram mention for the sender. Using tg://user?id= makes
// it notify the user even when they have no @username set.
function buildMention(from?: TelegramIncomingMessage['from']): string {
  if (!from) return 'Someone'
  const displayName =
    [from.first_name, from.last_name].filter(Boolean).join(' ') ||
    (from.username ? `@${from.username}` : '') ||
    'user'
  return `<a href="tg://user?id=${from.id}">${escapeHtml(displayName)}</a>`
}

// Detect whether a message contains a link/URL.
export function hasLink(msg: TelegramIncomingMessage): boolean {
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])]
  if (entities.some(e => e.type === 'url' || e.type === 'text_link')) {
    return true
  }
  // Fallback: scan raw text/caption for common URL shapes
  const text = `${msg.text || ''} ${msg.caption || ''}`
  return /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|\b[a-z0-9-]+\.(com|net|org|io|me|xyz|info|co|link)\b)/i.test(text)
}

export const RESTRICTED_FILE_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'gadget', 'msi', 'msp', 'mst',
  'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'vb', 'js', 'jse', 'ws', 'wsf', 'wsc',
  'hta', 'reg', 'inf', 'scf', 'sh', 'bash', 'zsh', 'ksh', 'csh', 'fish',
  'py', 'pyw', 'pl', 'rb', 'php', 'cgi', 'jar', 'class', 'dll', 'ocx', 'sys',
  'drv', 'cpl', 'lnk', 'url', 'docm', 'dotm', 'xlsm', 'xltm', 'xlam', 'pptm',
  'ppam', 'potm', 'sldm', 'chm', 'hlp', 'apk', 'aab', 'ipa', 'app', 'dmg',
  'pkg', 'deb', 'rpm', 'snap', 'flatpak', 'iso', 'img', 'vhd', 'vhdx', 'vmdk',
  'ova', 'ovf', 'elf', 'bin', 'run', 'out', 'zip', 'rar', '7z', 'tar', 'gz',
  'tgz', 'bz2', 'xz', 'cab', 'torrent', 'pdf', 'rtf'
]

// Return the first blocked keyword/phrase found in the text or caption
// (case-insensitive substring match), or '' when none match.
export function findBlockedKeyword(msg: TelegramIncomingMessage, keywords?: string[]): string {
  if (!Array.isArray(keywords) || keywords.length === 0) return ''
  const text = `${msg.text || ''} ${msg.caption || ''}`.toLowerCase().replace(/\s+/g, ' ')
  if (!text.trim()) return ''
  return keywords.find(kw => {
    const clean = kw.trim().toLowerCase()
    return clean.length > 0 && text.includes(clean)
  }) || ''
}

export function isSticker(msg: TelegramIncomingMessage): boolean {
  return !!msg.sticker
}

export function hasRestrictedFile(
  msg: TelegramIncomingMessage,
  settings?: ModerationSettings
): { isRestricted: boolean; fileName: string; ext: string } {
  const doc = msg.document || msg.audio || msg.video || msg.animation || msg.voice
  if (!doc) return { isRestricted: false, fileName: '', ext: '' }

  const fileName = ('file_name' in doc && doc.file_name) ? doc.file_name : ('mime_type' in doc && doc.mime_type ? doc.mime_type : 'file')
  const lowerName = fileName.toLowerCase().trim()
  const extParts = lowerName.split('.')
  const fileExt = extParts.length > 1 ? extParts.pop() || '' : ''

  const activeExtensions =
    settings && Array.isArray(settings.blockedExtensions)
      ? settings.blockedExtensions
      : RESTRICTED_FILE_EXTENSIONS

  // Wildcard '*' or 'all' blocks any file sent
  const blockAll = activeExtensions.some(ext => {
    const clean = ext.replace(/^\./, '').toLowerCase().trim()
    return clean === '*' || clean === 'all'
  })

  if (blockAll) {
    return { isRestricted: true, fileName, ext: fileExt ? `.${fileExt}` : '' }
  }

  const matched = activeExtensions.find(ext => {
    const cleanExt = ext.replace(/^\./, '').toLowerCase().trim()
    return lowerName.endsWith('.' + cleanExt) || fileExt === cleanExt
  })

  if (matched) {
    const cleanExt = matched.replace(/^\./, '').trim()
    return { isRestricted: true, fileName, ext: `.${cleanExt}` }
  }
  return { isRestricted: false, fileName: '', ext: '' }
}

// Does this message @-mention (or text-mention) our bot?
function mentionsBot(msg: TelegramIncomingMessage, botUserId: number, botUsername?: string): boolean {
  const text = msg.text || msg.caption || ''
  const entities = [...(msg.entities || []), ...(msg.caption_entities || [])]
  for (const e of entities) {
    if (e.type === 'text_mention' && e.user?.id === botUserId) return true
    if (e.type === 'mention' && botUsername) {
      const mention = text.substring(e.offset, e.offset + e.length).toLowerCase()
      if (mention === `@${botUsername.toLowerCase()}`) return true
    }
  }
  return false
}

// A short label for a replied-to message, used in logs and notices.
function summariseMessage(msg: TelegramIncomingMessage): string {
  if (msg.sticker) return `${msg.sticker.emoji || ''} Sticker`.trim()
  if (msg.photo) return msg.caption || '📷 Photo'
  if (msg.video) return msg.caption || '🎬 Video'
  if (msg.animation) return msg.caption || '🎞️ GIF'
  if (msg.voice) return '🎤 Voice message'
  if (msg.audio) return msg.caption || '🎵 Audio'
  if (msg.document) return msg.caption || `📎 ${msg.document.file_name || 'Document'}`
  const text = msg.text || msg.caption || '[media]'
  return text.length > 40 ? `${text.slice(0, 40)}…` : text
}

// Pull a renderable media descriptor out of a message, if any.
function extractMedia(msg: TelegramIncomingMessage): Partial<{
  mediaType: 'photo' | 'sticker' | 'video' | 'animation' | 'document' | 'audio' | 'voice'
  mediaFileId: string
  mediaMime: string
  mediaEmoji: string
  mediaFileName: string
  stickerFormat: 'static' | 'animated' | 'video'
}> {
  if (msg.sticker) {
    return {
      mediaType: 'sticker',
      mediaFileId: msg.sticker.file_id,
      mediaEmoji: msg.sticker.emoji,
      stickerFormat: msg.sticker.is_video ? 'video' : msg.sticker.is_animated ? 'animated' : 'static'
    }
  }
  if (msg.photo && msg.photo.length > 0) {
    return { mediaType: 'photo', mediaFileId: msg.photo[msg.photo.length - 1].file_id }
  }
  if (msg.video) return { mediaType: 'video', mediaFileId: msg.video.file_id, mediaMime: msg.video.mime_type }
  if (msg.animation) return { mediaType: 'animation', mediaFileId: msg.animation.file_id, mediaMime: msg.animation.mime_type }
  if (msg.voice) return { mediaType: 'voice', mediaFileId: msg.voice.file_id, mediaMime: msg.voice.mime_type }
  if (msg.audio) return { mediaType: 'audio', mediaFileId: msg.audio.file_id, mediaMime: msg.audio.mime_type }
  if (msg.document) {
    return {
      mediaType: 'document',
      mediaFileId: msg.document.file_id,
      mediaMime: msg.document.mime_type,
      mediaFileName: msg.document.file_name
    }
  }
  return {}
}

/**
 * Manual moderation command: an admin replies to a message, mentions the bot,
 * and includes the word "delete". The bot then removes the replied-to message
 * (a link, sticker, or anything else) plus the command message itself.
 * Returns true if the message was a delete command (handled — skip further processing).
 */
async function handleDeleteCommand(
  token: string,
  botUserId: number,
  botUsername: string | undefined,
  msg: TelegramIncomingMessage
): Promise<boolean> {
  if (msg.chat.type === 'private') return false
  if (!msg.reply_to_message) return false

  const text = (msg.text || msg.caption || '').toLowerCase()
  if (!/\bdelete\b/.test(text)) return false
  if (!mentionsBot(msg, botUserId, botUsername)) return false

  const chatId = String(msg.chat.id)
  const chatTitle = msg.chat.title || chatId

  // Only chat admins/owner may issue the command — ignore everyone else.
  if (msg.from && msg.from.id !== botUserId) {
    try {
      const member = await getChatMember(token, chatId, msg.from.id)
      if (member.status !== 'creator' && member.status !== 'administrator') {
        // Silently drop the command message from non-admins.
        await deleteMessage(token, chatId, msg.message_id).catch(() => {})
        return true
      }
    } catch (err: any) {
      console.warn(`[Command] Could not verify admin for delete command: ${err.message}`)
      return true
    }
  }

  const target = msg.reply_to_message
  const who = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'admin')

  try {
    await deleteMessage(token, chatId, target.message_id)
    // Also remove the "@bot delete" command message to keep the chat clean.
    await deleteMessage(token, chatId, msg.message_id).catch(() => {})

    const group = await db.getGroupByChatId(chatId)
    await db.createLog(
      group ? group.id : null,
      chatTitle,
      null,
      `🗑️ ${who} removed a message via reply-command: "${summariseMessage(target)}"`,
      'SUCCESS',
      null,
      null
    )
    console.log(`[Command] ${who} deleted message ${target.message_id} in "${chatTitle}"`)
  } catch (err: any) {
    console.warn(`[Command] Failed to delete replied message in ${chatId}: ${err.message}`)
    const group = await db.getGroupByChatId(chatId)
    await db.createLog(
      group ? group.id : null,
      chatTitle,
      null,
      `Reply-command delete failed: ${err.message}`,
      'FAILED',
      err.message
    )
  }
  return true
}

// Auto-register a group/channel the bot belongs to so it becomes a selectable
// broadcast target with the correct numeric chat ID.
async function autoRegisterChat(chat: {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  first_name?: string
  last_name?: string
  username?: string
}) {
  const chatId = String(chat.id)
  const existing = await db.getGroupByChatId(chatId)

  const name =
    chat.title ||
    [chat.first_name, chat.last_name].filter(Boolean).join(' ') ||
    (chat.username ? `@${chat.username}` : `Chat ${chatId}`)

  if (existing) {
    // Real-time update if group title or type was changed on Telegram
    const updates: Partial<JSONGroup> = {}
    if (name && name !== existing.name) {
      updates.name = name
    }
    if (chat.type && chat.type !== existing.type) {
      updates.type = chat.type
    }
    if (Object.keys(updates).length > 0) {
      await db.updateGroup(existing.id, updates)
      console.log(`[Discovery] Real-time updated ${chat.type} "${existing.name}" -> "${name}" (${chatId})`)
    }
    return
  }

  await db.createGroup(name, chatId, chat.type, true)
  console.log(`[Discovery] Auto-registered ${chat.type} "${name}" (${chatId})`)
}

// Is this user the chat owner or an admin?
async function isChatAdmin(token: string, chatId: string, userId: number): Promise<boolean> {
  try {
    const member = await getChatMember(token, chatId, userId)
    return member.status === 'creator' || member.status === 'administrator'
  } catch (err: any) {
    console.warn(`[Moderation] Could not check admin status of ${userId} in ${chatId}: ${err.message}`)
    return false
  }
}

// After a violation: add a strike, and mute the user once they hit the limit.
// Returns the line appended to the public notice.
async function applyStrike(
  token: string,
  chatId: string,
  chatTitle: string,
  msg: TelegramIncomingMessage,
  settings: ModerationSettings
): Promise<string> {
  if (!msg.from || !settings.warnLimit || settings.warnLimit <= 0) return ''

  const limit = settings.warnLimit
  const count = await db.addWarning(chatId, msg.from.id)
  if (count < limit) return `\n⚠️ Warning ${count}/${limit}`

  const minutes = Math.max(1, settings.muteMinutes || 60)
  const who = msg.from.username ? `@${msg.from.username}` : (msg.from.first_name || 'user')
  const group = await db.getGroupByChatId(chatId)
  try {
    await muteChatMember(token, chatId, msg.from.id, Math.floor(Date.now() / 1000) + minutes * 60)
    await db.resetWarnings(chatId, msg.from.id)
    await db.createLog(group ? group.id : null, chatTitle, null, `🔇 Muted ${who} for ${minutes} min after ${limit} warnings`, 'SUCCESS', null, null)
    console.log(`[Moderation] Muted ${who} in "${chatTitle}" for ${minutes} min`)
    return `\n🔇 Muted for ${minutes} minutes (${limit}/${limit} warnings).`
  } catch (err: any) {
    // Usually: basic group (not supergroup) or bot lacks "ban users" rights.
    console.warn(`[Moderation] Failed to mute ${who} in ${chatId}: ${err.message}`)
    await db.createLog(group ? group.id : null, chatTitle, null, `Mute failed for ${who}: ${err.message}`, 'FAILED', err.message)
    return `\n⚠️ Warning ${count}/${limit}`
  }
}

/**
 * Enforce moderation rules on a message.
 * Returns true if the message was deleted, so later steps can skip it.
 */
async function moderateMessage(
  token: string,
  botUserId: number,
  msg: TelegramIncomingMessage,
  settings: ModerationSettings
): Promise<boolean> {
  if (!settings.enabled) return false
  // Never moderate the bot's own messages (e.g. scheduled broadcasts)
  if (msg.from && msg.from.id === botUserId) return false
  if (msg.chat.type === 'private') return false

  let reason = ''
  let fileDetail = ''

  if (settings.deleteStickers && isSticker(msg)) {
    reason = 'sticker'
  } else if (settings.deleteLinks && hasLink(msg)) {
    reason = 'link'
  } else if (settings.deleteFiles) {
    const fileCheck = hasRestrictedFile(msg, settings)
    if (fileCheck.isRestricted) {
      reason = 'file'
      fileDetail = fileCheck.ext ? ` (${fileCheck.ext})` : ''
    }
  }
  let keywordDetail = ''
  if (!reason) {
    const keyword = findBlockedKeyword(msg, settings.blockedKeywords)
    if (keyword) {
      reason = 'keyword'
      keywordDetail = ` ("${keyword}")`
    }
  }
  if (!reason) return false

  const chatId = String(msg.chat.id)
  const who = msg.from?.username ? `@${msg.from.username}` : (msg.from?.first_name || 'user')
  const chatTitle = msg.chat.title || chatId

  // Checked only after a violation is found, to avoid an API call per message.
  if (settings.exemptAdmins && msg.from && (await isChatAdmin(token, chatId, msg.from.id))) {
    return false
  }

  try {
    await deleteMessage(token, chatId, msg.message_id)

    const strikeLine = await applyStrike(token, chatId, chatTitle, msg, settings)

    // Post a public notice in the group tagging the sender.
    const mention = buildMention(msg.from)
    const noticeText =
      (reason === 'sticker'
        ? `🚫 ជោមេសគេប្រាប់ហើយនិងហាស៎ \n ${mention}, stickers are not allowed in this group.`
        : reason === 'link'
        ? `🚫 ជោមេសគេប្រាប់ហើយនិងហាស៎ \n ${mention}, links are not allowed in this group.`
        : reason === 'keyword'
        ? `🚫 ជោមេសគេប្រាប់ហើយនិងហាស៎ \n ${mention}, messages with blocked words are not allowed in this group.`
        : `🚫 ជោមេសគេប្រាប់ហើយនិងហាស៎ \n ${mention}, files ${fileDetail ? fileDetail + ' ' : ''}are not allowed in this group.`) +
      strikeLine
    try {
      await sendTelegramMessage(token, chatId, noticeText, 'HTML')
    } catch (notifyErr: any) {
      console.warn(`[Moderation] Deleted ${reason} but failed to post mention: ${notifyErr.message}`)
    }

    const group = await db.getGroupByChatId(chatId)
    await db.createLog(
      group ? group.id : null,
      chatTitle,
      null,
      `🧹 Auto-deleted ${reason}${fileDetail}${keywordDetail} from ${who}`,
      'SUCCESS',
      null,
      null
    )
    console.log(`[Moderation] Deleted ${reason}${fileDetail}${keywordDetail} in "${chatTitle}" from ${who}`)
    return true
  } catch (err: any) {
    // Deletion failed (e.g. bot is not admin): the message stays, so treat it as kept.
    console.warn(`[Moderation] Failed to delete ${reason} in chat ${chatId}: ${err.message}`)
    return false
  }
}

// Record the sender into the member registry and store the message into the
// chat history so the dashboard can show members and a Telegram-style thread.
async function recordActivity(msg: TelegramIncomingMessage) {
  const chatId = String(msg.chat.id)

  if (msg.from) {
    await db.recordMember(chatId, msg.from, true)
  }

  const media = extractMedia(msg)
  // Media messages keep their caption as text (empty for stickers) and render
  // the attachment; text-only messages keep their text.
  const text = msg.text || msg.caption || (media.mediaType ? '' : '[media]')
  const fromName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') ||
    (msg.from?.username ? `@${msg.from.username}` : 'Unknown')

  // Capture reply context so the dashboard thread can show what was replied to.
  const replied = msg.reply_to_message
  const repliedName = replied
    ? [replied.from?.first_name, replied.from?.last_name].filter(Boolean).join(' ') ||
      (replied.from?.username ? `@${replied.from.username}` : 'Unknown')
    : undefined

  await db.addChatMessage({
    chatId,
    messageId: msg.message_id,
    fromId: msg.from?.id ?? null,
    fromName,
    fromUsername: msg.from?.username,
    isBot: !!msg.from?.is_bot,
    direction: 'in',
    text,
    date: new Date((msg.date || Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    replyToMessageId: replied?.message_id ?? null,
    replyToName: repliedName,
    replyToText: replied ? summariseMessage(replied) : undefined,
    ...media
  })
}

// Was this message a reply to one of the bot's own messages?
function isReplyToBot(msg: TelegramIncomingMessage, botUserId: number, botUsername?: string): boolean {
  const replied = msg.reply_to_message
  if (!replied?.from) return false
  if (replied.from.id === botUserId) return true
  return (
    !!replied.from.is_bot &&
    !!botUsername &&
    replied.from.username?.toLowerCase() === botUsername.toLowerCase()
  )
}

/**
 * If AI auto-reply is enabled and the user mentioned the bot (or replied to it),
 * generate a Claude answer and post it back as a reply.
 */
async function maybeAiReply(
  token: string,
  botUserId: number,
  botUsername: string | undefined,
  msg: TelegramIncomingMessage
) {
  if (msg.chat.type === 'channel') return
  if (msg.from?.id === botUserId || msg.from?.is_bot) return

  const text = (msg.text || '').trim()
  if (!text) return

  const settings = await db.getAiSettings()
  if (!settings.enabled) return

  const isPrivate = msg.chat.type === 'private'

  // In groups: if replyOnMention is enabled, verify the bot was mentioned or replied to
  if (!isPrivate) {
    if (settings.replyOnMention && !mentionsBot(msg, botUserId, botUsername) && !isReplyToBot(msg, botUserId, botUsername)) {
      return
    }
  }

  const chatId = String(msg.chat.id)
  const chatTitle = msg.chat.title || chatId

  const apiKey = (settings.apiKey || useRuntimeConfig().geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
  if (!apiKey) {
    console.warn('[AI] Message received but GEMINI_API_KEY is not configured.')
    const grp = await db.getGroupByChatId(chatId)
    await db.createLog(
      grp ? grp.id : null,
      chatTitle,
      null,
      'AI reply skipped: Gemini API key is not configured',
      'FAILED',
      'Add your Gemini API key in AI Settings or set GEMINI_API_KEY in .env'
    )
    return
  }
  const fromName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' ') ||
    (msg.from?.username ? `@${msg.from.username}` : 'User')

  // Remove the bot @mention from the prompt so it reads as a plain question.
  let prompt = text
  if (botUsername) prompt = prompt.replace(new RegExp(`@${botUsername}`, 'ig'), '').trim()
  if (!prompt) prompt = text

  // Provide a little prior context from this chat for coherence.
  const stored = await db.getChatMessagesByChatId(chatId, 12)
  const history = stored
    .filter(m => m.messageId !== msg.message_id)
    .slice(-6)
    .map(m => {
      const isAssistant = m.direction === 'out' || m.isBot
      return {
        role: isAssistant ? ('assistant' as const) : ('user' as const),
        text: isAssistant ? m.text : `${m.fromName}: ${m.text}`
      }
    })
    .filter(m => m.text.trim())

  try {
    const reply = await generateAiReply({ apiKey, settings, userText: prompt, userName: fromName, history })
    if (!reply) return

    const sent = await sendTelegramMessage(token, chatId, escapeHtml(reply), 'HTML', msg.message_id)

    const bot = await db.getBot()
    await db.addChatMessage({
      chatId,
      messageId: sent.message_id,
      fromId: null,
      fromName: bot?.firstName || 'AI',
      fromUsername: bot?.username,
      isBot: true,
      direction: 'out',
      text: reply,
      date: new Date().toISOString(),
      replyToMessageId: msg.message_id,
      replyToName: fromName,
      replyToText: prompt.length > 60 ? `${prompt.slice(0, 60)}…` : prompt
    })

    const group = await db.getGroupByChatId(chatId)
    await db.createLog(group ? group.id : null, chatTitle, null, `🤖 AI replied to ${fromName}`, 'SUCCESS', null, null)
    console.log(`[AI] Replied to ${fromName} in "${chatTitle}"`)
  } catch (err: any) {
    console.error(`[AI] Reply failed in ${chatId}: ${err.message}`)
    const group = await db.getGroupByChatId(chatId)
    await db.createLog(group ? group.id : null, chatTitle, null, `AI reply failed: ${err.message}`, 'FAILED', err.message)
  }
}

// The sender edited a message: keep the stored copy in sync instead of adding a new one.
async function recordEdit(msg: TelegramIncomingMessage) {
  const media = extractMedia(msg)
  const text = msg.text || msg.caption || (media.mediaType ? '' : '[media]')
  await db.updateChatMessage(String(msg.chat.id), msg.message_id, { text, ...media })
}

const HELP_TEXT = [
  '🤖 <b>Available commands</b>',
  '/help - show this list',
  '/rules - show the group rules',
  '/warns - show your warnings (admins: reply to a user)',
  '/resetwarns - admins: reply to a user to clear their warnings'
].join('\n')

/**
 * Handle slash commands (/start, /help, /rules, /warns, /resetwarns).
 * Returns true for any slash-command message so it never reaches the AI step,
 * including commands addressed to other bots.
 */
async function handleBotCommand(
  token: string,
  botUserId: number,
  botUsername: string | undefined,
  msg: TelegramIncomingMessage,
  settings: ModerationSettings
): Promise<boolean> {
  const text = (msg.text || '').trim()
  if (!text.startsWith('/')) return false
  if (msg.chat.type === 'channel') return true

  // "/cmd@SomeBot args" -> command "cmd", target "SomeBot"
  const match = text.match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?/i)
  if (!match?.[1]) return true
  const command = match[1].toLowerCase()
  const target = match[2]
  if (target && (!botUsername || target.toLowerCase() !== botUsername.toLowerCase())) return true

  const chatId = String(msg.chat.id)
  const isPrivate = msg.chat.type === 'private'

  const reply = async (html: string) => {
    const sent = await sendTelegramMessage(token, chatId, html, 'HTML', msg.message_id)
    const bot = await db.getBot()
    await db.addChatMessage({
      chatId,
      messageId: sent.message_id,
      fromId: null,
      fromName: bot?.firstName || 'Bot',
      fromUsername: bot?.username,
      isBot: true,
      direction: 'out',
      text: html.replace(/<[^>]+>/g, ''),
      date: new Date().toISOString(),
      replyToMessageId: msg.message_id
    })
  }

  try {
    switch (command) {
      case 'start':
      case 'help':
        await reply(command === 'start' ? `👋 Hi! I help moderate and manage this group.\n\n${HELP_TEXT}` : HELP_TEXT)
        break

      case 'rules':
        await reply(`📜 <b>Group rules</b>\n${escapeHtml(settings.rulesText || 'No rules have been set.')}`)
        break

      case 'warns': {
        if (isPrivate || !msg.from) {
          await reply('This command only works in groups.')
          break
        }
        // Admins can reply to someone to check that user's warnings.
        const replied = msg.reply_to_message?.from
        let subject = msg.from
        if (replied && replied.id !== msg.from.id && (await isChatAdmin(token, chatId, msg.from.id))) {
          subject = replied
        }
        const count = await db.getWarningCount(chatId, subject.id)
        const limit = settings.warnLimit > 0 ? `/${settings.warnLimit}` : ''
        await reply(`${buildMention(subject)} has ${count}${limit} warning(s).`)
        break
      }

      case 'resetwarns': {
        if (isPrivate || !msg.from) {
          await reply('This command only works in groups.')
          break
        }
        if (!(await isChatAdmin(token, chatId, msg.from.id))) {
          await reply('⛔ Only group admins can reset warnings.')
          break
        }
        const replied = msg.reply_to_message?.from
        if (!replied || replied.id === botUserId) {
          await reply('Reply to a user\'s message with /resetwarns to clear their warnings.')
          break
        }
        await db.resetWarnings(chatId, replied.id)
        await reply(`✅ Warnings cleared for ${buildMention(replied)}.`)
        break
      }

      default:
        if (isPrivate) await reply('Unknown command. Send /help to see what I can do.')
    }
  } catch (err: any) {
    console.warn(`[Command] /${command} failed in ${chatId}: ${err.message}`)
  }
  return true
}

/**
 * Handle a single Telegram update.
 *
 * Flow for a message:
 *   1. Discovery   - register/rename/migrate the chat
 *   2. Delete cmd  - "@bot delete" reply from an admin (stop)
 *   3. Moderation  - if the message is deleted, drop it from history and stop
 *   4. Edits       - update the stored copy only (no AI, no commands) and stop
 *   5. Record      - save the member and message to history
 *   6. Commands    - /help, /rules, /warns, /resetwarns (stop)
 *   7. AI reply    - Gemini answer when mentioned
 */
export async function handleTelegramUpdate(token: string, botUserId: number, update: TelegramUpdate) {
  const settings = await db.getModerationSettings()
  const bot = await db.getBot()
  const botUsername = bot?.username

  // Bot was added to / changed status in a chat -> register it
  if (update.my_chat_member) {
    const status = update.my_chat_member.new_chat_member?.status
    if (status && status !== 'left' && status !== 'kicked') {
      await autoRegisterChat(update.my_chat_member.chat)
    }
    return
  }

  const isEdit = !!(update.edited_message || update.edited_channel_post)
  const msg =
    update.message || update.channel_post || update.edited_message || update.edited_channel_post
  if (!msg) return

  // Handle group migration to supergroup (e.g. -54xxx -> -100xxx)
  if (msg.migrate_to_chat_id) {
    const oldChatId = String(msg.chat.id)
    const newChatId = String(msg.migrate_to_chat_id)
    const group = await db.getGroupByChatId(oldChatId)
    if (group) {
      await db.updateGroup(group.id, { chatId: newChatId, type: 'supergroup' })
      console.log(`[Discovery] Migrated group "${group.name}" from ${oldChatId} to supergroup ${newChatId}`)
    }
  }

  // Handle explicit Telegram chat rename event (new_chat_title)
  if (msg.new_chat_title) {
    const targetChatId = String(msg.migrate_to_chat_id || msg.chat.id)
    const group = await db.getGroupByChatId(targetChatId)
    if (group && group.name !== msg.new_chat_title) {
      await db.updateGroup(group.id, { name: msg.new_chat_title })
      console.log(`[Discovery] Renamed chat ${targetChatId} to "${msg.new_chat_title}"`)
    }
  }

  await autoRegisterChat(msg.chat)

  // Manual "@bot delete" reply-command takes priority; if handled, stop here.
  if (!isEdit && (await handleDeleteCommand(token, botUserId, botUsername, msg))) return

  // Moderate before anything else so removed messages are never stored or
  // answered. Edits are moderated too (a link can be added by editing).
  if (await moderateMessage(token, botUserId, msg, settings)) {
    if (isEdit) await db.removeChatMessage(String(msg.chat.id), msg.message_id)
    return
  }

  if (isEdit) {
    await recordEdit(msg)
    return
  }

  await recordActivity(msg)
  if (await handleBotCommand(token, botUserId, botUsername, msg, settings)) return
  await maybeAiReply(token, botUserId, botUsername, msg)
}
