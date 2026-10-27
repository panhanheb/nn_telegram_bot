import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// 1. Users (RBAC & Authentication)
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['Owner', 'Admin', 'Moderator', 'Viewer'] }).notNull().default('Viewer'),
  totpSecret: text('totp_secret'),
  createdAt: text('created_at').notNull()
})

// 2. Sessions (Server-side Session & CSRF Tracking)
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // 32-byte opaque hex token
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  username: text('username').notNull(),
  role: text('role', { enum: ['Owner', 'Admin', 'Moderator', 'Viewer'] }).notNull(),
  csrfToken: text('csrf_token').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  lastActiveAt: text('last_active_at').notNull()
}, (table) => [
  index('idx_sessions_user').on(table.userId),
  index('idx_sessions_expires').on(table.expiresAt)
])

// 3. Bot Configuration (Single active bot)
export const bots = sqliteTable('bots', {
  id: integer('id').primaryKey(),
  token: text('token').notNull(), // Encrypted AES-256-GCM ciphertext
  username: text('username').notNull(),
  firstName: text('first_name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  canJoinGroups: integer('can_join_groups', { mode: 'boolean' }).notNull().default(true),
  canReadAllGroupMessages: integer('can_read_all_group_messages', { mode: 'boolean' }).notNull().default(true),
  supportsInlineQueries: integer('supports_inline_queries', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['ONLINE', 'OFFLINE'] }).notNull().default('OFFLINE'),
  createdAt: text('created_at').notNull()
})

// 4. Groups & Channels
export const groups = sqliteTable('groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  chatId: text('chat_id').notNull().unique(),
  name: text('name').notNull(),
  type: text('type', { enum: ['group', 'channel', 'supergroup', 'private'] }).notNull().default('group'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  permissionsVerified: integer('permissions_verified', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull()
}, (table) => [
  uniqueIndex('idx_groups_chat_id').on(table.chatId)
])

// 5. Chat Messages (Telegram Chat History)
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  messageId: integer('message_id'),
  fromId: integer('from_id'),
  fromName: text('from_name').notNull(),
  fromUsername: text('from_username'),
  isBot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
  direction: text('direction', { enum: ['in', 'out'] }).notNull(),
  text: text('text').notNull().default(''),
  date: text('date').notNull(),
  replyToMessageId: integer('reply_to_message_id'),
  replyToName: text('reply_to_name'),
  replyToText: text('reply_to_text'),
  mediaType: text('media_type', { enum: ['photo', 'sticker', 'video', 'animation', 'document', 'audio', 'voice'] }),
  mediaFileId: text('media_file_id'),
  mediaMime: text('media_mime'),
  mediaEmoji: text('media_emoji'),
  mediaFileName: text('media_file_name'),
  stickerFormat: text('sticker_format', { enum: ['static', 'animated', 'video'] }),
  buttonsJson: text('buttons_json') // Stored as JSON string
}, (table) => [
  index('idx_messages_chat_date').on(table.chatId, table.date),
  index('idx_messages_message_id').on(table.chatId, table.messageId)
])

// 6. Broadcast Schedules
export const schedules = sqliteTable('schedules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  message: text('message').notNull(),
  messageType: text('message_type', { enum: ['text', 'photo', 'video', 'document'] }).notNull().default('text'),
  mediaUrl: text('media_url'),
  parseMode: text('parse_mode', { enum: ['HTML', 'MarkdownV2'] }).notNull().default('HTML'),
  type: text('type', { enum: ['one_time', 'daily', 'weekly', 'monthly', 'cron'] }).notNull().default('daily'),
  time: text('time').notNull(),
  dayOfWeek: integer('day_of_week'),
  dayOfMonth: integer('day_of_month'),
  timezone: text('timezone').notNull().default('UTC'),
  targetGroupIdsJson: text('target_group_ids_json'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastExecutedAt: text('last_executed_at'),
  lastDeliveryJson: text('last_delivery_json'),
  createdAt: text('created_at').notNull()
})

// 7. Schedule Execution Runs (Atomic Slot Deduplication)
export const scheduleRuns = sqliteTable('schedule_runs', {
  id: text('id').primaryKey(), // `<scheduleId>:<YYYY-MM-DDTHH:mm:00Z>`
  scheduleId: integer('schedule_id').notNull().references(() => schedules.id, { onDelete: 'cascade' }),
  scheduledFor: text('scheduled_for').notNull(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status', { enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'] }).notNull(),
  deliveredCount: integer('delivered_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  error: text('error')
}, (table) => [
  uniqueIndex('idx_schedule_slot').on(table.scheduleId, table.scheduledFor)
])

// 8. Moderation Settings
export const moderationSettings = sqliteTable('moderation_settings', {
  chatId: text('chat_id').primaryKey(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  deleteLinks: integer('delete_links', { mode: 'boolean' }).notNull().default(false),
  deleteStickers: integer('delete_stickers', { mode: 'boolean' }).notNull().default(false),
  deleteFiles: integer('delete_files', { mode: 'boolean' }).notNull().default(false),
  blockedExtensionsJson: text('blocked_extensions_json').default('[]'),
  blockedKeywordsJson: text('blocked_keywords_json').notNull().default('[]'),
  exemptAdmins: integer('exempt_admins', { mode: 'boolean' }).notNull().default(true),
  warnLimit: integer('warn_limit').notNull().default(3),
  muteMinutes: integer('mute_minutes').notNull().default(60),
  rulesText: text('rules_text').notNull().default('')
})

// 9. Moderation Warnings
export const moderationWarnings = sqliteTable('moderation_warnings', {
  id: text('id').primaryKey(),
  chatId: text('chat_id').notNull(),
  userId: integer('user_id').notNull(),
  count: integer('count').notNull().default(0),
  lastAt: text('last_at').notNull()
}, (table) => [
  uniqueIndex('idx_warnings_chat_user').on(table.chatId, table.userId)
])

// 10. Chat Members Registry
export const chatMembers = sqliteTable('chat_members', {
  id: text('id').primaryKey(), // `<chatId>:<userId>`
  chatId: text('chat_id').notNull(),
  userId: integer('user_id').notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  username: text('username'),
  isBot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['creator', 'administrator', 'member', 'restricted', 'left', 'kicked'] }),
  messageCount: integer('message_count').notNull().default(0),
  firstSeen: text('first_seen').notNull(),
  lastSeen: text('last_seen').notNull()
}, (table) => [
  uniqueIndex('idx_members_chat_user').on(table.chatId, table.userId)
])

// 11. AI Settings
export const aiSettings = sqliteTable('ai_settings', {
  id: integer('id').primaryKey().default(1),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  replyOnMention: integer('reply_on_mention', { mode: 'boolean' }).notNull().default(true),
  model: text('model').notNull().default('gemini-1.5-flash'),
  systemPrompt: text('system_prompt').notNull(),
  maxTokens: integer('max_tokens').notNull().default(800),
  apiKey: text('api_key') // Encrypted if set
})

// 12. Bot Menu Settings
export const menuSettings = sqliteTable('menu_settings', {
  id: integer('id').primaryKey().default(1),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  persistentKeyboard: integer('persistent_keyboard', { mode: 'boolean' }).notNull().default(false),
  inlineMenuOnStart: integer('inline_menu_on_start', { mode: 'boolean' }).notNull().default(true),
  chatMenuButton: text('chat_menu_button', { enum: ['commands', 'web_app', 'default'] }).notNull().default('default'),
  webAppUrl: text('web_app_url'),
  buttonsJson: text('buttons_json').notNull().default('[]')
})

// 13. Audit Logs
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  username: text('username').notNull(),
  role: text('role').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  detailsJson: text('details_json'),
  createdAt: text('created_at').notNull()
}, (table) => [
  index('idx_audit_created').on(table.createdAt)
])

// 14. Delivery Logs
export const deliveryLogs = sqliteTable('delivery_logs', {
  id: text('id').primaryKey(),
  groupId: integer('group_id'),
  chatTitle: text('chat_title').notNull(),
  scheduleId: integer('schedule_id'),
  message: text('message').notNull(),
  status: text('status', { enum: ['SUCCESS', 'FAILED'] }).notNull(),
  error: text('error'),
  sentAt: text('sent_at').notNull(),
  telegramResponseJson: text('telegram_response_json')
}, (table) => [
  index('idx_delivery_sent').on(table.sentAt)
])

// 15. Telegram Update Deduplication (Idempotency)
export const processedUpdates = sqliteTable('processed_updates', {
  updateId: integer('update_id').primaryKey(),
  processedAt: text('processed_at').notNull()
}, (table) => [
  index('idx_processed_updates_time').on(table.processedAt)
])
