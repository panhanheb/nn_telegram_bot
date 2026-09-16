import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
}

const toasts = ref<Toast[]>([])
let nextId = 0

export function useToast() {
  const addToast = (message: string, type: Toast['type'] = 'success', duration = 4000) => {
    const id = nextId++
    toasts.value.push({ id, message, type, duration })

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }

  const removeToast = (id: number) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    addToast,
    removeToast,
    success: (msg: string, dur?: number) => addToast(msg, 'success', dur),
    error: (msg: string, dur?: number) => addToast(msg, 'error', dur),
    info: (msg: string, dur?: number) => addToast(msg, 'info', dur),
    warning: (msg: string, dur?: number) => addToast(msg, 'warning', dur)
  }
}
