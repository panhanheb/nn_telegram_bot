import { db } from '../../utils/db'

const ALLOWED_MODELS = new Set([
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-pro-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-2.0-flash'
])

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const updates: Record<string, any> = {}

    if (body.enabled !== undefined) updates.enabled = !!body.enabled
    if (body.replyOnMention !== undefined) updates.replyOnMention = !!body.replyOnMention
    if (typeof body.systemPrompt === 'string') updates.systemPrompt = body.systemPrompt.trim()

    // Handle apiKey update: only update if explicitly provided and not a masked string
    if (typeof body.apiKey === 'string') {
      const trimmed = body.apiKey.trim()
      if (!trimmed.includes('••••')) {
        updates.apiKey = trimmed
      }
    }

    if (typeof body.model === 'string') {
      if (!ALLOWED_MODELS.has(body.model)) {
        throw createError({ statusCode: 400, statusMessage: 'Unsupported model' })
      }
      updates.model = body.model
    }

    if (body.maxTokens !== undefined) {
      const n = Number(body.maxTokens)
      if (!Number.isFinite(n) || n < 64 || n > 4096) {
        throw createError({ statusCode: 400, statusMessage: 'maxTokens must be between 64 and 4096' })
      }
      updates.maxTokens = Math.round(n)
    }

    const settings = await db.saveAiSettings(updates)
    const envKey = (useRuntimeConfig().geminiApiKey || process.env.GEMINI_API_KEY || '').trim()
    const effectiveKey = (settings.apiKey || envKey).trim()
    const keyConfigured = !!effectiveKey
    const maskedKey = settings.apiKey
      ? settings.apiKey.length > 8
        ? `${settings.apiKey.slice(0, 4)}••••${settings.apiKey.slice(-4)}`
        : '••••••••'
      : envKey
      ? 'Configured via Environment'
      : ''

    return {
      success: true,
      settings: {
        ...settings,
        apiKey: maskedKey,
        hasCustomKey: !!settings.apiKey,
        keyConfigured
      }
    }
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || `Failed to update AI settings: ${error.message}`
    })
  }
})
