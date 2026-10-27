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

export interface IStorageRepository {
  // Initialization & Migration
  initialize(): Promise<void>

  // Users & RBAC
  getUsers(): Promise<JSONUser[]>
  getUserById(id: string): Promise<JSONUser | null>
  getUserByUsername(username: string): Promise<JSONUser | null>
  createOwner(username: string, passwordHash: string): Promise<JSONUser>
  createUser(username: string, passwordHash: string, role?: UserRole): Promise<JSONUser>
  createUserWithId(user: JSONUser): Promise<JSONUser>
  updateUserPassword(id: string, newPasswordHash: string): Promise<boolean>
  updateUserRole(id: string, newRole: UserRole): Promise<boolean>
  deleteUser(id: string): Promise<boolean>
  hasOwner(): Promise<boolean>
  isSetupRequired(): Promise<boolean>

  // Sessions
  getSession(id: string): Promise<JSONSession | null>
  saveSession(session: JSONSession): Promise<void>
  touchSession(id: string): Promise<void>
  deleteSession(id: string): Promise<boolean>
  deleteUserSessions(userId: string): Promise<number>

  // Bot
  getBot(): Promise<JSONBot | null>
  saveBot(bot: Omit<JSONBot, 'id'> & { id?: number }): Promise<JSONBot>
  deleteBot(): Promise<boolean>

  // Groups
  getGroups(): Promise<JSONGroup[]>
  getGroupById(id: number): Promise<JSONGroup | null>
  getGroupByChatId(chatId: string): Promise<JSONGroup | null>
  createGroup(group: Omit<JSONGroup, 'id' | 'createdAt'>): Promise<JSONGroup>
  updateGroup(id: number, updates: Partial<Omit<JSONGroup, 'id' | 'createdAt'>>): Promise<JSONGroup>
  deleteGroup(id: number): Promise<boolean>

  // Chat Messages
  getChatMessages(chatId?: string, limit?: number): Promise<JSONChatMessage[]>
  saveChatMessage(message: Omit<JSONChatMessage, 'id' | 'date'> & { id?: string; date?: string }): Promise<JSONChatMessage>
  updateChatMessage(chatId: string, messageId: number, updates: Partial<JSONChatMessage>): Promise<boolean>
  deleteChatMessage(chatId: string, messageId: number): Promise<boolean>

  // Schedules
  getSchedules(): Promise<JSONSchedule[]>
  getScheduleById(id: number): Promise<JSONSchedule | null>
  createSchedule(schedule: Omit<JSONSchedule, 'id' | 'createdAt'>): Promise<JSONSchedule>
  updateSchedule(id: number, updates: Partial<Omit<JSONSchedule, 'id' | 'createdAt'>>): Promise<JSONSchedule>
  deleteSchedule(id: number): Promise<boolean>

  // Schedule Runs (Idempotent slot locking)
  claimScheduleRun(scheduleId: number, scheduledFor: string): Promise<boolean>
  completeScheduleRun(
    scheduleId: number,
    scheduledFor: string,
    status: 'SUCCESS' | 'FAILED',
    deliveredCount: number,
    failedCount: number,
    error?: string | null
  ): Promise<void>

  // Moderation Settings & Warnings
  getModerationSettings(chatId?: string): Promise<ModerationSettings>
  saveModerationSettings(settings: ModerationSettings, chatId?: string): Promise<void>
  getWarnings(): Promise<JSONWarning[]>
  recordWarning(chatId: string, userId: number): Promise<number>
  resetWarnings(chatId: string, userId: number): Promise<void>

  // Members
  getMembers(chatId?: string): Promise<JSONMember[]>
  recordMember(chatId: string, user: any, bumpMessage?: boolean): Promise<JSONMember>

  // AI & Menu Settings
  getAiSettings(): Promise<AiSettings>
  saveAiSettings(settings: AiSettings): Promise<void>
  getMenuSettings(): Promise<BotMenuSettings>
  saveMenuSettings(settings: BotMenuSettings): Promise<void>

  // Audit & Delivery Logs
  createAuditEntry(entry: Omit<JSONAuditEntry, 'id' | 'createdAt'>): Promise<JSONAuditEntry>
  getAuditEntries(limit?: number): Promise<JSONAuditEntry[]>
  createLog(
    groupId: number | null,
    chatTitle: string,
    scheduleId: number | null,
    message: string,
    status: 'SUCCESS' | 'FAILED',
    error?: string | null,
    telegramResponse?: any
  ): Promise<JSONLog>
  getLogs(limit?: number): Promise<JSONLog[]>

  // Update Deduplication
  isUpdateProcessed(updateId: number): Promise<boolean>
  markUpdateProcessed(updateId: number): Promise<void>
}
