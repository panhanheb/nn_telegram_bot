import { runScheduledBroadcast } from '../utils/scheduler'

/**
 * Runs every minute via the Cloudflare cron trigger ("* * * * *").
 * Replaces the old node-cron plugin, which cannot run on Workers.
 */
export default defineTask({
  meta: {
    name: 'broadcast',
    description: 'Dispatch any Telegram schedules that match the current minute'
  },
  async run() {
    try {
      const result = await runScheduledBroadcast()
      return { result }
    } catch (error: any) {
      console.error('[Task:broadcast] Failed:', error.message)
      return { result: { error: error.message } }
    }
  }
})
