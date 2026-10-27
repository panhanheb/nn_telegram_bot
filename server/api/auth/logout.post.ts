import { destroySession } from '../../utils/session'
import { logAudit } from '../../utils/audit'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (user) {
    await logAudit(event, 'LOGOUT', 'User', user.id, { username: user.username })
  }
  await destroySession(event)
  return {
    success: true
  }
})
