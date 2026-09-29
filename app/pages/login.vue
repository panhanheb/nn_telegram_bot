<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import { User, Lock, Send, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-vue-next'
import ToastList from '../components/ToastList.vue'

definePageMeta({
  layout: false
})

const authStore = useAuthStore()
const toast = useToast()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const isLoading = ref(false)

const fillCredentials = (u: string, p: string) => {
  username.value = u
  password.value = p
}

const handleLogin = async () => {
  if (!username.value || !password.value) {
    toast.error('Please enter both username and password')
    return
  }

  isLoading.value = true
  try {
    await authStore.login(username.value, password.value)
    toast.success('Successfully logged in to TeleFlow Pro')
    await navigateTo('/')
  } catch (err: any) {
    const message = err.data?.statusMessage || err.data?.message || err.statusMessage || err.message || 'Authentication failed. Please check credentials.'
    toast.error(message)
  } finally {
    isLoading.value = false
  }
}
const isDev = import.meta.dev
</script>

<template>
  <div class="min-h-screen bg-[var(--tf-bg)] text-[var(--tf-text)] flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">

    <div class="relative z-10 w-full max-w-4xl tf-card-elevated overflow-hidden grid grid-cols-1 md:grid-cols-2">
      <!-- Left: Brand Panel -->
      <div class="hidden md:flex flex-col justify-between p-10 bg-[var(--tf-surface-subtle)] border-r border-[var(--tf-border)] relative">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-[#2481cc] flex items-center justify-center text-white">
            <Send class="w-4 h-4 transform rotate-[15deg] -translate-x-0.5" />
          </div>
          <div>
            <h1 class="text-sm font-semibold text-white">TeleFlow</h1>
            <p class="text-[11px] text-slate-400">Telegram bot management</p>
          </div>
        </div>

        <div class="space-y-4">
          <h2 class="text-2xl font-semibold text-white leading-snug max-w-xs">
            Run your Telegram groups from one place.
          </h2>
          <p class="text-slate-400 text-sm leading-relaxed">
            Schedule broadcasts, moderate chats and reply with AI.
          </p>

          <div class="flex items-center gap-4 text-xs text-slate-400 pt-2">
            <div class="flex items-center gap-1.5">
              <ShieldCheck class="w-4 h-4 text-slate-400" />
              <span>Encrypted bot tokens</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-[#2481cc]"></span>
              <span>Cloudflare Workers</span>
            </div>
          </div>
        </div>

        <div class="text-[11px] text-slate-500">
          &copy; {{ new Date().getFullYear() }} TeleFlow
        </div>
      </div>

      <!-- Right: Form Panel -->
      <div class="p-8 sm:p-10 flex flex-col justify-center bg-transparent">
        <!-- Mobile Logo Header -->
        <div class="flex items-center gap-3 md:hidden mb-8">
          <div class="w-8 h-8 rounded-lg bg-[#2481cc] flex items-center justify-center text-white">
            <Send class="w-3.5 h-3.5 transform rotate-[15deg] -translate-x-0.5" />
          </div>
          <div>
            <h1 class="text-sm font-semibold text-white">TeleFlow</h1>
          </div>
        </div>

        <div class="mb-6">
          <h3 class="text-xl font-semibold text-white">Sign in</h3>
          <p class="text-sm text-slate-400 mt-1">Use your administrator account.</p>
        </div>

        <form @submit.prevent="handleLogin" class="space-y-4 text-xs">
          <div>
            <label class="block font-medium text-slate-300 mb-1.5 text-xs">Username</label>
            <div class="relative">
              <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                v-model="username"
                type="text"
                placeholder="admin"
                class="tf-input w-full pl-10 pr-4 py-2.5 text-sm text-white"
                required
              />
            </div>
          </div>

          <div>
            <label class="block font-medium text-slate-300 mb-1.5 text-xs">Password</label>
            <div class="relative">
              <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                placeholder="••••••••"
                class="tf-input w-full pl-10 pr-10 py-2.5 text-sm text-white"
                required
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                tabindex="-1"
              >
                <EyeOff v-if="showPassword" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="tf-btn-primary w-full py-2.5 text-sm font-medium flex items-center justify-center gap-2 mt-2 cursor-pointer"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <template v-else>
              <span>Sign in</span>
            </template>
          </button>

          <!-- Quick credentials helper: development builds only -->
          <div v-if="isDev" class="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Dev quick login:</span>
            <div class="flex items-center gap-1.5 font-mono">
              <button
                type="button"
                @click="fillCredentials('admin', 'admin')"
                class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-sky-400 text-[10px] transition-colors border border-white/10 cursor-pointer"
              >
                admin / admin
              </button>
              <span class="text-slate-500 text-[10px]">or</span>
              <button
                type="button"
                @click="fillCredentials('admin', 'abc@123')"
                class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-sky-400 text-[10px] transition-colors border border-white/10 cursor-pointer"
              >
                abc@123
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>

    <ToastList />
  </div>
</template>
