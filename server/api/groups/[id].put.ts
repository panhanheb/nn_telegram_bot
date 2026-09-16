import { db } from '../../utils/db'

export default defineEventHandler(async (event) => {
  try {
    const idStr = getRouterParam(event, 'id')
    if (!idStr) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Group ID is required'
      })
    }

    const id = Number(idStr)
    if (isNaN(id)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Group ID format'
      })
    }

    const body = await readBody(event)
    if (!body) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Request body is required'
      })
    }

    const group = await db.getGroupById(id)
    if (!group) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Group not found'
      })
    }

    const updates: any = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.type !== undefined) updates.type = body.type
    if (body.isActive !== undefined) updates.active = !!body.isActive

    let chatId = group.chatId
    if (body.chatId) {
      chatId = body.chatId.trim()

      // Validate chat ID format (numeric ID or public @username only)
      const isNumericId = /^-?\d+$/.test(chatId)
      const isUsername = /^@[A-Za-z0-9_]{3,}$/.test(chatId)
      if (!isNumericId && !isUsername) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Invalid Chat ID. Use a numeric ID like -1001234567890 or a public @username — not an invite link (t.me/...) or a bot token.'
        })
      }

      if (chatId !== group.chatId) {
        const duplicate = await db.getGroupByChatId(chatId)
        if (duplicate) {
          throw createError({
            statusCode: 409,
            statusMessage: 'A group with this Chat ID already exists'
          })
        }
      }
      updates.chatId = chatId
    }

    const updatedGroup = await db.updateGroup(id, updates)

    return {
      success: true,
      group: {
        id: String(updatedGroup.id),
        chatId: updatedGroup.chatId,
        name: updatedGroup.name,
        isActive: updatedGroup.active,
        type: updatedGroup.type || 'group',
        isAdmin: updatedGroup.isAdmin || false,
        permissionsVerified: updatedGroup.permissionsVerified || false,
        createdAt: updatedGroup.createdAt || new Date().toISOString()
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to update group: ${error.message}`
    })
  }
})
