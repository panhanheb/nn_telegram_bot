<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Users,
  Search,
  Crown,
  Shield,
  User,
  ShieldAlert,
  Ban,
  UserCheck,
  UserX,
  MessageSquare,
  MoreVertical,
  Filter
} from 'lucide-vue-next'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
}>()

const toast = useToast()

const searchQuery = ref('')
const roleFilter = ref('')
const statusFilter = ref('')

interface MemberRecord {
  id: number
  name: string
  username: string
  role: 'Creator' | 'Admin' | 'Member' | 'Restricted'
  status: 'Active' | 'Idle' | 'Banned'
  group: string
  messagesCount: number
  lastSeen: string
}

const members = ref<MemberRecord[]>([
  {
    id: 1,
    name: 'John Smith',
    username: 'johnsmith',
    role: 'Admin',
    status: 'Active',
    group: 'Developers Cambodia',
    messagesCount: 1420,
    lastSeen: '2 minutes ago'
  },
  {
    id: 2,
    name: 'Dara Kim',
    username: 'darakim',
    role: 'Member',
    status: 'Active',
    group: 'Developers Cambodia',
    messagesCount: 482,
    lastSeen: '15 minutes ago'
  },
  {
    id: 3,
    name: 'Alex Chan',
    username: 'alexchan',
    role: 'Member',
    status: 'Active',
    group: 'Flutter Dev Community',
    messagesCount: 890,
    lastSeen: '1 hour ago'
  },
  {
    id: 4,
    name: 'Sarah Connor',
    username: 'sarah_c',
    role: 'Creator',
    status: 'Active',
    group: 'Tech News & Releases',
    messagesCount: 3200,
    lastSeen: 'Just now'
  },
  {
    id: 5,
    name: 'Vannak Heng',
    username: 'vannak_h',
    role: 'Member',
    status: 'Idle',
    group: 'Developers Cambodia',
    messagesCount: 110,
    lastSeen: '2 days ago'
  },
  {
    id: 6,
    name: 'Spam Bot 3000',
    username: 'spammer_x',
    role: 'Restricted',
    status: 'Banned',
    group: 'Startup Builders Hub',
    messagesCount: 4,
    lastSeen: 'Yesterday'
  }
])

const filteredMembers = computed(() => {
  return members.value.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          m.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          m.group.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesRole = roleFilter.value ? m.role === roleFilter.value : true
    const matchesStatus = statusFilter.value ? m.status === statusFilter.value : true
    return matchesSearch && matchesRole && matchesStatus
  })
})

const promoteMember = (m: MemberRecord) => {
  m.role = 'Admin'
  toast.success(`Promoted ${m.name} to Group Administrator`)
}

const restrictMember = (m: MemberRecord) => {
  m.role = 'Restricted'
  toast.success(`Restricted ${m.name}'s posting permissions`)
}

const banMember = (m: MemberRecord) => {
  m.status = 'Banned'
  toast.success(`Banned ${m.name} from group`)
}

const unbanMember = (m: MemberRecord) => {
  m.status = 'Active'
  m.role = 'Member'
  toast.success(`Unbanned ${m.name}`)
}

const removeMember = (m: MemberRecord) => {
  members.value = members.value.filter(mem => mem.id !== m.id)
  toast.success(`Removed ${m.name} from directory`)
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'Creator': return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
    case 'Admin': return 'bg-sky-500/15 text-sky-400 border-sky-500/30'
    case 'Restricted': return 'bg-rose-500/15 text-rose-400 border-rose-500/30'
    default: return 'bg-white/5 text-slate-300 border-white/10'
  }
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'Active': return 'text-emerald-400'
    case 'Idle': return 'text-slate-400'
    case 'Banned': return 'text-rose-400'
    default: return 'text-slate-400'
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Members Management</h2>
        <p class="text-xs text-slate-400 mt-1">
          Monitor community members, manage moderation permissions, and track activity.
        </p>
      </div>

      <div class="text-xs text-slate-400">
        Total Discovered Members: <strong class="text-white">{{ members.length.toLocaleString() }}</strong>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="tf-card p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-2.5 w-full sm:w-auto flex-1 max-w-lg">
        <div class="relative w-full sm:w-64">
          <Search class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search member name or @username..."
            class="tf-input w-full pl-9 pr-3 py-2 text-xs"
          />
        </div>

        <select v-model="roleFilter" class="tf-input px-3 py-2 text-xs cursor-pointer">
          <option value="">All Roles</option>
          <option value="Creator">Creator</option>
          <option value="Admin">Admin</option>
          <option value="Member">Member</option>
          <option value="Restricted">Restricted</option>
        </select>

        <select v-model="statusFilter" class="tf-input px-3 py-2 text-xs cursor-pointer">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Idle">Idle</option>
          <option value="Banned">Banned</option>
        </select>
      </div>
    </div>

    <!-- Members Table (matching user prompt specification) -->
    <div class="tf-card overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="border-b border-white/10 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
            <th class="py-3 px-4">Avatar</th>
            <th class="py-3 px-4">Name</th>
            <th class="py-3 px-4">Username</th>
            <th class="py-3 px-4">Group</th>
            <th class="py-3 px-4">Role</th>
            <th class="py-3 px-4">Status</th>
            <th class="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5 text-slate-300">
          <tr v-for="m in filteredMembers" :key="m.id" class="hover:bg-white/[0.02] transition-colors">
            <td class="py-3.5 px-4 w-12">
              <div class="w-8 h-8 rounded-full bg-sky-500/20 text-[#2481cc] font-bold text-xs flex items-center justify-center">
                {{ m.name[0] }}
              </div>
            </td>
            <td class="py-3.5 px-4 font-semibold text-white">
              {{ m.name }}
            </td>
            <td class="py-3.5 px-4 font-mono text-slate-400">
              @{{ m.username }}
            </td>
            <td class="py-3.5 px-4 text-slate-300">
              {{ m.group }}
            </td>
            <td class="py-3.5 px-4">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border" :class="getRoleBadge(m.role)">
                {{ m.role }}
              </span>
            </td>
            <td class="py-3.5 px-4 font-medium" :class="getStatusBadge(m.status)">
              ● {{ m.status }}
            </td>
            <td class="py-3.5 px-4 text-right">
              <div class="flex items-center justify-end gap-1.5">
                <button
                  v-if="m.role !== 'Admin' && m.role !== 'Creator'"
                  @click="promoteMember(m)"
                  class="px-2 py-1 rounded bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-[10px] font-medium transition-colors cursor-pointer"
                  title="Promote to Admin"
                >
                  Promote
                </button>
                <button
                  v-if="m.status !== 'Banned'"
                  @click="banMember(m)"
                  class="px-2 py-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[10px] font-medium transition-colors cursor-pointer"
                  title="Ban User"
                >
                  Ban
                </button>
                <button
                  v-else
                  @click="unbanMember(m)"
                  class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-medium transition-colors cursor-pointer"
                  title="Unban User"
                >
                  Unban
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

