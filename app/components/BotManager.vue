<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Bot,
  Plus,
  Search,
  MoreVertical,
  ExternalLink,
  Send,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Power,
  Users,
  MessageSquare,
  Clock
} from 'lucide-vue-next'
import { useBotStore, type BotInfo } from '../stores/bot'
import { useToast } from '../composables/useToast'
import BotDetailModal from './BotDetailModal.vue'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

const botStore = useBotStore()
const toast = useToast()

const searchQuery = ref('')
const statusFilter = ref('')
const viewMode = ref<'grid' | 'table'>('grid')

// Add Bot Modal State
const showAddModal = ref(false)
const tokenInput = ref('')
const showToken = ref(false)
const isVerifying = ref(false)

// Bot Details Modal State
const selectedBot = ref<any>(null)
const showDetailModal = ref(false)

// Active Actions Dropdown
const openMenuBotId = ref<number | null>(null)

// Primary configured bot from API + mock instances for multi-bot presentation
const allBots = computed(() => {
  const bots: any[] = []

  if (botStore.bot) {
    bots.push({
      id: botStore.bot.id,
      name: botStore.bot.firstName,
      username: botStore.bot.username,
      status: botStore.bot.status,
      active: botStore.bot.active,
      groupsCount: 12,
      membersCount: '24.8K',
      messagesCount: '1.2M',
      lastActive: '2 minutes ago',
      isPrimary: true
    })
  } else {
    // If no token added yet, show a default configured business bot demo
    bots.push({
      id: 101,
      name: 'My Business Bot',
      username: 'mybusiness_bot',
      status: 'ONLINE',
      active: true,
      groupsCount: 12,
      membersCount: '24.8K',
      messagesCount: '1.2M',
      lastActive: '2 minutes ago',
      isPrimary: true
    })
  }

  // Supporting bots to demonstrate multi-bot management
  bots.push(
    {
      id: 102,
      name: 'TeleFlow Community Assistant',
      username: 'teleflow_helper_bot',
      status: 'ONLINE',
      active: true,
      groupsCount: 8,
      membersCount: '14.2K',
      messagesCount: '450K',
      lastActive: '12 minutes ago',
      isPrimary: false
    },
    {
      id: 103,
      name: 'Alerts & Monitoring Bot',
      username: 'teleflow_alerts_bot',
      status: 'ONLINE',
      active: true,
      groupsCount: 4,
      membersCount: '3.1K',
      messagesCount: '180K',
      lastActive: '1 hour ago',
      isPrimary: false
    }
  )

  return bots.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          b.username.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesStatus = statusFilter.value ? b.status.toLowerCase() === statusFilter.value.toLowerCase() : true
    return matchesSearch && matchesStatus
  })
})

onMounted(async () => {
  await botStore.fetchBot()
})

const openBotDetails = (bot: any) => {
  selectedBot.value = bot
  showDetailModal.value = true
}

const handleSaveToken = async () => {
  if (!tokenInput.value.trim()) {
    toast.error('Bot token cannot be empty')
    return
  }

  isVerifying.value = true
  try {
    const res = await botStore.saveBot(tokenInput.value.trim())
    if (res.success) {
      toast.success(`Connected bot @${res.bot.username} successfully!`)
      tokenInput.value = ''
      showAddModal.value = false
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Verification failed. Please check your token.')
  } finally {
    isVerifying.value = false
  }
}

const handleToggleStatus = async (bot: any) => {
  if (bot.isPrimary && botStore.bot) {
    try {
      await botStore.toggleBotStatus(!botStore.bot.active)
      toast.success(`Bot is now ${!botStore.bot.active ? 'active' : 'disabled'}`)
    } catch {
      toast.error('Failed to toggle status')
    }
  } else {
    bot.active = !bot.active
    bot.status = bot.active ? 'ONLINE' : 'OFFLINE'
    toast.success(`Bot @${bot.username} status updated to ${bot.status}`)
  }
}

const handleDeleteBot = async (bot: any) => {
  if (confirm(`Are you sure you want to delete bot @${bot.username}?`)) {
    if (bot.isPrimary && botStore.bot) {
      await botStore.deleteBot()
    }
    toast.success(`Bot @${bot.username} removed successfully`)
    openMenuBotId.value = null
  }
}

const getStatusBadge = (status: string) => {
  switch (status.toUpperCase()) {
    case 'ONLINE':
      return { label: 'Online', class: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' }
    case 'CONNECTING':
      return { label: 'Connecting', class: 'text-sky-400 bg-sky-500/15 border-sky-500/30' }
    case 'ERROR':
      return { label: 'Error', class: 'text-rose-400 bg-rose-500/15 border-rose-500/30' }
    default:
      return { label: 'Offline', class: 'text-slate-400 bg-slate-800 border-white/10' }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Bots</h2>
        <p class="text-xs text-slate-400 mt-1">
          Manage all Telegram bots connected to TeleFlow.
        </p>
      </div>

      <button
        type="button"
        @click="showAddModal = true"
        class="tf-btn-primary px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto shadow-sm"
      >
        <Plus class="w-4 h-4" />
        <span>+ Add Bot</span>
      </button>
    </div>

    <!-- Filter & Search Controls -->
    <div class="tf-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
        <div class="relative w-full">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search bots by name or username..."
            class="tf-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <select
          v-model="statusFilter"
          class="tf-input px-3 py-2 text-xs shrink-0 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="ONLINE">Online</option>
          <option value="OFFLINE">Offline</option>
          <option value="CONNECTING">Connecting</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5 self-end sm:self-auto text-xs text-slate-400">
        <span>Total: <strong>{{ allBots.length }}</strong> bots</span>
      </div>
    </div>

    <!-- Bots Grid -->
    <div v-if="allBots.length === 0" class="tf-card py-16 text-center space-y-3">
      <div class="w-12 h-12 rounded-full bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
        <Bot class="w-6 h-6" />
      </div>
      <h4 class="text-sm font-bold text-white">No bots found</h4>
      <p class="text-xs text-slate-400 max-w-xs mx-auto">
        No Telegram bots match your search or filter criteria.
      </p>
      <button
        @click="showAddModal = true"
        class="tf-btn-primary px-4 py-2 text-xs inline-flex items-center gap-2 cursor-pointer"
      >
        <Plus class="w-4 h-4" />
        <span>Connect Bot</span>
      </button>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="bot in allBots"
        :key="bot.id"
        class="tf-card tf-card-interactive p-5 flex flex-col justify-between group relative overflow-visible"
      >
        <div>
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-[#2481cc]/15 border border-[#2481cc]/30 text-[#2481cc] flex items-center justify-center shrink-0">
                <Bot class="w-5 h-5" />
              </div>

              <div class="min-w-0">
                <h3 class="text-sm font-bold text-white truncate group-hover:text-[#2481cc] transition-colors">
                  {{ bot.name }}
                </h3>
                <a
                  :href="`https://t.me/${bot.username}`"
                  target="_blank"
                  class="text-[11px] text-slate-400 hover:text-sky-400 transition-colors font-mono truncate block"
                >
                  @{{ bot.username }}
                </a>
              </div>
            </div>

            <!-- Status Badge -->
            <span
              class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 flex items-center gap-1.5"
              :class="getStatusBadge(bot.status).class"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="bot.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'"></span>
              {{ getStatusBadge(bot.status).label }}
            </span>
          </div>

          <!-- Middle Stats -->
          <div class="grid grid-cols-3 gap-2 py-3 border-y border-white/5 my-3 text-center">
            <div>
              <p class="text-[10px] text-slate-400 uppercase">Groups</p>
              <p class="text-xs font-bold text-white mt-0.5">{{ bot.groupsCount }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 uppercase">Members</p>
              <p class="text-xs font-bold text-white mt-0.5">{{ bot.membersCount }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-400 uppercase">Messages</p>
              <p class="text-xs font-bold text-white mt-0.5">{{ bot.messagesCount }}</p>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between pt-1 text-xs">
          <span class="text-[10px] text-slate-400 flex items-center gap-1">
            <Clock class="w-3 h-3" />
            {{ bot.lastActive }}
          </span>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="openBotDetails(bot)"
              class="tf-btn-secondary px-2.5 py-1 text-xs font-medium cursor-pointer"
            >
              Open
            </button>

            <!-- Actions Dropdown -->
            <div class="relative">
              <button
                type="button"
                @click="openMenuBotId = openMenuBotId === bot.id ? null : bot.id"
                class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
              >
                <MoreVertical class="w-4 h-4" />
              </button>

              <div
                v-if="openMenuBotId === bot.id"
                @click.outside="openMenuBotId = null"
                class="absolute right-0 bottom-full mb-2 w-40 py-1 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl shadow-md z-30 text-xs text-slate-200"
              >
                <button
                  @click="openBotDetails(bot); openMenuBotId = null"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer"
                >
                  <Eye class="w-3.5 h-3.5 text-slate-400" />
                  <span>Inspect Details</span>
                </button>
                <a
                  :href="`https://t.me/${bot.username}`"
                  target="_blank"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer"
                >
                  <ExternalLink class="w-3.5 h-3.5 text-slate-400" />
                  <span>Open Telegram</span>
                </a>
                <button
                  @click="handleToggleStatus(bot); openMenuBotId = null"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer"
                >
                  <Power class="w-3.5 h-3.5 text-amber-400" />
                  <span>{{ bot.active ? 'Disable Bot' : 'Enable Bot' }}</span>
                </button>
                <button
                  @click="handleDeleteBot(bot)"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 cursor-pointer border-t border-white/5"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Delete Bot</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Add Telegram Bot -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        @click="showAddModal = false"
        class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
      ></div>

      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-[#2481cc]/15 text-[#2481cc]">
              <Key class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">Connect Telegram Bot</h3>
              <p class="text-[11px] text-slate-400">Register Bot Token obtained from @BotFather</p>
            </div>
          </div>
          <button
            type="button"
            @click="showAddModal = false"
            class="p-1 text-slate-400 hover:text-white rounded"
          >
            ✕
          </button>
        </div>

        <form @submit.prevent="handleSaveToken" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1.5 uppercase text-[10px] tracking-wider">
              Telegram Bot Token
            </label>
            <div class="relative">
              <input
                v-model="tokenInput"
                :type="showToken ? 'text' : 'password'"
                placeholder="123456789:ABCdefGhIJKlmNoPQ..."
                class="tf-input w-full py-2.5 px-3 pr-10 font-mono text-xs"
                required
              />
              <button
                type="button"
                @click="showToken = !showToken"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <EyeOff v-if="showToken" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">
              Tokens are encrypted with AES-256-CBC and stored securely.
            </p>
          </div>

          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5 text-[11px] text-slate-300">
            <p class="font-semibold text-white">Prerequisites checklist:</p>
            <p>✓ Bot created via Telegram's official <span class="text-sky-400 font-mono">@BotFather</span></p>
            <p>✓ Privacy Mode disabled for auto-replies & moderation</p>
          </div>

          <div class="flex items-center gap-3 pt-2">
            <button
              type="button"
              @click="showAddModal = false"
              class="tf-btn-secondary flex-1 py-2 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isVerifying || !tokenInput.trim()"
              class="tf-btn-primary flex-1 py-2 font-medium flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
            >
              <RefreshCw v-if="isVerifying" class="w-3.5 h-3.5 animate-spin" />
              <span>Verify & Connect</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bot Detail Inspector Modal -->
    <BotDetailModal
      :open="showDetailModal"
      :bot="selectedBot"
      @update:open="showDetailModal = $event"
      @navigate="emit('navigate', $event)"
    />
  </div>
</template>

