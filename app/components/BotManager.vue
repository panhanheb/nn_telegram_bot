<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Bot,
  Plus,
  MoreVertical,
  ExternalLink,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  CheckCircle2,
  XCircle,
  Power,
  X,
  MousePointerClick
} from 'lucide-vue-next'
import { useBotStore } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'
import BotDetailModal from './BotDetailModal.vue'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

interface BotActivityStats {
  messagesSent: number
  failedDeliveries: number
  successRate: number
  totalLogs: number
  sentToday: number
}

const botStore = useBotStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const hasLoaded = ref(false)

// Add bot modal
const showAddModal = ref(false)
const tokenInput = ref('')
const showToken = ref(false)
const isVerifying = ref(false)

// Detail modal
const showDetailModal = ref(false)

// Actions menu
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)

// Real activity data (from delivery logs)
const stats = ref<BotActivityStats | null>(null)
const lastActivityAt = ref<string | null>(null)
const isRefreshingStatus = ref(false)
const isTogglingStatus = ref(false)

const bot = computed(() => botStore.bot)

const loadActivity = async () => {
  try {
    const [statsRes, logsRes] = await Promise.all([
      $fetch<BotActivityStats>('/api/dashboard/stats'),
      $fetch<{ logs: { sentAt: string }[] }>('/api/logs', { query: { page: 1, limit: 1 } })
    ])
    stats.value = statsRes
    lastActivityAt.value = logsRes.logs[0]?.sentAt || null
  } catch (error) {
    console.error('Failed to load bot activity:', error)
  }
}

const loadAll = async () => {
  await botStore.fetchBot()
  if (botStore.bot) {
    await Promise.all([groupsStore.fetchGroups(), loadActivity()])
  }
  hasLoaded.value = true
}

const onDocumentClick = (event: MouseEvent) => {
  if (menuOpen.value && menuRef.value && !menuRef.value.contains(event.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  loadAll()
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
})

const statusBadge = computed(() => {
  if (!bot.value) return null
  if (!bot.value.active) {
    return { label: 'Disabled', class: 'text-amber-400 bg-amber-500/10 border-amber-500/25', dot: 'bg-amber-400' }
  }
  if (bot.value.status === 'ONLINE') {
    return { label: 'Online', class: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25', dot: 'bg-emerald-400' }
  }
  return { label: 'Offline', class: 'text-slate-400 bg-white/5 border-white/10', dot: 'bg-slate-400' }
})

const permissionList = computed(() => {
  const p = bot.value?.permissions
  return [
    { label: 'Can join groups', enabled: !!p?.can_join_groups },
    { label: 'Reads all group messages (privacy mode off)', enabled: !!p?.can_read_all_group_messages },
    { label: 'Supports inline queries', enabled: !!p?.supports_inline_queries }
  ]
})

const formatNumber = (n: number) => n.toLocaleString()

const formatRelative = (iso: string | null) => {
  if (!iso) return null
  const diffMs = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return null
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d ago`
  return new Date(iso).toLocaleDateString()
}

const formatDate = (iso: string | undefined) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const openAddModal = () => {
  tokenInput.value = ''
  showToken.value = false
  showAddModal.value = true
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
      toast.success(`Connected @${res.bot.username}`)
      tokenInput.value = ''
      showAddModal.value = false
      await Promise.all([groupsStore.fetchGroups(), loadActivity()])
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || error.statusMessage || 'Verification failed. Check the token and try again.')
  } finally {
    isVerifying.value = false
  }
}

const handleVerify = async () => {
  menuOpen.value = false
  isRefreshingStatus.value = true
  try {
    const res = await botStore.verifyBot()
    if (res.success) {
      toast.success('Connection verified — bot is online')
    } else {
      toast.error(res.message || 'Bot could not be reached')
    }
  } catch (error: any) {
    toast.error(error.data?.statusMessage || error.statusMessage || 'Verification failed')
  } finally {
    isRefreshingStatus.value = false
  }
}

const handleToggleStatus = async () => {
  if (!bot.value) return
  menuOpen.value = false
  const next = !bot.value.active
  isTogglingStatus.value = true
  try {
    await botStore.toggleBotStatus(next)
    toast.success(next ? 'Bot enabled' : 'Bot disabled')
  } catch {
    toast.error('Failed to update bot status')
  } finally {
    isTogglingStatus.value = false
  }
}

const handleDeleteBot = async () => {
  if (!bot.value) return
  menuOpen.value = false
  const username = bot.value.username
  if (!confirm(`Remove bot @${username}? The stored token will be deleted.`)) return
  try {
    await botStore.deleteBot()
    showDetailModal.value = false
    stats.value = null
    lastActivityAt.value = null
    toast.success(`Removed @${username}`)
  } catch (error: any) {
    toast.error(error.data?.statusMessage || error.statusMessage || 'Failed to remove bot')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Bot</h2>
        <p class="text-xs text-slate-400 mt-1">
          The Telegram bot TeleFlow uses to deliver messages and manage your groups.
        </p>
      </div>

      <div v-if="bot" class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        <button
          type="button"
          @click="emit('navigate', 'menu')"
          class="tf-btn-primary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-[#2481cc] to-blue-600 hover:from-[#1d70b3] hover:to-blue-700"
        >
          <MousePointerClick class="w-3.5 h-3.5" />
          <span>Interactive Menu</span>
        </button>
        <button
          type="button"
          @click="handleVerify"
          :disabled="isRefreshingStatus"
          class="tf-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isRefreshingStatus }" />
          <span>{{ isRefreshingStatus ? 'Verifying…' : 'Verify connection' }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="!hasLoaded && !bot"
      class="tf-card p-5 space-y-4"
      aria-busy="true"
    >
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-lg bg-white/5"></div>
        <div class="space-y-2 flex-1">
          <div class="h-3 w-40 rounded bg-white/5"></div>
          <div class="h-2.5 w-24 rounded bg-white/5"></div>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="h-14 rounded-lg bg-white/5"></div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="!bot" class="tf-card py-14 px-6 text-center">
      <div class="w-12 h-12 rounded-lg bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
        <Bot class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-semibold text-white mt-4">No bot connected</h3>
      <p class="text-xs text-slate-400 max-w-sm mx-auto mt-1.5">
        Create a bot with @BotFather in Telegram, then paste its token here to start managing groups, broadcasts and moderation.
      </p>
      <button
        type="button"
        @click="openAddModal"
        class="tf-btn-primary px-4 py-2 text-xs inline-flex items-center gap-2 cursor-pointer mt-5"
      >
        <Plus class="w-4 h-4" />
        <span>Connect bot</span>
      </button>
    </div>

    <!-- Connected bot -->
    <template v-else>
      <div class="tf-card p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-11 h-11 rounded-lg bg-[#2481cc]/15 border border-[#2481cc]/30 text-[#2481cc] flex items-center justify-center shrink-0">
              <Bot class="w-5 h-5" />
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="text-sm font-semibold text-white truncate">{{ bot.firstName || bot.username }}</h3>
                <span
                  v-if="statusBadge"
                  class="px-2 py-0.5 rounded-md text-[11px] font-medium border flex items-center gap-1.5"
                  :class="statusBadge.class"
                >
                  <span class="w-1.5 h-1.5 rounded-full" :class="statusBadge.dot"></span>
                  {{ statusBadge.label }}
                </span>
              </div>
              <a
                :href="`https://t.me/${bot.username}`"
                target="_blank"
                rel="noopener"
                class="text-xs text-slate-400 hover:text-sky-400 transition-colors font-mono truncate block mt-0.5"
              >
                @{{ bot.username }}
              </a>
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              @click="showDetailModal = true"
              class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
            >
              Details
            </button>

            <div ref="menuRef" class="relative">
              <button
                type="button"
                @click="menuOpen = !menuOpen"
                class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
                aria-label="Bot actions"
              >
                <MoreVertical class="w-4 h-4" />
              </button>

              <div
                v-if="menuOpen"
                class="absolute right-0 top-full mt-1 w-48 py-1 tf-card-elevated z-30 text-xs text-slate-200"
              >
                <a
                  :href="`https://t.me/${bot.username}`"
                  target="_blank"
                  rel="noopener"
                  @click="menuOpen = false"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer"
                >
                  <ExternalLink class="w-3.5 h-3.5 text-slate-400" />
                  <span>Open in Telegram</span>
                </a>
                <button
                  type="button"
                  @click="menuOpen = false; emit('navigate', 'menu')"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer text-[#50a7ea]"
                >
                  <MousePointerClick class="w-3.5 h-3.5" />
                  <span>Configure Button Menu</span>
                </button>
                <button
                  type="button"
                  @click="handleVerify"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer"
                >
                  <RefreshCw class="w-3.5 h-3.5 text-slate-400" />
                  <span>Verify connection</span>
                </button>
                <button
                  type="button"
                  @click="handleToggleStatus"
                  :disabled="isTogglingStatus"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-white/5 cursor-pointer disabled:opacity-50"
                >
                  <Power class="w-3.5 h-3.5 text-slate-400" />
                  <span>{{ bot.active ? 'Disable bot' : 'Enable bot' }}</span>
                </button>
                <button
                  type="button"
                  @click="handleDeleteBot"
                  class="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-400 hover:bg-rose-500/10 cursor-pointer border-t border-white/5 mt-1 pt-1.5"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                  <span>Remove bot</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Real metrics -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <button
            type="button"
            @click="emit('navigate', 'groups')"
            class="text-left p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors cursor-pointer"
          >
            <p class="text-[11px] text-slate-400">Groups & channels</p>
            <p class="text-lg font-semibold text-white mt-0.5 tabular-nums">
              {{ formatNumber(groupsStore.groups.length) }}
            </p>
          </button>
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[11px] text-slate-400">Messages delivered</p>
            <p class="text-lg font-semibold text-white mt-0.5 tabular-nums">
              {{ stats ? formatNumber(stats.messagesSent) : '—' }}
            </p>
          </div>
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[11px] text-slate-400">Failed deliveries</p>
            <p
              class="text-lg font-semibold mt-0.5 tabular-nums"
              :class="stats && stats.failedDeliveries > 0 ? 'text-rose-400' : 'text-white'"
            >
              {{ stats ? formatNumber(stats.failedDeliveries) : '—' }}
            </p>
          </div>
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5">
            <p class="text-[11px] text-slate-400">Last delivery</p>
            <p class="text-lg font-semibold text-white mt-0.5 tabular-nums truncate">
              {{ formatRelative(lastActivityAt) || '—' }}
            </p>
          </div>
        </div>

        <!-- Permissions + meta -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-white/5 text-xs">
          <div>
            <h4 class="text-xs font-semibold text-white mb-2">Telegram capabilities</h4>
            <ul class="space-y-1.5">
              <li v-for="perm in permissionList" :key="perm.label" class="flex items-center gap-2 text-slate-300">
                <CheckCircle2 v-if="perm.enabled" class="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <XCircle v-else class="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span :class="perm.enabled ? '' : 'text-slate-400'">{{ perm.label }}</span>
              </li>
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-semibold text-white mb-2">Details</h4>
            <dl class="space-y-1.5">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Bot ID</dt>
              <dd class="text-slate-200 font-mono tabular-nums">{{ bot.id }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Connected</dt>
              <dd class="text-slate-200 tabular-nums">{{ formatDate(bot.createdAt) }}</dd>
            </div>
            <div v-if="stats && stats.totalLogs > 0" class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Delivery success rate</dt>
              <dd class="text-slate-200 tabular-nums">{{ stats.successRate }}%</dd>
            </div>
            </dl>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal: Connect bot -->
    <div v-if="showAddModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showAddModal = false" class="fixed inset-0 bg-slate-950/70"></div>

      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-lg bg-[#2481cc]/15 text-[#2481cc]">
              <Key class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Connect Telegram bot</h3>
              <p class="text-[11px] text-slate-400">Paste the token issued by @BotFather</p>
            </div>
          </div>
          <button
            type="button"
            @click="showAddModal = false"
            class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5"
            aria-label="Close"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <form @submit.prevent="handleSaveToken" class="space-y-4 text-xs">
          <div>
            <label class="block font-medium text-slate-300 mb-1.5 text-xs">Bot token</label>
            <div class="relative">
              <input
                v-model="tokenInput"
                :type="showToken ? 'text' : 'password'"
                placeholder="123456789:ABCdefGhIJKlmNoPQ..."
                class="tf-input w-full py-2.5 px-3 pr-10 font-mono text-xs"
                autocomplete="off"
                required
              />
              <button
                type="button"
                @click="showToken = !showToken"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                :aria-label="showToken ? 'Hide token' : 'Show token'"
              >
                <EyeOff v-if="showToken" class="w-4 h-4" />
                <Eye v-else class="w-4 h-4" />
              </button>
            </div>
            <p class="text-[11px] text-slate-400 mt-1.5">
              The token is encrypted before it is stored.
            </p>
          </div>

          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-1.5 text-[11px] text-slate-300">
            <p class="font-medium text-white">Before you connect</p>
            <p>Create the bot with <span class="text-sky-400 font-mono">@BotFather</span>.</p>
            <p>Disable privacy mode (/setprivacy) so the bot can read group messages for auto-replies and moderation.</p>
          </div>

          <div class="flex items-center gap-3 pt-1">
            <button
              type="button"
              @click="showAddModal = false"
              class="tf-btn-secondary flex-1 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="isVerifying || !tokenInput.trim()"
              class="tf-btn-primary flex-1 py-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw v-if="isVerifying" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isVerifying ? 'Verifying…' : 'Verify & connect' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Bot detail modal -->
    <BotDetailModal
      :open="showDetailModal"
      :bot="bot"
      :stats="stats"
      :last-activity-at="lastActivityAt"
      @update:open="showDetailModal = $event"
      @navigate="emit('navigate', $event)"
    />
  </div>
</template>
