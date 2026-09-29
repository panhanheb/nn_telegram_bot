<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X,
  Bot,
  ExternalLink,
  Send,
  Copy,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ChevronRight
} from 'lucide-vue-next'
import { useBotStore, type BotInfo } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  open: boolean
  bot: BotInfo | null
  stats?: {
    messagesSent: number
    failedDeliveries: number
    successRate: number
    totalLogs: number
    sentToday: number
  } | null
  lastActivityAt?: string | null
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'navigate', tab: string): void
}>()

const botStore = useBotStore()
const groupsStore = useGroupsStore()
const toast = useToast()

type TabId = 'overview' | 'test'
const activeTab = ref<TabId>('overview')
const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'test', label: 'Send test message' }
]

// Shortcuts to the dashboard modules that operate through this bot
const shortcuts = [
  { tab: 'groups', label: 'Groups & channels' },
  { tab: 'chat', label: 'Messages' },
  { tab: 'members', label: 'Members' },
  { tab: 'broadcasts', label: 'Broadcasts' },
  { tab: 'schedules', label: 'Schedules' },
  { tab: 'ai', label: 'AI assistant' },
  { tab: 'moderation', label: 'Moderation' },
  { tab: 'logs', label: 'Delivery logs' },
  { tab: 'settings', label: 'Settings' }
]

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    activeTab.value = 'overview'
    if (groupsStore.groups.length === 0 && !groupsStore.isLoading) {
      groupsStore.fetchGroups()
    }
  }
)

const statusBadge = computed(() => {
  if (!props.bot) return null
  if (!props.bot.active) {
    return { label: 'Disabled', class: 'text-amber-400 bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400' }
  }
  if (props.bot.status === 'ONLINE') {
    return { label: 'Online', class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400' }
  }
  return { label: 'Offline', class: 'text-slate-400 bg-white/5 border-white/10', dot: 'bg-slate-400' }
})

const permissionList = computed(() => {
  const p = props.bot?.permissions
  return [
    { label: 'Can join groups', enabled: !!p?.can_join_groups },
    { label: 'Reads all group messages', enabled: !!p?.can_read_all_group_messages },
    { label: 'Supports inline queries', enabled: !!p?.supports_inline_queries }
  ]
})

const activeGroupsCount = computed(() => groupsStore.groups.filter(g => g.isActive).length)

const formatNumber = (n: number) => n.toLocaleString()

const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Test message dispatcher
const testChatId = ref('')
const testMessage = ref('')
const isSendingTest = ref(false)

const handleSendTest = async () => {
  if (!testChatId.value) {
    toast.error('Select a destination')
    return
  }
  if (!testMessage.value.trim()) {
    toast.error('Message cannot be empty')
    return
  }

  isSendingTest.value = true
  try {
    const res = await botStore.testMessage(testChatId.value, testMessage.value.trim())
    if (res.success) {
      toast.success('Test message delivered')
      testMessage.value = ''
    }
  } catch (err: any) {
    toast.error(err.data?.statusMessage || err.statusMessage || 'Failed to send test message')
  } finally {
    isSendingTest.value = false
  }
}

const copyUsername = async () => {
  if (!props.bot?.username) return
  try {
    await navigator.clipboard.writeText(`@${props.bot.username}`)
    toast.success('Username copied')
  } catch {
    toast.error('Could not copy to clipboard')
  }
}

const goTo = (tab: string) => {
  emit('navigate', tab)
  emit('update:open', false)
}
</script>

<template>
  <div v-if="open && bot" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div @click="emit('update:open', false)" class="fixed inset-0 bg-slate-950/70"></div>

    <div class="relative w-full max-w-2xl tf-card-elevated z-10 max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Header -->
      <div class="p-5 border-b border-[var(--tf-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-11 h-11 rounded-lg bg-[#2481cc]/15 border border-[#2481cc]/30 text-[#2481cc] flex items-center justify-center shrink-0">
            <Bot class="w-5 h-5" />
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base font-semibold text-white truncate">
                {{ bot.firstName || bot.username }}
              </h3>
              <span
                v-if="statusBadge"
                class="px-2 py-0.5 rounded-md text-[11px] font-medium flex items-center gap-1.5 border"
                :class="statusBadge.class"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="statusBadge.dot"></span>
                {{ statusBadge.label }}
              </span>
            </div>

            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-xs text-slate-400 font-mono">@{{ bot.username }}</span>
              <button
                type="button"
                @click="copyUsername"
                class="text-slate-400 hover:text-white transition-colors"
                title="Copy username"
                aria-label="Copy username"
              >
                <Copy class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a
            :href="`https://t.me/${bot.username}`"
            target="_blank"
            rel="noopener"
            class="tf-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <span>Open in Telegram</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            @click="emit('update:open', false)"
            class="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex items-center px-5 border-b border-[var(--tf-border)] overflow-x-auto no-scrollbar gap-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          @click="activeTab = tab.id"
          class="px-3 py-2.5 text-xs border-b-2 transition-colors whitespace-nowrap cursor-pointer"
          :class="activeTab === tab.id
            ? 'border-[#2481cc] text-white font-semibold'
            : 'border-transparent text-slate-400 hover:text-slate-200 font-medium'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
        <!-- Overview -->
        <div v-if="activeTab === 'overview'" class="space-y-5">
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div class="p-3.5 rounded-lg bg-white/[0.02] border border-white/5">
              <p class="text-[11px] text-slate-400">Groups & channels</p>
              <p class="text-xl font-semibold text-white mt-1 tabular-nums">
                {{ formatNumber(groupsStore.groups.length) }}
              </p>
              <p class="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {{ formatNumber(activeGroupsCount) }} active
              </p>
            </div>
            <div class="p-3.5 rounded-lg bg-white/[0.02] border border-white/5">
              <p class="text-[11px] text-slate-400">Messages delivered</p>
              <p class="text-xl font-semibold text-white mt-1 tabular-nums">
                {{ stats ? formatNumber(stats.messagesSent) : '—' }}
              </p>
              <p v-if="stats" class="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                {{ formatNumber(stats.sentToday) }} today
              </p>
            </div>
            <div class="p-3.5 rounded-lg bg-white/[0.02] border border-white/5 col-span-2 sm:col-span-1">
              <p class="text-[11px] text-slate-400">Delivery success</p>
              <p class="text-xl font-semibold text-white mt-1 tabular-nums">
                {{ stats && stats.totalLogs > 0 ? `${stats.successRate}%` : '—' }}
              </p>
              <p v-if="stats" class="text-[11px] mt-0.5 tabular-nums" :class="stats.failedDeliveries > 0 ? 'text-rose-400' : 'text-slate-400'">
                {{ formatNumber(stats.failedDeliveries) }} failed
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-2.5">
              <h4 class="text-xs font-semibold text-white">Telegram capabilities</h4>
              <ul class="space-y-1.5">
                <li v-for="perm in permissionList" :key="perm.label" class="flex items-center gap-2 text-slate-300">
                  <CheckCircle2 v-if="perm.enabled" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <XCircle v-else class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span :class="perm.enabled ? '' : 'text-slate-400'">{{ perm.label }}</span>
                </li>
              </ul>
            </div>

            <div class="p-4 rounded-lg bg-white/[0.02] border border-white/5 space-y-2.5">
              <h4 class="text-xs font-semibold text-white">Details</h4>
              <dl class="space-y-1.5">
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-slate-400">Bot ID</dt>
                  <dd class="text-slate-200 font-mono tabular-nums">{{ bot.id }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-slate-400">Connected</dt>
                  <dd class="text-slate-200 tabular-nums">{{ formatDateTime(bot.createdAt) || '—' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-slate-400">Last delivery</dt>
                  <dd class="text-slate-200 tabular-nums">{{ formatDateTime(lastActivityAt) || 'None yet' }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div>
            <h4 class="text-xs font-semibold text-white mb-2">Manage</h4>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                v-for="s in shortcuts"
                :key="s.tab"
                type="button"
                @click="goTo(s.tab)"
                class="flex items-center justify-between px-3 py-2 rounded-md border border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <span>{{ s.label }}</span>
                <ChevronRight class="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
        </div>

        <!-- Send test message -->
        <div v-else class="space-y-4">
          <div>
            <h4 class="text-xs font-semibold text-white">Send a test message</h4>
            <p class="text-slate-400 text-[11px] mt-0.5">Delivers immediately through this bot to one of your groups or channels.</p>
          </div>

          <div
            v-if="groupsStore.groups.length === 0 && !groupsStore.isLoading"
            class="p-4 rounded-lg border border-white/5 bg-white/[0.02] text-slate-400"
          >
            No groups yet.
            <button type="button" @click="goTo('groups')" class="text-[#2481cc] hover:underline cursor-pointer">
              Add a group or channel
            </button>
            to send a test message.
          </div>

          <div v-else class="space-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Destination</label>
              <select v-model="testChatId" class="tf-input w-full p-2.5 text-xs">
                <option value="">{{ groupsStore.isLoading ? 'Loading groups…' : 'Select a group or channel' }}</option>
                <option v-for="g in groupsStore.groups" :key="g.id" :value="g.chatId">
                  {{ g.name }} ({{ g.type }})
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-300 mb-1">Message (HTML supported)</label>
              <textarea
                v-model="testMessage"
                rows="3"
                placeholder="Hello from TeleFlow"
                class="tf-input w-full p-2.5 text-xs resize-none"
              ></textarea>
            </div>

            <button
              type="button"
              @click="handleSendTest"
              :disabled="isSendingTest || !testChatId || !testMessage.trim()"
              class="tf-btn-primary px-4 py-2 text-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw v-if="isSendingTest" class="w-3.5 h-3.5 animate-spin" />
              <Send v-else class="w-3.5 h-3.5" />
              <span>{{ isSendingTest ? 'Sending…' : 'Send test message' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
