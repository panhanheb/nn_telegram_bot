import { db } from '../../utils/db'

export default defineEventHandler(async () => {
  try {
    const settings = await db.getAiSettings()
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
      ...settings,
      apiKey: maskedKey,
      hasCustomKey: !!settings.apiKey,
      keyConfigured
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to fetch AI settings: ${error.message}`
    })
  }
})
