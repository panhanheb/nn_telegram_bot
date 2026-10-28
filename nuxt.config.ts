// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  // Apply the saved theme before first paint to avoid a flash of dark mode
  app: {
    head: {
      title: 'TeleFlow — Bot Management',
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap' }
      ],
      script: [
        {
          innerHTML:
            "try{if(localStorage.getItem('teleflow-theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}",
          tagPosition: 'head'
        }
      ]
    }
  },

  // Enable Nuxt 4 directory structure and features
  future: {
    compatibilityVersion: 4
  },

  // Modules
  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vueuse/nuxt'
  ],

  // Use our stylesheet (Tailwind directives + theme overrides) as the entry
  tailwindcss: {
    cssPath: '~/assets/css/main.css'
  },

  // Server-side configs (runtimeConfig)
  // On Cloudflare set these as NUXT_* vars (e.g. NUXT_ENCRYPTION_KEY)
  runtimeConfig: {
    encryptionKey: process.env.ENCRYPTION_KEY || '',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramGroupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '',
    // Shared secret used to authenticate Telegram webhook calls
    webhookSecret: process.env.WEBHOOK_SECRET || '',
    // Public base URL of the deployment, used to register the webhook
    publicUrl: process.env.PUBLIC_URL || '',
    // Google Gemini API key powering the AI auto-reply (set as NUXT_GEMINI_API_KEY on Cloudflare)
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },

  // Nitro engine configuration (Cloudflare Workers or Docker/Node via NITRO_PRESET)
  nitro: {
    preset: process.env.NITRO_PRESET || 'cloudflare-module',

    // Enable Nitro tasks + map the every-minute Cloudflare cron trigger to them
    experimental: { tasks: true },
    scheduledTasks: {
      '* * * * *': ['broadcast']
    },

    // Production storage -> Cloudflare KV binding (no filesystem on Workers)
    storage: {
      data: { driver: 'cloudflareKVBinding', binding: 'DATA' }
    },
    // Local dev keeps using the existing data/*.json files
    devStorage: {
      data: { driver: 'fs', base: './data' }
    },

    // Exclude Node-only packages from the Workers bundle.
    // better-sqlite3 uses native bindings + fs APIs that don't exist in
    // Cloudflare Workers (unenv). Bundling them triggers error 10021.
    externals: {
      external: ['better-sqlite3', 'drizzle-orm/better-sqlite3']
    },
    rollupConfig: {
      external: ['better-sqlite3', 'drizzle-orm/better-sqlite3'],
      // Replace sqlite-repository with a no-op stub so Rollup never
      // bundles the real implementation (which calls fs.mkdirSync).
      // This is the only reliable way to prevent Cloudflare error 10021.
      plugins: [
        {
          name: 'cf-workers-sqlite-stub',
          resolveId(id: string) {
            if (id.includes('sqlite-repository')) {
              return '\0cf-sqlite-stub'
            }
            return null
          },
          load(id: string) {
            if (id === '\0cf-sqlite-stub') {
              // Minimal stub — same exports as sqlite-repository.ts but no
              // filesystem access. Workers always use D1; this code is never
              // actually called at runtime on Workers.
              return `
export class SqliteStorageRepository {
  constructor() {}
  async initialize() { throw new Error('[Workers] SQLite unavailable; configure D1') }
  async getAllGroups() { return [] }
  async getGroup() { return null }
  async upsertGroup() {}
  async deleteGroup() {}
  async getBotSettings() { return null }
  async setBotSettings() {}
  async getAllSchedules() { return [] }
  async getSchedule() { return null }
  async upsertSchedule() {}
  async deleteSchedule() {}
  async getLogs() { return [] }
  async addLog() {}
  async isUpdateProcessed() { return false }
  async markUpdateProcessed() {}
  async claimScheduleRun() { return false }
  async getAllUsers() { return [] }
  async getUser() { return null }
  async upsertUser() {}
  async deleteUser() {}
  async getAuditEntries() { return [] }
  async createAuditEntry(e) { return e }
}
`
            }
            return null
          }
        }
      ]
    }
  },

  // Pinia setup
  pinia: {
    storesDirs: ['./app/stores/**']
  }
})
