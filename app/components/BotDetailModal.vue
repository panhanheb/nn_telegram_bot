<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  X,
  Bot,
  ExternalLink,
  Send,
  MoreHorizontal,
  LayoutDashboard,
  MessageSquare,
  Users,
  Radio,
  Sparkles,
  ShieldAlert,
  ListTodo,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  RefreshCw
} from 'lucide-vue-next'
import { useBotStore, type BotInfo } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  open: boolean
  bot: any
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'navigate', tab: string): void
}>()

const botStore = useBotStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const activeTab = ref('Overview')
const tabs = [
  'Overview',
  'Messages',
  'Groups',
  'Members',
  'Broadcasts',
  'Automation',
  'AI',
  'Moderation',
  'Logs',
  'Settings'
]

// Direct Test Dispatcher State
const testChatId = ref('')
const testMessage = ref('')
const isSendingTest = ref(false)

const handleSendTest = async () => {
  if (!testChatId.value) {
    toast.error('Please select a destination target')
    return
  }
  if (!testMessage.value.trim()) {
    toast.error('Message content cannot be empty')
    return
  }

  isSendingTest.value = true
  try {
    const res = await botStore.testMessage(testChatId.value, testMessage.value.trim())
    if (res.success) {
      toast.success('Test message delivered to Telegram!')
      testMessage.value = ''
    }
  } catch (err: any) {
    toast.error(err.statusMessage || 'Failed to send test message')
  } finally {
    isSendingTest.value = false
  }
}

const copyUsername = () => {
  if (!props.bot?.username) return
  navigator.clipboard.writeText(`@${props.bot.username}`)
  toast.success('Bot username copied to clipboard')
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      @click="emit('update:open', false)"
      class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
    ></div>

    <!-- Modal Content -->
    <div class="relative w-full max-w-3xl tf-card-elevated z-10 max-h-[90vh] flex flex-col overflow-hidden">
      <!-- Bot Header -->
      <div class="p-6 border-b border-[var(--tf-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3.5 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-[#2481cc]/20 border border-[#2481cc]/40 text-[#2481cc] flex items-center justify-center shrink-0">
            <Bot class="w-6 h-6" />
          </div>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base font-bold text-white truncate">
                {{ bot?.firstName || bot?.username || 'Telegram Bot' }}
              </h3>
              <span
                class="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border"
                :class="bot?.status === 'ONLINE'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border-white/10'"
              >
                <span class="w-1.5 h-1.5 rounded-full" :class="bot?.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'"></span>
                {{ bot?.status || 'Online' }}
              </span>
            </div>

            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs text-slate-400 font-mono">@{{ bot?.username }}</span>
              <button
                @click="copyUsername"
                class="text-slate-400 hover:text-white transition-colors"
                title="Copy username"
              >
                <Copy class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <a
            :href="`https://t.me/${bot?.username}`"
            target="_blank"
            class="tf-btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5"
          >
            <span>Open Telegram</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </a>
          <button
            @click="activeTab = 'Settings'"
            class="tf-btn-primary px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Send class="w-3.5 h-3.5" />
            <span>Test Bot</span>
          </button>
          <button
            @click="emit('update:open', false)"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer ml-1"
          >
            <X class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Navigation Tabs (10 tabs as requested) -->
      <div class="flex items-center px-6 border-b border-[var(--tf-border)] overflow-x-auto no-scrollbar gap-1 bg-white/[0.01]">
        <button
          v-for="tab in tabs"
          :key="tab"
          @click="activeTab = tab"
          class="px-3 py-2.5 text-xs font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer"
          :class="activeTab === tab
            ? 'border-[#2481cc] text-white font-semibold'
            : 'border-transparent text-slate-400 hover:text-slate-200'"
        >
          {{ tab }}
        </button>
      </div>

      <!-- Tab Content Body -->
      <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
        <!-- Tab: Overview -->
        <div v-if="activeTab === 'Overview'" class="space-y-4">
          <div class="grid grid-cols-3 gap-3">
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-[10px] text-slate-400 uppercase font-semibold">Active Target Groups</p>
              <h4 class="text-xl font-bold text-white mt-1">12</h4>
              <p class="text-[10px] text-emerald-400 mt-0.5">● Connected</p>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-[10px] text-slate-400 uppercase font-semibold">Audience Reached</p>
              <h4 class="text-xl font-bold text-white mt-1">24.8K</h4>
              <p class="text-[10px] text-slate-400 mt-0.5">Subscribers & Members</p>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <p class="text-[10px] text-slate-400 uppercase font-semibold">Total Delivered</p>
              <h4 class="text-xl font-bold text-white mt-1">1.2M</h4>
              <p class="text-[10px] text-emerald-400 mt-0.5">99.8% Success</p>
            </div>
          </div>

          <!-- Telegram Permissions Checklist -->
          <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <h4 class="text-xs font-bold text-white uppercase tracking-wider">Bot Permissions & Capabilities</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                <span>Join Groups & Supergroups</span>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                <span>Read All Group Messages</span>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                <span>Delete Harmful Messages</span>
              </div>
              <div class="flex items-center gap-2">
                <CheckCircle2 class="w-4 h-4 text-emerald-400" />
                <span>Inline Queries & Bot Webhooks</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab: Settings / Test Dispatcher -->
        <div v-else-if="activeTab === 'Settings'" class="space-y-4">
          <div class="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
            <h4 class="text-xs font-bold text-white uppercase tracking-wider">Direct Message Dispatcher</h4>
            <p class="text-slate-400 text-[11px]">Send an instant manual payload through this bot to any group</p>

            <div class="space-y-3 pt-2">
              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">Destination Target</label>
                <select
                  v-model="testChatId"
                  class="tf-input w-full p-2.5 text-xs"
                >
                  <option value="">Select target destination...</option>
                  <option v-for="g in groupsStore.groups" :key="g.id" :value="g.chatId">
                    [{{ g.type.toUpperCase() }}] {{ g.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-slate-300 mb-1">Message Body (HTML supported)</label>
                <textarea
                  v-model="testMessage"
                  rows="3"
                  placeholder="Enter test message payload..."
                  class="tf-input w-full p-2.5 text-xs resize-none"
                ></textarea>
              </div>

              <button
                type="button"
                @click="handleSendTest"
                :disabled="isSendingTest || !testChatId || !testMessage.trim()"
                class="tf-btn-primary px-4 py-2 text-xs flex items-center gap-2 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw v-if="isSendingTest" class="w-3.5 h-3.5 animate-spin" />
                <Send v-else class="w-3.5 h-3.5" />
                <span>Send Test Message</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Default for other tabs: quick redirect -->
        <div v-else class="text-center py-10 space-y-3">
          <p class="text-slate-300 font-semibold">Manage {{ activeTab }} for @{{ bot?.username }}</p>
          <p class="text-slate-400 text-[11px]">Jump to dedicated full module in the dashboard</p>
          <button
            type="button"
            @click="emit('navigate', activeTab.toLowerCase()); emit('update:open', false)"
            class="tf-btn-secondary px-4 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Go to {{ activeTab }} Page</span>
            <ExternalLink class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

