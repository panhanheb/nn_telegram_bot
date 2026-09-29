<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  MessageSquare,
  Sparkles,
  Send,
  ShieldAlert,
  UserPlus,
  AlertCircle,
  RefreshCw
} from 'lucide-vue-next'

interface DayPoint {
  date: string
  received: number
  broadcastsDelivered: number
  broadcastsFailed: number
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
  broadcastsDelivered: number
  broadcastsFailed: number
  moderation: number
  aiReplies: number
  newMembers: number
}
interface TopGroup {
  chatId: string
  id: string | null
  name: string
  type: string | null
  received: number
  activeUsers: number
  knownMembers: number
}
interface Summary {
  days: number
  from: string
  to: string
  totals: Totals
  previousTotals: Record<keyof Totals, number | null>
  series: DayPoint[]
  hourly: number[]
  topGroups: TopGroup[]
  coverage: {
    logsComplete: boolean
    messagesComplete: boolean
    oldestLogAt: string | null
    oldestMessageAt: string | null
  }
}

const filters = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 }
] as const
const activeDays = ref<number>(14)

const summary = ref<Summary | null>(null)
const isLoading = ref(true)
const loadError = ref(false)

const fetchSummary = async () => {
  isLoading.value = true
  loadError.value = false
  try {
    summary.value = await $fetch<Summary>('/api/analytics/summary', {
      query: { days: activeDays.value, tz: new Date().getTimezoneOffset() }
    })
  } catch (error) {
    console.error('Failed to fetch analytics summary:', error)
    loadError.value = true
  } finally {
    isLoading.value = false
  }
}

const setFilter = (days: number) => {
  if (activeDays.value === days) return
  activeDays.value = days
  fetchSummary()
}

onMounted(fetchSummary)

const fmt = (n: number) => n.toLocaleString()

// ---------------------------------------------------------------------------
// Metric cards
// ---------------------------------------------------------------------------
type Trend = { text: string; up: boolean; good: boolean } | null

// Relative change vs. the previous period; omitted when that period isn't
// fully covered by stored history or had no activity to compare against.
const pctTrend = (key: keyof Totals, higherIsGood = true): Trend => {
  const s = summary.value
  if (!s) return null
  const prev = s.previousTotals[key]
  if (prev === null || prev === 0) return null
  const change = ((s.totals[key] - prev) / prev) * 100
  const up = change >= 0
  return { text: `${Math.abs(change).toFixed(1)}%`, up, good: up === higherIsGood }
}

const rate = (delivered: number, failed: number) => {
  const attempts = delivered + failed
  return attempts > 0 ? (delivered / attempts) * 100 : null
}

const deliveryRate = computed(() => {
  const t = summary.value?.totals
  return t ? rate(t.outboundDelivered, t.outboundFailed) : null
})

const deliveryRateTrend = computed<Trend>(() => {
  const s = summary.value
  if (!s || deliveryRate.value === null) return null
  const pd = s.previousTotals.outboundDelivered
  const pf = s.previousTotals.outboundFailed
  if (pd === null || pf === null) return null
  const prevRate = rate(pd, pf)
  if (prevRate === null) return null
  const diff = deliveryRate.value - prevRate
  return { text: `${Math.abs(diff).toFixed(1)} pts`, up: diff >= 0, good: diff >= 0 }
})

const metrics = computed(() => {
  const t = summary.value?.totals
  return [
    {
      label: 'Messages received',
      value: t ? fmt(t.received) : '—',
      hint: 'From group members',
      trend: pctTrend('received'),
      icon: MessageSquare,
      color: 'text-sky-400'
    },
    {
      label: 'Active members',
      value: t ? fmt(t.activeUsers) : '—',
      hint: 'Sent at least one message',
      trend: pctTrend('activeUsers'),
      icon: Users,
      color: 'text-indigo-400'
    },
    {
      label: 'New members seen',
      value: t ? fmt(t.newMembers) : '—',
      hint: 'First observed by the bot',
      trend: pctTrend('newMembers'),
      icon: UserPlus,
      color: 'text-emerald-400'
    },
    {
      label: 'AI replies',
      value: t ? fmt(t.aiReplies) : '—',
      hint: 'Answered by the assistant',
      trend: pctTrend('aiReplies'),
      icon: Sparkles,
      color: 'text-violet-400'
    },
    {
      label: 'Delivery rate',
      value: deliveryRate.value === null ? '—' : `${(Math.round(deliveryRate.value * 10) / 10)}%`,
      hint: t
        ? (t.outboundDelivered + t.outboundFailed > 0
            ? `${fmt(t.outboundDelivered)} of ${fmt(t.outboundDelivered + t.outboundFailed)} sends`
            : 'No sends in this period')
        : '',
      trend: deliveryRateTrend.value,
      icon: Send,
      color: 'text-amber-400'
    },
    {
      label: 'Moderation actions',
      value: t ? fmt(t.moderation) : '—',
      hint: 'Deletions and mutes',
      trend: pctTrend('moderation', false),
      icon: ShieldAlert,
      color: 'text-rose-400'
    }
  ]
})

const hasAnyActivity = computed(() => {
  const t = summary.value?.totals
  if (!t) return false
  return t.received + t.outboundDelivered + t.outboundFailed + t.aiReplies + t.moderation + t.newMembers > 0
})

const trendsLimited = computed(() => {
  const c = summary.value?.coverage
  return !!c && (!c.logsComplete || !c.messagesComplete)
})

// ---------------------------------------------------------------------------
// Daily volume chart (received vs. delivered)
// ---------------------------------------------------------------------------
const hoveredDay = ref<number | null>(null)
const series = computed(() => summary.value?.series ?? [])
const dailyMax = computed(() =>
  Math.max(0, ...series.value.map(d => Math.max(d.received, d.outboundDelivered + d.outboundFailed)))
)
const barHeight = (v: number, max: number) => (max > 0 && v > 0 ? `${Math.max(2, (v / max) * 100)}%` : '0%')

const dayLabel = (iso: string, long = false) => {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (long) return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  return activeDays.value <= 7
    ? date.toLocaleDateString(undefined, { weekday: 'short' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
const tickEvery = computed(() => (activeDays.value <= 7 ? 1 : activeDays.value <= 14 ? 2 : activeDays.value <= 30 ? 5 : 15))
const showTick = (i: number) => i % tickEvery.value === 0 || i === series.value.length - 1

// ---------------------------------------------------------------------------
// Hourly distribution (messages received by local hour of day)
// ---------------------------------------------------------------------------
const hoveredHour = ref<number | null>(null)
const hourly = computed(() => summary.value?.hourly ?? Array.from({ length: 24 }, () => 0))
const hourlyMax = computed(() => Math.max(0, ...hourly.value))
const hourlyTotal = computed(() => hourly.value.reduce((a, b) => a + b, 0))
const peakHour = computed(() => (hourlyMax.value > 0 ? hourly.value.indexOf(hourlyMax.value) : null))
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`

// ---------------------------------------------------------------------------
// Top groups
// ---------------------------------------------------------------------------
const topGroups = computed(() => {
  const s = summary.value
  if (!s || s.totals.received === 0) return []
  return s.topGroups.map(g => ({
    ...g,
    share: Math.round((g.received / s.totals.received) * 1000) / 10
  }))
})

// ---------------------------------------------------------------------------
// Delivery breakdown
// ---------------------------------------------------------------------------
const deliveryRows = computed(() => {
  const t = summary.value?.totals
  if (!t) return []
  const manualDelivered = t.outboundDelivered - t.broadcastsDelivered
  const manualFailed = t.outboundFailed - t.broadcastsFailed
  return [
    { label: 'Scheduled broadcasts', delivered: t.broadcastsDelivered, failed: t.broadcastsFailed },
    { label: 'Manual sends', delivered: manualDelivered, failed: manualFailed }
  ]
})

const rangeLabel = computed(() => {
  const s = summary.value
  if (!s) return ''
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${new Date(s.from).toLocaleDateString(undefined, opts)} – ${new Date(s.to).toLocaleDateString(undefined, opts)}`
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Analytics</h2>
        <p class="text-sm text-slate-400 mt-1">
          Message volume, engagement and delivery, from your bot's own records<span v-if="rangeLabel" class="tabular-nums"> · {{ rangeLabel }}</span>
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <div class="flex items-center rounded-lg bg-white/[0.04] p-1 border border-white/10 gap-1 text-xs">
          <button
            v-for="f in filters"
            :key="f.days"
            type="button"
            @click="setFilter(f.days)"
            class="px-2.5 py-1 rounded-md font-medium cursor-pointer transition-colors"
            :class="activeDays === f.days ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
          >
            {{ f.label }}
          </button>
        </div>
        <button
          type="button"
          @click="fetchSummary"
          :disabled="isLoading"
          class="tf-btn-secondary p-2 cursor-pointer"
          title="Refresh"
          aria-label="Refresh analytics"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="isLoading ? 'animate-spin' : ''" />
        </button>
      </div>
    </div>

    <!-- Initial loading -->
    <div v-if="isLoading && !summary" class="tf-card p-10 text-center text-sm text-slate-400">
      Loading analytics…
    </div>

    <!-- Error -->
    <div v-else-if="loadError && !summary" class="tf-card p-10 flex flex-col items-center gap-2 text-center">
      <AlertCircle class="w-5 h-5 text-rose-400" />
      <p class="text-sm text-white">Couldn't load analytics</p>
      <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer" @click="fetchSummary">Try again</button>
    </div>

    <template v-else-if="summary">
      <!-- Metric cards -->
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" :class="isLoading ? 'opacity-60' : ''">
        <div
          v-for="m in metrics"
          :key="m.label"
          class="tf-card p-4"
        >
          <div class="flex items-center justify-between">
            <component :is="m.icon" class="w-4 h-4" :class="m.color" />
            <span
              v-if="m.trend"
              class="inline-flex items-center gap-0.5 text-xs font-medium tabular-nums"
              :class="m.trend.good ? 'text-emerald-400' : 'text-rose-400'"
              :title="`Compared with the previous ${activeDays} days`"
            >
              <component :is="m.trend.up ? TrendingUp : TrendingDown" class="w-3 h-3" />
              {{ m.trend.text }}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-3">{{ m.label }}</p>
          <p class="text-xl font-bold text-white mt-0.5 tabular-nums">{{ m.value }}</p>
          <p class="text-[11px] text-slate-400 mt-0.5 truncate tabular-nums">{{ m.hint }}</p>
        </div>
      </div>

      <p v-if="trendsLimited" class="text-xs text-slate-400 -mt-2">
        Some trends are hidden because stored history doesn't cover the whole previous {{ activeDays }}-day period.
      </p>

      <!-- Empty state -->
      <div v-if="!hasAnyActivity" class="tf-card p-10 flex flex-col items-center gap-2 text-center">
        <BarChart3 class="w-5 h-5 text-slate-400" />
        <p class="text-sm font-medium text-white">No activity yet</p>
        <p class="text-xs text-slate-400 max-w-md">
          Nothing was recorded in the last {{ activeDays }} days. Add the bot to a group, make sure its webhook is set,
          and send a message or broadcast. Charts fill in as activity arrives.
        </p>
      </div>

      <template v-else>
        <!-- Daily volume -->
        <div class="tf-card p-5 sm:p-6 space-y-4" :class="isLoading ? 'opacity-60' : ''">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="text-sm font-semibold text-white">Daily volume</h3>
              <p class="text-xs text-slate-400">Messages received from members and messages sent by the bot</p>
            </div>
            <div class="flex items-center gap-4 text-xs text-slate-400">
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-[#2481cc]"></span>Received</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Delivered</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-rose-500"></span>Failed</span>
            </div>
          </div>

          <div class="relative">
            <div class="h-48 flex items-end gap-[2px] sm:gap-1 border-b border-white/10" @mouseleave="hoveredDay = null">
              <div
                v-for="(d, i) in series"
                :key="d.date"
                class="flex-1 h-full flex items-end gap-px"
                :class="hoveredDay === null || hoveredDay === i ? 'opacity-100' : 'opacity-50'"
                @mouseenter="hoveredDay = i"
              >
                <div class="flex-1 bg-[#2481cc] rounded-t-sm" :style="{ height: barHeight(d.received, dailyMax) }"></div>
                <div class="flex-1 h-full flex flex-col justify-end">
                  <div class="bg-rose-500 rounded-t-sm" :style="{ height: barHeight(d.outboundFailed, dailyMax) }"></div>
                  <div
                    class="bg-emerald-500"
                    :class="d.outboundFailed ? '' : 'rounded-t-sm'"
                    :style="{ height: barHeight(d.outboundDelivered, dailyMax) }"
                  ></div>
                </div>
              </div>
            </div>
            <div class="flex gap-[2px] sm:gap-1 mt-2">
              <span
                v-for="(d, i) in series"
                :key="d.date"
                class="flex-1 text-center text-[11px] text-slate-400 whitespace-nowrap"
              >
                {{ showTick(i) ? dayLabel(d.date) : '' }}
              </span>
            </div>

            <div
              v-if="hoveredDay !== null && series[hoveredDay]"
              class="absolute top-0 right-0 tf-card-elevated px-3 py-2 text-xs pointer-events-none z-10 space-y-1 min-w-[190px]"
            >
              <p class="font-medium text-white">{{ dayLabel(series[hoveredDay].date, true) }}</p>
              <div class="flex justify-between gap-4"><span class="text-slate-400">Received</span><span class="tabular-nums text-white">{{ fmt(series[hoveredDay].received) }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-400">Delivered</span><span class="tabular-nums text-white">{{ fmt(series[hoveredDay].outboundDelivered) }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-400">Failed</span><span class="tabular-nums" :class="series[hoveredDay].outboundFailed ? 'text-rose-400' : 'text-white'">{{ fmt(series[hoveredDay].outboundFailed) }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-400">AI replies</span><span class="tabular-nums text-white">{{ fmt(series[hoveredDay].aiReplies) }}</span></div>
              <div class="flex justify-between gap-4"><span class="text-slate-400">Moderation</span><span class="tabular-nums text-white">{{ fmt(series[hoveredDay].moderation) }}</span></div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" :class="isLoading ? 'opacity-60' : ''">
          <!-- Hourly activity -->
          <div class="lg:col-span-7 tf-card p-5 sm:p-6 space-y-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-semibold text-white">Activity by hour</h3>
                <p class="text-xs text-slate-400">Messages received, by hour of day in your time zone</p>
              </div>
              <span v-if="peakHour !== null" class="text-xs text-slate-400 tabular-nums whitespace-nowrap">
                Peak {{ hourLabel(peakHour) }}
              </span>
            </div>

            <div v-if="hourlyTotal === 0" class="h-40 flex items-center justify-center text-xs text-slate-400 text-center px-6">
              No messages received from members in this period.
            </div>
            <div v-else class="relative">
              <div class="h-40 flex items-end gap-[2px] border-b border-white/10" @mouseleave="hoveredHour = null">
                <div
                  v-for="(v, h) in hourly"
                  :key="h"
                  class="flex-1 h-full flex items-end"
                  @mouseenter="hoveredHour = h"
                >
                  <div
                    class="w-full rounded-t-sm"
                    :class="hoveredHour === h ? 'bg-[#1f72b5]' : h === peakHour ? 'bg-[#2481cc]' : 'bg-[#2481cc]/60'"
                    :style="{ height: barHeight(v, hourlyMax) }"
                  ></div>
                </div>
              </div>
              <div class="flex gap-[2px] mt-2">
                <span
                  v-for="h in 24"
                  :key="h"
                  class="flex-1 text-center text-[10px] text-slate-400 tabular-nums"
                >
                  {{ (h - 1) % 6 === 0 ? String(h - 1).padStart(2, '0') : '' }}
                </span>
              </div>
              <div
                v-if="hoveredHour !== null"
                class="absolute top-0 right-0 tf-card-elevated px-3 py-1.5 text-xs pointer-events-none z-10 tabular-nums"
              >
                <span class="text-slate-400">{{ hourLabel(hoveredHour) }}–{{ hourLabel((hoveredHour + 1) % 24) }}</span>
                <span class="text-white font-medium ml-2">{{ fmt(hourly[hoveredHour]) }}</span>
              </div>
            </div>
          </div>

          <!-- Top groups -->
          <div class="lg:col-span-5 tf-card p-5 sm:p-6 space-y-4">
            <div>
              <h3 class="text-sm font-semibold text-white">Most active groups</h3>
              <p class="text-xs text-slate-400">Share of messages received in this period</p>
            </div>

            <div v-if="topGroups.length === 0" class="py-8 text-center text-xs text-slate-400">
              No group messages in this period.
            </div>
            <div v-else class="space-y-4">
              <div v-for="g in topGroups" :key="g.chatId" class="space-y-1.5 text-xs">
                <div class="flex items-center justify-between gap-3">
                  <span class="font-medium text-white truncate">{{ g.name }}</span>
                  <span class="text-slate-300 tabular-nums whitespace-nowrap">{{ fmt(g.received) }} msgs</span>
                </div>
                <div class="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-[#2481cc] h-full rounded-full" :style="{ width: `${g.share}%` }"></div>
                </div>
                <p class="text-[11px] text-slate-400 tabular-nums">
                  {{ g.share }}% · {{ fmt(g.activeUsers) }} active {{ g.activeUsers === 1 ? 'member' : 'members' }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Delivery breakdown -->
        <div class="tf-card p-5 sm:p-6 space-y-4" :class="isLoading ? 'opacity-60' : ''">
          <div>
            <h3 class="text-sm font-semibold text-white">Deliveries</h3>
            <p class="text-xs text-slate-400">Messages the bot sent to groups, by source</p>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-left text-slate-400 border-b border-white/10">
                  <th class="font-medium py-2 pr-4">Source</th>
                  <th class="font-medium py-2 px-4 text-right">Delivered</th>
                  <th class="font-medium py-2 px-4 text-right">Failed</th>
                  <th class="font-medium py-2 pl-4 text-right">Success rate</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in deliveryRows" :key="r.label" class="border-b border-white/10 last:border-0">
                  <td class="py-2.5 pr-4 text-white">{{ r.label }}</td>
                  <td class="py-2.5 px-4 text-right tabular-nums text-white">{{ fmt(r.delivered) }}</td>
                  <td class="py-2.5 px-4 text-right tabular-nums" :class="r.failed ? 'text-rose-400' : 'text-slate-400'">{{ fmt(r.failed) }}</td>
                  <td class="py-2.5 pl-4 text-right tabular-nums text-slate-300">
                    {{ rate(r.delivered, r.failed) === null ? '—' : `${Math.round(rate(r.delivered, r.failed)! * 10) / 10}%` }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
