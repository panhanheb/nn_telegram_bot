<script setup lang="ts">
import { watch } from 'vue'
import {
  Bell,
  AlertTriangle,
  Send,
  Sparkles,
  ShieldAlert,
  Check,
  X,
  RefreshCw
} from 'lucide-vue-next'
import { useNotifications, relativeTime, type NotificationItem, type NotificationType } from '../../composables/useNotifications'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'navigate', tab: string): void
}>()

const { items, isLoading, unreadCount, isUnread, load, markAllRead } = useNotifications()

// Refresh whenever the panel is opened
watch(() => props.open, (open) => {
  if (open) load()
})

const handleClick = (item: NotificationItem) => {
  emit('navigate', item.targetTab)
  emit('update:open', false)
}

const icons: Record<NotificationType, any> = {
  broadcast: Send,
  moderation: ShieldAlert,
  ai: Sparkles,
  error: AlertTriangle,
  activity: Bell
}

const iconColors: Record<NotificationType, string> = {
  broadcast: 'text-[#2481cc] bg-[#2481cc]/10',
  moderation: 'text-amber-400 bg-amber-500/10',
  ai: 'text-violet-400 bg-violet-500/10',
  error: 'text-rose-400 bg-rose-500/10',
  activity: 'text-slate-400 bg-white/5'
}
</script>

<template>
  <div v-if="open" class="relative">
    <div
      @click="emit('update:open', false)"
      class="fixed inset-0 z-40"
    ></div>

    <div class="absolute right-0 mt-2 w-80 sm:w-96 tf-card-elevated z-50 overflow-hidden text-xs">
      <!-- Header -->
      <div class="px-4 py-3 border-b border-[var(--tf-border)] flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-white text-sm">Notifications</span>
          <span
            v-if="unreadCount > 0"
            class="px-1.5 rounded-full bg-[#2481cc]/15 text-[#2481cc] font-medium text-[10px]"
          >
            {{ unreadCount }} new
          </span>
        </div>

        <div class="flex items-center gap-1">
          <button
            @click="load"
            class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          </button>
          <button
            v-if="unreadCount > 0"
            @click="markAllRead"
            class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            title="Mark all as read"
          >
            <Check class="w-3.5 h-3.5" />
          </button>
          <button
            @click="emit('update:open', false)"
            class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 transition-colors cursor-pointer"
            title="Close"
          >
            <X class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Notification List -->
      <div class="max-h-96 overflow-y-auto divide-y divide-white/5">
        <div v-if="items.length === 0" class="py-10 text-center text-slate-400">
          {{ isLoading ? 'Loading…' : 'No activity yet' }}
        </div>

        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          @click="handleClick(item)"
          class="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer"
        >
          <div class="p-1.5 rounded-md shrink-0 mt-0.5" :class="iconColors[item.type]">
            <component :is="icons[item.type]" class="w-3.5 h-3.5" />
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <p class="font-medium text-white truncate">{{ item.title }}</p>
              <time class="text-[10px] text-slate-500 shrink-0" :datetime="item.date">{{ relativeTime(item.date) }}</time>
            </div>
            <p class="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{{ item.message }}</p>
          </div>

          <span v-if="isUnread(item)" class="w-1.5 h-1.5 rounded-full bg-[#2481cc] shrink-0 mt-2"></span>
        </button>
      </div>

      <div class="px-4 py-2.5 border-t border-[var(--tf-border)] text-center">
        <button
          type="button"
          @click="emit('navigate', 'logs'); emit('update:open', false)"
          class="text-[11px] font-medium text-[#2481cc] hover:underline cursor-pointer"
        >
          View all activity
        </button>
      </div>
    </div>
  </div>
</template>
