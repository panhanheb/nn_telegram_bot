import { db } from './db'

export interface EnqueuedTelegramTask<T = any> {
  id: string
  chatId: string
  isGroup: boolean
  execute: () => Promise<T>
  resolve: (value: T) => void
  reject: (reason: any) => void
  retries: number
}

/**
 * Outgoing Rate-Limiting Message Queue for Telegram Bot API 10.3 compliance.
 * - Global limit: 30 msg/s
 * - Group limit: 20 msg/min (~1 msg / 3s)
 * - Private chat limit: 1 msg/s
 * - Automatic HTTP 429 handling with `parameters.retry_after` backoff
 * - Automatic HTTP 403 Forbidden handling (marks group inactive when bot was kicked)
 */
class TelegramOutgoingQueue {
  private queue: EnqueuedTelegramTask[] = []
  private isProcessing = false

  // Global rate limiter: up to 30 requests per 1000ms
  private globalHistory: number[] = []
  private readonly MAX_GLOBAL_PER_SEC = 28 // small safety margin below 30

  // Per-chat rate limiter: timestamp of last sent message
  private chatLastSent: Map<string, number> = new Map()

  // Chat backoff pauses (for HTTP 429 retry_after)
  private chatPausedUntil: Map<string, number> = new Map()

  /**
   * Enqueue a Telegram Bot API request to be safely dispatched within rate limits.
   */
  async enqueue<T>(chatId: string, execute: () => Promise<T>): Promise<T> {
    const isGroup = chatId.startsWith('-')
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        id: crypto.randomUUID(),
        chatId,
        isGroup,
        execute,
        resolve,
        reject,
        retries: 0
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const now = Date.now()

      // Clean up global timestamps older than 1 second
      this.globalHistory = this.globalHistory.filter(t => now - t < 1000)

      // 1. Check global rate limit
      if (this.globalHistory.length >= this.MAX_GLOBAL_PER_SEC) {
        const oldest = this.globalHistory[0] ?? now
        const waitTime = Math.max(50, 1000 - (now - oldest))
        await this.delay(waitTime)
        continue
      }

      // 2. Find next task whose target chat is not rate-limited or paused
      let taskIndex = -1
      for (let i = 0; i < this.queue.length; i++) {
        const task = this.queue[i]
        if (!task) continue

        // Check if chat is paused due to HTTP 429
        const pausedUntil = this.chatPausedUntil.get(task.chatId) || 0
        if (now < pausedUntil) continue

        // Check per-chat rate limits:
        // Groups: ~3000ms between messages (20 msg/min)
        // Private: ~1000ms between messages (1 msg/s)
        const lastSent = this.chatLastSent.get(task.chatId) || 0
        const minSpacing = task.isGroup ? 3000 : 1000
        if (now - lastSent < minSpacing) continue

        taskIndex = i
        break
      }

      // If all pending tasks are waiting on per-chat rate limits, sleep briefly
      if (taskIndex === -1) {
        await this.delay(200)
        continue
      }

      const [task] = this.queue.splice(taskIndex, 1)
      if (!task) continue

      // Execute task
      this.globalHistory.push(Date.now())
      this.chatLastSent.set(task.chatId, Date.now())

      try {
        const result = await task.execute()
        task.resolve(result)
      } catch (err: any) {
        const description = err.data?.description || err.message || ''
        const retryAfter = err.data?.parameters?.retry_after || 0

        // Handle HTTP 429 (Too Many Requests: retry after X)
        if (err.statusCode === 429 || description.includes('Too Many Requests') || retryAfter > 0) {
          const pauseMs = Math.max(1, retryAfter) * 1000 + 500
          console.warn(`[TelegramQueue] Rate limited on ${task.chatId}. Pausing for ${pauseMs}ms...`)
          this.chatPausedUntil.set(task.chatId, Date.now() + pauseMs)

          // Re-queue task if retries not exceeded
          if (task.retries < 3) {
            task.retries++
            this.queue.unshift(task)
            await this.delay(pauseMs)
            continue
          }
        }

        // Handle HTTP 403 (Forbidden: bot was kicked or blocked)
        if (err.statusCode === 403 || description.includes('Forbidden')) {
          console.warn(`[TelegramQueue] Bot access forbidden in ${task.chatId} (${description}). Marking inactive.`)
          try {
            const group = await db.getGroupByChatId(task.chatId)
            if (group) {
              await db.updateGroup(group.id, { active: false })
            }
          } catch {}
        }

        task.reject(err)
      }
    }

    this.isProcessing = false
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

export const telegramQueue = new TelegramOutgoingQueue()
