<script setup lang="ts">
import { computed } from 'vue'
import {
  LayoutDashboard,
  Bot,
  Users,
  Radio,
  MessageSquare,
  Send,
  CalendarRange,
  Sparkles,
  ShieldAlert,
  BarChart3,
  ListTodo,
  Settings,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Activity
} from 'lucide-vue-next'
import { useBotStore } from '../../stores/bot'
import { useGroupsStore } from '../../stores/groups'
import { useSchedulesStore } from '../../stores/schedules'
import { useLogsStore } from '../../stores/logs'

const props = defineProps<{
  activeTab: string
  collapsed: boolean
}>()

const emit = defineEmits<{
  (e: 'update:activeTab', tab: string): void
  (e: 'update:collapsed', val: boolean): void
  (e: 'open-help'): void
}>()

const botStore = useBotStore()
const groupsStore = useGroupsStore()
const schedulesStore = useSchedulesStore()
const logsStore = useLogsStore()

const channelsCount = computed(() => groupsStore.groups.filter(g => g.type === 'channel').length)
const groupsCount = computed(() => groupsStore.groups.filter(g => g.type !== 'channel').length)
const activeSchedulesCount = computed(() => schedulesStore.schedules.filter(s => s.isActive).length)

interface NavItem {
  id: string
  name: string
  icon: any
  badge?: number | string
  badgeColor?: string
  isAction?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const navSections = computed<NavSection[]>(() => [
  {
    items: [
      { id: 'overview', name: 'Overview', icon: LayoutDashboard }
    ]
  },
  {
    title: 'BOT MANAGEMENT',
    items: [
      {
        id: 'bots',
        name: 'Bots',
        icon: Bot,
        badge: botStore.isConfigured ? (botStore.isOnline ? 'Online' : 'Offline') : '0',
        badgeColor: botStore.isOnline ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
      },
      {
        id: 'groups',
        name: 'Groups',
        icon: Users,
        badge: groupsCount.value || undefined
      },
      {
        id: 'channels',
        name: 'Channels',
        icon: Radio,
        badge: channelsCount.value || undefined
      }
    ]
  },
  {
    title: 'MESSAGING',
    items: [
      {
        id: 'chat',
        name: 'Messages',
        icon: MessageSquare,
        badge: 'Live',
        badgeColor: 'bg-sky-500/15 text-sky-400 border border-sky-500/20'
      },
      {
        id: 'broadcasts',
        name: 'Broadcasts',
        icon: Send
      },
      {
        id: 'schedules',
        name: 'Scheduler',
        icon: CalendarRange,
        badge: activeSchedulesCount.value || undefined
      }
    ]
  },
  {
    title: 'AUTOMATION',
    items: [
      {
        id: 'ai',
        name: 'AI Assistant',
        icon: Sparkles
      },
      {
        id: 'moderation',
        name: 'Moderation',
        icon: ShieldAlert
      }
    ]
  },
  {
    title: 'INSIGHTS',
    items: [
      {
        id: 'analytics',
        name: 'Analytics',
        icon: BarChart3
      },
      {
        id: 'logs',
        name: 'Activity Logs',
        icon: ListTodo,
        badge: logsStore.logs.length || undefined
      }
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      {
        id: 'settings',
        name: 'Settings',
        icon: Settings
      },
      {
        id: 'help',
        name: 'Help & Docs',
        icon: HelpCircle,
        isAction: true
      }
    ]
  }
])

const handleItemClick = (item: NavItem) => {
  if (item.isAction && item.id === 'help') {
    emit('open-help')
    return
  }
  emit('update:activeTab', item.id)
}
</script>

<template>
  <aside
    class="relative z-20 flex flex-col h-screen border-r transition-all duration-300 select-none bg-[var(--tf-card)] backdrop-blur-2xl border-[var(--tf-border)] shrink-0 shadow-[1px_0_24px_rgba(0,0,0,0.12)]"
    :class="collapsed ? 'w-16' : 'w-64'"
  >
    <!-- Brand Header -->
    <div class="h-16 px-4 flex items-center justify-between border-b border-[var(--tf-border)]">
      <div
        @click="emit('update:activeTab', 'overview')"
        class="flex items-center gap-3 cursor-pointer overflow-hidden group"
      >
        <div class="w-8 h-8 rounded-lg bg-[#2481cc] flex items-center justify-center text-white shrink-0 shadow-sm shadow-[#2481cc]/30 group-hover:bg-[#1d73b8] transition-colors">
          <Send class="w-4 h-4 transform rotate-[15deg] -translate-x-0.5" />
        </div>
        <div v-if="!collapsed" class="min-w-0 flex flex-col leading-none">
          <span class="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
            TeleFlow
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-semibold uppercase tracking-wider">
              PRO
            </span>
          </span>
          <span class="text-[10px] text-slate-400 mt-0.5">Bot Orchestration</span>
        </div>
      </div>

      <!-- Collapse / Expand Toggle Button -->
      <button
        type="button"
        @click="emit('update:collapsed', !collapsed)"
        class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        :title="collapsed ? 'Expand sidebar' : 'Collapse sidebar'"
      >
        <ChevronRight v-if="collapsed" class="w-4 h-4" />
        <ChevronLeft v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Navigation List -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-5 no-scrollbar">
      <div v-for="(section, sIndex) in navSections" :key="sIndex" class="space-y-1">
        <!-- Section Header -->
        <p
          v-if="section.title && !collapsed"
          class="px-2.5 py-1 text-[10px] font-semibold text-slate-400 tracking-wider uppercase"
        >
          {{ section.title }}
        </p>

        <!-- Section Separator for Collapsed View -->
        <div
          v-else-if="section.title && collapsed"
          class="h-px bg-white/5 my-2 mx-1"
        ></div>

        <!-- Navigation Items -->
        <button
          v-for="item in section.items"
          :key="item.id"
          type="button"
          @click="handleItemClick(item)"
          class="w-full flex items-center rounded-lg transition-all text-xs font-medium relative group cursor-pointer"
          :class="[
            collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2',
            activeTab === item.id
              ? 'liquid-glass-button text-white font-semibold shadow-md shadow-[#2481cc]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/5'
          ]"
        >
          <component
            :is="item.icon"
            class="w-4 h-4 shrink-0 transition-colors"
            :class="activeTab === item.id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'"
          />

          <span v-if="!collapsed" class="truncate flex-1 text-left">
            {{ item.name }}
          </span>

          <!-- Badge -->
          <span
            v-if="!collapsed && item.badge !== undefined"
            class="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            :class="item.badgeColor || (activeTab === item.id ? 'bg-white/25 text-white' : 'bg-white/10 text-slate-300')"
          >
            {{ item.badge }}
          </span>

          <!-- Floating Tooltip when collapsed -->
          <div
            v-if="collapsed"
            class="absolute left-full ml-3 px-2.5 py-1.5 tf-card-elevated text-white text-xs rounded-md shadow-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 flex items-center gap-2"
          >
            <span>{{ item.name }}</span>
            <span
              v-if="item.badge !== undefined"
              class="text-[10px] px-1 py-0.2 rounded bg-white/10 text-slate-300"
            >
              {{ item.badge }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- Bottom Status & System Health -->
    <div class="p-3 border-t border-[var(--tf-border)]">
      <div
        class="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.04] backdrop-blur-md border border-white/10"
        :class="collapsed ? 'justify-center' : ''"
        title="Edge network: Cloudflare Workers | Operational"
      >
        <div class="relative flex h-2 w-2 shrink-0">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>

        <div v-if="!collapsed" class="min-w-0 flex-1">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-semibold text-slate-200 truncate">System OK</span>
            <span class="text-[9px] text-emerald-400 font-mono">18ms</span>
          </div>
          <p class="text-[9px] text-slate-400 truncate">Cloudflare Edge active</p>
        </div>
      </div>
    </div>
  </aside>
</template>

