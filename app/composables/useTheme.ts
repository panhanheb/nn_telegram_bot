import { ref } from 'vue'

export type ThemeMode = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'teleflow-theme'
const currentTheme = ref<ThemeMode>('dark')
const resolvedTheme = ref<'dark' | 'light'>('dark')

let mediaQueryListenerAttached = false

function updateSystemTheme() {
  if (!import.meta.client) return
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const active = currentTheme.value === 'system' ? (prefersDark ? 'dark' : 'light') : currentTheme.value
  resolvedTheme.value = active
  document.documentElement.classList.toggle('theme-light', active === 'light')
  document.documentElement.classList.toggle('dark', active === 'dark')
}

export function useTheme() {
  const applyTheme = (mode: ThemeMode) => {
    currentTheme.value = mode
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, mode)
      } catch {}
      updateSystemTheme()
    }
  }

  const init = () => {
    if (!import.meta.client) return
    let saved: ThemeMode | null = null
    try {
      saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null
    } catch {}
    currentTheme.value = saved || 'dark'

    if (!mediaQueryListenerAttached && typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', () => {
        if (currentTheme.value === 'system') {
          updateSystemTheme()
        }
      })
      mediaQueryListenerAttached = true
    }

    updateSystemTheme()
  }

  const toggle = () => {
    const next: ThemeMode = currentTheme.value === 'dark' ? 'light' : currentTheme.value === 'light' ? 'system' : 'dark'
    applyTheme(next)
  }

  return {
    theme: currentTheme,
    resolvedTheme,
    init,
    toggle,
    applyTheme
  }
}
