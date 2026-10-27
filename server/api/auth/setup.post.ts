import { z } from 'zod'
import { db } from '../../utils/db'
import { hashPassword } from '../../utils/crypto'
import { createSession } from '../../utils/session'
import { logAudit } from '../../utils/audit'

const setupSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters').max(32, 'Username cannot exceed 32 characters').regex(/^[a-zA-Z0-9_.-]+$/, 'Username can only contain alphanumeric characters, dots, underscores, and dashes'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password cannot exceed 128 characters')
})

export default defineEventHandler(async (event) => {
  const isRequired = await db.isSetupRequired()
  if (!isRequired) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Owner account has already been initialized'
    })
  }

  const rawBody = await readBody(event).catch(() => null)
  const parseResult = setupSchema.safeParse(rawBody)

  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.issues[0]?.message || 'Invalid setup parameters'
    })
  }

  const { username, password } = parseResult.data
  const passwordHash = await hashPassword(password)
  const owner = await db.createOwner(username, passwordHash)

  // Automatically start an authenticated session for the newly created owner
  const { csrfToken } = await createSession(event, owner)

  // Attach context for audit logging
  event.context.user = { id: owner.id, username: owner.username, role: owner.role }
  await logAudit(event, 'SETUP_COMPLETED', 'User', owner.id, { username: owner.username })

  return {
    success: true,
    user: {
      id: owner.id,
      username: owner.username,
      role: owner.role
    },
    csrfToken
  }
})
