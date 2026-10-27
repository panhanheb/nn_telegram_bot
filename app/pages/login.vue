<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useToast } from '../composables/useToast'
import {
  User,
  Lock,
  Send,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Server,
  Cloud
} from 'lucide-vue-next'
import ToastList from '../components/ToastList.vue'

definePageMeta({
  layout: false
})

const authStore = useAuthStore()
const toast = useToast()

const isSetupMode = ref(false)
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const isLoading = ref(false)

onMounted(async () => {
  isLoading.value = true
  try {
    const needed = await authStore.checkSetupStatus()
    isSetupMode.value = needed
  } finally {
    isLoading.value = false
  }
})

const handleAuth = async () => {
  if (!username.value.trim() || !password.value) {
    toast.error('Please fill in all required fields')
    return
  }

  if (isSetupMode.value) {
    if (password.value.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }
    if (password.value !== confirmPassword.value) {
      toast.error('Passwords do not match')
      return
    }

    isLoading.value = true
    try {
      await authStore.setupOwner(username.value, password.value)
      toast.success('Owner account successfully created! Welcome to TeleFlow.')
      await navigateTo('/')
    } catch (err: any) {
      const message = err.data?.statusMessage || err.statusMessage || err.message || 'Setup failed'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  } else {
    isLoading.value = true
    try {
      await authStore.login(username.value, password.value)
      toast.success('Signed in successfully')
      await navigateTo('/')
    } catch (err: any) {
      const message = err.data?.statusMessage || err.statusMessage || err.message || 'Authentication failed'
      toast.error(message)
    } finally {
      isLoading.value = false
    }
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#0e1621] text-[#f5f5f5] flex items-center justify-center p-4 font-sans select-none relative overflow-hidden">
    <!-- Telegram Subtle Ambient Glow -->
    <div class="absolute -top-40 -left-40 w-96 h-96 bg-[#2481cc]/15 rounded-full blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 bg-[#2b5278]/20 rounded-full blur-3xl pointer-events-none"></div>

    <div class="relative z-10 w-full max-w-[440px] bg-[#17212b] border border-[#242f3d] rounded-2xl shadow-2xl p-8 sm:p-10 flex flex-col items-center">
      <!-- Telegram Animated Paper Plane Icon -->
      <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-[#2481cc] to-[#2AABEE] shadow-lg shadow-[#2481cc]/25 flex items-center justify-center text-white mb-6 transform hover:scale-105 transition-transform duration-300">
        <Send class="w-12 h-12 transform rotate-12 -translate-x-1" />
      </div>

      <!-- Header Titles -->
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-white mb-2 flex items-center justify-center gap-2">
          <span>TeleFlow</span>
          <span class="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#2481cc]/20 text-[#2AABEE] border border-[#2481cc]/30">
            Bot API 10.3
          </span>
        </h1>
        <p class="text-sm text-[#7f91a4] leading-relaxed">
          <template v-if="isSetupMode">
            Initialize your primary Owner account to get started
          </template>
          <template v-else>
            Sign in to your Telegram bot management workspace
          </template>
        </p>
      </div>

      <!-- Setup Notice Banner -->
      <div v-if="isSetupMode" class="w-full mb-6 p-3.5 rounded-xl bg-[#2481cc]/10 border border-[#2481cc]/30 flex items-start gap-3 text-xs text-[#a2d2fb]">
        <Sparkles class="w-4 h-4 text-[#2AABEE] mt-0.5 shrink-0" />
        <p class="leading-relaxed">
          <strong>First-Time Setup:</strong> No administrator exists yet. The credentials created here will hold permanent <strong>Owner</strong> privileges.
        </p>
      </div>

      <!-- Auth Form -->
      <form @submit.prevent="handleAuth" class="w-full space-y-4">
        <div>
          <label class="block text-xs font-medium text-[#7f91a4] mb-1.5 ml-1">Username</label>
          <div class="relative">
            <User class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7f91a4] pointer-events-none" />
            <input
              v-model="username"
              type="text"
              placeholder="admin"
              class="w-full pl-10 pr-4 py-2.5 bg-[#0e1621] border border-[#242f3d] rounded-xl text-sm text-white placeholder-[#4e5d6d] focus:outline-none focus:border-[#2481cc] focus:ring-2 focus:ring-[#2481cc]/25 transition-all"
              required
              autocomplete="username"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-[#7f91a4] mb-1.5 ml-1">Password</label>
          <div class="relative">
            <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7f91a4] pointer-events-none" />
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••••••"
              class="w-full pl-10 pr-10 py-2.5 bg-[#0e1621] border border-[#242f3d] rounded-xl text-sm text-white placeholder-[#4e5d6d] focus:outline-none focus:border-[#2481cc] focus:ring-2 focus:ring-[#2481cc]/25 transition-all"
              required
              :autocomplete="isSetupMode ? 'new-password' : 'current-password'"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#7f91a4] hover:text-white transition-colors"
              tabindex="-1"
            >
              <EyeOff v-if="showPassword" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="isSetupMode" class="text-[11px] text-[#7f91a4] mt-1 ml-1">Must be at least 8 characters</p>
        </div>

        <div v-if="isSetupMode">
          <label class="block text-xs font-medium text-[#7f91a4] mb-1.5 ml-1">Confirm Password</label>
          <div class="relative">
            <Lock class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7f91a4] pointer-events-none" />
            <input
              v-model="confirmPassword"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••••••"
              class="w-full pl-10 pr-4 py-2.5 bg-[#0e1621] border border-[#242f3d] rounded-xl text-sm text-white placeholder-[#4e5d6d] focus:outline-none focus:border-[#2481cc] focus:ring-2 focus:ring-[#2481cc]/25 transition-all"
              required
              autocomplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full py-3 bg-[#2481cc] hover:bg-[#1f72b5] active:bg-[#1b629b] text-white font-medium text-sm rounded-xl flex items-center justify-center gap-2 mt-6 transition-all duration-200 shadow-md shadow-[#2481cc]/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
          <template v-else>
            <ShieldCheck class="w-4 h-4" />
            <span>{{ isSetupMode ? 'Complete Setup' : 'Sign In' }}</span>
          </template>
        </button>
      </form>

      <!-- Platform Badges Footer -->
      <div class="mt-8 pt-6 border-t border-[#242f3d] w-full flex items-center justify-center gap-6 text-xs text-[#7f91a4]">
        <div class="flex items-center gap-1.5">
          <Cloud class="w-3.5 h-3.5 text-[#2AABEE]" />
          <span>Cloudflare Workers</span>
        </div>
        <div class="w-1 h-1 rounded-full bg-[#242f3d]"></div>
        <div class="flex items-center gap-1.5">
          <Server class="w-3.5 h-3.5 text-[#2AABEE]" />
          <span>Docker</span>
        </div>
      </div>
    </div>

    <ToastList />
  </div>
</template>
