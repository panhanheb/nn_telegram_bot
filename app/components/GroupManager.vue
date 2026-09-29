<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupsStore, type TelegramGroup } from '../stores/groups'
import { useToast } from '../composables/useToast'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  CheckSquare,
  Square,
  Upload,
  Radio,
  LayoutGrid,
  List,
  Power,
  X
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

type GroupType = TelegramGroup['type']

const groupsStore = useGroupsStore()
const toast = useToast()

const hasLoaded = ref(false)

// Add / edit modal
const showModal = ref(false)
const isEditing = ref(false)
const isSaving = ref(false)
const currentGroupId = ref('')
const formChatId = ref('')
const formName = ref('')
const formType = ref<GroupType>('group')

// Search, filter, sort, view mode
const searchQuery = ref('')
const typeFilter = ref('')
const sortBy = ref<'recent' | 'name' | 'added'>('recent')
const viewMode = ref<'cards' | 'table'>('cards')

// Selection & bulk actions
const selectedGroupIds = ref<string[]>([])
const isBulkWorking = ref(false)

// Bulk import
const showBulkModal = ref(false)
const bulkImportText = ref('')
const bulkImportType = ref<GroupType>('group')
const isImporting = ref(false)

// Telegram sync
const isSyncingTelegram = ref(false)

onMounted(async () => {
  await groupsStore.fetchGroups()
  hasLoaded.value = true
})

const typeLabel = (type: GroupType) => {
  switch (type) {
    case 'supergroup': return 'Supergroup'
    case 'channel': return 'Channel'
    case 'private': return 'Private chat'
    default: return 'Group'
  }
}

const timeValue = (iso: string | null | undefined) => {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? 0 : t
}

const formatRelative = (iso: string | null | undefined) => {
  const t = timeValue(iso)
  if (!t) return null
  const minutes = Math.floor((Date.now() - t) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} d ago`
  return new Date(t).toLocaleDateString()
}

const formatDate = (iso: string | null | undefined) => {
  const t = timeValue(iso)
  return t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

const displayGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()

  const filtered = groupsStore.groups.filter(g => {
    const matchesSearch = !q || g.name.toLowerCase().includes(q) || g.chatId.toLowerCase().includes(q)
    const matchesType = typeFilter.value ? g.type === typeFilter.value : true
    return matchesSearch && matchesType
  })

  return [...filtered].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    if (sortBy.value === 'added') return timeValue(b.createdAt) - timeValue(a.createdAt)
    return timeValue(b.lastMessageTime) - timeValue(a.lastMessageTime)
  })
})

const counts = computed(() => {
  const all = groupsStore.groups
  return {
    total: all.length,
    active: all.filter(g => g.isActive).length,
    channels: all.filter(g => g.type === 'channel').length,
    admin: all.filter(g => g.isAdmin).length
  }
})

const isFiltering = computed(() => !!searchQuery.value.trim() || !!typeFilter.value)

const isAllSelected = computed(() => {
  return displayGroups.value.length > 0 && displayGroups.value.every(g => selectedGroupIds.value.includes(g.id))
})

const toggleSelectAll = () => {
  selectedGroupIds.value = isAllSelected.value ? [] : displayGroups.value.map(g => g.id)
}

const toggleSelectGroup = (id: string) => {
  const index = selectedGroupIds.value.indexOf(id)
  if (index === -1) selectedGroupIds.value.push(id)
  else selectedGroupIds.value.splice(index, 1)
}

const openAddModal = () => {
  isEditing.value = false
  currentGroupId.value = ''
  formChatId.value = ''
  formName.value = ''
  formType.value = 'group'
  showModal.value = true
}

const openEditModal = (group: TelegramGroup) => {
  isEditing.value = true
  currentGroupId.value = group.id
  formChatId.value = group.chatId
  formName.value = group.name
  formType.value = group.type || 'group'
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
}

const errorMessage = (error: any, fallback: string) =>
  error?.data?.statusMessage || error?.statusMessage || fallback

const handleSubmit = async () => {
  if (!formChatId.value.trim()) {
    toast.error('Telegram chat ID is required')
    return
  }

  isSaving.value = true
  try {
    if (isEditing.value) {
      const res = await groupsStore.updateGroup(
        currentGroupId.value,
        formChatId.value.trim(),
        formName.value.trim(),
        formType.value
      )
      if (res.success) {
        toast.success('Group updated')
        closeModal()
      }
    } else {
      const res = await groupsStore.addGroup(
        formChatId.value.trim(),
        formName.value.trim(),
        formType.value
      )
      if (res.success) {
        toast.success(`Added ${res.group.name}`)
        closeModal()
      }
    }
  } catch (error: any) {
    toast.error(errorMessage(error, 'Could not save group'))
  } finally {
    isSaving.value = false
  }
}

const handleBulkImport = async () => {
  const chatIds = bulkImportText.value
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0)

  if (chatIds.length === 0) {
    toast.error('Enter at least one chat ID')
    return
  }

  isImporting.value = true
  let successCount = 0
  for (const chatId of chatIds) {
    try {
      const res = await groupsStore.addGroup(chatId, '', bulkImportType.value)
      if (res.success) successCount++
    } catch {}
  }
  isImporting.value = false

  const failed = chatIds.length - successCount
  if (failed > 0) {
    toast.error(`Imported ${successCount} of ${chatIds.length}. ${failed} could not be added.`)
  } else {
    toast.success(`Imported ${successCount} ${successCount === 1 ? 'target' : 'targets'}`)
  }
  if (successCount > 0) {
    bulkImportText.value = ''
    showBulkModal.value = false
  }
}

const handleToggleStatus = async (group: TelegramGroup) => {
  const targetStatus = !group.isActive
  try {
    await groupsStore.toggleGroupStatus(group.id, targetStatus)
    toast.success(`${group.name} ${targetStatus ? 'enabled' : 'disabled'}`)
  } catch (error: any) {
    toast.error(errorMessage(error, 'Could not update status'))
  }
}

const handleDeleteGroup = async (group: TelegramGroup) => {
  if (!confirm(`Delete "${group.name}"? The bot will stop sending to this chat.`)) return
  try {
    await groupsStore.deleteGroup(group.id)
    selectedGroupIds.value = selectedGroupIds.value.filter(id => id !== group.id)
    toast.success('Group deleted')
  } catch (error: any) {
    toast.error(errorMessage(error, 'Could not delete group'))
  }
}

const handleBulkStatus = async (isActive: boolean) => {
  const ids = [...selectedGroupIds.value]
  if (ids.length === 0) return
  isBulkWorking.value = true
  const results = await Promise.allSettled(ids.map(id => groupsStore.toggleGroupStatus(id, isActive)))
  isBulkWorking.value = false
  const ok = results.filter(r => r.status === 'fulfilled').length
  if (ok === ids.length) toast.success(`${ok} ${ok === 1 ? 'group' : 'groups'} ${isActive ? 'enabled' : 'disabled'}`)
  else toast.error(`Updated ${ok} of ${ids.length} groups`)
}

const handleBulkDelete = async () => {
  const ids = [...selectedGroupIds.value]
  if (ids.length === 0) return
  if (!confirm(`Delete ${ids.length} selected ${ids.length === 1 ? 'group' : 'groups'}?`)) return
  isBulkWorking.value = true
  let ok = 0
  for (const id of ids) {
    try {
      await groupsStore.deleteGroup(id)
      ok++
    } catch {}
  }
  isBulkWorking.value = false
  selectedGroupIds.value = selectedGroupIds.value.filter(id => groupsStore.groups.some(g => g.id === id))
  if (ok === ids.length) toast.success(`Deleted ${ok} ${ok === 1 ? 'group' : 'groups'}`)
  else toast.error(`Deleted ${ok} of ${ids.length} groups`)
}

const handleSyncTelegram = async () => {
  isSyncingTelegram.value = true
  try {
    const res = await groupsStore.syncWithTelegram()
    toast.success(`Synced with Telegram: ${res.totalGroups} ${res.totalGroups === 1 ? 'chat' : 'chats'}`)
  } catch (err: any) {
    toast.error(errorMessage(err, err?.message || 'Failed to sync with Telegram'))
  } finally {
    isSyncingTelegram.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Groups & channels</h2>
        <p class="text-xs text-slate-400 mt-1">
          Telegram chats your bot can deliver to and moderate.
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto flex-wrap">
        <button
          type="button"
          @click="handleSyncTelegram"
          :disabled="isSyncingTelegram"
          class="tf-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
          title="Refresh chat names, types and admin rights from Telegram"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncingTelegram }" />
          <span>{{ isSyncingTelegram ? 'Syncing…' : 'Sync from Telegram' }}</span>
        </button>

        <button
          type="button"
          @click="showBulkModal = true"
          class="tf-btn-secondary px-3.5 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Upload class="w-3.5 h-3.5" />
          <span>Bulk import</span>
        </button>

        <button
          type="button"
          @click="openAddModal"
          class="tf-btn-primary px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Add group</span>
        </button>
      </div>
    </div>

    <!-- Summary -->
    <div v-if="counts.total > 0" class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-400">
      <span><strong class="text-white font-semibold tabular-nums">{{ counts.total }}</strong> total</span>
      <span><strong class="text-white font-semibold tabular-nums">{{ counts.active }}</strong> active</span>
      <span><strong class="text-white font-semibold tabular-nums">{{ counts.channels }}</strong> channels</span>
      <span><strong class="text-white font-semibold tabular-nums">{{ counts.admin }}</strong> with bot as admin</span>
    </div>

    <!-- Filter & sort bar -->
    <div v-if="counts.total > 0" class="tf-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
        <div class="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or chat ID"
            class="tf-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <select v-model="typeFilter" class="tf-input px-3 py-2 text-xs shrink-0 cursor-pointer">
          <option value="">All types</option>
          <option value="supergroup">Supergroups</option>
          <option value="group">Groups</option>
          <option value="channel">Channels</option>
          <option value="private">Private chats</option>
        </select>

        <select v-model="sortBy" class="tf-input px-3 py-2 text-xs shrink-0 cursor-pointer">
          <option value="recent">Sort: Last delivery</option>
          <option value="added">Sort: Recently added</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      <div class="flex items-center gap-1 self-end md:self-auto bg-white/[0.04] p-1 rounded-md border border-white/5">
        <button
          type="button"
          @click="viewMode = 'cards'"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="viewMode === 'cards' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
          title="Card view"
          aria-label="Card view"
        >
          <LayoutGrid class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          @click="viewMode = 'table'"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="viewMode === 'table' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
          title="Table view"
          aria-label="Table view"
        >
          <List class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Bulk selection bar -->
    <div
      v-if="selectedGroupIds.length > 0"
      class="tf-card p-3 flex flex-wrap items-center justify-between gap-3 border-[#2481cc]/30"
    >
      <span class="text-xs font-medium text-white tabular-nums">
        {{ selectedGroupIds.length }} selected
      </span>
      <div class="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          @click="handleBulkStatus(true)"
          :disabled="isBulkWorking"
          class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
        >
          Enable
        </button>
        <button
          type="button"
          @click="handleBulkStatus(false)"
          :disabled="isBulkWorking"
          class="tf-btn-secondary px-3 py-1.5 text-xs cursor-pointer"
        >
          Disable
        </button>
        <button
          type="button"
          @click="handleBulkDelete"
          :disabled="isBulkWorking"
          class="tf-btn-secondary px-3 py-1.5 text-xs text-rose-400 cursor-pointer flex items-center gap-1.5"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
        <button
          type="button"
          @click="selectedGroupIds = []"
          class="text-xs text-slate-400 hover:text-white cursor-pointer px-2"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="!hasLoaded && groupsStore.groups.length === 0"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      aria-busy="true"
    >
      <div v-for="i in 3" :key="i" class="tf-card p-5 space-y-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-white/5"></div>
          <div class="space-y-2 flex-1">
            <div class="h-3 w-32 rounded bg-white/5"></div>
            <div class="h-2.5 w-20 rounded bg-white/5"></div>
          </div>
        </div>
        <div class="h-16 rounded-lg bg-white/5"></div>
      </div>
    </div>

    <!-- Empty: no groups at all -->
    <div v-else-if="counts.total === 0" class="tf-card py-14 px-6 text-center">
      <div class="w-12 h-12 rounded-lg bg-white/5 border border-white/10 text-slate-400 mx-auto flex items-center justify-center">
        <Users class="w-6 h-6" />
      </div>
      <h3 class="text-sm font-semibold text-white mt-4">No groups or channels yet</h3>
      <p class="text-xs text-slate-400 max-w-sm mx-auto mt-1.5">
        Add your bot to a Telegram group or channel, then add it here by chat ID — or sync to pick up chats the bot already belongs to.
      </p>
      <div class="flex items-center justify-center gap-2 mt-5">
        <button
          type="button"
          @click="handleSyncTelegram"
          :disabled="isSyncingTelegram"
          class="tf-btn-secondary px-3.5 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncingTelegram }" />
          <span>Sync from Telegram</span>
        </button>
        <button
          type="button"
          @click="openAddModal"
          class="tf-btn-primary px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus class="w-4 h-4" />
          <span>Add group</span>
        </button>
      </div>
    </div>

    <!-- Empty: nothing matches filters -->
    <div v-else-if="displayGroups.length === 0" class="tf-card py-12 px-6 text-center">
      <h3 class="text-sm font-semibold text-white">No matching groups</h3>
      <p class="text-xs text-slate-400 mt-1.5">Try a different search or type filter.</p>
      <button
        v-if="isFiltering"
        type="button"
        @click="searchQuery = ''; typeFilter = ''"
        class="tf-btn-secondary px-3.5 py-2 text-xs mt-4 cursor-pointer"
      >
        Clear filters
      </button>
    </div>

    <!-- Cards view -->
    <div v-else-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="g in displayGroups"
        :key="g.id"
        class="tf-card tf-card-interactive p-5 flex flex-col justify-between"
        :class="selectedGroupIds.includes(g.id) ? 'border-[#2481cc]/50' : ''"
      >
        <div>
          <!-- Card header -->
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <button
                type="button"
                @click="toggleSelectGroup(g.id)"
                class="shrink-0 text-slate-500 hover:text-white cursor-pointer"
                :aria-label="selectedGroupIds.includes(g.id) ? 'Deselect' : 'Select'"
              >
                <CheckSquare v-if="selectedGroupIds.includes(g.id)" class="w-4 h-4 text-[#2481cc]" />
                <Square v-else class="w-4 h-4" />
              </button>
              <div
                class="w-10 h-10 rounded-lg border flex items-center justify-center shrink-0"
                :class="g.isActive
                  ? 'bg-[#2481cc]/10 border-[#2481cc]/25 text-[#2481cc]'
                  : 'bg-white/5 border-white/10 text-slate-500'"
              >
                <Radio v-if="g.type === 'channel'" class="w-4 h-4" />
                <Users v-else class="w-4 h-4" />
              </div>

              <div class="min-w-0">
                <h3 class="text-sm font-semibold text-white truncate">{{ g.name }}</h3>
                <p class="text-[11px] text-slate-400 font-mono truncate mt-0.5">{{ g.chatId }}</p>
              </div>
            </div>

            <!-- Active switch -->
            <button
              type="button"
              role="switch"
              :aria-checked="g.isActive"
              :title="g.isActive ? 'Enabled — click to disable' : 'Disabled — click to enable'"
              @click="handleToggleStatus(g)"
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="g.isActive ? 'bg-[#2481cc]' : 'bg-slate-700'"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="g.isActive ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Real attributes -->
          <dl class="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2 mb-4 text-xs">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Type</dt>
              <dd class="text-slate-200">{{ typeLabel(g.type) }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Bot role</dt>
              <dd class="flex items-center gap-1.5" :class="g.isAdmin ? 'text-emerald-400' : 'text-amber-400'">
                <ShieldCheck v-if="g.isAdmin" class="w-3.5 h-3.5" />
                <ShieldAlert v-else class="w-3.5 h-3.5" />
                <span>{{ g.isAdmin ? (g.permissionsVerified ? 'Admin · can delete' : 'Admin') : 'Not admin' }}</span>
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Last delivery</dt>
              <dd class="text-slate-200 tabular-nums">{{ formatRelative(g.lastMessageTime) || 'None yet' }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-400">Added</dt>
              <dd class="text-slate-200 tabular-nums">{{ formatDate(g.createdAt) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Footer actions -->
        <div class="flex items-center justify-between pt-3 border-t border-white/5 text-xs">
          <button
            type="button"
            @click="emit('navigate', 'chat')"
            class="text-[#2481cc] hover:underline font-medium cursor-pointer"
          >
            Open chat
          </button>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="openEditModal(g)"
              class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
              title="Edit"
              aria-label="Edit"
            >
              <Edit2 class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              @click="handleDeleteGroup(g)"
              class="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 cursor-pointer"
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table view -->
    <div v-else class="tf-card overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-white/10 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <th class="py-3 px-4 w-8">
              <button type="button" @click="toggleSelectAll" class="text-slate-400 hover:text-white" aria-label="Select all">
                <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-[#2481cc]" />
                <Square v-else class="w-4 h-4" />
              </button>
            </th>
            <th class="py-3 px-4">Name</th>
            <th class="py-3 px-4">Chat ID</th>
            <th class="py-3 px-4">Type</th>
            <th class="py-3 px-4">Bot role</th>
            <th class="py-3 px-4">Last delivery</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-slate-300">
          <tr v-for="g in displayGroups" :key="g.id" class="hover:bg-white/[0.02] transition-colors">
            <td class="py-3 px-4">
              <button type="button" @click="toggleSelectGroup(g.id)" :aria-label="selectedGroupIds.includes(g.id) ? 'Deselect' : 'Select'">
                <CheckSquare v-if="selectedGroupIds.includes(g.id)" class="w-4 h-4 text-[#2481cc]" />
                <Square v-else class="w-4 h-4 text-slate-500" />
              </button>
            </td>
            <td class="py-3 px-4 font-medium text-white">{{ g.name }}</td>
            <td class="py-3 px-4 font-mono text-[11px] text-slate-400">{{ g.chatId }}</td>
            <td class="py-3 px-4">{{ typeLabel(g.type) }}</td>
            <td class="py-3 px-4">
              <span :class="g.isAdmin ? 'text-emerald-400' : 'text-amber-400'">
                {{ g.isAdmin ? 'Admin' : 'Not admin' }}
              </span>
            </td>
            <td class="py-3 px-4 tabular-nums text-slate-400">{{ formatRelative(g.lastMessageTime) || '—' }}</td>
            <td class="py-3 px-4">
              <button
                type="button"
                @click="handleToggleStatus(g)"
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] cursor-pointer"
                :class="g.isActive
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                  : 'text-slate-400 bg-white/5 border-white/10'"
                :title="g.isActive ? 'Click to disable' : 'Click to enable'"
              >
                <Power class="w-3 h-3" />
                {{ g.isActive ? 'Active' : 'Disabled' }}
              </button>
            </td>
            <td class="py-3 px-4 text-right whitespace-nowrap">
              <button type="button" @click="openEditModal(g)" class="p-1 text-slate-400 hover:text-white rounded-md" aria-label="Edit">
                <Edit2 class="w-3.5 h-3.5" />
              </button>
              <button type="button" @click="handleDeleteGroup(g)" class="p-1 text-slate-400 hover:text-rose-400 rounded-md ml-1" aria-label="Delete">
                <Trash2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Add / edit -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="closeModal" class="fixed inset-0 bg-slate-950/70" />
      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">
            {{ isEditing ? 'Edit group' : 'Add group or channel' }}
          </h3>
          <button type="button" @click="closeModal" class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5" aria-label="Close">
            <X class="w-4 h-4" />
          </button>
        </div>
        <form @submit.prevent="handleSubmit" class="space-y-4 text-xs">
          <div>
            <label class="block font-medium text-slate-300 mb-1">Chat ID or @username</label>
            <input v-model="formChatId" placeholder="-100123456789 or @channel" class="tf-input w-full p-2.5 font-mono" required />
          </div>
          <div>
            <label class="block font-medium text-slate-300 mb-1">Type</label>
            <select v-model="formType" class="tf-input w-full p-2.5">
              <option value="group">Group</option>
              <option value="supergroup">Supergroup</option>
              <option value="channel">Channel</option>
            </select>
          </div>
          <div>
            <label class="block font-medium text-slate-300 mb-1">Display name <span class="text-slate-500">(optional)</span></label>
            <input v-model="formName" placeholder="Detected from Telegram if left empty" class="tf-input w-full p-2.5" />
          </div>
          <div class="flex items-center gap-3 pt-2">
            <button type="button" @click="closeModal" class="tf-btn-secondary flex-1 py-2">Cancel</button>
            <button type="submit" :disabled="isSaving" class="tf-btn-primary flex-1 py-2 flex items-center justify-center gap-2">
              <RefreshCw v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
              <span>{{ isEditing ? 'Save changes' : 'Add group' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Bulk import -->
    <div v-if="showBulkModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showBulkModal = false" class="fixed inset-0 bg-slate-950/70" />
      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-4 text-xs">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-white">Bulk import</h3>
          <button type="button" @click="showBulkModal = false" class="p-1 text-slate-400 hover:text-white rounded-md hover:bg-white/5" aria-label="Close">
            <X class="w-4 h-4" />
          </button>
        </div>
        <p class="text-slate-400">Paste chat IDs separated by commas or new lines. Names are detected from Telegram.</p>
        <textarea
          v-model="bulkImportText"
          rows="6"
          placeholder="-10011223344&#10;-10055667788&#10;@my_channel"
          class="tf-input w-full p-2.5 font-mono text-xs"
        ></textarea>
        <div>
          <label class="block font-medium text-slate-300 mb-1">Type</label>
          <select v-model="bulkImportType" class="tf-input w-full p-2.5">
            <option value="group">Group</option>
            <option value="supergroup">Supergroup</option>
            <option value="channel">Channel</option>
          </select>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" @click="showBulkModal = false" class="tf-btn-secondary flex-1 py-2">Cancel</button>
          <button
            type="button"
            @click="handleBulkImport"
            :disabled="isImporting || !bulkImportText.trim()"
            class="tf-btn-primary flex-1 py-2 flex items-center justify-center gap-2"
          >
            <RefreshCw v-if="isImporting" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isImporting ? 'Importing…' : 'Import' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
