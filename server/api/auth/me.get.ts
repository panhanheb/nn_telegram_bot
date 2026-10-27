import { getSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = await getSessionUser(event)
  if (!sessionUser) {
    return {
      user: null,
      csrfToken: null
    }
  }

  return {
    user: {
      id: sessionUser.id,
      username: sessionUser.username,
      role: sessionUser.role
    },
    csrfToken: sessionUser.session.csrfToken
  }
})
