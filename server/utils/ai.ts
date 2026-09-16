import type { AiSettings } from './db'

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
    finishReason?: string
  }>
  promptFeedback?: { blockReason?: string }
}

/**
 * Generate an AI reply with Google Gemini for a group chat message that
 * mentioned the bot. Returns the reply text, or null if generation fails or is
 * blocked. A short amount of prior chat context is passed for coherence.
 */
export async function generateAiReply(opts: {
  apiKey: string
  settings: AiSettings
  userText: string
  userName: string
  history?: Array<{ role: 'user' | 'assistant'; text: string }>
}): Promise<string | null> {
  const { apiKey, settings } = opts
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  // Gemini uses role "model" for the assistant side.
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = []
  for (const turn of opts.history || []) {
    if (!turn.text.trim()) continue
    contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.text }] })
  }
  contents.push({ role: 'user', parts: [{ text: `${opts.userName}: ${opts.userText}` }] })

  let model = settings.model || 'gemini-1.5-flash'
  if (model === 'gemini-flash-latest') model = 'gemini-1.5-flash'
  if (model === 'gemini-flash-lite-latest') model = 'gemini-1.5-flash-8b'
  if (model === 'gemini-pro-latest') model = 'gemini-1.5-pro'

  const body: Record<string, any> = {
    contents,
    generationConfig: {
      maxOutputTokens: settings.maxTokens || 600
    }
  }
  if (settings.systemPrompt?.trim()) {
    body.systemInstruction = { parts: [{ text: settings.systemPrompt }] }
  }

  const response = await $fetch<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body
    }
  )

  if (response.promptFeedback?.blockReason) {
    return "Sorry, I can't help with that one."
  }

  const parts = response.candidates?.[0]?.content?.parts || []
  const text = parts
    .map(p => p.text || '')
    .join('\n')
    .trim()

  return text || null
}
