// Storage keys. Backed by Cloudflare KV in production and by the local
// data/*.json files during development (see nitro.storage in nuxt.config).
const BOT_PATH = 'bot.json'
const GROUPS_PATH = 'groups.json'
const SCHEDULES_PATH = 'schedules.json'
const LOGS_PATH = 'logs.json'
const MODERATION_PATH = 'moderation.json'
const USERS_PATH = 'users.json'
const MEMBERS_PATH = 'members.json'
const MESSAGES_PATH = 'messages.json'
const AI_PATH = 'ai.json'
const WARNINGS_PATH = 'warnings.json'
const MENU_PATH = 'menu.json'
const LEGACY_BOTS_PATH = 'bots.json'
const SESSIONS_PATH = 'sessions.json'
const AUDIT_PATH = 'audit.json'

export interface BotMenuButton {
  id: string
  text: string
  type: 'command' | 'url' | 'callback'
  value: string
}

export interface BotMenuSettings {
  enabled: boolean
  persistentKeyboard: boolean
  inlineMenuOnStart: boolean
  chatMenuButton: 'commands' | 'web_app' | 'default'
  webAppUrl?: string
  buttons: BotMenuButton[]
}

export type UserRole = 'Owner' | 'Admin' | 'Moderator' | 'Viewer'

export interface JSONUser {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  createdAt: string
  totpSecret?: string
}

export interface JSONSession {
  id: string // 32-byte opaque hex token
  userId: string
  username: string
  role: UserRole
  csrfToken: string
  createdAt: string
  expiresAt: string
  lastActiveAt: string
  ipAddress?: string
  userAgent?: string
}

export interface JSONAuditEntry {
  id: string
  userId: string | null
  username: string
  role: string
  action: string
  entityType?: string
  entityId?: string
  ipAddress?: string
  userAgent?: string
  details?: any
  createdAt: string
}

export interface JSONBot {
  id: number
  token: string // Encrypted token
  username: string
  firstName: string
  active: boolean
  permissions: {
    can_join_groups: boolean
    can_read_all_group_messages: boolean
    supports_inline_queries: boolean
  }
  status: 'ONLINE' | 'OFFLINE'
  createdAt: string
}

export interface JSONGroup {
  id: number
  name: string
  chatId: string
  active: boolean
  type: 'group' | 'channel' | 'supergroup' | 'private'
  isAdmin?: boolean
  permissionsVerified?: boolean
  createdAt: string
}

export interface JSONSchedule {
  id: number
  title: string
  type: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'cron'
  time: string // HH:MM or Cron expression
  dayOfWeek?: number // 0-6 (Sunday-Saturday)
  dayOfMonth?: number // 1-31
  timezone: string // e.g. "Asia/Phnom_Penh"
  message: string
  messageType: 'text' | 'photo' | 'video' | 'document'
  mediaUrl?: string
  parseMode: 'HTML' | 'MarkdownV2'
  active: boolean
  // Group IDs this schedule sends to. Empty/undefined = all active groups
  // (keeps older schedules broadcasting to everyone).
  targetGroupIds?: number[]
  createdAt: string
  lastExecutedAt?: string
  // Result of the most recent dispatch. sentAt is Telegram's own message
  // timestamp (Message.date), i.e. when Telegram actually posted it.
  lastDelivery?: {
    sentAt: string | null // ISO date string; null if every send failed
    delivered: number
    failed: number
  }
}

export interface ModerationSettings {
  enabled: boolean
  deleteLinks: boolean
  deleteStickers: boolean
  deleteFiles: boolean
  blockedExtensions?: string[]
  // Lower-case words/phrases; a message containing any of them is removed.
  blockedKeywords: string[]
  // Group admins/owner bypass automatic moderation.
  exemptAdmins: boolean
  // Warnings before a user is muted. 0 = never mute, only delete + warn.
  warnLimit: number
  // How long a mute lasts once warnLimit is reached.
  muteMinutes: number
  // Text returned by the /rules command.
  rulesText: string
}

// Moderation strikes a user has collected in one chat.
export interface JSONWarning {
  chatId: string
  userId: number
  count: number
  lastAt: string // ISO date string
}

// Strikes older than this are forgotten, so rare slips never add up to a mute.
const WARNING_TTL_MS = 24 * 60 * 60 * 1000

// AI auto-reply configuration. When enabled, the bot replies with a Claude-
// generated answer whenever a user @-mentions it (or replies to it) in a group.
export interface AiSettings {
  enabled: boolean
  replyOnMention: boolean
  model: string
  systemPrompt: string
  maxTokens: number
  apiKey?: string
}

// A user the bot has observed in a chat. The Bot API cannot list a group's
// full membership, so we build this registry from incoming messages (plus a
// live merge of admins fetched via getChatAdministrators).
export interface JSONMember {
  chatId: string
  userId: number
  firstName?: string
  lastName?: string
  username?: string
  isBot: boolean
  status?: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'
  messageCount: number
  firstSeen: string
  lastSeen: string
}

// A single message in a group's conversation history (Telegram-style chat view).
export interface JSONChatMessage {
  id: string
  chatId: string
  messageId: number | null
  fromId: number | null
  fromName: string
  fromUsername?: string
  isBot: boolean
  direction: 'in' | 'out' // 'in' = received from Telegram, 'out' = sent from dashboard
  text: string
  date: string // ISO date string
  replyToMessageId?: number | null
  replyToName?: string
  replyToText?: string
  // Media attachment (photo/sticker/video/etc.), rendered via /api/media/<fileId>
  mediaType?: 'photo' | 'sticker' | 'video' | 'animation' | 'document' | 'audio' | 'voice'
  mediaFileId?: string
  mediaMime?: string
  mediaEmoji?: string
  mediaFileName?: string
  stickerFormat?: 'static' | 'animated' | 'video'
  buttons?: Array<{ text: string; url?: string; callbackData?: string }>
}

export interface JSONLog {
  id: string
  groupId: number | null
  chatTitle: string
  scheduleId: number | null
  message: string
  status: 'SUCCESS' | 'FAILED'
  error: string | null
  sentAt: string // ISO date string
  telegramResponse?: any
}

// Nitro storage layer: Cloudflare KV in production, filesystem in dev.
const store = () => useStorage('data')

async function readJsonFile<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const data = await store().getItem<T>(key)
    if (data === null || data === undefined) {
      return defaultValue
    }
    // The fs driver may hand back a raw string; KV returns parsed JSON.
    if (typeof data === 'string') {
      try {
        return JSON.parse(data) as T
      } catch {
        return defaultValue
      }
    }
    return data as T
  } catch (error) {
    console.error(`Error reading storage key ${key}:`, error)
    return defaultValue
  }
}

async function writeJsonFile<T>(key: string, data: T): Promise<void> {
  try {
    await store().setItem(key, data as any)
  } catch (error) {
    console.error(`Error writing storage key ${key}:`, error)
    throw error
  }
}

async function removeJsonFile(key: string): Promise<void> {
  try {
    await store().removeItem(key)
  } catch { }
}

export const db = {
  // Migrate a legacy multi-bot bots.json (array) down to a single bot.json
  async migrateLegacyBotsIfNeeded(): Promise<void> {
    try {
      const legacyBots = await readJsonFile<JSONBot[] | null>(LEGACY_BOTS_PATH, null)
      if (!legacyBots) return

      // Only migrate if a single bot.json is not already present
      const current = await readJsonFile<JSONBot | null>(BOT_PATH, null)
      if (!current && Array.isArray(legacyBots) && legacyBots.length > 0) {
        console.log('[Migration] Converting legacy bots.json (multi-bot) to single bot.json...')
        await writeJsonFile(BOT_PATH, { ...legacyBots[0], id: 1 })
      }

      await removeJsonFile(LEGACY_BOTS_PATH)
      console.log('[Migration] Removed legacy bots.json.')
    } catch (err) {
      console.error('[Migration] Failed to migrate legacy bots.json:', err)
    }
  },

  // Bot Management (single bot)
  async getBot(): Promise<JSONBot | null> {
    await this.migrateLegacyBotsIfNeeded()
    return readJsonFile<JSONBot | null>(BOT_PATH, null)
  },

  async saveBot(bot: JSONBot): Promise<void> {
    await writeJsonFile(BOT_PATH, bot)
  },

  async setBot(
    token: string,
    username: string,
    firstName: string,
    permissions = { can_join_groups: true, can_read_all_group_messages: true, supports_inline_queries: false },
    active = true
  ): Promise<JSONBot> {
    const bot: JSONBot = {
      id: 1,
      token,
      username,
      firstName,
      active,
      permissions,
      status: 'ONLINE',
      createdAt: new Date().toISOString()
    }
    await this.saveBot(bot)
    return bot
  },

  async updateBot(updates: Partial<Omit<JSONBot, 'id' | 'createdAt'>>): Promise<JSONBot> {
    const bot = await this.getBot()
    if (!bot) {
      throw new Error('No bot is configured')
    }
    const updated = { ...bot, ...updates }
    await this.saveBot(updated)
    return updated
  },

  async deleteBot(): Promise<boolean> {
    const bot = await this.getBot()
    if (!bot) return false
    await removeJsonFile(BOT_PATH)
    return true
  },

  // Group Management
  async getGroups(): Promise<JSONGroup[]> {
    return readJsonFile<JSONGroup[]>(GROUPS_PATH, [])
  },

  async saveGroups(groups: JSONGroup[]): Promise<void> {
    await writeJsonFile(GROUPS_PATH, groups)
  },

  async getGroupById(id: number): Promise<JSONGroup | null> {
    const groups = await this.getGroups()
    return groups.find(g => g.id === id) || null
  },

  async getGroupByChatId(chatId: string): Promise<JSONGroup | null> {
    const groups = await this.getGroups()
    return groups.find(g => g.chatId === chatId) || null
  },

  async createGroup(
    name: string,
    chatId: string,
    type: 'group' | 'channel' | 'supergroup' | 'private' = 'group',
    active = true
  ): Promise<JSONGroup> {
    const groups = await this.getGroups()
    const nextId = groups.length > 0 ? Math.max(...groups.map(g => g.id)) + 1 : 1
    const newGroup: JSONGroup = {
      id: nextId,
      name,
      chatId,
      active,
      type,
      createdAt: new Date().toISOString()
    }
    groups.push(newGroup)
    await this.saveGroups(groups)
    return newGroup
  },

  async updateGroup(id: number, updates: Partial<Omit<JSONGroup, 'id' | 'createdAt'>>): Promise<JSONGroup> {
    const groups = await this.getGroups()
    const index = groups.findIndex(g => g.id === id)
    const existing = groups[index]
    if (index === -1 || !existing) {
      throw new Error(`Group with ID ${id} not found`)
    }
    const updatedGroup: JSONGroup = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt
    }
    groups[index] = updatedGroup
    await this.saveGroups(groups)
    return updatedGroup
  },

  async deleteGroup(id: number): Promise<boolean> {
    let groups = await this.getGroups()
    const exists = groups.some(g => g.id === id)
    if (!exists) return false

    groups = groups.filter(g => g.id !== id)
    await this.saveGroups(groups)

    // Cascade delete logs associated with this group
    let logs = await this.getLogs()
    logs = logs.filter(l => l.groupId !== id)
    await this.saveLogs(logs)

    return true
  },

  // Schedule Management
  async getSchedules(): Promise<JSONSchedule[]> {
    return readJsonFile<JSONSchedule[]>(SCHEDULES_PATH, [])
  },

  async saveSchedules(schedules: JSONSchedule[]): Promise<void> {
    await writeJsonFile(SCHEDULES_PATH, schedules)
  },

  async getScheduleById(id: number): Promise<JSONSchedule | null> {
    const schedules = await this.getSchedules()
    return schedules.find(s => s.id === id) || null
  },

  async createSchedule(
    title: string,
    message: string,
    time: string,
    type: 'one_time' | 'daily' | 'weekly' | 'monthly' | 'cron' = 'daily',
    timezone = 'Asia/Phnom_Penh',
    messageType: 'text' | 'photo' | 'video' | 'document' = 'text',
    mediaUrl = '',
    parseMode: 'HTML' | 'MarkdownV2' = 'HTML',
    options?: { dayOfWeek?: number; dayOfMonth?: number; targetGroupIds?: number[] },
    active = true
  ): Promise<JSONSchedule> {
    const schedules = await this.getSchedules()
    const nextId = schedules.length > 0 ? Math.max(...schedules.map(s => s.id)) + 1 : 1
    const newSchedule: JSONSchedule = {
      id: nextId,
      title,
      type,
      time,
      timezone,
      message,
      messageType,
      mediaUrl: mediaUrl || undefined,
      parseMode,
      active,
      dayOfWeek: options?.dayOfWeek,
      dayOfMonth: options?.dayOfMonth,
      targetGroupIds: options?.targetGroupIds,
      createdAt: new Date().toISOString()
    }
    schedules.push(newSchedule)
    await this.saveSchedules(schedules)
    return newSchedule
  },

  async updateSchedule(id: number, updates: Partial<Omit<JSONSchedule, 'id' | 'createdAt'>>): Promise<JSONSchedule> {
    const schedules = await this.getSchedules()
    const index = schedules.findIndex(s => s.id === id)
    const existing = schedules[index]
    if (index === -1 || !existing) {
      throw new Error(`Schedule with ID ${id} not found`)
    }
    const updatedSchedule: JSONSchedule = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt
    }
    schedules[index] = updatedSchedule
    await this.saveSchedules(schedules)
    return updatedSchedule
  },

  async deleteSchedule(id: number): Promise<boolean> {
    let schedules = await this.getSchedules()
    const exists = schedules.some(s => s.id === id)
    if (!exists) return false

    schedules = schedules.filter(s => s.id !== id)
    await this.saveSchedules(schedules)

    // Set scheduleId to null for logs associated with this schedule
    let logs = await this.getLogs()
    let logUpdated = false
    logs = logs.map(l => {
      if (l.scheduleId === id) {
        logUpdated = true
        return { ...l, scheduleId: null }
      }
      return l
    })
    if (logUpdated) {
      await this.saveLogs(logs)
    }

    return true
  },

  // Moderation Settings
  async getModerationSettings(): Promise<ModerationSettings> {
    const defaults: ModerationSettings = {
      enabled: false,
      deleteLinks: false,
      deleteStickers: false,
      deleteFiles: false,
      blockedExtensions: [
        'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'gadget', 'msi', 'msp', 'mst',
        'ps1', 'psm1', 'psd1', 'vbs', 'vbe', 'vb', 'js', 'jse', 'ws', 'wsf', 'wsc',
        'hta', 'reg', 'inf', 'scf', 'sh', 'bash', 'zsh', 'ksh', 'csh', 'fish',
        'py', 'pyw', 'pl', 'rb', 'php', 'cgi', 'jar', 'class', 'dll', 'ocx', 'sys',
        'drv', 'cpl', 'lnk', 'url', 'docm', 'dotm', 'xlsm', 'xltm', 'xlam', 'pptm',
        'ppam', 'potm', 'sldm', 'chm', 'hlp', 'apk', 'aab', 'ipa', 'app', 'dmg',
        'pkg', 'deb', 'rpm', 'snap', 'flatpak', 'iso', 'img', 'vhd', 'vhdx', 'vmdk',
        'ova', 'ovf', 'elf', 'bin', 'run', 'out', 'zip', 'rar', '7z', 'tar', 'gz',
        'tgz', 'bz2', 'xz', 'cab', 'torrent', 'pdf', 'rtf'
      ],
      blockedKeywords: [],
      exemptAdmins: true,
      warnLimit: 3,
      muteMinutes: 60,
      rulesText:
        '1. Be respectful to everyone.\n2. No links, stickers or suspicious files.\n3. Repeated violations lead to a temporary mute.'
    }
    // Merge over defaults so settings saved before a field existed still get it.
    const stored = await readJsonFile<Partial<ModerationSettings>>(MODERATION_PATH, {})
    return { ...defaults, ...stored }
  },

  async saveModerationSettings(updates: Partial<ModerationSettings>): Promise<ModerationSettings> {
    const current = await this.getModerationSettings()
    const merged: ModerationSettings = { ...current, ...updates }
    await writeJsonFile(MODERATION_PATH, merged)
    return merged
  },

  // AI Auto-Reply Settings
  async getAiSettings(): Promise<AiSettings> {
    return readJsonFile<AiSettings>(AI_PATH, {
      enabled: false,
      replyOnMention: true,
      model: 'gemini-flash-latest',
      systemPrompt:
        'You are a friendly, concise assistant in a Telegram group chat. Answer the user helpfully in the same language they use. Keep replies short (a few sentences) and do not use Markdown headings.',
      maxTokens: 600
    })
  },

  async saveAiSettings(updates: Partial<AiSettings>): Promise<AiSettings> {
    const current = await this.getAiSettings()
    const merged: AiSettings = { ...current, ...updates }
    await writeJsonFile(AI_PATH, merged)
    return merged
  },

  // Telegram Interactive Button Menu Settings
  async getMenuSettings(): Promise<BotMenuSettings> {
    const defaults: BotMenuSettings = {
      enabled: true,
      persistentKeyboard: true,
      inlineMenuOnStart: true,
      chatMenuButton: 'commands',
      webAppUrl: '',
      buttons: [
        { id: '1', text: '🤖 Ask AI', type: 'callback', value: 'menu:ai' },
        { id: '2', text: '📜 Group Rules', type: 'callback', value: 'menu:rules' },
        { id: '3', text: '⚠️ My Warnings', type: 'callback', value: 'menu:warns' },
        { id: '4', text: '📊 Bot Status', type: 'callback', value: 'menu:status' },
        { id: '5', text: '🌐 Web Dashboard', type: 'url', value: '' },
        { id: '6', text: '❓ Help & Info', type: 'callback', value: 'menu:help' }
      ]
    }
    const current = await readJsonFile<BotMenuSettings | null>(MENU_PATH, null)
    if (!current) return defaults
    return {
      ...defaults,
      ...current,
      buttons: Array.isArray(current.buttons) && current.buttons.length > 0 ? current.buttons : defaults.buttons
    }
  },

  async saveMenuSettings(updates: Partial<BotMenuSettings>): Promise<BotMenuSettings> {
    const current = await this.getMenuSettings()
    const merged: BotMenuSettings = { ...current, ...updates }
    await writeJsonFile(MENU_PATH, merged)
    return merged
  },

  // Message Logs
  async getLogs(): Promise<JSONLog[]> {
    return readJsonFile<JSONLog[]>(LOGS_PATH, [])
  },

  async saveLogs(logs: JSONLog[]): Promise<void> {
    await writeJsonFile(LOGS_PATH, logs)
  },

  async createLog(
    groupId: number | null,
    chatTitle: string,
    scheduleId: number | null,
    message: string,
    status: 'SUCCESS' | 'FAILED',
    error: string | null = null,
    telegramResponse: any = null
  ): Promise<JSONLog> {
    const logs = await this.getLogs()
    const newLog: JSONLog = {
      id: crypto.randomUUID(),
      groupId,
      chatTitle,
      scheduleId,
      message,
      status,
      error,
      sentAt: new Date().toISOString(),
      telegramResponse
    }
    logs.push(newLog)

    // Cap logs at 1000 to avoid file growing indefinitely
    if (logs.length > 1000) {
      logs.shift()
    }

    await this.saveLogs(logs)
    return newLog
  },

  // Group Members (discovered from incoming messages)
  async getMembers(): Promise<JSONMember[]> {
    return readJsonFile<JSONMember[]>(MEMBERS_PATH, [])
  },

  async saveMembers(members: JSONMember[]): Promise<void> {
    await writeJsonFile(MEMBERS_PATH, members)
  },

  async getMembersByChatId(chatId: string): Promise<JSONMember[]> {
    const members = await this.getMembers()
    return members.filter(m => m.chatId === chatId)
  },

  // Insert or update a member seen in a chat. `bumpMessage` increments their
  // message counter and refreshes lastSeen (used when they post a message).
  async recordMember(
    chatId: string,
    user: { id: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string },
    bumpMessage = false
  ): Promise<JSONMember> {
    const members = await this.getMembers()
    const now = new Date().toISOString()
    const index = members.findIndex(m => m.chatId === chatId && m.userId === user.id)

    if (index === -1) {
      const newMember: JSONMember = {
        chatId,
        userId: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        isBot: !!user.is_bot,
        status: 'member',
        messageCount: bumpMessage ? 1 : 0,
        firstSeen: now,
        lastSeen: now
      }
      members.push(newMember)
      await this.saveMembers(members)
      return newMember
    }

    const existing = members[index]
    if (!existing) {
      return members[0]!
    }
    const updated: JSONMember = {
      ...existing,
      firstName: user.first_name ?? existing.firstName,
      lastName: user.last_name ?? existing.lastName,
      username: user.username ?? existing.username,
      isBot: user.is_bot ?? existing.isBot,
      messageCount: existing.messageCount + (bumpMessage ? 1 : 0),
      lastSeen: bumpMessage ? now : existing.lastSeen
    }
    members[index] = updated
    await this.saveMembers(members)
    return updated
  },

  // Group Chat History
  async getChatMessages(): Promise<JSONChatMessage[]> {
    return readJsonFile<JSONChatMessage[]>(MESSAGES_PATH, [])
  },

  async saveChatMessages(messages: JSONChatMessage[]): Promise<void> {
    await writeJsonFile(MESSAGES_PATH, messages)
  },

  async getChatMessagesByChatId(chatId: string, limit = 200): Promise<JSONChatMessage[]> {
    const messages = await this.getChatMessages()
    return messages
      .filter(m => m.chatId === chatId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-limit)
  },

  async addChatMessage(msg: Omit<JSONChatMessage, 'id'>): Promise<JSONChatMessage> {
    const messages = await this.getChatMessages()
    const newMessage: JSONChatMessage = { id: crypto.randomUUID(), ...msg }
    messages.push(newMessage)

    // Cap total stored messages to avoid unbounded growth.
    if (messages.length > 5000) {
      messages.splice(0, messages.length - 5000)
    }

    await this.saveChatMessages(messages)
    return newMessage
  },

  // Update a stored message in place (e.g. after the sender edited it).
  async updateChatMessage(
    chatId: string,
    messageId: number,
    updates: Partial<Omit<JSONChatMessage, 'id' | 'chatId' | 'messageId'>>
  ): Promise<boolean> {
    const messages = await this.getChatMessages()
    let changed = false
    for (const m of messages) {
      if (m.chatId === chatId && m.messageId === messageId) {
        Object.assign(m, updates)
        changed = true
      }
    }
    if (changed) await this.saveChatMessages(messages)
    return changed
  },

  // Drop every stored copy of a message from the chat history.
  async removeChatMessage(chatId: string, messageId: number): Promise<boolean> {
    const messages = await this.getChatMessages()
    const remaining = messages.filter(m => !(m.chatId === chatId && m.messageId === messageId))
    if (remaining.length === messages.length) return false
    await this.saveChatMessages(remaining)
    return true
  },

  // Moderation Warnings (strikes per user per chat)
  async getWarnings(): Promise<JSONWarning[]> {
    return readJsonFile<JSONWarning[]>(WARNINGS_PATH, [])
  },

  // Active (non-expired) strike count for a user in a chat.
  async getWarningCount(chatId: string, userId: number): Promise<number> {
    const warnings = await this.getWarnings()
    const w = warnings.find(x => x.chatId === chatId && x.userId === userId)
    if (!w || Date.now() - new Date(w.lastAt).getTime() > WARNING_TTL_MS) return 0
    return w.count
  },

  // Add a strike and return the user's new active count.
  async addWarning(chatId: string, userId: number): Promise<number> {
    const warnings = await this.getWarnings()
    const now = new Date()
    let w = warnings.find(x => x.chatId === chatId && x.userId === userId)
    if (!w) {
      w = { chatId, userId, count: 0, lastAt: now.toISOString() }
      warnings.push(w)
    } else if (now.getTime() - new Date(w.lastAt).getTime() > WARNING_TTL_MS) {
      w.count = 0
    }
    w.count += 1
    w.lastAt = now.toISOString()
    await writeJsonFile(WARNINGS_PATH, warnings)
    return w.count
  },

  async resetWarnings(chatId: string, userId: number): Promise<void> {
    const warnings = await this.getWarnings()
    const remaining = warnings.filter(x => !(x.chatId === chatId && x.userId === userId))
    if (remaining.length !== warnings.length) await writeJsonFile(WARNINGS_PATH, remaining)
  },

  // User & Access Management (RBAC)
  async getUsers(): Promise<JSONUser[]> {
    return readJsonFile<JSONUser[]>(USERS_PATH, [])
  },

  async saveUsers(users: JSONUser[]): Promise<void> {
    await writeJsonFile(USERS_PATH, users)
  },

  async hasOwner(): Promise<boolean> {
    const users = await this.getUsers()
    return users.some(u => u.role === 'Owner')
  },

  async isSetupRequired(): Promise<boolean> {
    const users = await this.getUsers()
    return users.length === 0 || !users.some(u => u.role === 'Owner')
  },

  async getUserById(id: string): Promise<JSONUser | null> {
    const users = await this.getUsers()
    return users.find(u => u.id === id) || null
  },

  async getUserByUsername(username: string): Promise<JSONUser | null> {
    const users = await this.getUsers()
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null
  },

  async createOwner(username: string, passwordHash: string): Promise<JSONUser> {
    const users = await this.getUsers()
    if (users.some(u => u.role === 'Owner')) {
      throw new Error('An Owner account has already been initialized')
    }
    const owner: JSONUser = {
      id: crypto.randomUUID(),
      username: username.trim(),
      passwordHash,
      role: 'Owner',
      createdAt: new Date().toISOString()
    }
    users.push(owner)
    await this.saveUsers(users)
    return owner
  },

  async createUser(username: string, passwordHash: string, role: UserRole = 'Viewer'): Promise<JSONUser> {
    const users = await this.getUsers()
    const cleanUsername = username.trim()
    if (users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      throw new Error(`Username "${cleanUsername}" is already taken`)
    }
    const newUser: JSONUser = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    }
    users.push(newUser)
    await this.saveUsers(users)
    return newUser
  },

  async updateUserPassword(id: string, newPasswordHash: string): Promise<boolean> {
    const users = await this.getUsers()
    const index = users.findIndex(u => u.id === id)
    const target = users[index]
    if (index === -1 || !target) return false
    target.passwordHash = newPasswordHash
    await this.saveUsers(users)
    return true
  },

  async updateUserRole(id: string, newRole: UserRole): Promise<boolean> {
    const users = await this.getUsers()
    const index = users.findIndex(u => u.id === id)
    const target = users[index]
    if (index === -1 || !target) return false
    // Ensure we do not demote the last remaining Owner
    if (target.role === 'Owner' && newRole !== 'Owner') {
      const ownerCount = users.filter(u => u.role === 'Owner').length
      if (ownerCount <= 1) {
        throw new Error('Cannot demote the primary Owner account')
      }
    }
    target.role = newRole
    await this.saveUsers(users)
    return true
  },

  async deleteUser(id: string): Promise<boolean> {
    const users = await this.getUsers()
    const user = users.find(u => u.id === id)
    if (!user) return false
    if (user.role === 'Owner') {
      const ownerCount = users.filter(u => u.role === 'Owner').length
      if (ownerCount <= 1) {
        throw new Error('Cannot delete the primary Owner account')
      }
    }
    const remaining = users.filter(u => u.id !== id)
    await this.saveUsers(remaining)
    // Revoke all active sessions for this user
    await this.deleteUserSessions(id)
    return true
  },

  // Server-Side Session Store
  async getSessions(): Promise<JSONSession[]> {
    return readJsonFile<JSONSession[]>(SESSIONS_PATH, [])
  },

  async saveSessions(sessions: JSONSession[]): Promise<void> {
    await writeJsonFile(SESSIONS_PATH, sessions)
  },

  async getSession(id: string): Promise<JSONSession | null> {
    const sessions = await this.getSessions()
    const now = Date.now()
    const session = sessions.find(s => s.id === id)
    if (!session) return null

    // Check expiration (absolute or idle 24h)
    const expiresAt = new Date(session.expiresAt).getTime()
    const lastActiveAt = new Date(session.lastActiveAt).getTime()
    const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000

    if (now > expiresAt || now - lastActiveAt > IDLE_LIMIT_MS) {
      await this.deleteSession(id)
      return null
    }

    return session
  },

  async saveSession(session: JSONSession): Promise<void> {
    const sessions = await this.getSessions()
    const index = sessions.findIndex(s => s.id === session.id)
    if (index === -1) {
      sessions.push(session)
    } else {
      sessions[index] = session
    }
    // Prune expired sessions (keep list bounded)
    const now = Date.now()
    const active = sessions.filter(s => new Date(s.expiresAt).getTime() > now)
    await this.saveSessions(active)
  },

  async touchSession(id: string): Promise<void> {
    const sessions = await this.getSessions()
    const session = sessions.find(s => s.id === id)
    if (session) {
      session.lastActiveAt = new Date().toISOString()
      await this.saveSessions(sessions)
    }
  },

  async deleteSession(id: string): Promise<boolean> {
    const sessions = await this.getSessions()
    const remaining = sessions.filter(s => s.id !== id)
    if (remaining.length === sessions.length) return false
    await this.saveSessions(remaining)
    return true
  },

  async deleteUserSessions(userId: string): Promise<number> {
    const sessions = await this.getSessions()
    const remaining = sessions.filter(s => s.userId !== userId)
    const removedCount = sessions.length - remaining.length
    if (removedCount > 0) {
      await this.saveSessions(remaining)
    }
    return removedCount
  },

  // Audit Logging
  async getAuditEntries(limit = 100): Promise<JSONAuditEntry[]> {
    const entries = await readJsonFile<JSONAuditEntry[]>(AUDIT_PATH, [])
    return entries.slice(-limit).reverse()
  },

  async createAuditEntry(entry: Omit<JSONAuditEntry, 'id' | 'createdAt'>): Promise<JSONAuditEntry> {
    const entries = await readJsonFile<JSONAuditEntry[]>(AUDIT_PATH, [])
    const newEntry: JSONAuditEntry = {
      id: crypto.randomUUID(),
      ...entry,
      createdAt: new Date().toISOString()
    }
    entries.push(newEntry)
    // Keep bounded to last 2000 entries
    if (entries.length > 2000) {
      entries.splice(0, entries.length - 2000)
    }
    await writeJsonFile(AUDIT_PATH, entries)
    return newEntry
  }
}

