<script setup lang="ts">
import { ref } from 'vue'
import {
  User,
  Shield,
  Palette,
  Cpu,
  CheckCircle2,
  Sun,
  Moon,
  Laptop
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useTheme, type ThemeMode } from '../composables/useTheme'

const authStore = useAuthStore()
const { theme, applyTheme } = useTheme()

type SettingsTab = 'security' | 'appearance' | 'account' | 'system'
const activeTab = ref<SettingsTab>('security')

const tabs: Array<{ id: SettingsTab; label: string; icon: any }> = [
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account', label: 'Account', icon: User },
  { id: 'system', label: 'System', icon: Cpu }
]

const themeOptions: Array<{ id: ThemeMode; label: string; icon: any }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Laptop }
]

// Facts about how this deployment protects data (see server/utils/crypto.ts,
// server/utils/session.ts and the webhook handler).
const securityFacts = [
  {
    title: 'Bot token encryption',
    detail: 'Bot tokens are stored encrypted with AES-256-CBC and a random IV per token.',
    value: 'AES-256-CBC'
  },
  {
    title: 'Password storage',
    detail: 'Administrator passwords are stored as salted SHA-256 hashes.',
    value: 'Hashed'
  },
  {
    title: 'Session cookie',
    detail: 'Dashboard sessions use an HttpOnly, SameSite=Lax cookie (Secure over HTTPS).',
    value: 'HttpOnly'
  },
  {
    title: 'Webhook verification',
    detail: 'Webhook requests that send a wrong secret token are rejected.',
    value: 'Secret token'
  }
]

const systemFacts = [
  { label: 'Framework', value: 'Nuxt 4 · Vue 3' },
  { label: 'Runtime', value: 'Cloudflare Workers' },
  { label: 'Storage', value: 'Cloudflare KV (local JSON in development)' },
  { label: 'Version', value: '2.0.0' }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl font-semibold text-white">Settings</h2>
      <p class="text-sm text-slate-400 mt-1">Security, appearance and account details.</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Sub-navigation -->
      <nav class="lg:col-span-3 tf-card p-1.5 space-y-0.5 text-[13px]">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors cursor-pointer font-medium"
          :class="activeTab === tab.id ? 'bg-[var(--tf-primary-soft)] text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'"
        >
          <component :is="tab.icon" class="w-4 h-4" :class="activeTab === tab.id ? 'text-[#2481cc]' : ''" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Content -->
      <div class="lg:col-span-9">
        <!-- Security -->
        <section v-if="activeTab === 'security'" class="tf-card">
          <header class="px-6 py-4 border-b border-white/5">
            <h3 class="text-sm font-semibold text-white">Security</h3>
            <p class="text-xs text-slate-400 mt-0.5">How this deployment protects credentials and traffic.</p>
          </header>
          <ul class="divide-y divide-white/5">
            <li v-for="fact in securityFacts" :key="fact.title" class="px-6 py-4 flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-sm font-medium text-white">{{ fact.title }}</p>
                <p class="text-xs text-slate-400 mt-0.5">{{ fact.detail }}</p>
              </div>
              <span class="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                <CheckCircle2 class="w-3.5 h-3.5" />
                {{ fact.value }}
              </span>
            </li>
          </ul>
        </section>

        <!-- Appearance -->
        <section v-else-if="activeTab === 'appearance'" class="tf-card">
          <header class="px-6 py-4 border-b border-white/5">
            <h3 class="text-sm font-semibold text-white">Appearance</h3>
            <p class="text-xs text-slate-400 mt-0.5">Choose a theme. "System" follows your device setting.</p>
          </header>
          <div class="p-6">
            <div class="grid grid-cols-3 gap-3 max-w-md">
              <button
                v-for="opt in themeOptions"
                :key="opt.id"
                type="button"
                @click="applyTheme(opt.id)"
                class="p-4 rounded-lg border flex flex-col items-center gap-2 text-xs font-medium cursor-pointer transition-colors"
                :class="theme === opt.id
                  ? 'border-[#2481cc] bg-[var(--tf-primary-soft)] text-white'
                  : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'"
              >
                <component :is="opt.icon" class="w-5 h-5" />
                <span>{{ opt.label }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Account -->
        <section v-else-if="activeTab === 'account'" class="tf-card">
          <header class="px-6 py-4 border-b border-white/5">
            <h3 class="text-sm font-semibold text-white">Account</h3>
            <p class="text-xs text-slate-400 mt-0.5">The administrator you are signed in as.</p>
          </header>
          <div class="p-6 space-y-4 max-w-md text-xs">
            <div>
              <label class="block font-medium text-slate-300 mb-1.5">Username</label>
              <input :value="authStore.user?.username || ''" class="tf-input w-full px-3 py-2" disabled />
            </div>
            <div>
              <label class="block font-medium text-slate-300 mb-1.5">Role</label>
              <input value="Administrator" class="tf-input w-full px-3 py-2" disabled />
            </div>
          </div>
        </section>

        <!-- System -->
        <section v-else class="tf-card">
          <header class="px-6 py-4 border-b border-white/5">
            <h3 class="text-sm font-semibold text-white">System</h3>
            <p class="text-xs text-slate-400 mt-0.5">Runtime and build information.</p>
          </header>
          <dl class="divide-y divide-white/5">
            <div v-for="fact in systemFacts" :key="fact.label" class="px-6 py-3.5 flex items-center justify-between gap-4 text-sm">
              <dt class="text-slate-400">{{ fact.label }}</dt>
              <dd class="text-white font-medium text-right">{{ fact.value }}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>
