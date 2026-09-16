<script setup lang="ts">
import { ref } from 'vue'
import {
  User,
  Bot,
  Radio,
  Bell,
  Sparkles,
  ShieldAlert,
  Shield,
  Palette,
  Cpu,
  Lock,
  CheckCircle2,
  Key,
  Sun,
  Moon,
  Laptop
} from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../composables/useTheme'
import { useToast } from '../composables/useToast'

const authStore = useAuthStore()
const { theme, resolvedTheme, applyTheme } = useTheme()
const toast = useToast()

const activeTab = ref<'security' | 'appearance' | 'account' | 'system'>('security')

const twoFactorEnabled = ref(true)
const sessionCount = ref(2)
const selectedAccent = ref('telegram-blue')

const accents = [
  { id: 'telegram-blue', name: 'Telegram Blue', hex: '#2481cc' },
  { id: 'indigo', name: 'Electric Indigo', hex: '#6366f1' },
  { id: 'emerald', name: 'Emerald Green', hex: '#10b981' },
  { id: 'violet', name: 'Amethyst Violet', hex: '#8b5cf6' }
]

const saveSettings = () => {
  toast.success('Settings updated successfully')
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">System Settings</h2>
      <p class="text-xs text-slate-400 mt-1">
        Configure bot credentials, cryptographic encryption, session security, and appearance.
      </p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Sub-Navigation -->
      <div class="lg:col-span-3 tf-card p-2 space-y-1 text-xs">
        <button
          @click="activeTab = 'security'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
          :class="activeTab === 'security' ? 'bg-[#2481cc] text-white font-semibold' : 'text-slate-300 hover:bg-white/5'"
        >
          <Shield class="w-4 h-4" />
          <span>Security & Encryption</span>
        </button>

        <button
          @click="activeTab = 'appearance'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
          :class="activeTab === 'appearance' ? 'bg-[#2481cc] text-white font-semibold' : 'text-slate-300 hover:bg-white/5'"
        >
          <Palette class="w-4 h-4" />
          <span>Appearance & Theme</span>
        </button>

        <button
          @click="activeTab = 'account'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
          :class="activeTab === 'account' ? 'bg-[#2481cc] text-white font-semibold' : 'text-slate-300 hover:bg-white/5'"
        >
          <User class="w-4 h-4" />
          <span>Account Profile</span>
        </button>

        <button
          @click="activeTab = 'system'"
          class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer"
          :class="activeTab === 'system' ? 'bg-[#2481cc] text-white font-semibold' : 'text-slate-300 hover:bg-white/5'"
        >
          <Cpu class="w-4 h-4" />
          <span>Edge Runtime & Nodes</span>
        </button>
      </div>

      <!-- Right Content Panel -->
      <div class="lg:col-span-9 space-y-6">
        <!-- TAB: Security (matching prompt specification) -->
        <div v-if="activeTab === 'security'" class="tf-card p-6 space-y-6 text-xs">
          <div class="border-b border-white/5 pb-4">
            <h3 class="text-sm font-bold text-white">Security & Token Protection</h3>
            <p class="text-[11px] text-slate-400">Cryptographic protections and access control protocols.</p>
          </div>

          <div class="space-y-4">
            <!-- Bot Token status -->
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div>
                <p class="font-bold text-white">Bot Token</p>
                <p class="font-mono text-slate-400 mt-1">••••••••••••••••••••••••••••••••••••••••</p>
              </div>
              <span class="px-2.5 py-1 rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 text-[10px] font-mono font-bold">
                AES-256-CBC
              </span>
            </div>

            <!-- Encryption status -->
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div>
                <p class="font-bold text-white">Encryption Protocol</p>
                <p class="text-slate-400 text-[11px] mt-0.5">At-rest token encryption and secure storage binding</p>
              </div>
              <span class="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 class="w-4 h-4" />
                ● Enabled
              </span>
            </div>

            <!-- Sessions -->
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div>
                <p class="font-bold text-white">Active Sessions</p>
                <p class="text-slate-400 text-[11px] mt-0.5">Current dashboard authorization tokens</p>
              </div>
              <span class="text-slate-200 font-semibold">
                {{ sessionCount }} active sessions
              </span>
            </div>

            <!-- Two-Factor Authentication -->
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div>
                <p class="font-bold text-white">Two-Factor Authentication (2FA)</p>
                <p class="text-slate-400 text-[11px] mt-0.5">Enforce TOTP authenticator verification on sign in</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-emerald-400 font-bold">● Enabled</span>
              </div>
            </div>
          </div>
        </div>

        <!-- TAB: Appearance (Light / Dark / System + Accent Color) -->
        <div v-else-if="activeTab === 'appearance'" class="tf-card p-6 space-y-6 text-xs">
          <div class="border-b border-white/5 pb-4">
            <h3 class="text-sm font-bold text-white">Appearance & Color System</h3>
            <p class="text-[11px] text-slate-400">Choose your theme mode and custom interface accent colors.</p>
          </div>

          <!-- Theme Modes: ☀ Light 🌙 Dark ⚙ System -->
          <div class="space-y-3">
            <label class="block font-bold uppercase tracking-wider text-slate-400 text-[10px]">Theme Mode</label>
            <div class="grid grid-cols-3 gap-3">
              <button
                type="button"
                @click="applyTheme('light')"
                class="p-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all"
                :class="theme === 'light' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5'"
              >
                <Sun class="w-5 h-5 text-amber-400" />
                <span>☀ Light</span>
              </button>

              <button
                type="button"
                @click="applyTheme('dark')"
                class="p-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all"
                :class="theme === 'dark' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5'"
              >
                <Moon class="w-5 h-5 text-sky-400" />
                <span>🌙 Dark</span>
              </button>

              <button
                type="button"
                @click="applyTheme('system')"
                class="p-4 rounded-xl border flex flex-col items-center gap-2 cursor-pointer transition-all"
                :class="theme === 'system' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5'"
              >
                <Laptop class="w-5 h-5 text-slate-300" />
                <span>⚙ System</span>
              </button>
            </div>
          </div>

          <!-- Accent Palette -->
          <div class="space-y-3 pt-2">
            <label class="block font-bold uppercase tracking-wider text-slate-400 text-[10px]">Accent Color</label>
            <div class="flex items-center gap-3">
              <button
                v-for="acc in accents"
                :key="acc.id"
                type="button"
                @click="selectedAccent = acc.id; toast.success(`Selected accent: ${acc.name}`)"
                class="w-9 h-9 rounded-full flex items-center justify-center transition-transform cursor-pointer"
                :style="{ backgroundColor: acc.hex }"
                :class="selectedAccent === acc.id ? 'ring-4 ring-white/25 scale-110' : 'opacity-80 hover:opacity-100'"
                :title="acc.name"
              >
                <CheckCircle2 v-if="selectedAccent === acc.id" class="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>

        <!-- TAB: Account -->
        <div v-else-if="activeTab === 'account'" class="tf-card p-6 space-y-5 text-xs">
          <div class="border-b border-white/5 pb-4">
            <h3 class="text-sm font-bold text-white">Administrator Account</h3>
            <p class="text-[11px] text-slate-400">Manage login credentials and admin permissions.</p>
          </div>

          <div class="space-y-4 max-w-md">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Username</label>
              <input :value="authStore.user?.username || 'admin'" class="tf-input w-full p-2.5" disabled />
            </div>
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Role</label>
              <input value="Super Administrator" class="tf-input w-full p-2.5" disabled />
            </div>
          </div>
        </div>

        <!-- TAB: System -->
        <div v-else class="tf-card p-6 space-y-5 text-xs">
          <div class="border-b border-white/5 pb-4">
            <h3 class="text-sm font-bold text-white">System Architecture & Runtime</h3>
            <p class="text-[11px] text-slate-400">TeleFlow Pro operational specifications.</p>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-slate-400 text-[10px] uppercase font-semibold">Framework</p>
              <h4 class="text-sm font-bold text-white mt-1">Nuxt 4 + Vue 3</h4>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-slate-400 text-[10px] uppercase font-semibold">Edge Target</p>
              <h4 class="text-sm font-bold text-white mt-1">Cloudflare Workers</h4>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-slate-400 text-[10px] uppercase font-semibold">Storage Driver</p>
              <h4 class="text-sm font-bold text-white mt-1">Cloudflare KV / Local FS</h4>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-slate-400 text-[10px] uppercase font-semibold">Edition</p>
              <h4 class="text-sm font-bold text-sky-400 mt-1">v2.0.0 Pro Enterprise</h4>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

