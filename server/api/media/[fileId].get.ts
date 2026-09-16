import { db } from '../../utils/db'
import { decryptToken } from '../../utils/crypto'
import { getTelegramFile } from '../../utils/telegram'

// Map a file extension to a content type when Telegram's file server doesn't
// return one we can trust.
function guessContentType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    webm: 'video/webm',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    tgs: 'application/gzip',
    pdf: 'application/pdf'
  }
  return map[ext] || 'application/octet-stream'
}

/**
 * Proxy a Telegram file (photo, sticker, video, document, …) by its file_id.
 * Keeps the bot token server-side and lets the dashboard render media with a
 * plain <img>/<video src="/api/media/<fileId>">. Session-protected by the auth
 * middleware, so only logged-in users can fetch attachments.
 */
export default defineEventHandler(async (event) => {
  const fileId = getRouterParam(event, 'fileId')
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'File ID is required' })
  }

  const bot = await db.getBot()
  if (!bot) {
    throw createError({ statusCode: 404, statusMessage: 'No bot is configured' })
  }

  let token: string
  try {
    token = await decryptToken(bot.token)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Bot token could not be decrypted' })
  }

  let filePath: string
  try {
    const info = await getTelegramFile(token, fileId)
    filePath = info.file_path
  } catch (err: any) {
    // Telegram file_paths expire (~1h) and getFile can fail for old media.
    throw createError({ statusCode: 404, statusMessage: `File unavailable: ${err.message}` })
  }

  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`)
  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: 'Failed to download file from Telegram' })
  }

  const buffer = new Uint8Array(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || guessContentType(filePath)

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'private, max-age=86400')
  return buffer
})
