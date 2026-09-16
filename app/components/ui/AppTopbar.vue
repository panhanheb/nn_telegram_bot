<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  Laptop,
  HelpCircle,
  User,
  LogOut,
  CheckCircle2,
  ChevronDown,
  Bot
} from 'lucide-vue-next'
import { useBotStore } from '../../stores/bot'
import { useAuthStore } from '../../stores/auth'
import { useTheme, type ThemeMode } from '../../composables/useTheme'

const props = defineProps<{
  activeTab: string
  unreadNotificationCount?: number
}>()

const emit = defineEmits<{
  (e: 'toggle-mobile-sidebar'): void
  (e: 'open-search'): void
  (e: 'toggle-notifications'): void
  (e: 'open-help'): void
  (e: 'navigate', tab: string): void
}>()

const botStore = useBotStore()
const authStore = useAuthStore()
const { theme, resolvedTheme, applyTheme } = useTheme()

const showUserMenu = ref(false)
const showThemeMenu = ref(false)

const tabTitles: Record<string, { title: string; section: string }> = {
  overview: { title: 'Overview', section: 'Dashboard' },
  bots: { title: 'Telegram Bots', section: 'Bot Management' },
  groups: { title: 'Groups & Channels', section: 'Bot Management' },
  channels: { title: 'Channels', section: 'Bot Management' },
  chat: { title: 'Live Chat', section: 'Messaging' },
  broadcasts: { title: 'Broadcast Center', section: 'Messaging' },
  schedules: { title: 'Scheduler', section: 'Messaging' },
  ai: { title: 'AI Assistant', section: 'Automation' },
  moderation: { title: 'Moderation Center', section: 'Automation' },
  analytics: { title: 'Analytics', section: 'Insights' },
  logs: { title: 'Activity Logs', section: 'Insights' },
  settings: { title: 'System Settings', section: 'System' },
  members: { title: 'Members Directory', section: 'Community' }
}

const currentView = computed(() => tabTitles[props.activeTab] || { title: 'Dashboard', section: 'TeleFlow Pro' })
</script>

<template>
  <header class="h-16 px-4 sm:px-6 border-b flex items-center justify-between bg-[var(--tf-card)] backdrop-blur-2xl border-[var(--tf-border)] sticky top-0 z-30 select-none shadow-[0_4px_24px_rgba(0,0,0,0.08)]">
    <!-- Left: Mobile menu button + Title/Breadcrumb -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        @click="emit('toggle-mobile-sidebar')"
        class="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        title="Open navigation menu"
      >
        <Menu class="w-5 h-5" />
      </button>

      <div class="flex items-center gap-2">
        <span class="text-xs text-slate-400 hidden sm:inline">{{ currentView.section }}</span>
        <span class="text-xs text-slate-500 hidden sm:inline">/</span>
        <h1 class="text-sm font-bold text-white tracking-tight">{{ currentView.title }}</h1>
      </div>
    </div>

    <!-- Center: Quick search button -->
    <div class="hidden md:flex items-center max-w-sm w-full mx-4">
      <button
        type="button"
        @click="emit('open-search')"
        class="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-400 bg-white/[0.04] backdrop-blur-md border border-white/10 hover:border-white/20 hover:text-slate-200 transition-all cursor-pointer"
      >
        <div class="flex items-center gap-2">
          <Search class="w-3.5 h-3.5" />
          <span>Search bots, groups, actions...</span>
        </div>
        <kbd class="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/10 text-slate-300 border border-white/10">
          ⌘K
        </kbd>
      </button>
    </div>

    <!-- Right: Actions & Profile -->
    <div class="flex items-center gap-2 sm:gap-3">
      <!-- Mobile Search Icon -->
      <button
        type="button"
        @click="emit('open-search')"
        class="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        title="Search"
      >
        <Search class="w-4 h-4" />
      </button>

      <!-- Bot Live Status Pill -->
      <div
        v-if="botStore.bot"
        @click="emit('navigate', 'bots')"
        class="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-colors"
        :class="botStore.isOnline
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
          : 'bg-slate-800 text-slate-400 border-white/10 hover:bg-slate-700'"
        :title="`Bot: @${botStore.bot.username} (${botStore.bot.status})`"
      >
        <span class="relative flex h-2 w-2">
          <span v-if="botStore.isOnline" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2" :class="botStore.isOnline ? 'bg-emerald-500' : 'bg-slate-500'"></span>
        </span>
        <span class="font-medium text-[11px] truncate max-w-[120px]">
          @{{ botStore.bot.username }}
        </span>
      </div>

      <!-- Notification Bell -->
      <button
        type="button"
        @click="emit('toggle-notifications')"
        class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell class="w-4 h-4" />
        <span
          v-if="unreadNotificationCount && unreadNotificationCount > 0"
          class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#2481cc] ring-2 ring-[var(--tf-card)]"
        ></span>
      </button>

      <!-- Help Button -->
      <button
        type="button"
        @click="emit('open-help')"
        class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        title="Help & Documentation"
      >
        <HelpCircle class="w-4 h-4" />
      </button>

      <!-- Theme Switcher Menu -->
      <div class="relative">
        <button
          type="button"
          @click="showThemeMenu = !showThemeMenu; showUserMenu = false"
          class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          :title="`Theme: ${theme}`"
        >
          <Sun v-if="resolvedTheme === 'light'" class="w-4 h-4 text-amber-400" />
          <Moon v-else class="w-4 h-4 text-sky-400" />
        </button>

        <div
          v-if="showThemeMenu"
          @click.outside="showThemeMenu = false"
          class="absolute right-0 mt-2 w-36 py-1 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl shadow-md z-50 text-xs text-slate-200"
        >
          <button
            @click="applyTheme('light'); showThemeMenu = false"
            class="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
            :class="theme === 'light' ? 'text-[#2481cc] font-semibold' : ''"
          >
            <Sun class="w-3.5 h-3.5" />
            <span>Light</span>
          </button>
          <button
            @click="applyTheme('dark'); showThemeMenu = false"
            class="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
            :class="theme === 'dark' ? 'text-[#2481cc] font-semibold' : ''"
          >
            <Moon class="w-3.5 h-3.5" />
            <span>Dark</span>
          </button>
          <button
            @click="applyTheme('system'); showThemeMenu = false"
            class="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
            :class="theme === 'system' ? 'text-[#2481cc] font-semibold' : ''"
          >
            <Laptop class="w-3.5 h-3.5" />
            <span>System</span>
          </button>
        </div>
      </div>

      <!-- User Profile Dropdown -->
      <div class="relative">
        <button
          type="button"
          @click="showUserMenu = !showUserMenu; showThemeMenu = false"
          class="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer border border-transparent hover:border-white/10"
        >
          <div class="w-7 h-7 rounded-full bg-[#2481cc]/20 border border-[#2481cc]/40 text-[#2481cc] flex items-center justify-center font-bold text-xs">
            {{ (authStore.user?.username || 'A')[0]?.toUpperCase() }}
          </div>
          <span class="text-xs font-semibold hidden md:inline truncate max-w-[90px]">
            {{ authStore.user?.username || 'Admin' }}
          </span>
          <ChevronDown class="w-3 h-3 text-slate-400 hidden md:inline" />
        </button>

        <div
          v-if="showUserMenu"
          @click.outside="showUserMenu = false"
          class="absolute right-0 mt-2 w-48 py-1 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl shadow-md z-50 text-xs text-slate-200"
        >
          <div class="px-3 py-2 border-b border-white/5">
            <p class="font-semibold text-white truncate">{{ authStore.user?.username || 'Administrator' }}</p>
            <p class="text-[10px] text-slate-400 font-mono">Super Admin</p>
          </div>

          <button
            @click="emit('navigate', 'settings'); showUserMenu = false"
            class="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <User class="w-3.5 h-3.5 text-slate-400" />
            <span>Account Settings</span>
          </button>

          <button
            @click="authStore.logout(); showUserMenu = false"
            class="w-full px-3 py-2 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer border-t border-white/5"
          >
            <LogOut class="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

