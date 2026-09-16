// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },

  // Apply the saved theme before first paint to avoid a flash of dark mode
  app: {
    head: {
      title: 'TeleFlow — Bot Management',
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' }
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
    encryptionKey: process.env.ENCRYPTION_KEY || 'teleflow-ultra-secure-secret-encryption-key-32b',
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramGroupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '',
    // Shared secret used to authenticate Telegram webhook calls
    webhookSecret: process.env.WEBHOOK_SECRET || 'teleflow-webhook-secret',
    // Public base URL of the deployment, used to register the webhook
    publicUrl: process.env.PUBLIC_URL || '',
    // Google Gemini API key powering the AI auto-reply (set as NUXT_GEMINI_API_KEY on Cloudflare)
    geminiApiKey: process.env.GEMINI_API_KEY || ''
  },

  // Cloudflare Workers target
  nitro: {
    preset: 'cloudflare-module',

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
    }
  },

  // Pinia setup
  pinia: {
    storesDirs: ['./app/stores/**']
  }
})
