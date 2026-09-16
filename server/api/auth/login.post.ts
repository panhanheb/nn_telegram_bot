import { db } from '../../utils/db'
import { verifyPassword, hashPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    if (!body || !body.username || !body.password) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Username and password are required'
      })
    }

    const username = body.username.trim()
    const password = body.password

    // Retrieve user by username
    const user = await db.getUserByUsername(username)
    if (!user) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid username or password'
      })
    }

    // Verify password hash with multi-salt and default-admin support
    const { valid, needsRehash } = await verifyPassword(password, user.passwordHash, user.username)
    if (!valid) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid username or password'
      })
    }

    // Auto-upgrade password hash to current active runtime encryption key
    if (needsRehash) {
      try {
        const upgradedHash = await hashPassword(password)
        await db.updateUserPassword(user.id, upgradedHash)
      } catch (rehashErr) {
        console.warn('[auth] Could not auto-rehash password:', rehashErr)
      }
    }

    // Log the user in by starting session
    await createSession(event, user)

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Login failed: ${error.message}`
    })
  }
})
