<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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

onMounted(async () => {
  await Promise.all([
    schedulesStore.fetchSchedules(),
    botStore.fetchBot(),
    groupsStore.fetchGroups()
  ])
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
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Broadcast Scheduler</h2>
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

    <!-- Empty State -->
    <div v-if="schedulesStore.schedules.length === 0" class="tf-card py-16 text-center space-y-3">
      <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
        <Clock class="w-6 h-6" />
      </div>
      <h4 class="text-sm font-bold text-white">No schedules configured</h4>
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

    <!-- LIST VIEW: Cards matching prompt specification -->
    <div v-else-if="viewMode === 'list'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="s in schedulesStore.schedules"
        :key="s.id"
        class="tf-card tf-card-interactive p-5 flex flex-col justify-between group relative overflow-visible"
      >
        <div>
          <!-- Title & Pause/Resume -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <h3 class="text-sm font-bold text-white group-hover:text-[#2481cc] transition-colors truncate">
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
              Tomorrow · {{ s.time }}
            </p>
            <p class="text-slate-400 text-[11px]">
              12 groups · 48,291 recipients
            </p>
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
            class="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border"
            :class="s.isActive ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' : 'text-slate-400 bg-slate-800 border-white/10'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="s.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'"></span>
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
        <h3 class="text-sm font-bold text-white">Monthly Broadcast Distribution</h3>
        <span class="text-xs text-slate-400">September 2026</span>
      </div>

      <div class="grid grid-cols-7 gap-2 text-center text-xs">
        <div v-for="d in daysOfWeek" :key="d" class="font-bold text-slate-400 py-1 uppercase text-[10px]">
          {{ d }}
        </div>
        <div
          v-for="day in 30"
          :key="day"
          class="min-h-[70px] p-1.5 rounded-lg border border-white/5 bg-white/[0.01] text-left relative flex flex-col justify-between"
        >
          <span class="text-[10px] text-slate-400 font-mono">{{ day }}</span>
          <div v-if="day % 2 === 0" class="p-1 rounded bg-[#2481cc]/20 text-[#2481cc] text-[9px] font-medium truncate">
            08:00 AM Daily Broadcast
          </div>
        </div>
      </div>
    </div>

    <!-- TIMELINE VIEW -->
    <div v-else class="tf-card p-6 space-y-4">
      <h3 class="text-sm font-bold text-white">24-Hour Broadcast Timeline</h3>
      <div class="relative pl-6 border-l-2 border-[#2481cc]/30 space-y-6 text-xs">
        <div
          v-for="s in schedulesStore.schedules"
          :key="s.id"
          class="relative space-y-1"
        >
          <span class="absolute -left-[31px] top-0 w-3 h-3 rounded-full bg-[#2481cc] ring-4 ring-[var(--tf-card)]"></span>
          <p class="font-mono text-[10px] text-sky-400">{{ s.time }} (Daily)</p>
          <h4 class="font-bold text-white">{{ s.title }}</h4>
          <p class="text-slate-400 text-[11px]">12 targets · {{ s.parseMode }} formatting</p>
        </div>
      </div>
    </div>

    <!-- Modal: Create / Edit Schedule -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showModal = false" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div class="relative w-full max-w-lg tf-card-elevated z-10 p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <h3 class="text-sm font-bold text-white">
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
