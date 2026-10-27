import { describe, it, expect, vi } from 'vitest'
import { telegramQueue } from '../../server/utils/telegram-queue'

describe('Telegram Outgoing Queue', () => {
  it('enqueues and executes tasks asynchronously', async () => {
    const fn = vi.fn().mockResolvedValue({ message_id: 42 })
    const result = await telegramQueue.enqueue('-100123456', fn)

    expect(fn).toHaveBeenCalled()
    expect(result).toEqual({ message_id: 42 })
  })

  it('handles and propagates errors if task rejects', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'))

    await expect(telegramQueue.enqueue('12345678', fn)).rejects.toThrow('Network error')
  })
})
