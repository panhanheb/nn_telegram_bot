import { db } from '../../../utils/db'
import { decryptToken } from '../../../utils/crypto'
import { resolveGroup } from '../../../utils/group-resolver'
import {
  sendTelegramMessage,
  sendTelegramSticker,
  sendTelegramStickerUpload,
  sendTelegramPhotoUpload,
  sendTelegramVideoUpload
} from '../../../utils/telegram'

function isUploadedBlob(value: unknown): value is Blob {
  return !!value && typeof value === 'object' &&
    typeof (value as Blob).arrayBuffer === 'function' &&
    typeof (value as Blob).size === 'number'
}

/**
 * Send a message, photo, video, or sticker to a group from the dashboard
 * and store it in the chat history as an outgoing message.
 */
export default defineEventHandler(async (event) => {
  const idStr = getRouterParam(event, 'id')
  if (!idStr) {
    throw createError({ statusCode: 400, statusMessage: 'Group ID is required' })
  }

  const group = await resolveGroup(idStr)
  if (!group) {
    throw createError({ statusCode: 404, statusMessage: `Group "${idStr}" not found` })
  }

  const isMultipart = getHeader(event, 'content-type')?.includes('multipart/form-data')
  const form = isMultipart ? await event.request.formData().catch(() => null) : null
  const body = form ? Object.fromEntries(form.entries()) : await readBody(event).catch(() => ({}))
  const text = typeof body?.message === 'string' ? body.message.trim() : ''
  const stickerFileId = typeof body?.stickerFileId === 'string' ? body.stickerFileId.trim() : ''
  const mediaType = body?.mediaType === 'photo' || body?.mediaType === 'video' || body?.mediaType === 'sticker' ? body.mediaType : null
  const mediaFile = form?.get('media')
  const uploadedMedia = isUploadedBlob(mediaFile) ? mediaFile : null
  const fileName = (uploadedMedia as any)?.name || (mediaType === 'photo' ? 'photo.jpg' : (mediaType === 'video' ? 'video.mp4' : 'sticker.webp'))

  if (!text && !stickerFileId && !(mediaType && uploadedMedia)) {
    throw createError({ statusCode: 400, statusMessage: 'Message, sticker, or media file is required' })
  }
  if (mediaType && !uploadedMedia) {
    throw createError({ statusCode: 400, statusMessage: 'Media file is required' })
  }
  if (uploadedMedia && uploadedMedia.size > (mediaType === 'video' ? 50 : 15) * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: `${mediaType === 'video' ? 'Videos' : 'Media'} must be ${mediaType === 'video' ? '50' : '15'} MB or smaller` })
  }

  const bot = await db.getBot()
  if (!bot) {
    throw createError({ statusCode: 404, statusMessage: 'No bot is configured' })
  }

  const parseMode = body.parseMode === 'MarkdownV2' ? 'MarkdownV2' : (body.parseMode === 'HTML' ? 'HTML' : undefined)
  const replyToMessageId =
    typeof body.replyToMessageId === 'number' && body.replyToMessageId > 0 ? body.replyToMessageId : undefined

  let response: { message_id: number; photo?: Array<{ file_id: string }>; video?: { file_id: string; mime_type?: string }; sticker?: { file_id: string; emoji?: string } }
  try {
    const token = await decryptToken(bot.token)
    response = mediaType === 'photo' && uploadedMedia
      ? await sendTelegramPhotoUpload(token, group.chatId, uploadedMedia, fileName, text, replyToMessageId)
      : mediaType === 'video' && uploadedMedia
        ? await sendTelegramVideoUpload(token, group.chatId, uploadedMedia, fileName, text, replyToMessageId)
      : mediaType === 'sticker' && uploadedMedia
        ? await sendTelegramStickerUpload(token, group.chatId, uploadedMedia, fileName, replyToMessageId)
      : stickerFileId
        ? await sendTelegramSticker(token, group.chatId, stickerFileId, replyToMessageId)
      : await sendTelegramMessage(token, group.chatId, text, parseMode, replyToMessageId)
  } catch (err: any) {
    await db.createLog(group.id, group.name, null, text, 'FAILED', err.message)
    throw createError({
      statusCode: 400,
      statusMessage: `Failed to send message: ${err.message}`
    })
  }

  const stored = await db.addChatMessage({
    chatId: group.chatId,
    messageId: response.message_id,
    fromId: null,
    fromName: bot.firstName || 'Bot',
    fromUsername: bot.username,
    isBot: true,
    direction: 'out',
    text,
    date: new Date().toISOString(),
    replyToMessageId: replyToMessageId ?? null,
    replyToName: typeof body.replyToName === 'string' ? body.replyToName : undefined,
    replyToText: typeof body.replyToText === 'string' ? body.replyToText : undefined,
    ...(stickerFileId || (mediaType === 'sticker' && response.sticker)
      ? {
          mediaType: 'sticker' as const,
          mediaFileId: stickerFileId || response.sticker?.file_id,
          mediaEmoji: typeof body.stickerEmoji === 'string' ? body.stickerEmoji : response.sticker?.emoji,
          stickerFormat: body.stickerFormat === 'video' || body.stickerFormat === 'animated'
            ? body.stickerFormat
            : 'static' as const
        }
      : {}),
    ...(mediaType === 'photo' && response.photo?.length
      ? { mediaType: 'photo' as const, mediaFileId: response.photo[response.photo.length - 1].file_id }
      : mediaType === 'video' && response.video
        ? { mediaType: 'video' as const, mediaFileId: response.video.file_id, mediaMime: response.video.mime_type, mediaFileName: fileName }
        : {})
  })

  await db.createLog(
    group.id,
    group.name,
    null,
    text || (mediaType === 'photo' ? '📷 Photo' : mediaType === 'video' ? '🎬 Video' : `${body?.stickerEmoji || ''} Sticker`.trim()),
    'SUCCESS',
    null,
    response
  )

  return { success: true, message: stored }
})
