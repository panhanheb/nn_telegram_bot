import { drizzle } from 'drizzle-orm/d1'
import { eq, desc, and, sql } from 'drizzle-orm'
import * as schema from './schema'
import type { IStorageRepository } from './interfaces'
import type {
  JSONUser,
  JSONSession,
  JSONBot,
  JSONGroup,
  JSONChatMessage,
  JSONSchedule,
  JSONWarning,
  JSONMember,
  JSONLog,
  JSONAuditEntry,
  ModerationSettings,
  AiSettings,
  BotMenuSettings,
  UserRole
} from '../utils/db'

export class D1StorageRepository implements IStorageRepository {
  private db: ReturnType<typeof drizzle<typeof schema>>
  private d1: any

  constructor(d1Binding: any) {
    this.d1 = d1Binding
    this.db = drizzle(d1Binding, { schema })
  }

  async initialize(): Promise<void> {
    // D1 schema migrations are typically applied via `wrangler d1 migrations apply`
    // or batch execution during setup
  }

  // --- Users & RBAC ---
  async getUsers(): Promise<JSONUser[]> {
    const rows = await this.db.select().from(schema.users)
    return rows.map(r => ({
      id: r.id,
      username: r.username,
      passwordHash: r.passwordHash,
      role: r.role as UserRole,
      totpSecret: r.totpSecret || undefined,
      createdAt: r.createdAt
    }))
  }

  async getUserById(id: string): Promise<JSONUser | null> {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.id, id))
    if (!row) return null
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      role: row.role as UserRole,
      totpSecret: row.totpSecret || undefined,
      createdAt: row.createdAt
    }
  }

  async getUserByUsername(username: string): Promise<JSONUser | null> {
    const [row] = await this.db.select().from(schema.users).where(
      sql`lower(${schema.users.username}) = lower(${username.trim()})`
    )
    if (!row) return null
    return {
      id: row.id,
      username: row.username,
      passwordHash: row.passwordHash,
      role: row.role as UserRole,
      totpSecret: row.totpSecret || undefined,
      createdAt: row.createdAt
    }
  }

  async createOwner(username: string, passwordHash: string): Promise<JSONUser> {
    const hasOwner = await this.hasOwner()
    if (hasOwner) {
      throw new Error('An Owner account has already been initialized')
    }
    const newUser: JSONUser = {
      id: crypto.randomUUID(),
      username: username.trim(),
      passwordHash,
      role: 'Owner',
      createdAt: new Date().toISOString()
    }
    await this.db.insert(schema.users).values(newUser)
    return newUser
  }

  async createUser(username: string, passwordHash: string, role: UserRole = 'Viewer'): Promise<JSONUser> {
    const cleanUsername = username.trim()
    const existing = await this.getUserByUsername(cleanUsername)
    if (existing) {
      throw new Error(`Username "${cleanUsername}" is already taken`)
    }
    const newUser: JSONUser = {
      id: crypto.randomUUID(),
      username: cleanUsername,
      passwordHash,
      role,
      createdAt: new Date().toISOString()
    }
    await this.db.insert(schema.users).values(newUser)
    return newUser
  }

  async createUserWithId(user: JSONUser): Promise<JSONUser> {
    await this.db.insert(schema.users).values({
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role,
      totpSecret: user.totpSecret,
      createdAt: user.createdAt
    }).onConflictDoNothing()
    return user
  }

  async updateUserPassword(id: string, newPasswordHash: string): Promise<boolean> {
    const res = await this.db.update(schema.users)
      .set({ passwordHash: newPasswordHash })
      .where(eq(schema.users.id, id))
    return Boolean(res.meta?.changes)
  }

  async updateUserRole(id: string, newRole: UserRole): Promise<boolean> {
    const target = await this.getUserById(id)
    if (!target) return false
    if (target.role === 'Owner' && newRole !== 'Owner') {
      const all = await this.getUsers()
      if (all.filter(u => u.role === 'Owner').length <= 1) {
        throw new Error('Cannot demote the primary Owner account')
      }
    }
    const res = await this.db.update(schema.users)
      .set({ role: newRole })
      .where(eq(schema.users.id, id))
    return Boolean(res.meta?.changes)
  }

  async deleteUser(id: string): Promise<boolean> {
    const target = await this.getUserById(id)
    if (!target) return false
    if (target.role === 'Owner') {
      const all = await this.getUsers()
      if (all.filter(u => u.role === 'Owner').length <= 1) {
        throw new Error('Cannot delete the primary Owner account')
      }
    }
    const res = await this.db.delete(schema.users).where(eq(schema.users.id, id))
    return Boolean(res.meta?.changes)
  }

  async hasOwner(): Promise<boolean> {
    const [row] = await this.db.select().from(schema.users).where(eq(schema.users.role, 'Owner'))
    return Boolean(row)
  }

  async isSetupRequired(): Promise<boolean> {
    return !(await this.hasOwner())
  }

  // --- Sessions ---
  async getSession(id: string): Promise<JSONSession | null> {
    const [row] = await this.db.select().from(schema.sessions).where(eq(schema.sessions.id, id))
    if (!row) return null

    const now = Date.now()
    const expiresAt = new Date(row.expiresAt).getTime()
    const lastActiveAt = new Date(row.lastActiveAt).getTime()
    const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000

    if (now > expiresAt || now - lastActiveAt > IDLE_LIMIT_MS) {
      await this.deleteSession(id)
      return null
    }

    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      role: row.role as UserRole,
      csrfToken: row.csrfToken,
      ipAddress: row.ipAddress || undefined,
      userAgent: row.userAgent || undefined,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      lastActiveAt: row.lastActiveAt
    }
  }

  async saveSession(session: JSONSession): Promise<void> {
    await this.db.insert(schema.sessions).values({
      id: session.id,
      userId: session.userId,
      username: session.username,
      role: session.role,
      csrfToken: session.csrfToken,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      lastActiveAt: session.lastActiveAt
    }).onConflictDoUpdate({
      target: schema.sessions.id,
      set: {
        lastActiveAt: session.lastActiveAt,
        expiresAt: session.expiresAt
      }
    })
  }

  async touchSession(id: string): Promise<void> {
    await this.db.update(schema.sessions)
      .set({ lastActiveAt: new Date().toISOString() })
      .where(eq(schema.sessions.id, id))
  }

  async deleteSession(id: string): Promise<boolean> {
    const res = await this.db.delete(schema.sessions).where(eq(schema.sessions.id, id))
    return Boolean(res.meta?.changes)
  }

  async deleteUserSessions(userId: string): Promise<number> {
    const res = await this.db.delete(schema.sessions).where(eq(schema.sessions.userId, userId))
    return Number(res.meta?.changes || 0)
  }

  // --- Bot ---
  async getBot(): Promise<JSONBot | null> {
    const [row] = await this.db.select().from(schema.bots).where(eq(schema.bots.id, 1))
    if (!row) return null
    return {
      id: row.id,
      token: row.token,
      username: row.username,
      firstName: row.firstName,
      active: row.active,
      permissions: {
        can_join_groups: row.canJoinGroups,
        can_read_all_group_messages: row.canReadAllGroupMessages,
        supports_inline_queries: row.supportsInlineQueries
      },
      status: row.status as 'ONLINE' | 'OFFLINE',
      createdAt: row.createdAt
    }
  }

  async saveBot(bot: Omit<JSONBot, 'id'> & { id?: number }): Promise<JSONBot> {
    const record = {
      id: 1,
      token: bot.token,
      username: bot.username,
      firstName: bot.firstName,
      active: bot.active,
      canJoinGroups: bot.permissions?.can_join_groups ?? true,
      canReadAllGroupMessages: bot.permissions?.can_read_all_group_messages ?? true,
      supportsInlineQueries: bot.permissions?.supports_inline_queries ?? false,
      status: bot.status,
      createdAt: bot.createdAt || new Date().toISOString()
    }
    await this.db.insert(schema.bots).values(record).onConflictDoUpdate({
      target: schema.bots.id,
      set: record
    })
    return {
      id: 1,
      token: record.token,
      username: record.username,
      firstName: record.firstName,
      active: record.active,
      permissions: {
        can_join_groups: record.canJoinGroups,
        can_read_all_group_messages: record.canReadAllGroupMessages,
        supports_inline_queries: record.supportsInlineQueries
      },
      status: record.status as 'ONLINE' | 'OFFLINE',
      createdAt: record.createdAt
    }
  }

  async deleteBot(): Promise<boolean> {
    const res = await this.db.delete(schema.bots).where(eq(schema.bots.id, 1))
    return Boolean(res.meta?.changes)
  }

  // --- Groups ---
  async getGroups(): Promise<JSONGroup[]> {
    const rows = await this.db.select().from(schema.groups)
    return rows.map(r => ({
      id: r.id,
      chatId: r.chatId,
      name: r.name,
      type: r.type as any,
      active: r.active,
      isAdmin: Boolean(r.isAdmin),
      permissionsVerified: Boolean(r.permissionsVerified),
      createdAt: r.createdAt
    }))
  }

  async getGroupById(id: number): Promise<JSONGroup | null> {
    const [row] = await this.db.select().from(schema.groups).where(eq(schema.groups.id, id))
    if (!row) return null
    return {
      id: row.id,
      chatId: row.chatId,
      name: row.name,
      type: row.type as any,
      active: row.active,
      isAdmin: Boolean(row.isAdmin),
      permissionsVerified: Boolean(row.permissionsVerified),
      createdAt: row.createdAt
    }
  }

  async getGroupByChatId(chatId: string): Promise<JSONGroup | null> {
    const [row] = await this.db.select().from(schema.groups).where(eq(schema.groups.chatId, chatId))
    if (!row) return null
    return {
      id: row.id,
      chatId: row.chatId,
      name: row.name,
      type: row.type as any,
      active: row.active,
      isAdmin: Boolean(row.isAdmin),
      permissionsVerified: Boolean(row.permissionsVerified),
      createdAt: row.createdAt
    }
  }

  async createGroup(group: Omit<JSONGroup, 'id' | 'createdAt'>): Promise<JSONGroup> {
    const record = {
      chatId: group.chatId,
      name: group.name,
      type: group.type,
      active: group.active,
      isAdmin: Boolean(group.isAdmin),
      permissionsVerified: Boolean(group.permissionsVerified),
      createdAt: new Date().toISOString()
    }
    const [inserted] = await this.db.insert(schema.groups).values(record).returning()
    return {
      id: inserted!.id,
      chatId: inserted!.chatId,
      name: inserted!.name,
      type: inserted!.type as any,
      active: inserted!.active,
      isAdmin: Boolean(inserted!.isAdmin),
      permissionsVerified: Boolean(inserted!.permissionsVerified),
      createdAt: inserted!.createdAt
    }
  }

  async updateGroup(id: number, updates: Partial<Omit<JSONGroup, 'id' | 'createdAt'>>): Promise<JSONGroup> {
    const payload: Record<string, any> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.chatId !== undefined) payload.chatId = updates.chatId
    if (updates.type !== undefined) payload.type = updates.type
    if (updates.active !== undefined) payload.active = updates.active
    if (updates.isAdmin !== undefined) payload.isAdmin = updates.isAdmin
    if (updates.permissionsVerified !== undefined) payload.permissionsVerified = updates.permissionsVerified

    const [updated] = await this.db.update(schema.groups)
      .set(payload)
      .where(eq(schema.groups.id, id))
      .returning()
    if (!updated) throw new Error(`Group with ID ${id} not found`)
    return {
      id: updated.id,
      chatId: updated.chatId,
      name: updated.name,
      type: updated.type as any,
      active: updated.active,
      isAdmin: Boolean(updated.isAdmin),
      permissionsVerified: Boolean(updated.permissionsVerified),
      createdAt: updated.createdAt
    }
  }

  async deleteGroup(id: number): Promise<boolean> {
    const res = await this.db.delete(schema.groups).where(eq(schema.groups.id, id))
    return Boolean(res.meta?.changes)
  }

  // --- Chat Messages ---
  async getChatMessages(chatId?: string, limit = 100): Promise<JSONChatMessage[]> {
    const query = this.db.select().from(schema.chatMessages)
    const rows = chatId
      ? await query.where(eq(schema.chatMessages.chatId, chatId)).orderBy(desc(schema.chatMessages.date)).limit(limit)
      : await query.orderBy(desc(schema.chatMessages.date)).limit(limit)

    return rows.reverse().map(r => ({
      id: r.id,
      chatId: r.chatId,
      messageId: r.messageId,
      fromId: r.fromId,
      fromName: r.fromName,
      fromUsername: r.fromUsername || undefined,
      isBot: r.isBot,
      direction: r.direction as 'in' | 'out',
      text: r.text,
      date: r.date,
      replyToMessageId: r.replyToMessageId,
      replyToName: r.replyToName || undefined,
      replyToText: r.replyToText || undefined,
      mediaType: r.mediaType as any,
      mediaFileId: r.mediaFileId || undefined,
      mediaMime: r.mediaMime || undefined,
      mediaEmoji: r.mediaEmoji || undefined,
      mediaFileName: r.mediaFileName || undefined,
      stickerFormat: r.stickerFormat as any,
      buttons: r.buttonsJson ? JSON.parse(r.buttonsJson) : undefined
    }))
  }

  async saveChatMessage(message: Omit<JSONChatMessage, 'id' | 'date'> & { id?: string; date?: string }): Promise<JSONChatMessage> {
    const msg: JSONChatMessage = {
      id: message.id || crypto.randomUUID(),
      chatId: message.chatId,
      messageId: message.messageId ?? null,
      fromId: message.fromId ?? null,
      fromName: message.fromName,
      fromUsername: message.fromUsername,
      isBot: message.isBot,
      direction: message.direction,
      text: message.text || '',
      date: message.date || new Date().toISOString(),
      replyToMessageId: message.replyToMessageId,
      replyToName: message.replyToName,
      replyToText: message.replyToText,
      mediaType: message.mediaType,
      mediaFileId: message.mediaFileId,
      mediaMime: message.mediaMime,
      mediaEmoji: message.mediaEmoji,
      mediaFileName: message.mediaFileName,
      stickerFormat: message.stickerFormat,
      buttons: message.buttons
    }

    await this.db.insert(schema.chatMessages).values({
      id: msg.id,
      chatId: msg.chatId,
      messageId: msg.messageId,
      fromId: msg.fromId,
      fromName: msg.fromName,
      fromUsername: msg.fromUsername,
      isBot: msg.isBot,
      direction: msg.direction,
      text: msg.text,
      date: msg.date,
      replyToMessageId: msg.replyToMessageId,
      replyToName: msg.replyToName,
      replyToText: msg.replyToText,
      mediaType: msg.mediaType,
      mediaFileId: msg.mediaFileId,
      mediaMime: msg.mediaMime,
      mediaEmoji: msg.mediaEmoji,
      mediaFileName: msg.mediaFileName,
      stickerFormat: msg.stickerFormat,
      buttonsJson: msg.buttons ? JSON.stringify(msg.buttons) : null
    }).onConflictDoUpdate({
      target: schema.chatMessages.id,
      set: {
        text: msg.text,
        mediaType: msg.mediaType,
        mediaFileId: msg.mediaFileId
      }
    })

    return msg
  }

  async updateChatMessage(chatId: string, messageId: number, updates: Partial<JSONChatMessage>): Promise<boolean> {
    const payload: Record<string, any> = {}
    if (updates.text !== undefined) payload.text = updates.text
    if (updates.mediaType !== undefined) payload.mediaType = updates.mediaType
    if (updates.mediaFileId !== undefined) payload.mediaFileId = updates.mediaFileId

    const res = await this.db.update(schema.chatMessages)
      .set(payload)
      .where(and(eq(schema.chatMessages.chatId, chatId), eq(schema.chatMessages.messageId, messageId)))
    return Boolean(res.meta?.changes)
  }

  async deleteChatMessage(chatId: string, messageId: number): Promise<boolean> {
    const res = await this.db.delete(schema.chatMessages)
      .where(and(eq(schema.chatMessages.chatId, chatId), eq(schema.chatMessages.messageId, messageId)))
    return Boolean(res.meta?.changes)
  }

  // --- Schedules ---
  async getSchedules(): Promise<JSONSchedule[]> {
    const rows = await this.db.select().from(schema.schedules)
    return rows.map(r => ({
      id: r.id,
      title: r.title,
      message: r.message,
      messageType: r.messageType as any,
      mediaUrl: r.mediaUrl || undefined,
      parseMode: r.parseMode as any,
      type: r.type as any,
      time: r.time,
      dayOfWeek: r.dayOfWeek ?? undefined,
      dayOfMonth: r.dayOfMonth ?? undefined,
      timezone: r.timezone,
      targetGroupIds: r.targetGroupIdsJson ? JSON.parse(r.targetGroupIdsJson) : undefined,
      active: r.active,
      lastExecutedAt: r.lastExecutedAt || undefined,
      lastDelivery: r.lastDeliveryJson ? JSON.parse(r.lastDeliveryJson) : undefined,
      createdAt: r.createdAt
    }))
  }

  async getScheduleById(id: number): Promise<JSONSchedule | null> {
    const [row] = await this.db.select().from(schema.schedules).where(eq(schema.schedules.id, id))
    if (!row) return null
    return {
      id: row.id,
      title: row.title,
      message: row.message,
      messageType: row.messageType as any,
      mediaUrl: row.mediaUrl || undefined,
      parseMode: row.parseMode as any,
      type: row.type as any,
      time: row.time,
      dayOfWeek: row.dayOfWeek ?? undefined,
      dayOfMonth: row.dayOfMonth ?? undefined,
      timezone: row.timezone,
      targetGroupIds: row.targetGroupIdsJson ? JSON.parse(row.targetGroupIdsJson) : undefined,
      active: row.active,
      lastExecutedAt: row.lastExecutedAt || undefined,
      lastDelivery: row.lastDeliveryJson ? JSON.parse(row.lastDeliveryJson) : undefined,
      createdAt: row.createdAt
    }
  }

  async createSchedule(schedule: Omit<JSONSchedule, 'id' | 'createdAt'>): Promise<JSONSchedule> {
    const record = {
      title: schedule.title,
      message: schedule.message,
      messageType: schedule.messageType,
      mediaUrl: schedule.mediaUrl || null,
      parseMode: schedule.parseMode,
      type: schedule.type,
      time: schedule.time,
      dayOfWeek: schedule.dayOfWeek ?? null,
      dayOfMonth: schedule.dayOfMonth ?? null,
      timezone: schedule.timezone || 'UTC',
      targetGroupIdsJson: schedule.targetGroupIds ? JSON.stringify(schedule.targetGroupIds) : null,
      active: schedule.active,
      lastExecutedAt: schedule.lastExecutedAt || null,
      lastDeliveryJson: schedule.lastDelivery ? JSON.stringify(schedule.lastDelivery) : null,
      createdAt: new Date().toISOString()
    }
    const [inserted] = await this.db.insert(schema.schedules).values(record).returning()
    return {
      id: inserted!.id,
      title: inserted!.title,
      message: inserted!.message,
      messageType: inserted!.messageType as any,
      mediaUrl: inserted!.mediaUrl || undefined,
      parseMode: inserted!.parseMode as any,
      type: inserted!.type as any,
      time: inserted!.time,
      dayOfWeek: inserted!.dayOfWeek ?? undefined,
      dayOfMonth: inserted!.dayOfMonth ?? undefined,
      timezone: inserted!.timezone,
      targetGroupIds: inserted!.targetGroupIdsJson ? JSON.parse(inserted!.targetGroupIdsJson) : undefined,
      active: inserted!.active,
      lastExecutedAt: inserted!.lastExecutedAt || undefined,
      lastDelivery: inserted!.lastDeliveryJson ? JSON.parse(inserted!.lastDeliveryJson) : undefined,
      createdAt: inserted!.createdAt
    }
  }

  async updateSchedule(id: number, updates: Partial<Omit<JSONSchedule, 'id' | 'createdAt'>>): Promise<JSONSchedule> {
    const payload: Record<string, any> = {}
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.message !== undefined) payload.message = updates.message
    if (updates.messageType !== undefined) payload.messageType = updates.messageType
    if (updates.mediaUrl !== undefined) payload.mediaUrl = updates.mediaUrl
    if (updates.parseMode !== undefined) payload.parseMode = updates.parseMode
    if (updates.type !== undefined) payload.type = updates.type
    if (updates.time !== undefined) payload.time = updates.time
    if (updates.dayOfWeek !== undefined) payload.dayOfWeek = updates.dayOfWeek
    if (updates.dayOfMonth !== undefined) payload.dayOfMonth = updates.dayOfMonth
    if (updates.timezone !== undefined) payload.timezone = updates.timezone
    if (updates.targetGroupIds !== undefined) payload.targetGroupIdsJson = updates.targetGroupIds ? JSON.stringify(updates.targetGroupIds) : null
    if (updates.active !== undefined) payload.active = updates.active
    if (updates.lastExecutedAt !== undefined) payload.lastExecutedAt = updates.lastExecutedAt
    if (updates.lastDelivery !== undefined) payload.lastDeliveryJson = updates.lastDelivery ? JSON.stringify(updates.lastDelivery) : null

    const [updated] = await this.db.update(schema.schedules)
      .set(payload)
      .where(eq(schema.schedules.id, id))
      .returning()
    if (!updated) throw new Error(`Schedule with ID ${id} not found`)
    return {
      id: updated.id,
      title: updated.title,
      message: updated.message,
      messageType: updated.messageType as any,
      mediaUrl: updated.mediaUrl || undefined,
      parseMode: updated.parseMode as any,
      type: updated.type as any,
      time: updated.time,
      dayOfWeek: updated.dayOfWeek ?? undefined,
      dayOfMonth: updated.dayOfMonth ?? undefined,
      timezone: updated.timezone,
      targetGroupIds: updated.targetGroupIdsJson ? JSON.parse(updated.targetGroupIdsJson) : undefined,
      active: updated.active,
      lastExecutedAt: updated.lastExecutedAt || undefined,
      lastDelivery: updated.lastDeliveryJson ? JSON.parse(updated.lastDeliveryJson) : undefined,
      createdAt: updated.createdAt
    }
  }

  async deleteSchedule(id: number): Promise<boolean> {
    const res = await this.db.delete(schema.schedules).where(eq(schema.schedules.id, id))
    return Boolean(res.meta?.changes)
  }

  // --- Schedule Runs (Atomic Deduplication Slot) ---
  async claimScheduleRun(scheduleId: number, scheduledFor: string): Promise<boolean> {
    const slotId = `${scheduleId}:${scheduledFor}`
    try {
      await this.db.insert(schema.scheduleRuns).values({
        id: slotId,
        scheduleId,
        scheduledFor,
        startedAt: new Date().toISOString(),
        status: 'RUNNING',
        deliveredCount: 0,
        failedCount: 0
      })
      return true
    } catch {
      return false
    }
  }

  async completeScheduleRun(
    scheduleId: number,
    scheduledFor: string,
    status: 'SUCCESS' | 'FAILED',
    deliveredCount: number,
    failedCount: number,
    error?: string | null
  ): Promise<void> {
    const slotId = `${scheduleId}:${scheduledFor}`
    await this.db.update(schema.scheduleRuns)
      .set({
        finishedAt: new Date().toISOString(),
        status,
        deliveredCount,
        failedCount,
        error: error || null
      })
      .where(eq(schema.scheduleRuns.id, slotId))
  }

  // --- Moderation Settings & Warnings ---
  async getModerationSettings(chatId = 'default'): Promise<ModerationSettings> {
    const [row] = await this.db.select().from(schema.moderationSettings).where(eq(schema.moderationSettings.chatId, chatId))
    if (!row) {
      return {
        enabled: true,
        deleteLinks: false,
        deleteStickers: false,
        deleteFiles: false,
        blockedExtensions: [],
        blockedKeywords: [],
        exemptAdmins: true,
        warnLimit: 3,
        muteMinutes: 60,
        rulesText: 'Welcome! Please adhere to community rules.'
      }
    }
    return {
      enabled: row.enabled,
      deleteLinks: row.deleteLinks,
      deleteStickers: row.deleteStickers,
      deleteFiles: row.deleteFiles,
      blockedExtensions: JSON.parse(row.blockedExtensionsJson || '[]'),
      blockedKeywords: JSON.parse(row.blockedKeywordsJson || '[]'),
      exemptAdmins: row.exemptAdmins,
      warnLimit: row.warnLimit,
      muteMinutes: row.muteMinutes,
      rulesText: row.rulesText
    }
  }

  async saveModerationSettings(settings: ModerationSettings, chatId = 'default'): Promise<void> {
    const record = {
      chatId,
      enabled: settings.enabled,
      deleteLinks: settings.deleteLinks,
      deleteStickers: settings.deleteStickers,
      deleteFiles: settings.deleteFiles,
      blockedExtensionsJson: JSON.stringify(settings.blockedExtensions || []),
      blockedKeywordsJson: JSON.stringify(settings.blockedKeywords || []),
      exemptAdmins: settings.exemptAdmins,
      warnLimit: settings.warnLimit,
      muteMinutes: settings.muteMinutes,
      rulesText: settings.rulesText || ''
    }
    await this.db.insert(schema.moderationSettings).values(record).onConflictDoUpdate({
      target: schema.moderationSettings.chatId,
      set: record
    })
  }

  async getWarnings(): Promise<JSONWarning[]> {
    const rows = await this.db.select().from(schema.moderationWarnings)
    return rows.map(r => ({
      chatId: r.chatId,
      userId: r.userId,
      count: r.count,
      lastAt: r.lastAt
    }))
  }

  async recordWarning(chatId: string, userId: number): Promise<number> {
    const warningId = `${chatId}:${userId}`
    const now = new Date()
    const WARNING_TTL_MS = 24 * 60 * 60 * 1000

    const [existing] = await this.db.select().from(schema.moderationWarnings).where(eq(schema.moderationWarnings.id, warningId))
    let currentCount = 0
    if (existing) {
      const elapsed = now.getTime() - new Date(existing.lastAt).getTime()
      currentCount = elapsed > WARNING_TTL_MS ? 0 : existing.count
    }
    const newCount = currentCount + 1

    await this.db.insert(schema.moderationWarnings).values({
      id: warningId,
      chatId,
      userId,
      count: newCount,
      lastAt: now.toISOString()
    }).onConflictDoUpdate({
      target: schema.moderationWarnings.id,
      set: {
        count: newCount,
        lastAt: now.toISOString()
      }
    })

    return newCount
  }

  async resetWarnings(chatId: string, userId: number): Promise<void> {
    const warningId = `${chatId}:${userId}`
    await this.db.delete(schema.moderationWarnings).where(eq(schema.moderationWarnings.id, warningId))
  }

  // --- Members ---
  async getMembers(chatId?: string): Promise<JSONMember[]> {
    const query = this.db.select().from(schema.chatMembers)
    const rows = chatId
      ? await query.where(eq(schema.chatMembers.chatId, chatId))
      : await query
    return rows.map(r => ({
      chatId: r.chatId,
      userId: r.userId,
      firstName: r.firstName || undefined,
      lastName: r.lastName || undefined,
      username: r.username || undefined,
      isBot: r.isBot,
      status: r.status as any,
      messageCount: r.messageCount,
      firstSeen: r.firstSeen,
      lastSeen: r.lastSeen
    }))
  }

  async recordMember(chatId: string, user: any, bumpMessage = false): Promise<JSONMember> {
    const memberId = `${chatId}:${user.id}`
    const now = new Date().toISOString()
    const [existing] = await this.db.select().from(schema.chatMembers).where(eq(schema.chatMembers.id, memberId))

    if (!existing) {
      const newMember: JSONMember = {
        chatId,
        userId: user.id,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        username: user.username || undefined,
        isBot: Boolean(user.is_bot),
        messageCount: bumpMessage ? 1 : 0,
        firstSeen: now,
        lastSeen: now
      }
      await this.db.insert(schema.chatMembers).values({
        id: memberId,
        chatId: newMember.chatId,
        userId: newMember.userId,
        firstName: newMember.firstName,
        lastName: newMember.lastName,
        username: newMember.username,
        isBot: newMember.isBot,
        messageCount: newMember.messageCount,
        firstSeen: newMember.firstSeen,
        lastSeen: newMember.lastSeen
      })
      return newMember
    }

    const updated: JSONMember = {
      chatId,
      userId: user.id,
      firstName: user.first_name ?? existing.firstName ?? undefined,
      lastName: user.last_name ?? existing.lastName ?? undefined,
      username: user.username ?? existing.username ?? undefined,
      isBot: user.is_bot ?? existing.isBot,
      status: existing.status as any,
      messageCount: existing.messageCount + (bumpMessage ? 1 : 0),
      firstSeen: existing.firstSeen,
      lastSeen: bumpMessage ? now : existing.lastSeen
    }

    await this.db.update(schema.chatMembers).set({
      firstName: updated.firstName,
      lastName: updated.lastName,
      username: updated.username,
      isBot: updated.isBot,
      messageCount: updated.messageCount,
      lastSeen: updated.lastSeen
    }).where(eq(schema.chatMembers.id, memberId))

    return updated
  }

  // --- AI Settings ---
  async getAiSettings(): Promise<AiSettings> {
    const [row] = await this.db.select().from(schema.aiSettings).where(eq(schema.aiSettings.id, 1))
    if (!row) {
      return {
        enabled: false,
        replyOnMention: true,
        model: 'gemini-1.5-flash',
        systemPrompt: 'You are a helpful assistant for this Telegram community.',
        maxTokens: 800
      }
    }
    return {
      enabled: row.enabled,
      replyOnMention: row.replyOnMention,
      model: row.model,
      systemPrompt: row.systemPrompt,
      maxTokens: row.maxTokens,
      apiKey: row.apiKey || undefined
    }
  }

  async saveAiSettings(settings: AiSettings): Promise<void> {
    const record = {
      id: 1,
      enabled: settings.enabled,
      replyOnMention: settings.replyOnMention,
      model: settings.model || 'gemini-1.5-flash',
      systemPrompt: settings.systemPrompt,
      maxTokens: settings.maxTokens || 800,
      apiKey: settings.apiKey || null
    }
    await this.db.insert(schema.aiSettings).values(record).onConflictDoUpdate({
      target: schema.aiSettings.id,
      set: record
    })
  }

  // --- Menu Settings ---
  async getMenuSettings(): Promise<BotMenuSettings> {
    const [row] = await this.db.select().from(schema.menuSettings).where(eq(schema.menuSettings.id, 1))
    if (!row) {
      return {
        enabled: true,
        persistentKeyboard: false,
        inlineMenuOnStart: true,
        chatMenuButton: 'default',
        buttons: []
      }
    }
    return {
      enabled: row.enabled,
      persistentKeyboard: row.persistentKeyboard,
      inlineMenuOnStart: row.inlineMenuOnStart,
      chatMenuButton: row.chatMenuButton as any,
      webAppUrl: row.webAppUrl || undefined,
      buttons: JSON.parse(row.buttonsJson || '[]')
    }
  }

  async saveMenuSettings(settings: BotMenuSettings): Promise<void> {
    const record = {
      id: 1,
      enabled: settings.enabled,
      persistentKeyboard: settings.persistentKeyboard,
      inlineMenuOnStart: settings.inlineMenuOnStart,
      chatMenuButton: settings.chatMenuButton,
      webAppUrl: settings.webAppUrl || null,
      buttonsJson: JSON.stringify(settings.buttons || [])
    }
    await this.db.insert(schema.menuSettings).values(record).onConflictDoUpdate({
      target: schema.menuSettings.id,
      set: record
    })
  }

  // --- Audit Logs ---
  async createAuditEntry(entry: Omit<JSONAuditEntry, 'id' | 'createdAt'>): Promise<JSONAuditEntry> {
    const record: JSONAuditEntry = {
      id: crypto.randomUUID(),
      ...entry,
      createdAt: new Date().toISOString()
    }
    await this.db.insert(schema.auditLogs).values({
      id: record.id,
      userId: record.userId,
      username: record.username,
      role: record.role,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      detailsJson: record.details ? JSON.stringify(record.details) : null,
      createdAt: record.createdAt
    })
    return record
  }

  async getAuditEntries(limit = 100): Promise<JSONAuditEntry[]> {
    const rows = await this.db.select().from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(limit)
    return rows.map(r => ({
      id: r.id,
      userId: r.userId,
      username: r.username,
      role: r.role,
      action: r.action,
      entityType: r.entityType || undefined,
      entityId: r.entityId || undefined,
      ipAddress: r.ipAddress || undefined,
      userAgent: r.userAgent || undefined,
      details: r.detailsJson ? JSON.parse(r.detailsJson) : undefined,
      createdAt: r.createdAt
    }))
  }

  // --- Delivery Logs ---
  async createLog(
    groupId: number | null,
    chatTitle: string,
    scheduleId: number | null,
    message: string,
    status: 'SUCCESS' | 'FAILED',
    error?: string | null,
    telegramResponse?: any
  ): Promise<JSONLog> {
    const log: JSONLog = {
      id: crypto.randomUUID(),
      groupId,
      chatTitle,
      scheduleId,
      message,
      status,
      error: error || null,
      sentAt: new Date().toISOString(),
      telegramResponse
    }
    await this.db.insert(schema.deliveryLogs).values({
      id: log.id,
      groupId: log.groupId,
      chatTitle: log.chatTitle,
      scheduleId: log.scheduleId,
      message: log.message,
      status: log.status,
      error: log.error,
      sentAt: log.sentAt,
      telegramResponseJson: log.telegramResponse ? JSON.stringify(log.telegramResponse) : null
    })
    return log
  }

  async getLogs(limit = 100): Promise<JSONLog[]> {
    const rows = await this.db.select().from(schema.deliveryLogs)
      .orderBy(desc(schema.deliveryLogs.sentAt))
      .limit(limit)
    return rows.map(r => ({
      id: r.id,
      groupId: r.groupId,
      chatTitle: r.chatTitle,
      scheduleId: r.scheduleId,
      message: r.message,
      status: r.status as any,
      error: r.error,
      sentAt: r.sentAt,
      telegramResponse: r.telegramResponseJson ? JSON.parse(r.telegramResponseJson) : undefined
    }))
  }

  // --- Update Deduplication ---
  async isUpdateProcessed(updateId: number): Promise<boolean> {
    const [row] = await this.db.select().from(schema.processedUpdates)
      .where(eq(schema.processedUpdates.updateId, updateId))
    return Boolean(row)
  }

  async markUpdateProcessed(updateId: number): Promise<void> {
    await this.db.insert(schema.processedUpdates).values({
      updateId,
      processedAt: new Date().toISOString()
    }).onConflictDoNothing()
  }
}
