<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDashboardStore } from '../stores/dashboard'
import { useBotStore } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useSchedulesStore } from '../stores/schedules'
import { useAiStore } from '../stores/ai'
import { useModerationStore } from '../stores/moderation'
import {
  Bot,
  Users,
  MessageSquare,
  Send,
  TrendingUp,
  TrendingDown,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  BarChart3
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
  (e: 'open-add-bot'): void
}>()

const dashboardStore = useDashboardStore()
const botStore = useBotStore()
const groupsStore = useGroupsStore()
const schedulesStore = useSchedulesStore()
const aiStore = useAiStore()
const moderationStore = useModerationStore()

// ---------------------------------------------------------------------------
// Analytics summary (real aggregates from logs + chat history)
// ---------------------------------------------------------------------------
interface DayPoint {
  date: string
  received: number
  outboundDelivered: number
  outboundFailed: number
  moderation: number
  aiReplies: number
}
interface Totals {
  received: number
  activeUsers: number
  outboundDelivered: number
  outboundFailed: number
  moderation: number
  aiReplies: number
}
interface Summary {
  days: number
  totals: Totals
  previousTotals: Record<keyof Totals, number | null>
  series: DayPoint[]
}

const rangeOptions = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 }
] as const
const rangeDays = ref<number>(7)
const summary = ref<Summary | null>(null)
const summaryLoading = ref(true)
const summaryError = ref(false)

const fetchSummary = async () => {
  summaryLoading.value = true
  summaryError.value = false
  try {
    summary.value = await $fetch<Summary>('/api/analytics/summary', {
      query: { days: rangeDays.value, tz: new Date().getTimezoneOffset() }
    })
  } catch (error) {
    console.error('Failed to fetch analytics summary:', error)
    summaryError.value = true
  } finally {
    summaryLoading.value = false
  }
}

const setRange = (days: number) => {
  if (rangeDays.value === days) return
  rangeDays.value = days
  fetchSummary()
}

const fmt = (n: number) => n.toLocaleString()

// Percentage change vs. the previous period, only when that period is fully
// covered by stored history and non-zero.
const trendFor = (key: keyof Totals) => {
  const s = summary.value
  if (!s) return null
  const prev = s.previousTotals[key]
  if (prev === null || prev === 0) return null
  const change = ((s.totals[key] - prev) / prev) * 100
  return { value: Math.abs(change).toFixed(1), up: change >= 0 }
}

const deliveryRate = computed(() => {
  const t = summary.value?.totals
  if (!t) return null
  const attempts = t.outboundDelivered + t.outboundFailed
  if (attempts === 0) return null
  return Math.round((t.outboundDelivered / attempts) * 1000) / 10
})

// ---------------------------------------------------------------------------
// Activity chart
// ---------------------------------------------------------------------------
type SeriesKey = 'received' | 'outboundDelivered' | 'aiReplies' | 'moderation'
const seriesOptions: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'received', label: 'Messages received', color: 'bg-[#2481cc]' },
  { key: 'outboundDelivered', label: 'Messages delivered', color: 'bg-emerald-500' },
  { key: 'aiReplies', label: 'AI replies', color: 'bg-violet-500' },
  { key: 'moderation', label: 'Moderation actions', color: 'bg-rose-500' }
]
const activeSeries = ref<SeriesKey>('received')
const activeSeriesMeta = computed(() => seriesOptions.find(s => s.key === activeSeries.value)!)
const hoveredIndex = ref<number | null>(null)

const chartData = computed(() => summary.value?.series ?? [])
const chartMax = computed(() => Math.max(0, ...chartData.value.map(d => d[activeSeries.value])))
const seriesTotal = computed(() => summary.value ? summary.value.totals[activeSeries.value] : 0)
const hasAnyActivity = computed(() => {
  const t = summary.value?.totals
  return !!t && (t.received + t.outboundDelivered + t.outboundFailed + t.aiReplies + t.moderation) > 0
})

const dayLabel = (iso: string, long = false) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return long
    ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    : rangeDays.value <= 7
      ? date.toLocaleDateString(undefined, { weekday: 'short' })
      : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
// Show every label for 7 days, roughly every 5th for 30 days.
const showTick = (i: number) => rangeDays.value <= 7 || i % 5 === 0 || i === chartData.value.length - 1

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
})

const botStatus = computed(() => {
  if (!botStore.isConfigured) return { label: 'Not connected', cls: 'text-slate-400', dot: 'bg-slate-500' }
  if (botStore.isOnline) return { label: 'Online', cls: 'text-emerald-400', dot: 'bg-emerald-500' }
  return { label: 'Offline', cls: 'text-amber-400', dot: 'bg-amber-500' }
})

const activeGroupsCount = computed(() => groupsStore.groups.filter(g => g.isActive).length)

// ---------------------------------------------------------------------------
// Upcoming broadcast (schedules carry a server-computed nextRunAt)
// ---------------------------------------------------------------------------
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let refetchPending = false

const nextSchedule = computed(() => {
  const upcoming = schedulesStore.schedules
    .filter(s => s.isActive && s.nextRunAt)
    .map(s => ({ s, t: new Date(s.nextRunAt as string).getTime() }))
    .filter(x => Number.isFinite(x.t))
    .sort((a, b) => a.t - b.t)
  return upcoming[0]?.s ?? null
})

const timeRemaining = computed(() => {
  const next = nextSchedule.value
  if (!next?.nextRunAt) return ''
  const diff = new Date(next.nextRunAt).getTime() - now.value
  if (diff <= 0) return 'Sending now'

  const days = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const minutes = Math.floor((diff % 3_600_000) / 60_000)
  const seconds = Math.floor((diff % 60_000) / 1000)
  if (days > 0) return `in ${days}d ${hours}h`
  if (hours > 0) return `in ${hours}h ${minutes}m`
  if (minutes > 0) return `in ${minutes}m ${seconds}s`
  return `in ${seconds}s`
})

const nextRunLabel = computed(() => {
  const at = nextSchedule.value?.nextRunAt
  if (!at) return ''
  return new Date(at).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
})

const destinationLabel = computed(() => {
  const ids = nextSchedule.value?.targetGroupIds
  if (!ids || ids.length === 0) {
    return `All active groups (${activeGroupsCount.value})`
  }
  return `${ids.length} ${ids.length === 1 ? 'group' : 'groups'}`
})

const tick = () => {
  now.value = Date.now()
  const at = nextSchedule.value?.nextRunAt
  // Once the run time passes, refresh once so nextRunAt / lastDelivery update.
  if (at && new Date(at).getTime() <= now.value && !refetchPending) {
    refetchPending = true
    setTimeout(async () => {
      await Promise.all([schedulesStore.fetchSchedules(), dashboardStore.fetchStats()])
      refetchPending = false
    }, 5000)
  }
}

// ---------------------------------------------------------------------------
// Automation status (real settings + Telegram webhook info)
// ---------------------------------------------------------------------------
const webhook = ref<{ configured: boolean; lastError: string | null; pendingUpdateCount: number } | null>(null)
const webhookLoading = ref(true)

const fetchWebhook = async () => {
  webhookLoading.value = true
  try {
    webhook.value = await $fetch<any>('/api/telegram/webhook')
  } catch {
    webhook.value = null
  } finally {
    webhookLoading.value = false
  }
}

const automationItems = computed(() => {
  const wh = webhook.value
  const webhookState = !botStore.isConfigured
    ? { value: 'No bot', cls: 'text-slate-400' }
    : webhookLoading.value
      ? { value: 'Checking…', cls: 'text-slate-400' }
      : !wh
        ? { value: 'Unknown', cls: 'text-slate-400' }
        : !wh.configured
          ? { value: 'Not set', cls: 'text-amber-400' }
          : wh.lastError
            ? { value: 'Error', cls: 'text-rose-400' }
            : { value: 'Connected', cls: 'text-emerald-400' }

  const ai = aiStore.settings
  const aiState = !ai.enabled
    ? { value: 'Off', cls: 'text-slate-400' }
    : ai.keyConfigured === false
      ? { value: 'No API key', cls: 'text-amber-400' }
      : { value: 'On', cls: 'text-emerald-400' }

  const mod = moderationStore.settings
  const modState = mod.enabled
    ? { value: 'On', cls: 'text-emerald-400' }
    : { value: 'Off', cls: 'text-slate-400' }

  return [
    { label: 'Webhook', tab: 'bots', ...webhookState, detail: wh?.lastError || null },
    { label: 'AI replies', tab: 'ai', ...aiState, detail: null },
    { label: 'Moderation', tab: 'moderation', ...modState, detail: null }
  ]
})

const automationOverall = computed(() => {
  if (!botStore.isConfigured) return { label: 'Setup needed', cls: 'bg-white/5 text-slate-400 border-white/10' }
  const hasProblem = automationItems.value.some(i => i.cls.includes('rose') || i.cls.includes('amber')) || !botStore.isOnline
  return hasProblem
    ? { label: 'Needs attention', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
    : { label: 'Operational', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' }
})

onMounted(async () => {
  dashboardStore.fetchStats()
  groupsStore.fetchGroups()
  schedulesStore.fetchSchedules()
  aiStore.fetchSettings()
  moderationStore.fetchSettings()
  fetchSummary()
  timer = setInterval(tick, 1000)
  await botStore.fetchBot()
  if (botStore.isConfigured) fetchWebhook()
  else webhookLoading.value = false
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">{{ greeting }}</h2>
        <p class="text-sm text-slate-400 mt-1">
          Here's what your bot has been doing.
        </p>
      </div>

      <button
        type="button"
        @click="emit('open-add-bot')"
        class="tf-btn-primary px-3.5 py-2 text-sm flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
      >
        <Plus v-if="!botStore.isConfigured" class="w-4 h-4" />
        <Bot v-else class="w-4 h-4" />
        <span>{{ botStore.isConfigured ? 'Manage bot' : 'Add bot' }}</span>
      </button>
    </div>

    <!-- Key statistics -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Bot -->
      <button
        type="button"
        @click="emit('navigate', 'bots')"
        class="tf-card tf-card-interactive p-5 text-left cursor-pointer"
      >
        <div class="flex items-center justify-between">
          <div class="p-2 rounded-lg bg-sky-500/10 text-[#2481cc]">
            <Bot class="w-4 h-4" />
          </div>
          <span class="inline-flex items-center gap-1.5 text-xs font-medium" :class="botStatus.cls">
            <span class="w-1.5 h-1.5 rounded-full" :class="botStatus.dot"></span>
            {{ botStatus.label }}
          </span>
        </div>
        <p class="text-sm text-slate-400 mt-4">Bot</p>
        <p class="text-lg font-semibold text-white mt-1 truncate">
          {{ botStore.bot ? `@${botStore.bot.username}` : 'No bot connected' }}
        </p>
        <p class="text-xs text-slate-400 mt-1 truncate">
          {{ botStore.bot ? botStore.bot.firstName : 'Add a bot token to get started' }}
        </p>
      </button>

      <!-- Groups -->
      <button
        type="button"
        @click="emit('navigate', 'groups')"
        class="tf-card tf-card-interactive p-5 text-left cursor-pointer"
      >
        <div class="flex items-center justify-between">
          <div class="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Users class="w-4 h-4" />
          </div>
        </div>
        <p class="text-sm text-slate-400 mt-4">Groups</p>
        <p class="text-2xl font-bold text-white mt-1 tabular-nums">
          {{ fmt(dashboardStore.stats.totalGroups) }}
        </p>
        <p class="text-xs text-slate-400 mt-1 tabular-nums">
          {{ fmt(dashboardStore.stats.totalChannels) }} {{ dashboardStore.stats.totalChannels === 1 ? 'channel' : 'channels' }}
          · {{ fmt(activeGroupsCount) }} active
        </p>
      </button>

      <!-- Messages received -->
      <button
        type="button"
        @click="emit('navigate', 'chat')"
        class="tf-card tf-card-interactive p-5 text-left cursor-pointer"
      >
        <div class="flex items-center justify-between">
          <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <MessageSquare class="w-4 h-4" />
          </div>
          <span
            v-if="trendFor('received')"
            class="inline-flex items-center gap-1 text-xs font-medium tabular-nums"
            :class="trendFor('received')!.up ? 'text-emerald-400' : 'text-rose-400'"
            :title="`Compared with the previous ${rangeDays} days`"
          >
            <component :is="trendFor('received')!.up ? TrendingUp : TrendingDown" class="w-3.5 h-3.5" />
            {{ trendFor('received')!.value }}%
          </span>
        </div>
        <p class="text-sm text-slate-400 mt-4">Messages received</p>
        <p class="text-2xl font-bold text-white mt-1 tabular-nums">
          <span v-if="summaryLoading && !summary" class="text-slate-500">—</span>
          <template v-else>{{ fmt(summary?.totals.received ?? 0) }}</template>
        </p>
        <p class="text-xs text-slate-400 mt-1 tabular-nums">
          Last {{ rangeDays }} days · {{ fmt(summary?.totals.activeUsers ?? 0) }} active {{ summary?.totals.activeUsers === 1 ? 'member' : 'members' }}
        </p>
      </button>

      <!-- Deliveries -->
      <button
        type="button"
        @click="emit('navigate', 'broadcasts')"
        class="tf-card tf-card-interactive p-5 text-left cursor-pointer"
      >
        <div class="flex items-center justify-between">
          <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Send class="w-4 h-4" />
          </div>
          <span
            v-if="trendFor('outboundDelivered')"
            class="inline-flex items-center gap-1 text-xs font-medium tabular-nums"
            :class="trendFor('outboundDelivered')!.up ? 'text-emerald-400' : 'text-rose-400'"
            :title="`Compared with the previous ${rangeDays} days`"
          >
            <component :is="trendFor('outboundDelivered')!.up ? TrendingUp : TrendingDown" class="w-3.5 h-3.5" />
            {{ trendFor('outboundDelivered')!.value }}%
          </span>
        </div>
        <p class="text-sm text-slate-400 mt-4">Messages delivered</p>
        <p class="text-2xl font-bold text-white mt-1 tabular-nums">
          <span v-if="summaryLoading && !summary" class="text-slate-500">—</span>
          <template v-else>{{ fmt(summary?.totals.outboundDelivered ?? 0) }}</template>
        </p>
        <p class="text-xs mt-1 tabular-nums" :class="summary && summary.totals.outboundFailed > 0 ? 'text-amber-400' : 'text-slate-400'">
          <template v-if="deliveryRate !== null">
            {{ deliveryRate }}% success · {{ fmt(summary!.totals.outboundFailed) }} failed
          </template>
          <template v-else>No sends in the last {{ rangeDays }} days</template>
        </p>
      </button>
    </div>

    <!-- Activity chart -->
    <div class="tf-card p-5 sm:p-6 space-y-5">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-semibold text-white">Activity</h3>
          <p class="text-sm text-slate-400 mt-0.5">Daily totals from your bot's message history and logs</p>
        </div>

        <div class="flex items-center rounded-lg bg-white/[0.04] p-1 border border-white/10 gap-1 self-start sm:self-auto">
          <button
            v-for="opt in rangeOptions"
            :key="opt.days"
            type="button"
            @click="setRange(opt.days)"
            class="px-2.5 py-1 text-xs rounded-md font-medium cursor-pointer transition-colors"
            :class="rangeDays === opt.days ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Series selector -->
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="s in seriesOptions"
          :key="s.key"
          type="button"
          @click="activeSeries = s.key"
          class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs cursor-pointer border transition-colors"
          :class="activeSeries === s.key
            ? 'border-white/10 bg-white/5 text-white font-medium'
            : 'border-transparent text-slate-400 hover:text-white'"
        >
          <span class="w-2 h-2 rounded-full" :class="s.color"></span>
          {{ s.label }}
          <span class="tabular-nums text-slate-400">{{ summary ? fmt(summary.totals[s.key]) : '—' }}</span>
        </button>
      </div>

      <!-- Loading -->
      <div v-if="summaryLoading && !summary" class="h-56 flex items-center justify-center text-sm text-slate-400">
        Loading activity…
      </div>

      <!-- Error -->
      <div v-else-if="summaryError && !summary" class="h-56 flex flex-col items-center justify-center gap-2 text-center">
        <AlertCircle class="w-5 h-5 text-rose-400" />
        <p class="text-sm text-white">Couldn't load activity</p>
        <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer" @click="fetchSummary">Try again</button>
      </div>

      <!-- Empty -->
      <div v-else-if="!hasAnyActivity" class="h-56 flex flex-col items-center justify-center gap-2 text-center px-6">
        <BarChart3 class="w-5 h-5 text-slate-400" />
        <p class="text-sm font-medium text-white">No activity yet</p>
        <p class="text-xs text-slate-400 max-w-sm">
          Add the bot to a group and send a message or a broadcast. Activity from the last {{ rangeDays }} days will show up here.
        </p>
      </div>

      <!-- Bars -->
      <div v-else class="relative" :class="summaryLoading ? 'opacity-60' : ''">
        <div class="flex items-center justify-between text-xs text-slate-400 mb-2">
          <span>{{ activeSeriesMeta.label }} per day</span>
          <span class="tabular-nums">Peak {{ fmt(chartMax) }}</span>
        </div>

        <div class="h-48 flex items-end gap-[3px] sm:gap-1 border-b border-white/10" @mouseleave="hoveredIndex = null">
          <div
            v-for="(d, i) in chartData"
            :key="d.date"
            class="flex-1 h-full flex items-end cursor-default"
            @mouseenter="hoveredIndex = i"
          >
            <div
              class="w-full rounded-t-sm transition-opacity"
              :class="[activeSeriesMeta.color, hoveredIndex === null || hoveredIndex === i ? 'opacity-100' : 'opacity-50']"
              :style="{ height: chartMax > 0 && d[activeSeries] > 0 ? `${Math.max(2, (d[activeSeries] / chartMax) * 100)}%` : '0%' }"
            ></div>
          </div>
        </div>

        <div class="flex gap-[3px] sm:gap-1 mt-2">
          <span
            v-for="(d, i) in chartData"
            :key="d.date"
            class="flex-1 text-center text-[11px] text-slate-400 whitespace-nowrap overflow-visible"
          >
            {{ showTick(i) ? dayLabel(d.date) : '' }}
          </span>
        </div>

        <!-- Hover details -->
        <div
          v-if="hoveredIndex !== null && chartData[hoveredIndex]"
          class="absolute top-6 right-0 tf-card-elevated px-3 py-2 text-xs pointer-events-none z-10 space-y-1 min-w-[180px]"
        >
          <p class="font-medium text-white">{{ dayLabel(chartData[hoveredIndex].date, true) }}</p>
          <div
            v-for="s in seriesOptions"
            :key="s.key"
            class="flex items-center justify-between gap-4"
          >
            <span class="inline-flex items-center gap-1.5 text-slate-400">
              <span class="w-1.5 h-1.5 rounded-full" :class="s.color"></span>{{ s.label }}
            </span>
            <span class="tabular-nums text-white">{{ fmt(chartData[hoveredIndex][s.key]) }}</span>
          </div>
          <div v-if="chartData[hoveredIndex].outboundFailed > 0" class="flex items-center justify-between gap-4">
            <span class="text-rose-400">Failed sends</span>
            <span class="tabular-nums text-rose-400">{{ fmt(chartData[hoveredIndex].outboundFailed) }}</span>
          </div>
        </div>

        <p class="sr-only">{{ activeSeriesMeta.label }}: {{ fmt(seriesTotal) }} in the last {{ rangeDays }} days.</p>
      </div>
    </div>

    <!-- Upcoming broadcast & automation -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <!-- Upcoming broadcast -->
      <div class="tf-card p-5 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-semibold text-white">Upcoming broadcast</h4>
              <p class="text-xs text-slate-400">Next scheduled delivery</p>
            </div>
          </div>
          <span v-if="nextSchedule" class="tf-pill px-2 py-0.5 text-slate-300 tabular-nums">
            {{ timeRemaining }}
          </span>
        </div>

        <div v-if="schedulesStore.isLoading && schedulesStore.schedules.length === 0" class="py-6 text-center text-sm text-slate-400">
          Loading schedules…
        </div>

        <div v-else-if="nextSchedule" class="tf-card-subtle p-3.5 space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-white truncate">{{ nextSchedule.title }}</p>
            <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{{ nextRunLabel }}</span>
          </div>
          <p class="text-xs text-slate-400 line-clamp-2 break-words">{{ nextSchedule.message }}</p>
          <div class="flex items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs text-slate-400">
            <span class="truncate">
              To {{ destinationLabel }}
              <template v-if="nextSchedule.lastDelivery">
                · Last run {{ nextSchedule.lastDelivery.delivered }} delivered<template v-if="nextSchedule.lastDelivery.failed">, <span class="text-rose-400">{{ nextSchedule.lastDelivery.failed }} failed</span></template>
              </template>
            </span>
            <button
              type="button"
              @click="emit('navigate', 'schedules')"
              class="text-[#2481cc] hover:underline cursor-pointer font-medium whitespace-nowrap"
            >
              View schedule
            </button>
          </div>
        </div>

        <div v-else class="tf-card-subtle p-4 text-center space-y-2">
          <p class="text-sm text-white">No upcoming broadcasts</p>
          <p class="text-xs text-slate-400">Create a schedule to send messages to your groups automatically.</p>
          <button
            type="button"
            @click="emit('navigate', 'schedules')"
            class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
          >
            Open scheduler
          </button>
        </div>
      </div>

      <!-- Automation status -->
      <div class="tf-card p-5 space-y-4">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-semibold text-white">Automation</h4>
              <p class="text-xs text-slate-400">Webhook and feature status</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-md text-xs font-medium border" :class="automationOverall.cls">
            {{ automationOverall.label }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="item in automationItems"
            :key="item.label"
            type="button"
            @click="emit('navigate', item.tab)"
            class="tf-card-subtle p-3 text-left cursor-pointer hover:bg-white/5 transition-colors"
            :title="item.detail || undefined"
          >
            <p class="text-xs text-slate-400">{{ item.label }}</p>
            <p class="text-sm font-semibold mt-1" :class="item.cls">{{ item.value }}</p>
          </button>
        </div>

        <p v-if="webhook?.lastError" class="text-xs text-rose-400 break-words">
          Webhook error: {{ webhook.lastError }}
        </p>
        <p v-else-if="webhook && webhook.pendingUpdateCount > 0" class="text-xs text-slate-400 tabular-nums">
          {{ fmt(webhook.pendingUpdateCount) }} pending {{ webhook.pendingUpdateCount === 1 ? 'update' : 'updates' }} waiting on Telegram
        </p>
      </div>
    </div>
  </div>
</template>
