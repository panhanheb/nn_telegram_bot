<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Send,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  Paperclip,
  Smile,
  Image,
  Video,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Eye,
  FileText,
  RefreshCw,
  Sparkles
} from 'lucide-vue-next'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

const groupsStore = useGroupsStore()
const toast = useToast()

const currentStep = ref<number>(1)
const steps = [
  { num: 1, title: 'Message', desc: 'Compose content' },
  { num: 2, title: 'Audience', desc: 'Select groups' },
  { num: 3, title: 'Schedule', desc: 'Timing & frequency' },
  { num: 4, title: 'Review', desc: 'Telegram preview' }
]

// Step 1: Message
const messageText = ref('')
const parseMode = ref<'HTML' | 'MarkdownV2'>('HTML')
const mediaType = ref<'none' | 'photo' | 'video'>('none')
const mediaUrl = ref('')

// Step 2: Audience Selection
const selectedGroupIds = ref<string[]>([])
const availableGroups = computed(() => {
  if (groupsStore.groups.length > 0) {
    return groupsStore.groups.map(g => ({
      id: g.id,
      name: g.name,
      chatId: g.chatId,
      type: g.type,
      members: 12482
    }))
  }
  return [
    { id: 'g1', name: 'Developers Cambodia', chatId: '@developers_cambodia', type: 'supergroup', members: 12482 },
    { id: 'g2', name: 'Flutter Community', chatId: '@flutter_cambodia', type: 'supergroup', members: 8490 },
    { id: 'g3', name: 'Marketing & Growth', chatId: '@marketing_kh', type: 'group', members: 2890 },
    { id: 'g4', name: 'News & Announcements Channel', chatId: '@teleflow_news', type: 'channel', members: 24429 }
  ]
})

const selectAllRecipients = () => {
  if (selectedGroupIds.value.length === availableGroups.value.length) {
    selectedGroupIds.value = []
  } else {
    selectedGroupIds.value = availableGroups.value.map(g => g.id)
  }
}

const toggleRecipient = (id: string) => {
  const i = selectedGroupIds.value.indexOf(id)
  if (i === -1) selectedGroupIds.value.push(id)
  else selectedGroupIds.value.splice(i, 1)
}

const totalRecipientsCount = computed(() => {
  return availableGroups.value
    .filter(g => selectedGroupIds.value.includes(g.id))
    .reduce((sum, g) => sum + g.members, 0)
})

// Step 3: Schedule
const scheduleType = ref<'now' | 'later'>('now')
const scheduleDate = ref(new Date().toISOString().split('T')[0])
const scheduleTime = ref('09:00')
const timezone = ref('Asia/Phnom_Penh')

// Step 5: Send
const isSending = ref(false)

const handleSendNow = async () => {
  isSending.value = true
  setTimeout(() => {
    isSending.value = false
    toast.success(`Broadcast successfully sent to ${totalRecipientsCount.value.toLocaleString()} recipients across ${selectedGroupIds.value.length} targets!`)
    // Reset wizard
    currentStep.value = 1
    messageText.value = ''
    mediaUrl.value = ''
  }, 1200)
}

const handleSchedule = () => {
  toast.success(`Broadcast scheduled for ${scheduleDate.value} at ${scheduleTime.value} (${timezone.value})`)
  currentStep.value = 1
  messageText.value = ''
}

const nextStep = () => {
  if (currentStep.value === 1 && !messageText.value.trim()) {
    toast.error('Please write a message before proceeding')
    return
  }
  if (currentStep.value === 2 && selectedGroupIds.value.length === 0) {
    toast.error('Please select at least one recipient community')
    return
  }
  if (currentStep.value < 4) {
    currentStep.value++
  }
}

const prevStep = () => {
  if (currentStep.value > 1) {
    currentStep.value--
  }
}

// Initial selection
if (selectedGroupIds.value.length === 0) {
  selectedGroupIds.value = ['g1', 'g2']
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Broadcast Center</h2>
      <p class="text-xs text-slate-400 mt-1">
        Design and dispatch multichannel Telegram broadcasts with live message review.
      </p>
    </div>

    <!-- 5-Step Indicator -->
    <div class="tf-card p-4">
      <div class="grid grid-cols-4 gap-2">
        <div
          v-for="step in steps"
          :key="step.num"
          class="flex items-center gap-3 p-2 rounded-lg transition-all"
          :class="currentStep === step.num ? 'bg-[#2481cc]/15 border border-[#2481cc]/30' : (currentStep > step.num ? 'opacity-90' : 'opacity-40')"
        >
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0"
            :class="currentStep >= step.num ? 'bg-[#2481cc] text-white' : 'bg-slate-800 text-slate-400'"
          >
            {{ step.num }}
          </div>
          <div class="hidden sm:block min-w-0">
            <p class="text-xs font-bold text-white truncate">{{ step.title }}</p>
            <p class="text-[10px] text-slate-400 truncate">{{ step.desc }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Step 1: Compose Message -->
    <div v-if="currentStep === 1" class="tf-card p-6 space-y-5">
      <div class="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 class="text-sm font-bold text-white">Step 1: Write Broadcast Message</h3>
          <p class="text-[11px] text-slate-400">Craft your notification payload with text formatting and optional media.</p>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="parseMode = parseMode === 'HTML' ? 'MarkdownV2' : 'HTML'"
            class="px-2.5 py-1 rounded bg-white/5 text-[10px] font-mono text-slate-300 border border-white/10"
          >
            Format: {{ parseMode }}
          </button>
        </div>
      </div>

      <div class="space-y-4">
        <div class="relative">
          <textarea
            v-model="messageText"
            rows="6"
            placeholder="Write your broadcast message here... (e.g. 📢 Important Update: Version 2.0 is now live for all communities!)"
            class="tf-input w-full p-4 text-xs resize-none"
          ></textarea>
        </div>

        <!-- Attachment Selector -->
        <div class="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            @click="mediaType = mediaType === 'photo' ? 'none' : 'photo'"
            class="tf-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            :class="mediaType === 'photo' ? 'border-[#2481cc] text-[#2481cc]' : ''"
          >
            <Image class="w-3.5 h-3.5" />
            <span>Photo</span>
          </button>

          <button
            type="button"
            @click="mediaType = mediaType === 'video' ? 'none' : 'video'"
            class="tf-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
            :class="mediaType === 'video' ? 'border-[#2481cc] text-[#2481cc]' : ''"
          >
            <Video class="w-3.5 h-3.5" />
            <span>Video</span>
          </button>

          <input
            v-if="mediaType !== 'none'"
            v-model="mediaUrl"
            type="url"
            placeholder="https://example.com/media.jpg"
            class="tf-input px-3 py-1.5 text-xs flex-1 min-w-[200px]"
          />
        </div>
      </div>

      <div class="flex justify-end pt-4 border-t border-white/5">
        <button
          type="button"
          @click="nextStep"
          class="tf-btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <span>Next: Select Audience</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Step 2: Audience Selection -->
    <div v-else-if="currentStep === 2" class="tf-card p-6 space-y-5">
      <div class="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 class="text-sm font-bold text-white">Step 2: Select Audience</h3>
          <p class="text-[11px] text-slate-400">Choose the destination Telegram groups and broadcast channels.</p>
        </div>
        <button
          type="button"
          @click="selectAllRecipients"
          class="text-xs text-[#2481cc] hover:underline font-semibold cursor-pointer"
        >
          {{ selectedGroupIds.length === availableGroups.length ? 'Deselect All' : 'Select All Groups' }}
        </button>
      </div>

      <div class="space-y-2 max-h-80 overflow-y-auto no-scrollbar">
        <div
          v-for="group in availableGroups"
          :key="group.id"
          @click="toggleRecipient(group.id)"
          class="p-3 rounded-lg border flex items-center justify-between transition-colors cursor-pointer"
          :class="selectedGroupIds.includes(group.id)
            ? 'bg-[#2481cc]/10 border-[#2481cc]/30 text-white'
            : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/5'"
        >
          <div class="flex items-center gap-3">
            <input
              type="checkbox"
              :checked="selectedGroupIds.includes(group.id)"
              class="rounded text-[#2481cc] pointer-events-none"
            />
            <div>
              <p class="text-xs font-semibold">{{ group.name }}</p>
              <p class="text-[10px] text-slate-400 font-mono">{{ group.chatId }}</p>
            </div>
          </div>
          <span class="text-xs text-slate-300 font-medium">
            {{ group.members.toLocaleString() }} recipients
          </span>
        </div>
      </div>

      <!-- Recipient Summary Bar -->
      <div class="p-3.5 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-between text-xs">
        <span class="text-sky-300 font-medium">
          {{ selectedGroupIds.length }} destination groups selected
        </span>
        <strong class="text-white text-sm">
          {{ totalRecipientsCount.toLocaleString() }} total recipients
        </strong>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/5">
        <button
          type="button"
          @click="prevStep"
          class="tf-btn-secondary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          @click="nextStep"
          class="tf-btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <span>Next: Schedule Settings</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Step 3: Schedule Settings -->
    <div v-else-if="currentStep === 3" class="tf-card p-6 space-y-5">
      <div class="border-b border-white/5 pb-4">
        <h3 class="text-sm font-bold text-white">Step 3: Dispatch Timing</h3>
        <p class="text-[11px] text-slate-400">Choose whether to broadcast immediately or schedule for future delivery.</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          @click="scheduleType = 'now'"
          class="p-4 rounded-xl border cursor-pointer transition-all"
          :class="scheduleType === 'now' ? 'bg-[#2481cc]/15 border-[#2481cc]' : 'bg-white/[0.02] border-white/5'"
        >
          <div class="flex items-center gap-2.5 mb-1">
            <Send class="w-4 h-4 text-[#2481cc]" />
            <h4 class="text-xs font-bold text-white">Send Now</h4>
          </div>
          <p class="text-[11px] text-slate-400">Deliver immediately across all selected channels</p>
        </div>

        <div
          @click="scheduleType = 'later'"
          class="p-4 rounded-xl border cursor-pointer transition-all"
          :class="scheduleType === 'later' ? 'bg-[#2481cc]/15 border-[#2481cc]' : 'bg-white/[0.02] border-white/5'"
        >
          <div class="flex items-center gap-2.5 mb-1">
            <Clock class="w-4 h-4 text-amber-400" />
            <h4 class="text-xs font-bold text-white">Schedule for Later</h4>
          </div>
          <p class="text-[11px] text-slate-400">Pick a future date, time, and timezone</p>
        </div>
      </div>

      <div v-if="scheduleType === 'later'" class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div>
          <label class="block font-semibold text-slate-300 mb-1">Date</label>
          <input v-model="scheduleDate" type="date" class="tf-input w-full p-2.5" />
        </div>
        <div>
          <label class="block font-semibold text-slate-300 mb-1">Time</label>
          <input v-model="scheduleTime" type="time" class="tf-input w-full p-2.5" />
        </div>
        <div>
          <label class="block font-semibold text-slate-300 mb-1">Timezone</label>
          <select v-model="timezone" class="tf-input w-full p-2.5">
            <option value="Asia/Phnom_Penh">Asia/Phnom Penh (GMT+7)</option>
            <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
      </div>

      <div class="flex items-center justify-between pt-4 border-t border-white/5">
        <button
          type="button"
          @click="prevStep"
          class="tf-btn-secondary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <button
          type="button"
          @click="nextStep"
          class="tf-btn-primary px-5 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer"
        >
          <span>Next: Review & Preview</span>
          <ArrowRight class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Step 4: Review & Realistic Telegram Mobile Preview -->
    <div v-else-if="currentStep === 4" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: Review summary -->
      <div class="lg:col-span-7 tf-card p-6 space-y-5">
        <div class="border-b border-white/5 pb-4">
          <h3 class="text-sm font-bold text-white">Step 4: Final Review</h3>
          <p class="text-[11px] text-slate-400">Confirm all parameters before dispatching broadcast.</p>
        </div>

        <div class="space-y-3 text-xs">
          <div class="flex justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <span class="text-slate-400">Target Audiences:</span>
            <strong class="text-white">{{ selectedGroupIds.length }} groups ({{ totalRecipientsCount.toLocaleString() }} recipients)</strong>
          </div>
          <div class="flex justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <span class="text-slate-400">Dispatch Timing:</span>
            <strong class="text-white">{{ scheduleType === 'now' ? 'Send Immediately' : `${scheduleDate} @ ${scheduleTime}` }}</strong>
          </div>
          <div class="flex justify-between p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <span class="text-slate-400">Formatting Mode:</span>
            <strong class="text-white">{{ parseMode }}</strong>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center gap-3 pt-4 border-t border-white/5">
          <button
            type="button"
            @click="prevStep"
            class="tf-btn-secondary px-4 py-2.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft class="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <div class="flex-1"></div>
          <button
            type="button"
            @click="scheduleType === 'now' ? handleSendNow() : handleSchedule()"
            :disabled="isSending"
            class="tf-btn-primary px-6 py-2.5 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
          >
            <RefreshCw v-if="isSending" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
            <span>{{ scheduleType === 'now' ? 'Send Broadcast Now' : 'Confirm Schedule' }}</span>
          </button>
        </div>
      </div>

      <!-- Right: Mobile Telegram Preview Frame -->
      <div class="lg:col-span-5 flex justify-center">
        <div class="w-full max-w-sm rounded-3xl border-4 border-white/20 bg-slate-900/70 backdrop-blur-xl p-4 shadow-xl space-y-4 ring-1 ring-white/10">
          <div class="flex items-center justify-between text-[10px] text-slate-400 border-b border-white/10 pb-2">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span class="font-bold text-white">Telegram Preview</span>
            </div>
            <span>Today 14:30</span>
          </div>

          <!-- Telegram Outgoing Bubble Preview -->
          <div class="flex flex-col items-end">
            <div class="chat-bubble-out rounded-2xl rounded-tr-sm p-3.5 max-w-[85%] text-xs shadow-md space-y-2">
              <div v-if="mediaType === 'photo'" class="rounded-lg overflow-hidden max-h-40">
                <img :src="mediaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80'" class="w-full h-full object-cover" />
              </div>
              <p class="whitespace-pre-wrap leading-relaxed">{{ messageText }}</p>
              <div class="text-[9px] opacity-70 text-right">
                <span>14:30</span> ✓✓
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

