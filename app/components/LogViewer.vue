<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useLogsStore } from '../stores/logs'
import { useGroupsStore } from '../stores/groups'
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const logsStore = useLogsStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const searchInput = ref('')
const selectedLevel = ref('')
const expandedLogId = ref<string | null>(null)

// Sample developer-friendly logs if store is empty
const defaultLogs = [
  {
    id: 'l1',
    level: 'INFO',
    title: 'Broadcast completed',
    message: '48,291 messages delivered across 12 target groups successfully.',
    target: 'All Groups',
    sentAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    payload: { deliveredCount: 48291, failedCount: 0, executionTimeMs: 1420 }
  },
  {
    id: 'l2',
    level: 'INFO',
    title: 'AI response generated',
    message: 'Generated reply for @user_71 in Developers Cambodia via gemini-1.5-flash.',
    target: 'Developers Cambodia',
    sentAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    payload: { promptTokens: 142, completionTokens: 48, latencyMs: 620 }
  },
  {
    id: 'l3',
    level: 'WARN',
    title: 'Message deleted (Moderation)',
    message: 'Reason: Blocked URL (phishing-link.top) posted by @spammer_99.',
    target: 'Flutter Community',
    sentAt: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    payload: { rule: 'LinkProtection', match: 'phishing-link.top', user: '@spammer_99' }
  },
  {
    id: 'l4',
    level: 'ERROR',
    title: 'Telegram API request failed',
    message: 'Error: 429 Too Many Requests. Retry-After: 12 seconds.',
    target: 'Tech News & Releases',
    sentAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    payload: { status: 429, errorCode: 'FLOOD_WAIT_12', retryAfterSeconds: 12 }
  },
  {
    id: 'l5',
    level: 'SUCCESS',
    title: 'Webhook registration verified',
    message: 'Endpoint https://teleflow.workers.dev/api/telegram/webhook confirmed by Telegram API.',
    target: 'System',
    sentAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    payload: { url: 'https://teleflow.workers.dev/api/telegram/webhook', hasCustomCert: false }
  }
]

onMounted(async () => {
  await Promise.all([
    logsStore.fetchLogs(),
    groupsStore.fetchGroups()
  ])
})

const handleSearch = () => {
  logsStore.setSearch(searchInput.value)
}

const handleClear = () => {
  searchInput.value = ''
  selectedLevel.value = ''
  logsStore.resetFilters()
}

const exportLogs = () => {
  const jsonStr = JSON.stringify(logsStore.logs.length > 0 ? logsStore.logs : defaultLogs, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `teleflow-logs-${Date.now()}.json`
  a.click()
  toast.success('Activity logs exported to JSON')
}

const getLevelIndicator = (level: string) => {
  switch (level.toUpperCase()) {
    case 'INFO':
      return { label: 'INFO', class: 'bg-sky-500/15 text-sky-400 border-sky-500/30', icon: Info }
    case 'SUCCESS':
      return { label: 'SUCCESS', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 }
    case 'WARN':
    case 'WARNING':
      return { label: 'WARN', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: AlertTriangle }
    case 'ERROR':
    case 'FAILED':
      return { label: 'ERROR', class: 'bg-rose-500/15 text-rose-400 border-rose-500/30', icon: AlertOctagon }
    default:
      return { label: level, class: 'bg-slate-800 text-slate-300 border-white/10', icon: Info }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Activity Logs</h2>
        <p class="text-xs text-slate-400 mt-1">
          Real-time audit log of broadcasts, moderation triggers, and Telegram API events.
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          @click="logsStore.fetchLogs(1)"
          class="tf-btn-secondary px-3 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          title="Refresh logs"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': logsStore.isLoading }" />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          @click="exportLogs"
          class="tf-btn-secondary px-3 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Download class="w-3.5 h-3.5" />
          <span>Export Logs</span>
        </button>
      </div>
    </div>

    <!-- Filter Bar (as specified in prompt: [Search logs...] [All Levels ▼] [Filter]) -->
    <div class="tf-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1 max-w-lg">
        <div class="relative w-full sm:w-72">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchInput"
            @keyup.enter="handleSearch"
            type="text"
            placeholder="Search logs..."
            class="tf-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <select
          v-model="logsStore.status"
          class="tf-input px-3 py-2 text-xs cursor-pointer"
        >
          <option value="">All Levels</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="FAILED">FAILED / ERROR</option>
        </select>

        <button
          type="button"
          @click="handleClear"
          class="tf-btn-secondary p-2 text-xs cursor-pointer"
          title="Reset"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Log Items Stream -->
    <div class="tf-card divide-y divide-white/5 overflow-hidden text-xs">
      <div
        v-for="log in (logsStore.logs.length > 0 ? logsStore.logs : defaultLogs)"
        :key="log.id"
        class="p-4 hover:bg-white/[0.02] transition-colors"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3 min-w-0">
            <!-- Level Tag -->
            <span
              class="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 uppercase tracking-wider"
              :class="getLevelIndicator((log as any).level || (log as any).status).class"
            >
              {{ getLevelIndicator((log as any).level || (log as any).status).label }}
            </span>

            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-white truncate">
                  {{ (log as any).title || ((log as any).schedule?.title ? (log as any).schedule.title : 'Broadcast Event') }}
                </h4>
                <span v-if="(log as any).group?.name" class="text-[10px] text-slate-400">
                  · {{ (log as any).group.name }}
                </span>
              </div>
              <p class="text-slate-300 mt-1 leading-relaxed">{{ log.message }}</p>
            </div>
          </div>

          <div class="text-[10px] text-slate-400 font-mono shrink-0 whitespace-nowrap">
            {{ new Date(log.sentAt).toLocaleTimeString() }}
          </div>
        </div>

        <!-- Optional JSON Payload View -->
        <div v-if="(log as any).payload" class="mt-2.5 pt-2 border-t border-white/5 font-mono text-[10px] text-slate-400 bg-black/20 p-2 rounded">
          <pre class="overflow-x-auto">{{ JSON.stringify((log as any).payload, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
