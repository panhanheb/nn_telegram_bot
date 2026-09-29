<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSchedulesStore, type Schedule } from '../stores/schedules'
import { useBotStore } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'
import {
  CalendarRange,
  Plus,
  Trash2,
  Edit2,
  Clock,
  RefreshCw,
  FileText,
  Image,
  Video,
  File,
  Globe,
  Users,
  Repeat,
  Copy,
  Pause,
  Play,
  Calendar as CalendarIcon,
  List as ListIcon,
  Activity,
  MoreVertical
} from 'lucide-vue-next'

const schedulesStore = useSchedulesStore()
const botStore = useBotStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const viewMode = ref<'list' | 'calendar' | 'timeline'>('list')

const showModal = ref(false)
const isEditing = ref(false)
const currentScheduleId = ref('')

// Form Fields
const formTitle = ref('')
const formType = ref<'one_time' | 'daily' | 'weekly' | 'monthly' | 'cron'>('daily')
const formTime = ref('08:00')
const formDayOfWeek = ref<number>(1)
const formDayOfMonth = ref<number>(1)
const formTimezone = ref('Asia/Phnom_Penh')
const formMessage = ref('')
const formMessageType = ref<'text' | 'photo' | 'video' | 'document'>('text')
const formMediaUrl = ref('')
const formParseMode = ref<'HTML' | 'MarkdownV2'>('HTML')
const formTargetGroupIds = ref<number[]>([])

// Live clock: re-renders relative times, and polls the server so the
// Telegram delivery times and next-run times stay current.
const now = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await Promise.all([
    schedulesStore.fetchSchedules(),
    botStore.fetchBot(),
    groupsStore.fetchGroups()
  ])
  clockTimer = setInterval(() => { now.value = Date.now() }, 15000)
  pollTimer = setInterval(() => {
    if (!showModal.value) schedulesStore.fetchSchedules()
  }, 30000)
})

onUnmounted(() => {
  clearInterval(clockTimer)
  clearInterval(pollTimer)
})

// "in 2h 15m" / "5m ago"
const relative = (iso: string) => {
  const diff = Math.round((new Date(iso).getTime() - now.value) / 60000)
  const abs = Math.abs(diff)
  const text =
    abs < 1 ? 'now'
    : abs < 60 ? `${abs}m`
    : abs < 1440 ? `${Math.floor(abs / 60)}h ${abs % 60}m`
    : `${Math.floor(abs / 1440)}d ${Math.floor((abs % 1440) / 60)}h`
  if (text === 'now') return 'just now'
  return diff > 0 ? `in ${text}` : `${text} ago`
}

// Absolute time in the schedule's own timezone, e.g. "Tue 30 Sep, 08:00".
const formatInTz = (iso: string, tz: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

// ── Calendar (real month, real occurrences) ──────────────────────────────
const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const shiftMonth = (delta: number) => {
  const d = calendarMonth.value
  calendarMonth.value = new Date(d.getFullYear(), d.getMonth() + delta, 1)
}
const calendarTitle = computed(() =>
  calendarMonth.value.toLocaleString('en-US', { month: 'long', year: 'numeric' })
)
const sameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const calendarCells = computed(() => {
  const first = calendarMonth.value
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const today = new Date(now.value)
  const cells: Array<{ day: number; isToday: boolean; items: Array<{ id: string; label: string }> } | null> = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(first.getFullYear(), first.getMonth(), day)
    const items = filteredSchedules.value
      .filter(s => {
        if (!s.isActive && s.type !== 'one_time') return false
        switch (s.type) {
          case 'daily': return true
          case 'weekly': return s.dayOfWeek === date.getDay()
          case 'monthly': return s.dayOfMonth === day
          // One-time and cron: show the concrete next run (or the past send for one-time).
          case 'one_time': {
            const at = s.nextRunAt || s.lastDelivery?.sentAt || s.lastExecutedAt
            return !!at && sameDate(new Date(at), date)
          }
          default:
            return !!s.nextRunAt && sameDate(new Date(s.nextRunAt), date)
        }
      })
      .map(s => ({ id: s.id, label: `${s.type === 'cron' ? '⏱' : s.time} ${s.title}` }))
    cells.push({ day, isToday: sameDate(date, today), items })
  }
  return cells
})

const openAddModal = () => {
  isEditing.value = false
  currentScheduleId.value = ''
  formTitle.value = ''
  formType.value = 'daily'
  formTime.value = '08:00'
  formDayOfWeek.value = 1
  formDayOfMonth.value = 1
  formTimezone.value = 'Asia/Phnom_Penh'
  formMessage.value = ''
  formMessageType.value = 'text'
  formMediaUrl.value = ''
  formParseMode.value = 'HTML'
  formTargetGroupIds.value = []
  showModal.value = true
}

const openEditModal = (s: Schedule) => {
  isEditing.value = true
  currentScheduleId.value = s.id
  formTitle.value = s.title
  formType.value = s.type || 'daily'
  formTime.value = s.time
  formDayOfWeek.value = s.dayOfWeek ?? 1
  formDayOfMonth.value = s.dayOfMonth ?? 1
  formTimezone.value = s.timezone || 'Asia/Phnom_Penh'
  formMessage.value = s.message
  formMessageType.value = s.messageType || 'text'
  formMediaUrl.value = s.mediaUrl || ''
  formParseMode.value = s.parseMode || 'HTML'
  formTargetGroupIds.value = Array.isArray(s.targetGroupIds) ? [...s.targetGroupIds] : []
  showModal.value = true
}

const duplicateSchedule = async (s: Schedule) => {
  try {
    await schedulesStore.addSchedule({
      title: `${s.title} (Copy)`,
      type: s.type,
      time: s.time,
      dayOfWeek: s.dayOfWeek,
      dayOfMonth: s.dayOfMonth,
      timezone: s.timezone,
      message: s.message,
      messageType: s.messageType,
      mediaUrl: s.mediaUrl,
      parseMode: s.parseMode,
      targetGroupIds: s.targetGroupIds
    })
    toast.success(`Duplicated schedule "${s.title}"`)
  } catch {
    toast.error('Failed to duplicate schedule')
  }
}

const handleSubmit = async () => {
  if (!formTitle.value.trim() || !formTime.value.trim() || !formMessage.value.trim()) {
    toast.error('Title, execution time, and message are required')
    return
  }

  const payload: any = {
    title: formTitle.value.trim(),
    type: formType.value,
    time: formTime.value.trim(),
    timezone: formTimezone.value,
    message: formMessage.value.trim(),
    messageType: formMessageType.value,
    mediaUrl: formMessageType.value !== 'text' ? formMediaUrl.value.trim() : '',
    parseMode: formParseMode.value,
    targetGroupIds: [...formTargetGroupIds.value]
  }

  if (formType.value === 'weekly') payload.dayOfWeek = formDayOfWeek.value
  if (formType.value === 'monthly') payload.dayOfMonth = formDayOfMonth.value

  try {
    if (isEditing.value) {
      await schedulesStore.updateSchedule(currentScheduleId.value, payload)
      toast.success('Schedule updated')
    } else {
      await schedulesStore.addSchedule(payload)
      toast.success('Schedule created')
    }
    showModal.value = false
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to save schedule')
  }
}

const handleToggleStatus = async (s: Schedule) => {
  try {
    const next = !s.isActive
    await schedulesStore.toggleScheduleStatus(s.id, next)
    s.isActive = next
    toast.success(`Schedule is now ${next ? 'active' : 'paused'}`)
  } catch {
    toast.error('Failed to toggle status')
  }
}

const handleDelete = async (id: string, title: string) => {
  if (confirm(`Delete schedule "${title}"?`)) {
    try {
      await schedulesStore.deleteSchedule(id)
      toast.success('Schedule deleted')
    } catch {
      toast.error('Failed to delete schedule')
    }
  }
}

const formatRecurrence = (s: Schedule) => {
  switch (s.type) {
    case 'daily': return '🔁 Every day'
    case 'weekly': return '🔁 Every week'
    case 'monthly': return '🔁 Every month'
    case 'cron': return `🔁 Cron: ${s.time}`
    default: return 'One-time'
  }
}

// Days of week
const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Alerts by group ───────────────────────────────────────────────────────
// Schedule targets are numeric group IDs; the groups store exposes them as strings.
const groupNameById = computed(() => {
  const map = new Map<number, string>()
  for (const g of groupsStore.groups) map.set(Number(g.id), g.name)
  return map
})

const toggleTarget = (id: string | number) => {
  const n = Number(id)
  const idx = formTargetGroupIds.value.indexOf(n)
  if (idx > -1) formTargetGroupIds.value.splice(idx, 1)
  else formTargetGroupIds.value.push(n)
}

// Human-readable target list for a schedule card ("All active groups" when empty).
const targetNames = (s: Schedule): string[] => {
  if (!s.targetGroupIds || s.targetGroupIds.length === 0) return []
  return s.targetGroupIds.map(id => groupNameById.value.get(Number(id)) || `Removed group #${id}`)
}

// 'all' = every schedule; otherwise a group ID - show schedules that reach that group
// (explicitly targeted, or sent to all groups).
const groupFilter = ref<string>('all')
const filteredSchedules = computed(() => {
  if (groupFilter.value === 'all') return schedulesStore.schedules
  const id = Number(groupFilter.value)
  return schedulesStore.schedules.filter(
    s => !s.targetGroupIds || s.targetGroupIds.length === 0 || s.targetGroupIds.map(Number).includes(id)
  )
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Broadcast Scheduler</h2>
        <p class="text-xs text-slate-400 mt-1">
          Automate recurring messages, announcements, and periodic community updates.
        </p>
      </div>

      <div class="flex items-center gap-3 self-start sm:self-auto">
        <!-- View Mode Switcher: Calendar | List | Timeline -->
        <div class="flex items-center rounded-lg bg-white/[0.04] p-1 border border-white/5 gap-1 text-xs">
          <button
            type="button"
            @click="viewMode = 'list'"
            class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'list' ? 'bg-[#2481cc] text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'"
          >
            <ListIcon class="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            @click="viewMode = 'calendar'"
            class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'calendar' ? 'bg-[#2481cc] text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'"
          >
            <CalendarIcon class="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
          <button
            type="button"
            @click="viewMode = 'timeline'"
            class="px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 cursor-pointer"
            :class="viewMode === 'timeline' ? 'bg-[#2481cc] text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'"
          >
            <Activity class="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>

        <button
          type="button"
          @click="openAddModal"
          class="tf-btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus class="w-4 h-4" />
          <span>New Schedule</span>
        </button>
      </div>
    </div>

    <!-- Filter alerts by group -->
    <div v-if="schedulesStore.schedules.length > 0" class="flex flex-wrap items-center gap-2 text-xs">
      <Users class="w-3.5 h-3.5 text-slate-400" />
      <span class="text-slate-400">Alerts for group:</span>
      <select v-model="groupFilter" class="tf-input p-1.5 text-xs min-w-[180px]">
        <option value="all">All groups</option>
        <option v-for="g in groupsStore.groups" :key="g.id" :value="g.id">{{ g.name }}</option>
      </select>
      <span class="text-slate-500">{{ filteredSchedules.length }} schedule(s)</span>
    </div>

    <!-- Empty State -->
    <div v-if="schedulesStore.schedules.length === 0" class="tf-card py-16 text-center space-y-3">
      <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
        <Clock class="w-6 h-6" />
      </div>
      <h4 class="text-sm font-semibold text-white">No schedules configured</h4>
      <p class="text-xs text-slate-400 max-w-xs mx-auto">
        Set up recurring broadcasts to automatically engage your communities.
      </p>
      <button
        @click="openAddModal"
        class="tf-btn-primary px-4 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        <span>Create Schedule</span>
      </button>
    </div>

    <div
      v-else-if="filteredSchedules.length === 0"
      class="tf-card py-10 text-center text-xs text-slate-400"
    >
      No alerts are scheduled for this group.
    </div>

    <!-- LIST VIEW: Cards matching prompt specification -->
    <div v-else-if="viewMode === 'list'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="s in filteredSchedules"
        :key="s.id"
        class="tf-card tf-card-interactive p-5 flex flex-col justify-between group relative overflow-visible"
      >
        <div>
          <!-- Title & Pause/Resume -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <h3 class="text-sm font-semibold text-white group-hover:text-[#2481cc] transition-colors truncate">
              📢 {{ s.title }}
            </h3>
            <button
              type="button"
              @click="handleToggleStatus(s)"
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="s.isActive ? 'bg-[#2481cc]' : 'bg-slate-800'"
              :title="s.isActive ? 'Pause Schedule' : 'Resume Schedule'"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="s.isActive ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Time & Frequency details (Matching prompt specification) -->
          <div class="space-y-1 text-xs mb-3">
            <p class="text-slate-300 font-medium">
              <template v-if="s.nextRunAt">
                Next: {{ formatInTz(s.nextRunAt, s.timezone) }}
                <span class="text-sky-400">({{ relative(s.nextRunAt) }})</span>
              </template>
              <template v-else>
                {{ s.isActive ? 'No upcoming run' : 'Paused' }} · {{ s.time }}
              </template>
            </p>
            <p class="text-[11px]" :class="s.lastDelivery?.failed ? 'text-amber-400' : 'text-slate-400'">
              <template v-if="s.lastDelivery?.sentAt">
                Last sent (Telegram): {{ formatInTz(s.lastDelivery.sentAt, s.timezone) }} · {{ relative(s.lastDelivery.sentAt) }}
                · ✓ {{ s.lastDelivery.delivered }}<template v-if="s.lastDelivery.failed"> · ✗ {{ s.lastDelivery.failed }} failed</template>
              </template>
              <template v-else-if="s.lastDelivery">
                Last run failed for all {{ s.lastDelivery.failed }} group(s)
              </template>
              <template v-else>Not sent yet</template>
            </p>
            <div class="flex flex-wrap gap-1 pt-0.5">
              <span
                v-if="targetNames(s).length === 0"
                class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300 text-[10px]"
              >
                👥 All active groups
              </span>
              <span
                v-for="name in targetNames(s)"
                :key="name"
                class="px-1.5 py-0.5 rounded bg-[#2481cc]/15 border border-[#2481cc]/30 text-sky-300 text-[10px] truncate max-w-[160px]"
              >
                👥 {{ name }}
              </span>
            </div>
            <p class="text-sky-400 font-medium text-[11px] pt-1">
              {{ formatRecurrence(s) }}
            </p>
          </div>

          <!-- Message Body Preview -->
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 text-[11px] text-slate-300 italic line-clamp-2 mb-4">
            "{{ s.message }}"
          </div>
        </div>

        <!-- Footer Status & Actions -->
        <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 border"
            :class="s.isActive ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' : 'text-slate-400 bg-slate-800 border-white/10'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="s.isActive ? 'bg-emerald-400' : 'bg-slate-400'"></span>
            {{ s.isActive ? 'Scheduled' : 'Paused' }}
          </span>

          <div class="flex items-center gap-1">
            <button
              @click="duplicateSchedule(s)"
              class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
              title="Duplicate"
            >
              <Copy class="w-3.5 h-3.5" />
            </button>
            <button
              @click="openEditModal(s)"
              class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
              title="Edit"
            >
              <Edit2 class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handleDelete(s.id, s.title)"
              class="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 cursor-pointer"
              title="Delete"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CALENDAR VIEW -->
    <div v-else-if="viewMode === 'calendar'" class="tf-card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-white">Monthly Broadcast Distribution</h3>
        <div class="flex items-center gap-2 text-xs">
          <button type="button" @click="shiftMonth(-1)" class="px-2 py-0.5 rounded hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer">‹</button>
          <span class="text-slate-300 min-w-[110px] text-center">{{ calendarTitle }}</span>
          <button type="button" @click="shiftMonth(1)" class="px-2 py-0.5 rounded hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer">›</button>
        </div>
      </div>

      <div class="grid grid-cols-7 gap-2 text-center text-xs">
        <div v-for="d in daysOfWeek" :key="d" class="font-semibold text-slate-400 py-1 uppercase text-[10px]">
          {{ d }}
        </div>
        <template v-for="(cell, i) in calendarCells" :key="i">
          <div v-if="!cell" class="min-h-[70px]" />
          <div
            v-else
            class="min-h-[70px] p-1.5 rounded-lg border text-left relative flex flex-col gap-1"
            :class="cell.isToday ? 'border-[#2481cc]/60 bg-[#2481cc]/5' : 'border-white/5 bg-white/[0.01]'"
          >
            <span class="text-[10px] font-mono" :class="cell.isToday ? 'text-sky-400 font-semibold' : 'text-slate-400'">{{ cell.day }}</span>
            <div
              v-for="item in cell.items.slice(0, 3)"
              :key="item.id"
              class="p-1 rounded bg-[#2481cc]/20 text-[#2481cc] text-[9px] font-medium truncate"
              :title="item.label"
            >
              {{ item.label }}
            </div>
            <span v-if="cell.items.length > 3" class="text-[9px] text-slate-500">+{{ cell.items.length - 3 }} more</span>
          </div>
        </template>
      </div>
    </div>

    <!-- TIMELINE VIEW -->
    <div v-else class="tf-card p-6 space-y-4">
      <h3 class="text-sm font-semibold text-white">24-Hour Broadcast Timeline</h3>
      <div class="relative pl-6 border-l-2 border-[#2481cc]/30 space-y-6 text-xs">
        <div
          v-for="s in filteredSchedules"
          :key="s.id"
          class="relative space-y-1"
        >
          <span class="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-[#2481cc] ring-4 ring-[var(--tf-card)]"></span>
          <p class="font-mono text-[10px] text-sky-400">{{ s.time }} · {{ formatRecurrence(s) }}</p>
          <h4 class="font-semibold text-white">{{ s.title }}</h4>
          <p class="text-slate-400 text-[11px]">
            {{ targetNames(s).length ? targetNames(s).join(', ') : 'All active groups' }}
          </p>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Schedule -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showModal = false" class="fixed inset-0 bg-slate-950/70" />
      <div class="relative w-full max-w-lg tf-card-elevated z-10 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 class="text-sm font-semibold text-white">
          {{ isEditing ? 'Edit Broadcast Schedule' : 'Create Broadcast Schedule' }}
        </h3>

        <form @submit.prevent="handleSubmit" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Schedule Title</label>
            <input v-model="formTitle" placeholder="E.g., Daily Promotion Announcement" class="tf-input w-full p-2.5" required />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Recurrence Type</label>
              <select v-model="formType" class="tf-input w-full p-2.5">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="one_time">One-time</option>
                <option value="cron">Cron Expression</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-300 mb-1">Execution Time</label>
              <input v-model="formTime" type="time" class="tf-input w-full p-2.5" required />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Timezone</label>
            <select v-model="formTimezone" class="tf-input w-full p-2.5">
              <option value="Asia/Phnom_Penh">Asia/Phnom Penh (GMT+7)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
              <option value="UTC">UTC (GMT+0)</option>
            </select>
          </div>

          <div v-if="formType === 'weekly'">
            <label class="block font-semibold text-slate-300 mb-1">Day of Week</label>
            <select v-model.number="formDayOfWeek" class="tf-input w-full p-2.5">
              <option v-for="(d, i) in daysOfWeek" :key="d" :value="i">{{ d }}</option>
            </select>
          </div>
          <div v-if="formType === 'monthly'">
            <label class="block font-semibold text-slate-300 mb-1">Day of Month</label>
            <input v-model.number="formDayOfMonth" type="number" min="1" max="31" class="tf-input w-full p-2.5" />
          </div>

          <!-- Target groups: which groups receive this alert -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="font-semibold text-slate-300">Send Alert To</label>
              <button
                v-if="formTargetGroupIds.length > 0"
                type="button"
                @click="formTargetGroupIds = []"
                class="text-[10px] text-sky-400 hover:text-white cursor-pointer"
              >
                Clear (send to all)
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mb-2">
              {{ formTargetGroupIds.length === 0
                ? 'No group selected: the alert goes to all active groups.'
                : `${formTargetGroupIds.length} group(s) selected.` }}
            </p>
            <div v-if="groupsStore.groups.length === 0" class="text-[11px] text-slate-500 italic">
              No groups yet. Add the bot to a group first.
            </div>
            <div v-else class="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-white/5 p-1.5">
              <label
                v-for="g in groupsStore.groups"
                :key="g.id"
                class="flex items-center gap-2 p-1.5 rounded-md hover:bg-white/[0.03] cursor-pointer"
              >
                <input
                  type="checkbox"
                  :checked="formTargetGroupIds.includes(Number(g.id))"
                  @change="toggleTarget(g.id)"
                  class="rounded text-[#2481cc]"
                />
                <span class="text-white truncate flex-1">{{ g.name }}</span>
                <span v-if="!g.isActive" class="text-[10px] text-amber-400">inactive</span>
                <span class="text-[10px] text-slate-500">{{ g.type }}</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">Broadcast Message Body</label>
            <textarea v-model="formMessage" rows="4" placeholder="Enter message text..." class="tf-input w-full p-2.5 resize-none" required></textarea>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button type="button" @click="showModal = false" class="tf-btn-secondary flex-1 py-2 font-medium">Cancel</button>
            <button type="submit" class="tf-btn-primary flex-1 py-2 font-medium">{{ isEditing ? 'Save Changes' : 'Create Schedule' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
