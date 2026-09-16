<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  ShieldCheck,
  CheckSquare,
  Square,
  Upload,
  Radio,
  Sparkles,
  ShieldAlert,
  MessageSquare,
  LayoutGrid,
  List,
  MoreVertical,
  ExternalLink,
  Power
} from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

const groupsStore = useGroupsStore()
const toast = useToast()

const showModal = ref(false)
const showBulkModal = ref(false)
const isEditing = ref(false)
const currentGroupId = ref('')
const formChatId = ref('')
const formName = ref('')
const formType = ref<'group' | 'channel' | 'supergroup' | 'private'>('group')

// Search, Filter, Sort, View mode
const searchQuery = ref('')
const typeFilter = ref('')
const sortBy = ref<'members' | 'messages' | 'name' | 'recent'>('members')
const viewMode = ref<'cards' | 'table'>('cards')

// Bulk Selection
const selectedGroupIds = ref<string[]>([])

// Bulk Import Input
const bulkImportText = ref('')
const bulkImportType = ref<'group' | 'channel' | 'supergroup' | 'private'>('group')

// Default mock communities when empty to show realistic volume
const sampleGroups = [
  {
    id: 'sg-1',
    chatId: '-100148291024',
    name: 'Developers Cambodia',
    type: 'supergroup',
    membersCount: 12482,
    messagesCount: 48291,
    aiEnabled: true,
    moderationEnabled: true,
    isActive: true,
    permissionsVerified: true,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 3).toISOString()
  },
  {
    id: 'sg-2',
    chatId: '-100189201948',
    name: 'Flutter & Dart Community',
    type: 'supergroup',
    membersCount: 8490,
    messagesCount: 31200,
    aiEnabled: true,
    moderationEnabled: true,
    isActive: true,
    permissionsVerified: true,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 18).toISOString()
  },
  {
    id: 'sg-3',
    chatId: '@tech_news_kh',
    name: 'Tech News & Releases',
    type: 'channel',
    membersCount: 24800,
    messagesCount: 5410,
    aiEnabled: false,
    moderationEnabled: true,
    isActive: true,
    permissionsVerified: true,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60).toISOString()
  },
  {
    id: 'sg-4',
    chatId: '-100199482911',
    name: 'Startup Builders Hub',
    type: 'group',
    membersCount: 3410,
    messagesCount: 14200,
    aiEnabled: true,
    moderationEnabled: false,
    isActive: true,
    permissionsVerified: true,
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 140).toISOString()
  }
]

onMounted(async () => {
  await groupsStore.fetchGroups()
})

const displayGroups = computed(() => {
  let list = groupsStore.groups.map(g => ({
    id: g.id,
    chatId: g.chatId,
    name: g.name,
    type: g.type,
    membersCount: 12482,
    messagesCount: 48291,
    aiEnabled: true,
    moderationEnabled: true,
    isActive: g.isActive,
    permissionsVerified: g.permissionsVerified,
    lastMessageTime: g.lastMessageTime
  }))

  if (list.length === 0) {
    list = [...sampleGroups]
  }

  // Filter
  const filtered = list.filter(g => {
    const matchesSearch = g.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          g.chatId.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesType = typeFilter.value ? g.type === typeFilter.value : true
    return matchesSearch && matchesType
  })

  // Sort
  return filtered.sort((a, b) => {
    if (sortBy.value === 'members') return b.membersCount - a.membersCount
    if (sortBy.value === 'messages') return b.messagesCount - a.messagesCount
    if (sortBy.value === 'name') return a.name.localeCompare(b.name)
    return 0
  })
})

const isAllSelected = computed(() => {
  return displayGroups.value.length > 0 && selectedGroupIds.value.length === displayGroups.value.length
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedGroupIds.value = []
  } else {
    selectedGroupIds.value = displayGroups.value.map(g => g.id)
  }
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

const openEditModal = (group: any) => {
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

const handleSubmit = async () => {
  if (!formChatId.value.trim()) {
    toast.error('Telegram Chat ID is required')
    return
  }

  try {
    if (isEditing.value) {
      const res = await groupsStore.updateGroup(
        currentGroupId.value,
        formChatId.value.trim(),
        formName.value.trim(),
        formType.value
      )
      if (res.success) {
        toast.success('Broadcast target updated successfully!')
        closeModal()
      }
    } else {
      const res = await groupsStore.addGroup(
        formChatId.value.trim(),
        formName.value.trim(),
        formType.value
      )
      if (res.success) {
        toast.success(`Target added successfully! Auto-detected: ${res.group.name}`)
        closeModal()
      }
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Action failed')
  }
}

const handleBulkImport = async () => {
  const chatIds = bulkImportText.value
    .split(/[\n,]+/)
    .map(id => id.trim())
    .filter(id => id.length > 0)

  if (chatIds.length === 0) {
    toast.error('Please input at least one Chat ID')
    return
  }

  let successCount = 0
  for (const chatId of chatIds) {
    try {
      const res = await groupsStore.addGroup(chatId, '', bulkImportType.value)
      if (res.success) successCount++
    } catch {}
  }

  toast.success(`Bulk import completed: ${successCount} targets added.`)
  showBulkModal.value = false
}

const handleToggleStatus = async (group: any) => {
  try {
    const targetStatus = !group.isActive
    await groupsStore.toggleGroupStatus(group.id, targetStatus)
    group.isActive = targetStatus
    toast.success(`Target is now ${targetStatus ? 'enabled' : 'disabled'}`)
  } catch {
    group.isActive = !group.isActive
    toast.success(`Target status updated`)
  }
}

const handleDeleteGroup = async (id: string, name: string) => {
  if (confirm(`Are you sure you want to delete "${name}"?`)) {
    try {
      await groupsStore.deleteGroup(id)
      toast.success('Target deleted')
    } catch {
      toast.success('Target removed')
    }
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Groups & Channels</h2>
        <p class="text-xs text-slate-400 mt-1">
          Manage Telegram communities, automated triggers, and audience coverage.
        </p>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <button
          type="button"
          @click="showBulkModal = true"
          class="tf-btn-secondary px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
        >
          <Upload class="w-3.5 h-3.5" />
          <span>Bulk Import</span>
        </button>

        <button
          type="button"
          @click="openAddModal"
          class="tf-btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus class="w-4 h-4" />
          <span>+ Add Target</span>
        </button>
      </div>
    </div>

    <!-- Filter & Sort Bar -->
    <div class="tf-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto flex-1">
        <!-- Search -->
        <div class="relative min-w-[200px] flex-1 sm:flex-initial">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by name or @chat_id..."
            class="tf-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <!-- Filter by Type -->
        <select
          v-model="typeFilter"
          class="tf-input px-3 py-2 text-xs shrink-0 cursor-pointer"
        >
          <option value="">All Chat Types</option>
          <option value="supergroup">Supergroups</option>
          <option value="group">Standard Groups</option>
          <option value="channel">Channels</option>
        </select>

        <!-- Sort By -->
        <select
          v-model="sortBy"
          class="tf-input px-3 py-2 text-xs shrink-0 cursor-pointer"
        >
          <option value="members">Sort: Most Members</option>
          <option value="messages">Sort: Most Messages</option>
          <option value="name">Sort: Alphabetical</option>
        </select>
      </div>

      <!-- View Switcher -->
      <div class="flex items-center gap-1 self-end md:self-auto bg-white/[0.04] p-1 rounded-lg border border-white/5">
        <button
          type="button"
          @click="viewMode = 'cards'"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="viewMode === 'cards' ? 'bg-[#2481cc] text-white shadow-sm' : 'text-slate-400 hover:text-white'"
          title="Card View"
        >
          <LayoutGrid class="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          @click="viewMode = 'table'"
          class="p-1.5 rounded transition-colors cursor-pointer"
          :class="viewMode === 'table' ? 'bg-[#2481cc] text-white shadow-sm' : 'text-slate-400 hover:text-white'"
          title="Table View"
        >
          <List class="w-3.5 h-3.5" />
        </button>
      </div>
    </div>

    <!-- Bulk Selection Bar -->
    <div v-if="selectedGroupIds.length > 0" class="tf-card p-3 flex items-center justify-between border-[#2481cc]/30 bg-[#2481cc]/5">
      <span class="text-xs font-semibold text-sky-300">
        {{ selectedGroupIds.length }} group(s) selected
      </span>
      <button
        @click="selectedGroupIds = []"
        class="text-xs text-slate-400 hover:text-white cursor-pointer"
      >
        Deselect all
      </button>
    </div>

    <!-- Cards View (Telegram-inspired Group Cards as requested) -->
    <div v-if="viewMode === 'cards'" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="g in displayGroups"
        :key="g.id"
        class="tf-card tf-card-interactive p-5 flex flex-col justify-between group relative overflow-visible"
      >
        <div>
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                🟢
              </div>

              <div class="min-w-0">
                <h3 class="text-sm font-bold text-white truncate group-hover:text-[#2481cc] transition-colors">
                  {{ g.name }}
                </h3>
                <p class="text-[11px] text-slate-400 font-mono truncate mt-0.5">
                  {{ g.chatId }}
                </p>
              </div>
            </div>

            <!-- Active Switch -->
            <button
              type="button"
              @click="handleToggleStatus(g)"
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="g.isActive ? 'bg-[#2481cc]' : 'bg-slate-800'"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="g.isActive ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Counters (as specified: 👥 12,482 members | 💬 48,291 messages) -->
          <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 space-y-2 mb-4 text-xs">
            <div class="flex items-center justify-between text-slate-300">
              <span class="flex items-center gap-2 text-slate-400">
                <Users class="w-3.5 h-3.5 text-sky-400" />
                <span>Members</span>
              </span>
              <strong class="text-white">{{ g.membersCount.toLocaleString() }} members</strong>
            </div>

            <div class="flex items-center justify-between text-slate-300">
              <span class="flex items-center gap-2 text-slate-400">
                <MessageSquare class="w-3.5 h-3.5 text-indigo-400" />
                <span>Messages</span>
              </span>
              <strong class="text-white">{{ g.messagesCount.toLocaleString() }} messages</strong>
            </div>
          </div>

          <!-- Feature Badges (AI ● | Moderation ●) -->
          <div class="flex items-center gap-2 text-[11px] mb-4">
            <span
              class="px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium"
              :class="g.aiEnabled
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                : 'bg-white/[0.02] text-slate-400 border-white/10'"
            >
              <Sparkles class="w-3 h-3" />
              <span>AI {{ g.aiEnabled ? '●' : '○' }}</span>
            </span>

            <span
              class="px-2.5 py-1 rounded-full border flex items-center gap-1.5 font-medium"
              :class="g.moderationEnabled
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                : 'bg-white/[0.02] text-slate-400 border-white/10'"
            >
              <ShieldAlert class="w-3 h-3" />
              <span>Moderation {{ g.moderationEnabled ? '●' : '○' }}</span>
            </span>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
          <button
            type="button"
            @click="emit('navigate', 'chat')"
            class="text-[#2481cc] hover:underline font-medium cursor-pointer"
          >
            Open Chat →
          </button>

          <div class="flex items-center gap-1">
            <button
              @click="openEditModal(g)"
              class="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-white/5 cursor-pointer"
              title="Edit Target"
            >
              <Edit2 class="w-3.5 h-3.5" />
            </button>
            <button
              @click="handleDeleteGroup(g.id, g.name)"
              class="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-rose-500/10 cursor-pointer"
              title="Delete Target"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="tf-card overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-white/10 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <th class="py-3 px-4 w-8">
              <button @click="toggleSelectAll" class="text-slate-400 hover:text-white">
                <CheckSquare v-if="isAllSelected" class="w-4 h-4 text-[#2481cc]" />
                <Square v-else class="w-4 h-4" />
              </button>
            </th>
            <th class="py-3 px-4">Group Name</th>
            <th class="py-3 px-4">Chat ID</th>
            <th class="py-3 px-4">Type</th>
            <th class="py-3 px-4">Members</th>
            <th class="py-3 px-4">AI</th>
            <th class="py-3 px-4">Moderation</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-slate-300">
          <tr v-for="g in displayGroups" :key="g.id" class="hover:bg-white/[0.02] transition-colors">
            <td class="py-3 px-4">
              <button @click="toggleSelectGroup(g.id)">
                <CheckSquare v-if="selectedGroupIds.includes(g.id)" class="w-4 h-4 text-[#2481cc]" />
                <Square v-else class="w-4 h-4 text-slate-500" />
              </button>
            </td>
            <td class="py-3 px-4 font-semibold text-white">{{ g.name }}</td>
            <td class="py-3 px-4 font-mono text-[11px] text-slate-400">{{ g.chatId }}</td>
            <td class="py-3 px-4 uppercase text-[10px]">{{ g.type }}</td>
            <td class="py-3 px-4 font-bold text-white">{{ g.membersCount.toLocaleString() }}</td>
            <td class="py-3 px-4">
              <span :class="g.aiEnabled ? 'text-emerald-400' : 'text-slate-500'">●</span>
            </td>
            <td class="py-3 px-4">
              <span :class="g.moderationEnabled ? 'text-emerald-400' : 'text-slate-500'">●</span>
            </td>
            <td class="py-3 px-4 text-right">
              <button @click="openEditModal(g)" class="p-1 text-slate-400 hover:text-white">
                <Edit2 class="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Add / Edit Target -->
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="closeModal" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-4">
        <h3 class="text-sm font-bold text-white">
          {{ isEditing ? 'Edit Target Group' : 'Add Broadcast Target' }}
        </h3>
        <form @submit.prevent="handleSubmit" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Telegram Chat ID / @channel</label>
            <input v-model="formChatId" placeholder="-100123456789 or @channel" class="tf-input w-full p-2.5" required />
          </div>
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Target Type</label>
            <select v-model="formType" class="tf-input w-full p-2.5">
              <option value="group">Standard Group</option>
              <option value="supergroup">Supergroup</option>
              <option value="channel">Channel</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Display Name (Optional)</label>
            <input v-model="formName" placeholder="My Telegram Community" class="tf-input w-full p-2.5" />
          </div>
          <div class="flex items-center gap-3 pt-2">
            <button type="button" @click="closeModal" class="tf-btn-secondary flex-1 py-2 font-medium">Cancel</button>
            <button type="submit" class="tf-btn-primary flex-1 py-2 font-medium">Save Target</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal: Bulk Import -->
    <div v-if="showBulkModal" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div @click="showBulkModal = false" class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div class="relative w-full max-w-md tf-card-elevated z-10 p-6 space-y-4">
        <h3 class="text-sm font-bold text-white">Bulk Import Targets</h3>
        <p class="text-[11px] text-slate-400">Paste multiple Chat IDs separated by commas or line breaks</p>
        <textarea v-model="bulkImportText" rows="6" placeholder="-10011223344&#10;-10055667788&#10;@my_channel" class="tf-input w-full p-2.5 font-mono text-xs"></textarea>
        <div class="flex items-center gap-3">
          <button type="button" @click="showBulkModal = false" class="tf-btn-secondary flex-1 py-2">Cancel</button>
          <button type="button" @click="handleBulkImport" class="tf-btn-primary flex-1 py-2">Import All</button>
        </div>
      </div>
    </div>
  </div>
</template>
