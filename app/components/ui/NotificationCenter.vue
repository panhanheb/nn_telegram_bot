<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Send,
  Bot,
  Zap,
  Check,
  Trash2,
  X
} from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'navigate', tab: string): void
}>()

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  type: 'bot' | 'broadcast' | 'moderation' | 'api'
  read: boolean
  targetTab?: string
}

const notifications = ref<NotificationItem[]>([
  {
    id: 'n1',
    title: 'Bot connected',
    message: 'My Business Bot is now online and listening to webhook events.',
    time: '2 minutes ago',
    type: 'bot',
    read: false,
    targetTab: 'bots'
  },
  {
    id: 'n2',
    title: 'Broadcast completed',
    message: '48,291 messages successfully delivered across 12 target groups.',
    time: '45 minutes ago',
    type: 'broadcast',
    read: false,
    targetTab: 'broadcasts'
  },
  {
    id: 'n3',
    title: 'Moderation alert',
    message: '12 suspicious spam links and 3 executable attachments auto-deleted.',
    time: '2 hours ago',
    type: 'moderation',
    read: true,
    targetTab: 'moderation'
  },
  {
    id: 'n4',
    title: 'API rate-limit warning',
    message: 'Telegram API 429 threshold mitigated with automatic exponential backoff.',
    time: '5 hours ago',
    type: 'api',
    read: true,
    targetTab: 'logs'
  }
])

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)

const markAllRead = () => {
  notifications.value.forEach(n => n.read = true)
}

const clearAll = () => {
  notifications.value = []
}

const handleClick = (item: NotificationItem) => {
  item.read = true
  if (item.targetTab) {
    emit('navigate', item.targetTab)
    emit('update:open', false)
  }
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'bot': return Bot
    case 'broadcast': return Send
    case 'moderation': return AlertTriangle
    case 'api': return Zap
    default: return Bell
  }
}

const getIconColor = (type: string) => {
  switch (type) {
    case 'bot': return 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
    case 'broadcast': return 'text-[#2481cc] bg-[#2481cc]/15 border-[#2481cc]/30'
    case 'moderation': return 'text-amber-400 bg-amber-500/15 border-amber-500/30'
    case 'api': return 'text-rose-400 bg-rose-500/15 border-rose-500/30'
    default: return 'text-slate-400 bg-white/10'
  }
}
</script>

<template>
  <div v-if="open" class="relative">
    <div
      @click="emit('update:open', false)"
      class="fixed inset-0 z-40"
    ></div>

    <div class="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl shadow-md z-50 overflow-hidden text-xs">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--tf-border)] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-bold text-white">Notifications</span>
          <span
            v-if="unreadCount > 0"
            class="px-1.5 py-0.2 rounded-full bg-[#2481cc]/20 text-[#2481cc] font-semibold text-[10px]"
          >
            {{ unreadCount }} new
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="unreadCount > 0"
            @click="markAllRead"
            class="p-1 text-slate-400 hover:text-white rounded transition-colors"
            title="Mark all as read"
          >
            <Check class="w-3.5 h-3.5" />
          </button>
          <button
            v-if="notifications.length > 0"
            @click="clearAll"
            class="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
            title="Clear all"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
          <button
            @click="emit('update:open', false)"
            class="p-1 text-slate-400 hover:text-white rounded transition-colors"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Notification List -->
      <div class="max-h-96 overflow-y-auto divide-y divide-white/5 no-scrollbar">
        <div v-if="notifications.length === 0" class="py-8 text-center text-slate-400">
          No notifications yet
        </div>

        <div
          v-for="item in notifications"
          :key="item.id"
          @click="handleClick(item)"
          class="p-3 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer"
          :class="!item.read ? 'bg-white/[0.02]' : 'opacity-80'"
        >
          <div
            class="p-2 rounded-lg border shrink-0 mt-0.5"
            :class="getIconColor(item.type)"
          >
            <component :is="getNotificationIcon(item.type)" class="w-4 h-4" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-1 mb-0.5">
              <p class="font-semibold text-white truncate">{{ item.title }}</p>
              <span class="text-[10px] text-slate-400 shrink-0">{{ item.time }}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed">{{ item.message }}</p>
          </div>

          <span v-if="!item.read" class="w-2 h-2 rounded-full bg-[#2481cc] shrink-0 mt-1.5"></span>
        </div>
      </div>
    </div>
  </div>
</template>

