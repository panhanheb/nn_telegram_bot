<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLogsStore, type MessageLog } from '../stores/logs'
import { useGroupsStore } from '../stores/groups'
import {
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Download,
  ScrollText,
  AlertCircle
} from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const logsStore = useLogsStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const searchInput = ref(logsStore.search)
const expandedLogId = ref<string | null>(null)
const isExporting = ref(false)

onMounted(async () => {
  await Promise.all([
    logsStore.fetchLogs(1),
    groupsStore.groups.length ? Promise.resolve() : groupsStore.fetchGroups()
  ])
})

// Search runs on the server; debounce so each keystroke doesn't hit the API.
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (value.trim() !== logsStore.search) logsStore.setSearch(value)
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

const submitSearch = () => {
  clearTimeout(searchTimer)
  logsStore.setSearch(searchInput.value)
}

const statusModel = computed({
  get: () => logsStore.status,
  set: (value: string) => logsStore.setStatus(value)
})

const groupModel = computed({
  get: () => logsStore.groupId,
  set: (value: string) => logsStore.setGroupId(value)
})

const limitModel = computed({
  get: () => logsStore.pagination.limit,
  set: (value: number) => logsStore.setLimit(Number(value))
})

const handleClear = () => {
  clearTimeout(searchTimer)
  searchInput.value = ''
  expandedLogId.value = null
  logsStore.resetFilters()
}

const goToPage = (page: number) => {
  expandedLogId.value = null
  logsStore.setPage(page)
}

const rangeLabel = computed(() => {
  const { total, page, limit } = logsStore.pagination
  if (!total) return '0 entries'
  const start = (page - 1) * limit + 1
  const end = Math.min(total, page * limit)
  return `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
})

const exportLogs = async () => {
  if (!logsStore.pagination.total) return
  isExporting.value = true
  try {
    const all = await logsStore.fetchAllMatching()
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `teleflow-logs-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${all.length.toLocaleString()} log ${all.length === 1 ? 'entry' : 'entries'}`)
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || 'Failed to export logs')
  } finally {
    isExporting.value = false
  }
}

// ---- Classification of real log entries -------------------------------

type LogKind = 'broadcast' | 'moderation' | 'ai' | 'delete' | 'message'
type LogLevel = 'error' | 'warning' | 'success'

const kindLabels: Record<LogKind, string> = {
  broadcast: 'Broadcast',
  moderation: 'Moderation',
  ai: 'AI',
  delete: 'Deletion',
  message: 'Message'
}

const kindOf = (log: MessageLog): LogKind => {
  const text = log.message || ''
  if (log.scheduleId) return 'broadcast'
  if (text.startsWith('🧹 Auto-deleted') || text.startsWith('🔇 Muted') || /^Mute failed/.test(text)) return 'moderation'
  if (text.startsWith('🤖 AI replied') || /^AI reply/.test(text)) return 'ai'
  if (text.startsWith('🗑️') || text.startsWith('🧹 Cleared chat history') || /^Reply-command delete failed/.test(text)) return 'delete'
  return 'message'
}

const levelOf = (log: MessageLog, kind: LogKind): LogLevel => {
  if (log.status === 'FAILED') return 'error'
  if (kind === 'moderation') return 'warning'
  return 'success'
}

const titleOf = (log: MessageLog, kind: LogKind): string => {
  const failed = log.status === 'FAILED'
  switch (kind) {
    case 'broadcast': {
      const name = log.schedule?.title || 'Scheduled message'
      return failed ? `Broadcast failed: ${name}` : `Broadcast sent: ${name}`
    }
    case 'moderation':
      if (failed) return 'Moderation action failed'
      return log.message.startsWith('🔇') ? 'Member muted' : 'Message auto-deleted'
    case 'ai':
      return failed ? 'AI reply failed' : 'AI reply sent'
    case 'delete':
      if (failed) return 'Deletion failed'
      return log.message.startsWith('🧹') ? 'Chat history cleared' : 'Message deleted'
    default:
      return failed ? 'Message failed' : 'Message sent'
  }
}

const levelStyles: Record<LogLevel, { label: string; class: string; dot: string }> = {
  error: { label: 'Error', class: 'bg-rose-500/10 text-rose-400 border-rose-500/25', dot: 'bg-rose-400' },
  warning: { label: 'Warning', class: 'bg-amber-500/10 text-amber-400 border-amber-500/25', dot: 'bg-amber-400' },
  success: { label: 'Success', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', dot: 'bg-emerald-400' }
}

const rows = computed(() =>
  logsStore.logs.map((log) => {
    const kind = kindOf(log)
    const level = levelOf(log, kind)
    return { log, kind, kindLabel: kindLabels[kind], level, levelStyle: levelStyles[level], title: titleOf(log, kind) }
  })
)

const toggle = (id: string) => {
  expandedLogId.value = expandedLogId.value === id ? null : id
}

const formatTime = (iso: string) => {
  const d = new Date(iso)
  const sameDay = d.toDateString() === new Date().toDateString()
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const formatFull = (iso: string) => new Date(iso).toLocaleString()
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Activity logs</h2>
        <p class="text-xs text-slate-400 mt-1">
          Messages, broadcasts, moderation actions and AI replies recorded by the bot.
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          :disabled="logsStore.isLoading"
          title="Refresh logs"
          @click="logsStore.fetchLogs()"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': logsStore.isLoading }" />
          <span>Refresh</span>
        </button>

        <button
          type="button"
          class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          :disabled="isExporting || !logsStore.pagination.total"
          :title="logsStore.hasFilters ? 'Export all logs matching the current filters' : 'Export all logs'"
          @click="exportLogs"
        >
          <Download class="w-3.5 h-3.5" />
          <span>{{ isExporting ? 'Exporting…' : 'Export JSON' }}</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="tf-card p-3 flex flex-col lg:flex-row lg:items-center gap-2.5">
      <form class="relative w-full lg:w-72" @submit.prevent="submitSearch">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="Search message, error or group"
          class="tf-input w-full pl-9 pr-3 py-2 text-xs"
        />
      </form>

      <div class="flex flex-wrap items-center gap-2.5">
        <select v-model="statusModel" class="tf-input px-3 py-2 text-xs cursor-pointer" aria-label="Status">
          <option value="">All statuses</option>
          <option value="SUCCESS">Success</option>
          <option value="FAILED">Failed</option>
        </select>

        <select v-model="groupModel" class="tf-input px-3 py-2 text-xs cursor-pointer max-w-[220px]" aria-label="Group">
          <option value="">All groups</option>
          <option v-for="g in groupsStore.groups" :key="g.id" :value="String(g.id)">{{ g.name }}</option>
        </select>

        <button
          v-if="logsStore.hasFilters || searchInput"
          type="button"
          class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          @click="handleClear"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Clear filters</span>
        </button>
      </div>

      <div class="lg:ml-auto text-xs text-slate-400 tabular-nums">
        {{ rangeLabel }}
      </div>
    </div>

    <!-- Error state -->
    <div
      v-if="logsStore.error"
      class="tf-card p-4 flex items-start gap-3 text-xs border-rose-500/30"
    >
      <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-white">Couldn't load logs</p>
        <p class="text-slate-400 mt-0.5 break-words">{{ logsStore.error }}</p>
      </div>
      <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer" @click="logsStore.fetchLogs()">
        Retry
      </button>
    </div>

    <!-- Log list -->
    <div class="tf-card overflow-hidden text-xs">
      <!-- Initial loading -->
      <div v-if="!logsStore.loaded && logsStore.isLoading" class="divide-y divide-white/5">
        <div v-for="i in 6" :key="i" class="p-4 flex items-center gap-3">
          <div class="h-5 w-16 rounded-md bg-white/5" />
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/3 rounded bg-white/5" />
            <div class="h-3 w-2/3 rounded bg-white/5" />
          </div>
          <div class="h-3 w-12 rounded bg-white/5" />
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="rows.length === 0" class="py-14 px-6 flex flex-col items-center text-center">
        <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3">
          <ScrollText class="w-5 h-5 text-slate-400" />
        </div>
        <template v-if="logsStore.hasFilters">
          <p class="text-sm font-semibold text-white">No logs match these filters</p>
          <p class="text-slate-400 mt-1 max-w-sm">Try a different search term, status or group.</p>
          <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs mt-4 cursor-pointer" @click="handleClear">
            Clear filters
          </button>
        </template>
        <template v-else>
          <p class="text-sm font-semibold text-white">No activity yet</p>
          <p class="text-slate-400 mt-1 max-w-sm">
            Entries appear here when the bot sends a message or broadcast, moderates a chat, or replies with AI.
          </p>
        </template>
      </div>

      <!-- Entries -->
      <ul v-else class="divide-y divide-white/5" :class="{ 'opacity-60': logsStore.isLoading }">
        <li v-for="row in rows" :key="row.log.id">
          <button
            type="button"
            class="w-full text-left p-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
            :aria-expanded="expandedLogId === row.log.id"
            @click="toggle(row.log.id)"
          >
            <div class="flex items-start gap-3">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border shrink-0 w-[76px]"
                :class="row.levelStyle.class"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="row.levelStyle.dot" />
                {{ row.levelStyle.label }}
              </span>

              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-semibold text-white truncate">{{ row.title }}</span>
                  <span class="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] text-slate-400">
                    {{ row.kindLabel }}
                  </span>
                  <span class="text-slate-400 truncate">{{ row.log.group?.name }}</span>
                </div>
                <p class="text-slate-300 mt-1 leading-relaxed break-words line-clamp-2">{{ row.log.message }}</p>
                <p v-if="row.log.error" class="text-rose-400 mt-1 break-words line-clamp-1">{{ row.log.error }}</p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <time class="text-[11px] text-slate-400 tabular-nums whitespace-nowrap" :datetime="row.log.sentAt" :title="formatFull(row.log.sentAt)">
                  {{ formatTime(row.log.sentAt) }}
                </time>
                <ChevronDown
                  class="w-4 h-4 text-slate-500 transition-transform"
                  :class="{ 'rotate-180': expandedLogId === row.log.id }"
                />
              </div>
            </div>
          </button>

          <!-- Details: only fields the API actually returns -->
          <div v-if="expandedLogId === row.log.id" class="px-4 pb-4 sm:pl-[104px]">
            <dl class="tf-card-subtle p-3 grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-x-4 gap-y-2">
              <dt class="text-slate-400">Status</dt>
              <dd class="text-white">{{ row.log.status === 'FAILED' ? 'Failed' : 'Success' }}</dd>

              <dt class="text-slate-400">Time</dt>
              <dd class="text-white tabular-nums">{{ formatFull(row.log.sentAt) }}</dd>

              <dt class="text-slate-400">Group</dt>
              <dd class="text-white break-words">
                {{ row.log.group?.name }}
                <span v-if="row.log.group?.chatId" class="text-slate-400 font-mono ml-1">{{ row.log.group.chatId }}</span>
              </dd>

              <template v-if="row.log.scheduleId">
                <dt class="text-slate-400">Schedule</dt>
                <dd class="text-white">{{ row.log.schedule?.title || `#${row.log.scheduleId} (deleted)` }}</dd>
              </template>

              <dt class="text-slate-400">Message</dt>
              <dd class="text-slate-200 whitespace-pre-wrap break-words">{{ row.log.message }}</dd>

              <template v-if="row.log.error">
                <dt class="text-slate-400">Error</dt>
                <dd class="text-rose-400 whitespace-pre-wrap break-words font-mono text-[11px]">{{ row.log.error }}</dd>
              </template>

              <dt class="text-slate-400">Log ID</dt>
              <dd class="text-slate-400 font-mono text-[11px] break-all">{{ row.log.id }}</dd>
            </dl>
          </div>
        </li>
      </ul>

      <!-- Pagination -->
      <div
        v-if="logsStore.pagination.total > 0"
        class="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/10"
      >
        <label class="flex items-center gap-2 text-slate-400">
          <span>Rows per page</span>
          <select v-model="limitModel" class="tf-input px-2 py-1 text-xs cursor-pointer">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="tf-btn-secondary p-1.5 cursor-pointer"
            :disabled="logsStore.isLoading || logsStore.pagination.page <= 1"
            aria-label="Previous page"
            @click="goToPage(logsStore.pagination.page - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-slate-400 tabular-nums min-w-[96px] text-center">
            Page {{ logsStore.pagination.page }} of {{ logsStore.pagination.totalPages }}
          </span>
          <button
            type="button"
            class="tf-btn-secondary p-1.5 cursor-pointer"
            :disabled="logsStore.isLoading || logsStore.pagination.page >= logsStore.pagination.totalPages"
            aria-label="Next page"
            @click="goToPage(logsStore.pagination.page + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
