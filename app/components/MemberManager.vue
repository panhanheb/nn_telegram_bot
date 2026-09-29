<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Search, RotateCcw, RefreshCw, ChevronLeft, ChevronRight, Users, AlertCircle } from 'lucide-vue-next'
import { useGroupsStore } from '../stores/groups'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

type MemberRole = 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked'

interface MemberRow {
  chatId: string
  groupId: string | null
  groupName: string | null
  userId: number
  firstName: string | null
  lastName: string | null
  username: string | null
  isBot: boolean
  status: MemberRole
  messageCount: number
  firstSeen: string
  lastSeen: string
}

interface MembersResponse {
  total: number
  uniqueUsers: number
  limit: number
  offset: number
  members: MemberRow[]
}

const PAGE_SIZE = 50

const groupsStore = useGroupsStore()

const members = ref<MemberRow[]>([])
const total = ref(0)
const uniqueUsers = ref(0)
const page = ref(1)
const isLoading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)

const searchInput = ref('')
const search = ref('')
const chatFilter = ref('')
const roleFilter = ref('')

const hasFilters = computed(() => Boolean(search.value || chatFilter.value || roleFilter.value))
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

let requestSeq = 0
const fetchMembers = async (targetPage = page.value) => {
  const seq = ++requestSeq
  isLoading.value = true
  try {
    const query: Record<string, string | number> = { limit: PAGE_SIZE, offset: (targetPage - 1) * PAGE_SIZE }
    if (search.value) query.search = search.value
    if (chatFilter.value) query.chatId = chatFilter.value
    if (roleFilter.value) query.role = roleFilter.value
    const data = await $fetch<MembersResponse>('/api/members', { query })
    if (seq !== requestSeq) return
    members.value = data.members
    total.value = data.total
    uniqueUsers.value = data.uniqueUsers
    page.value = targetPage
    error.value = null
    loaded.value = true
  } catch (err: any) {
    if (seq !== requestSeq) return
    error.value = err?.data?.statusMessage || err?.statusMessage || err?.message || 'Failed to load members'
  } finally {
    if (seq === requestSeq) isLoading.value = false
  }
}

onMounted(() => {
  fetchMembers(1)
  if (!groupsStore.groups.length) groupsStore.fetchGroups()
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchInput, (value) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    search.value = value.trim()
  }, 300)
})
onBeforeUnmount(() => clearTimeout(searchTimer))

watch([search, chatFilter, roleFilter], () => fetchMembers(1))

const clearFilters = () => {
  clearTimeout(searchTimer)
  searchInput.value = ''
  search.value = ''
  chatFilter.value = ''
  roleFilter.value = ''
}

const rangeLabel = computed(() => {
  if (!total.value) return '0 members'
  const start = (page.value - 1) * PAGE_SIZE + 1
  const end = Math.min(total.value, page.value * PAGE_SIZE)
  return `${start.toLocaleString()}–${end.toLocaleString()} of ${total.value.toLocaleString()}`
})

// ---- Presentation helpers ----------------------------------------------

const displayName = (m: MemberRow) =>
  [m.firstName, m.lastName].filter(Boolean).join(' ') || (m.username ? `@${m.username}` : `User ${m.userId}`)

const initial = (m: MemberRow) => (displayName(m).replace(/^@/, '')[0] || '?').toUpperCase()

const roleMeta: Record<MemberRole, { label: string; class: string }> = {
  creator: { label: 'Owner', class: 'bg-amber-500/10 text-amber-400 border-amber-500/25' },
  administrator: { label: 'Admin', class: 'bg-sky-500/10 text-sky-400 border-sky-500/25' },
  member: { label: 'Member', class: 'bg-white/5 text-slate-300 border-white/10' },
  restricted: { label: 'Restricted', class: 'bg-rose-500/10 text-rose-400 border-rose-500/25' },
  left: { label: 'Left', class: 'bg-white/5 text-slate-400 border-white/10' },
  kicked: { label: 'Removed', class: 'bg-rose-500/10 text-rose-400 border-rose-500/25' }
}
const roleOf = (m: MemberRow) => roleMeta[m.status] ?? roleMeta.member

const relativeTime = (iso: string) => {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const min = Math.floor(Math.max(0, Date.now() - t) / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatFull = (iso: string) => new Date(iso).toLocaleString()
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Members</h2>
        <p class="text-xs text-slate-400 mt-1">
          People the bot has seen post in your groups, plus administrators found during sync.
        </p>
      </div>

      <div class="flex items-center gap-3 self-start sm:self-auto">
        <span v-if="loaded" class="text-xs text-slate-400 tabular-nums">
          <strong class="text-white font-semibold">{{ uniqueUsers.toLocaleString() }}</strong>
          {{ uniqueUsers === 1 ? 'person' : 'people' }}{{ hasFilters ? ' match' : '' }}
        </span>
        <button
          type="button"
          class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          :disabled="isLoading"
          @click="fetchMembers()"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" />
          <span>Refresh</span>
        </button>
      </div>
    </div>

    <!-- Filters -->
    <div class="tf-card p-3 flex flex-col lg:flex-row lg:items-center gap-2.5">
      <div class="relative w-full lg:w-72">
        <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          v-model="searchInput"
          type="search"
          placeholder="Search name, @username or user ID"
          class="tf-input w-full pl-9 pr-3 py-2 text-xs"
        />
      </div>

      <div class="flex flex-wrap items-center gap-2.5">
        <select v-model="chatFilter" class="tf-input px-3 py-2 text-xs cursor-pointer max-w-[220px]" aria-label="Group">
          <option value="">All groups</option>
          <option v-for="g in groupsStore.groups" :key="g.id" :value="g.chatId">{{ g.name }}</option>
        </select>

        <select v-model="roleFilter" class="tf-input px-3 py-2 text-xs cursor-pointer" aria-label="Role">
          <option value="">All roles</option>
          <option value="creator">Owner</option>
          <option value="administrator">Admin</option>
          <option value="member">Member</option>
          <option value="restricted">Restricted</option>
          <option value="left">Left</option>
          <option value="kicked">Removed</option>
        </select>

        <button
          v-if="hasFilters || searchInput"
          type="button"
          class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          @click="clearFilters"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Clear filters</span>
        </button>
      </div>

      <div class="lg:ml-auto text-xs text-slate-400 tabular-nums">{{ rangeLabel }}</div>
    </div>

    <!-- Error -->
    <div v-if="error" class="tf-card p-4 flex items-start gap-3 text-xs border-rose-500/30">
      <AlertCircle class="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-white">Couldn't load members</p>
        <p class="text-slate-400 mt-0.5 break-words">{{ error }}</p>
      </div>
      <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer" @click="fetchMembers()">
        Retry
      </button>
    </div>

    <div class="tf-card overflow-hidden">
      <!-- Initial loading -->
      <div v-if="!loaded && isLoading" class="divide-y divide-white/5">
        <div v-for="i in 6" :key="i" class="px-4 py-3.5 flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-white/5" />
          <div class="flex-1 space-y-2">
            <div class="h-3 w-1/4 rounded bg-white/5" />
            <div class="h-3 w-1/6 rounded bg-white/5" />
          </div>
          <div class="h-3 w-16 rounded bg-white/5" />
        </div>
      </div>

      <!-- Empty -->
      <div v-else-if="members.length === 0" class="py-14 px-6 flex flex-col items-center text-center text-xs">
        <div class="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center mb-3">
          <Users class="w-5 h-5 text-slate-400" />
        </div>
        <template v-if="hasFilters">
          <p class="text-sm font-semibold text-white">No members match these filters</p>
          <p class="text-slate-400 mt-1 max-w-sm">Try a different name, group or role.</p>
          <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs mt-4 cursor-pointer" @click="clearFilters">
            Clear filters
          </button>
        </template>
        <template v-else>
          <p class="text-sm font-semibold text-white">No members recorded yet</p>
          <p class="text-slate-400 mt-1 max-w-sm">
            Members are added when they post in a group the bot is in. Make sure the bot can read group messages.
          </p>
          <button type="button" class="tf-btn-secondary px-3 py-1.5 text-xs mt-4 cursor-pointer" @click="emit('navigate', 'groups')">
            Manage groups
          </button>
        </template>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto" :class="{ 'opacity-60': isLoading }">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-white/10 text-slate-400 font-medium uppercase text-[10px]">
              <th class="py-3 px-4 font-medium">Member</th>
              <th class="py-3 px-4 font-medium">Group</th>
              <th class="py-3 px-4 font-medium">Role</th>
              <th class="py-3 px-4 font-medium text-right">Messages</th>
              <th class="py-3 px-4 font-medium text-right">Last seen</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5 text-slate-300">
            <tr
              v-for="m in members"
              :key="`${m.chatId}:${m.userId}`"
              class="hover:bg-white/[0.03] transition-colors"
            >
              <td class="py-3 px-4">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-[#2481cc]/15 text-[#2481cc] font-semibold text-xs flex items-center justify-center shrink-0">
                    {{ initial(m) }}
                  </div>
                  <div class="min-w-0">
                    <div class="font-semibold text-white truncate">{{ displayName(m) }}</div>
                    <div class="text-slate-400 truncate">
                      <span v-if="m.username">@{{ m.username }}</span>
                      <span v-else class="font-mono tabular-nums">ID {{ m.userId }}</span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="py-3 px-4">
                <span v-if="m.groupName" class="text-slate-300">{{ m.groupName }}</span>
                <span v-else class="text-slate-500 font-mono">{{ m.chatId }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium border" :class="roleOf(m).class">
                  {{ roleOf(m).label }}
                </span>
              </td>
              <td class="py-3 px-4 text-right tabular-nums text-white">
                {{ m.messageCount.toLocaleString() }}
              </td>
              <td class="py-3 px-4 text-right tabular-nums text-slate-400 whitespace-nowrap">
                <time :datetime="m.lastSeen" :title="formatFull(m.lastSeen)">{{ relativeTime(m.lastSeen) }}</time>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="total > PAGE_SIZE"
        class="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/10 text-xs"
      >
        <button
          type="button"
          class="tf-btn-secondary p-1.5 cursor-pointer"
          :disabled="isLoading || page <= 1"
          aria-label="Previous page"
          @click="fetchMembers(page - 1)"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>
        <span class="text-slate-400 tabular-nums min-w-[96px] text-center">Page {{ page }} of {{ totalPages }}</span>
        <button
          type="button"
          class="tf-btn-secondary p-1.5 cursor-pointer"
          :disabled="isLoading || page >= totalPages"
          aria-label="Next page"
          @click="fetchMembers(page + 1)"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
</template>
