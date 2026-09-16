import { runScheduledBroadcast } from '../../utils/scheduler'

/**
 * Runs a scheduler tick on demand, so a broadcast can be verified without
 * waiting for the every-minute Cloudflare cron trigger.
 *
 * Pass { force: true } to dispatch every active schedule immediately,
 * regardless of whether its slot is due. Useful for confirming the bot token,
 * chat IDs and permissions actually work.
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const result = await runScheduledBroadcast(new Date(), { force: !!body?.force })
    return { success: true, ...result }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to run scheduler: ${error.message}`
    })
  }
})
