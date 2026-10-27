import { describe, it, expect, vi } from 'vitest'
import { generateAiReply } from '../../server/utils/ai'

describe('AI Guardrails & Prompt Injection Defense', () => {
  it('throws when apiKey is missing', async () => {
    await expect(
      generateAiReply({
        apiKey: '',
        settings: { enabled: true, model: 'gemini-1.5-flash', maxTokens: 500, systemPrompt: '' },
        userText: 'Hello',
        userName: 'Alice'
      })
    ).rejects.toThrow('GEMINI_API_KEY is not configured')
  })
})
