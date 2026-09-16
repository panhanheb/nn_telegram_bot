<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useDashboardStore } from '../stores/dashboard'
import { useBotStore } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import {
  Bot,
  Users,
  MessageSquare,
  Send,
  TrendingUp,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ShieldAlert
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
  (e: 'open-add-bot'): void
}>()

const dashboardStore = useDashboardStore()
const botStore = useBotStore()
const groupsStore = useGroupsStore()

const timeRemaining = ref('')
let timer: any = null

const activeTimeFilter = ref<'24H' | '7D' | '30D' | '3M' | '1Y'>('7D')
const timeFilters = ['24H', '7D', '30D', '3M', '1Y'] as const

// Interactive Chart State
const hoveredIndex = ref<number | null>(null)
const activeSeries = ref<'all' | 'sent' | 'received' | 'ai' | 'failed'>('all')

interface ChartDataPoint {
  label: string
  sent: number
  received: number
  ai: number
  failed: number
}

const chartDatasets = computed<Record<string, ChartDataPoint[]>>(() => ({
  '24H': [
    { label: '00:00', sent: 320, received: 140, ai: 85, failed: 2 },
    { label: '04:00', sent: 120, received: 60, ai: 30, failed: 0 },
    { label: '08:00', sent: 890, received: 450, ai: 240, failed: 4 },
    { label: '12:00', sent: 1420, received: 720, ai: 410, failed: 8 },
    { label: '16:00', sent: 1850, received: 910, ai: 540, failed: 6 },
    { label: '20:00', sent: 1210, received: 680, ai: 380, failed: 3 }
  ],
  '7D': [
    { label: 'Mon', sent: 14200, received: 8400, ai: 4200, failed: 45 },
    { label: 'Tue', sent: 16800, received: 9800, ai: 5100, failed: 38 },
    { label: 'Wed', sent: 19400, received: 11200, ai: 5900, failed: 52 },
    { label: 'Thu', sent: 18100, received: 10400, ai: 5400, failed: 41 },
    { label: 'Fri', sent: 22400, received: 13100, ai: 6800, failed: 60 },
    { label: 'Sat', sent: 15300, received: 9100, ai: 4600, failed: 32 },
    { label: 'Sun', sent: 13900, received: 8200, ai: 4100, failed: 28 }
  ],
  '30D': [
    { label: 'Week 1', sent: 84000, received: 48000, ai: 24000, failed: 210 },
    { label: 'Week 2', sent: 98000, received: 56000, ai: 29000, failed: 245 },
    { label: 'Week 3', sent: 112000, received: 64000, ai: 33000, failed: 280 },
    { label: 'Week 4', sent: 128492, received: 74000, ai: 38200, failed: 310 }
  ],
  '3M': [
    { label: 'Month 1', sent: 320000, received: 190000, ai: 95000, failed: 850 },
    { label: 'Month 2', sent: 390000, received: 230000, ai: 115000, failed: 920 },
    { label: 'Month 3', sent: 485000, received: 285000, ai: 142000, failed: 1100 }
  ],
  '1Y': [
    { label: 'Q1', sent: 850000, received: 510000, ai: 260000, failed: 2400 },
    { label: 'Q2', sent: 1120000, received: 680000, ai: 340000, failed: 2900 },
    { label: 'Q3', sent: 1450000, received: 890000, ai: 450000, failed: 3800 },
    { label: 'Q4', sent: 1890000, received: 1150000, ai: 580000, failed: 4500 }
  ]
}))

const currentChartData = computed(() => chartDatasets.value[activeTimeFilter.value])

// Compute max for SVG scaling
const maxDataValue = computed(() => {
  const values = currentChartData.value.flatMap(d => [d.sent, d.received, d.ai])
  return Math.max(...values, 100) * 1.15
})

// Generate SVG points string for polyline/polygon
const getPoints = (seriesKey: 'sent' | 'received' | 'ai' | 'failed') => {
  const data = currentChartData.value
  const width = 600
  const height = 180
  const paddingX = 20
  const paddingY = 20
  const availableWidth = width - paddingX * 2
  const availableHeight = height - paddingY * 2

  return data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * availableWidth
    const y = height - paddingY - (d[seriesKey] / maxDataValue.value) * availableHeight
    return `${x},${y}`
  }).join(' ')
}

const getAreaPoints = (seriesKey: 'sent' | 'received' | 'ai' | 'failed') => {
  const data = currentChartData.value
  const width = 600
  const height = 180
  const paddingX = 20
  const paddingY = 20
  const availableWidth = width - paddingX * 2
  const availableHeight = height - paddingY * 2

  const linePoints = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * availableWidth
    const y = height - paddingY - (d[seriesKey] / maxDataValue.value) * availableHeight
    return `${x},${y}`
  })

  const firstX = paddingX
  const lastX = paddingX + availableWidth
  const bottomY = height - paddingY

  return `${firstX},${bottomY} ${linePoints.join(' ')} ${lastX},${bottomY}`
}

const calculateCountdown = () => {
  const next = dashboardStore.stats.nextSchedule
  if (!next) {
    timeRemaining.value = 'No active schedules'
    return
  }

  const execTime = new Date(next.execTime).getTime()
  const now = new Date().getTime()
  const diff = execTime - now

  if (diff <= 0) {
    timeRemaining.value = 'Processing...'
    setTimeout(() => {
      dashboardStore.fetchStats()
    }, 3000)
    return
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts = []
  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
  parts.push(`${seconds}s`)

  timeRemaining.value = parts.join(' ')
}

onMounted(() => {
  dashboardStore.fetchStats()
  botStore.fetchBot()
  groupsStore.fetchGroups()
  timer = setInterval(calculateCountdown, 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

watch(() => dashboardStore.stats.nextSchedule, calculateCountdown)
</script>

<template>
  <div class="space-y-6">
    <!-- Header Greeting with Add Bot Button -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Good morning, Admin 👋
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Manage your Telegram automation from one place.
        </p>
      </div>

      <button
        type="button"
        @click="emit('open-add-bot')"
        class="tf-btn-primary px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shadow-sm"
      >
        <Plus class="w-4 h-4" />
        <span>+ Add Bot</span>
      </button>
    </div>

    <!-- 4 Key Statistics Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- 1. Active Bots -->
      <div
        @click="emit('navigate', 'bots')"
        class="tf-card tf-card-interactive p-5 cursor-pointer relative overflow-hidden group"
      >
        <div class="flex items-center justify-between">
          <div class="p-2.5 rounded-lg bg-sky-500/10 text-[#2481cc] border border-sky-500/20">
            <Bot class="w-5 h-5" />
          </div>
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <TrendingUp class="w-3.5 h-3.5" />
            ↑ 8.2%
          </span>
        </div>
        <div class="mt-4">
          <p class="text-xs font-medium text-slate-400">Active Bots</p>
          <div class="flex items-baseline gap-2 mt-1">
            <h3 class="text-2xl font-bold text-white">
              {{ botStore.isConfigured ? '1' : '12' }}
            </h3>
            <span class="text-[11px] text-emerald-400 font-medium">● 100% online</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1 truncate">
            {{ botStore.bot ? `@${botStore.bot.username}` : '12 connected instances' }}
          </p>
        </div>
      </div>

      <!-- 2. Groups -->
      <div
        @click="emit('navigate', 'groups')"
        class="tf-card tf-card-interactive p-5 cursor-pointer relative overflow-hidden group"
      >
        <div class="flex items-center justify-between">
          <div class="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Users class="w-5 h-5" />
          </div>
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <TrendingUp class="w-3.5 h-3.5" />
            ↑ 12.4%
          </span>
        </div>
        <div class="mt-4">
          <p class="text-xs font-medium text-slate-400">Groups</p>
          <div class="flex items-baseline gap-2 mt-1">
            <h3 class="text-2xl font-bold text-white">
              {{ dashboardStore.stats.totalGroups > 0 ? dashboardStore.stats.totalGroups : 48 }}
            </h3>
            <span class="text-[11px] text-slate-400 font-normal">communities</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1">
            Reaching ~48.2K total members
          </p>
        </div>
      </div>

      <!-- 3. Messages -->
      <div
        @click="emit('navigate', 'chat')"
        class="tf-card tf-card-interactive p-5 cursor-pointer relative overflow-hidden group"
      >
        <div class="flex items-center justify-between">
          <div class="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <MessageSquare class="w-5 h-5" />
          </div>
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <TrendingUp class="w-3.5 h-3.5" />
            ↑ 18.6%
          </span>
        </div>
        <div class="mt-4">
          <p class="text-xs font-medium text-slate-400">Messages</p>
          <div class="flex items-baseline gap-2 mt-1">
            <h3 class="text-2xl font-bold text-white">128,492</h3>
            <span class="text-[11px] text-slate-400 font-normal">processed</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1">
            {{ dashboardStore.stats.messagesSent || 342 }} outbound broadcasts
          </p>
        </div>
      </div>

      <!-- 4. Broadcasts -->
      <div
        @click="emit('navigate', 'broadcasts')"
        class="tf-card tf-card-interactive p-5 cursor-pointer relative overflow-hidden group"
      >
        <div class="flex items-center justify-between">
          <div class="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Send class="w-5 h-5" />
          </div>
          <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <TrendingUp class="w-3.5 h-3.5" />
            ↑ 6.8%
          </span>
        </div>
        <div class="mt-4">
          <p class="text-xs font-medium text-slate-400">Broadcasts</p>
          <div class="flex items-baseline gap-2 mt-1">
            <h3 class="text-2xl font-bold text-white">1,284</h3>
            <span class="text-[11px] text-slate-400 font-normal">dispatched</span>
          </div>
          <p class="text-[10px] text-slate-400 mt-1">
            99.4% delivery success rate
          </p>
        </div>
      </div>
    </div>

    <!-- Message Analytics Interactive Chart -->
    <div class="tf-card p-5 sm:p-6 space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 class="text-base font-bold text-white tracking-tight">Message Analytics</h3>
          <p class="text-xs text-slate-400 mt-0.5">Comprehensive inbound, outbound, and AI response volume</p>
        </div>

        <!-- Time Range Filters -->
        <div class="flex items-center rounded-lg bg-white/[0.04] p-1 border border-white/5 gap-1 self-start sm:self-auto">
          <button
            v-for="tf in timeFilters"
            :key="tf"
            type="button"
            @click="activeTimeFilter = tf"
            class="px-2.5 py-1 text-xs rounded-md transition-all font-medium cursor-pointer"
            :class="activeTimeFilter === tf
              ? 'bg-[#2481cc] text-white font-semibold shadow-sm'
              : 'text-slate-400 hover:text-white'"
          >
            {{ tf }}
          </button>
        </div>
      </div>

      <!-- Series Legend & Quick Filters -->
      <div class="flex flex-wrap items-center gap-4 text-xs">
        <button
          @click="activeSeries = 'all'"
          class="flex items-center gap-2 cursor-pointer transition-opacity"
          :class="activeSeries === 'all' ? 'opacity-100 font-semibold' : 'opacity-60 hover:opacity-100'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-[#2481cc]"></span>
          <span class="text-slate-200">All Metrics</span>
        </button>

        <button
          @click="activeSeries = 'sent'"
          class="flex items-center gap-2 cursor-pointer transition-opacity"
          :class="activeSeries === 'sent' ? 'opacity-100 font-semibold' : 'opacity-60 hover:opacity-100'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
          <span class="text-slate-200">Messages Sent</span>
        </button>

        <button
          @click="activeSeries = 'received'"
          class="flex items-center gap-2 cursor-pointer transition-opacity"
          :class="activeSeries === 'received' ? 'opacity-100 font-semibold' : 'opacity-60 hover:opacity-100'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
          <span class="text-slate-200">Messages Received</span>
        </button>

        <button
          @click="activeSeries = 'ai'"
          class="flex items-center gap-2 cursor-pointer transition-opacity"
          :class="activeSeries === 'ai' ? 'opacity-100 font-semibold' : 'opacity-60 hover:opacity-100'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span class="text-slate-200">AI Replies</span>
        </button>

        <button
          @click="activeSeries = 'failed'"
          class="flex items-center gap-2 cursor-pointer transition-opacity"
          :class="activeSeries === 'failed' ? 'opacity-100 font-semibold' : 'opacity-60 hover:opacity-100'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
          <span class="text-slate-200">Failed</span>
        </button>
      </div>

      <!-- Interactive SVG Chart Canvas -->
      <div class="relative w-full h-56 select-none">
        <svg viewBox="0 0 600 180" class="w-full h-full overflow-visible" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tf-gradient-sent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#2481cc" stop-opacity="0.3" />
              <stop offset="100%" stop-color="#2481cc" stop-opacity="0.0" />
            </linearGradient>
            <linearGradient id="tf-gradient-ai" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#10b981" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#10b981" stop-opacity="0.0" />
            </linearGradient>
          </defs>

          <!-- Horizontal Grid Lines -->
          <line x1="20" y1="20" x2="580" y2="20" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4" />
          <line x1="20" y1="65" x2="580" y2="65" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4" />
          <line x1="20" y1="110" x2="580" y2="110" stroke="rgba(255,255,255,0.05)" stroke-dasharray="4 4" />
          <line x1="20" y1="160" x2="580" y2="160" stroke="rgba(255,255,255,0.08)" />

          <!-- Filled Area for Sent -->
          <polygon
            v-if="activeSeries === 'all' || activeSeries === 'sent'"
            :points="getAreaPoints('sent')"
            fill="url(#tf-gradient-sent)"
            class="transition-all duration-300"
          />

          <!-- Filled Area for AI -->
          <polygon
            v-if="activeSeries === 'all' || activeSeries === 'ai'"
            :points="getAreaPoints('ai')"
            fill="url(#tf-gradient-ai)"
            class="transition-all duration-300"
          />

          <!-- Line: Sent Messages -->
          <polyline
            v-if="activeSeries === 'all' || activeSeries === 'sent'"
            :points="getPoints('sent')"
            fill="none"
            stroke="#2481cc"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-300"
          />

          <!-- Line: Received Messages -->
          <polyline
            v-if="activeSeries === 'all' || activeSeries === 'received'"
            :points="getPoints('received')"
            fill="none"
            stroke="#818cf8"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-300"
          />

          <!-- Line: AI Replies -->
          <polyline
            v-if="activeSeries === 'all' || activeSeries === 'ai'"
            :points="getPoints('ai')"
            fill="none"
            stroke="#10b981"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="transition-all duration-300"
          />

          <!-- Data Points with Hover Interaction -->
          <g v-for="(point, idx) in currentChartData" :key="idx">
            <circle
              v-if="activeSeries === 'all' || activeSeries === 'sent'"
              :cx="20 + (idx / (currentChartData.length - 1)) * 560"
              :cy="160 - (point.sent / maxDataValue) * 140"
              r="4"
              class="fill-[#2481cc] stroke-[var(--tf-card)] stroke-2 hover:r-6 cursor-pointer transition-all"
              @mouseenter="hoveredIndex = idx"
              @mouseleave="hoveredIndex = null"
            />
          </g>
        </svg>

        <!-- X Axis Labels -->
        <div class="flex justify-between px-4 mt-2 text-[10px] text-slate-400 font-mono">
          <span v-for="d in currentChartData" :key="d.label">{{ d.label }}</span>
        </div>

        <!-- Hover Tooltip Popup -->
        <div
          v-if="hoveredIndex !== null"
          class="absolute top-2 left-1/2 transform -translate-x-1/2 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-lg px-3 py-2 shadow-md text-xs z-30 pointer-events-none flex items-center gap-4"
        >
          <div class="font-bold text-white">{{ currentChartData[hoveredIndex].label }}</div>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="text-[#2481cc]">Sent: <strong>{{ currentChartData[hoveredIndex].sent.toLocaleString() }}</strong></span>
            <span class="text-indigo-400">Recv: <strong>{{ currentChartData[hoveredIndex].received.toLocaleString() }}</strong></span>
            <span class="text-emerald-400">AI: <strong>{{ currentChartData[hoveredIndex].ai.toLocaleString() }}</strong></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Upcoming Broadcast & System Audit Mini-Row -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: Next Scheduled Broadcast Countdown -->
      <div class="lg:col-span-6 tf-card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">Upcoming Broadcast</h4>
              <p class="text-[11px] text-slate-400">Scheduled automated delivery</p>
            </div>
          </div>

          <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
            {{ timeRemaining }}
          </span>
        </div>

        <div class="p-3.5 rounded-lg bg-white/[0.02] border border-white/5 space-y-2">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold text-white truncate">
              {{ dashboardStore.stats.nextSchedule?.title || 'Daily Morning Digest' }}
            </p>
            <span class="text-[10px] text-slate-400 font-mono">
              {{ dashboardStore.stats.nextSchedule?.time || '08:00 AM' }}
            </span>
          </div>
          <p class="text-[11px] text-slate-300 italic truncate">
            "{{ dashboardStore.stats.nextSchedule?.message || 'Good morning! Here is your daily automated community briefing.' }}"
          </p>
          <div class="flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400">
            <span>Destination: <strong>12 groups</strong></span>
            <button
              @click="emit('navigate', 'schedules')"
              class="text-[#2481cc] hover:underline cursor-pointer font-medium"
            >
              View in Scheduler →
            </button>
          </div>
        </div>
      </div>

      <!-- Right: System Automation Status -->
      <div class="lg:col-span-6 tf-card p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">Automation Engine</h4>
              <p class="text-[11px] text-slate-400">Health & edge execution status</p>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold uppercase">
            Operational
          </span>
        </div>

        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[10px] text-slate-400 uppercase font-semibold">Webhook</p>
            <p class="text-sm font-bold text-emerald-400 mt-1">Live</p>
          </div>
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[10px] text-slate-400 uppercase font-semibold">Gemini AI</p>
            <p class="text-sm font-bold text-[#2481cc] mt-1">Active</p>
          </div>
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[10px] text-slate-400 uppercase font-semibold">Moderation</p>
            <p class="text-sm font-bold text-purple-400 mt-1">Shielded</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
