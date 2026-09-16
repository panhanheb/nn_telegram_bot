<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Search,
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
  Plus,
  Moon,
  Sun,
  X
} from 'lucide-vue-next'
import { useTheme } from '../../composables/useTheme'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
  (e: 'select-tab', tab: string): void
  (e: 'quick-action', action: string): void
}>()

const { theme, toggle } = useTheme()
const search = ref('')
const selectedIndex = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: any
  category: 'Pages' | 'Actions' | 'Settings'
  action: () => void
}

const commands = computed<CommandItem[]>(() => [
  // Navigation
  {
    id: 'nav-overview',
    title: 'Overview',
    subtitle: 'Main system metrics and analytics',
    icon: LayoutDashboard,
    category: 'Pages',
    action: () => { emit('select-tab', 'overview'); emit('update:open', false) }
  },
  {
    id: 'nav-bots',
    title: 'Bots Management',
    subtitle: 'Manage connected Telegram bots and tokens',
    icon: Bot,
    category: 'Pages',
    action: () => { emit('select-tab', 'bots'); emit('update:open', false) }
  },
  {
    id: 'nav-groups',
    title: 'Groups & Channels',
    subtitle: 'Manage destination chat groups and channels',
    icon: Users,
    category: 'Pages',
    action: () => { emit('select-tab', 'groups'); emit('update:open', false) }
  },
  {
    id: 'nav-chat',
    title: 'Live Chat',
    subtitle: 'Telegram-style chat interface and group messages',
    icon: MessageSquare,
    category: 'Pages',
    action: () => { emit('select-tab', 'chat'); emit('update:open', false) }
  },
  {
    id: 'nav-broadcasts',
    title: 'Broadcast Center',
    subtitle: 'Create and dispatch broadcast messages',
    icon: Send,
    category: 'Pages',
    action: () => { emit('select-tab', 'broadcasts'); emit('update:open', false) }
  },
  {
    id: 'nav-schedules',
    title: 'Broadcast Scheduler',
    subtitle: 'Calendar and recurring broadcast schedules',
    icon: CalendarRange,
    category: 'Pages',
    action: () => { emit('select-tab', 'schedules'); emit('update:open', false) }
  },
  {
    id: 'nav-ai',
    title: 'AI Assistant',
    subtitle: 'Google Gemini automated group auto-replies',
    icon: Sparkles,
    category: 'Pages',
    action: () => { emit('select-tab', 'ai'); emit('update:open', false) }
  },
  {
    id: 'nav-moderation',
    title: 'Moderation Center',
    subtitle: 'Anti-spam, link protection, file blocking',
    icon: ShieldAlert,
    category: 'Pages',
    action: () => { emit('select-tab', 'moderation'); emit('update:open', false) }
  },
  {
    id: 'nav-analytics',
    title: 'Analytics Dashboard',
    subtitle: 'Deep performance metrics and engagement graphs',
    icon: BarChart3,
    category: 'Pages',
    action: () => { emit('select-tab', 'analytics'); emit('update:open', false) }
  },
  {
    id: 'nav-logs',
    title: 'Activity Logs',
    subtitle: 'Live delivery and system audit logs',
    icon: ListTodo,
    category: 'Pages',
    action: () => { emit('select-tab', 'logs'); emit('update:open', false) }
  },
  {
    id: 'nav-settings',
    title: 'Settings',
    subtitle: 'Configure account, tokens, security, appearance',
    icon: Settings,
    category: 'Pages',
    action: () => { emit('select-tab', 'settings'); emit('update:open', false) }
  },

  // Quick Actions
  {
    id: 'act-add-bot',
    title: 'Add New Bot',
    subtitle: 'Connect another Telegram Bot Token',
    icon: Plus,
    category: 'Actions',
    action: () => { emit('select-tab', 'bots'); emit('quick-action', 'add-bot'); emit('update:open', false) }
  },
  {
    id: 'act-new-broadcast',
    title: 'Create New Broadcast',
    subtitle: 'Open the 5-step broadcast composer',
    icon: Send,
    category: 'Actions',
    action: () => { emit('select-tab', 'broadcasts'); emit('quick-action', 'new-broadcast'); emit('update:open', false) }
  },
  {
    id: 'act-add-group',
    title: 'Add Broadcast Target',
    subtitle: 'Register new Telegram group or channel ID',
    icon: Users,
    category: 'Actions',
    action: () => { emit('select-tab', 'groups'); emit('quick-action', 'add-group'); emit('update:open', false) }
  },
  {
    id: 'act-toggle-theme',
    title: `Switch to ${theme.value === 'dark' ? 'Light' : 'Dark'} Mode`,
    subtitle: 'Toggle dashboard appearance',
    icon: theme.value === 'dark' ? Sun : Moon,
    category: 'Settings',
    action: () => { toggle(); emit('update:open', false) }
  }
])

const filteredCommands = computed(() => {
  const q = search.value.toLowerCase().trim()
  if (!q) return commands.value
  return commands.value.filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.subtitle?.toLowerCase().includes(q) ||
    c.category.toLowerCase().includes(q)
  )
})

const executeSelected = () => {
  const item = filteredCommands.value[selectedIndex.value]
  if (item) {
    item.action()
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  // Global shortcut: ⌘K or Ctrl+K
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    emit('update:open', !props.open)
    return
  }

  if (!props.open) return

  if (e.key === 'Escape') {
    e.preventDefault()
    emit('update:open', false)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (selectedIndex.value < filteredCommands.value.length - 1) {
      selectedIndex.value++
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    executeSelected()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-start justify-center pt-20 sm:pt-28 p-4">
    <!-- Backdrop -->
    <div
      @click="emit('update:open', false)"
      class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
    ></div>

    <!-- Palette Box -->
    <div class="relative w-full max-w-xl tf-card-elevated overflow-hidden z-10">
      <!-- Search Input Header -->
      <div class="flex items-center px-4 border-b border-[var(--tf-border)]">
        <Search class="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref="inputEl"
          v-model="search"
          type="text"
          placeholder="Type a command or search..."
          class="w-full bg-transparent px-3 py-3.5 text-sm text-white placeholder-slate-400 focus:outline-none"
          autofocus
        />
        <button
          type="button"
          @click="emit('update:open', false)"
          class="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <!-- Commands List -->
      <div class="max-h-80 overflow-y-auto p-2 no-scrollbar">
        <div v-if="filteredCommands.length === 0" class="py-8 text-center text-xs text-slate-400">
          No results found for "{{ search }}"
        </div>

        <button
          v-for="(cmd, index) in filteredCommands"
          :key="cmd.id"
          type="button"
          @click="cmd.action()"
          @mouseenter="selectedIndex = index"
          class="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer"
          :class="selectedIndex === index ? 'bg-[#2481cc]/15 text-white' : 'text-slate-300 hover:bg-white/5'"
        >
          <div class="flex items-center gap-3 min-w-0">
            <component
              :is="cmd.icon"
              class="w-4 h-4 shrink-0"
              :class="selectedIndex === index ? 'text-[#2481cc]' : 'text-slate-400'"
            />
            <div class="min-w-0">
              <p class="text-xs font-semibold truncate">{{ cmd.title }}</p>
              <p v-if="cmd.subtitle" class="text-[11px] text-slate-400 truncate">{{ cmd.subtitle }}</p>
            </div>
          </div>

          <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
            {{ cmd.category }}
          </span>
        </button>
      </div>

      <!-- Footer Help -->
      <div class="px-4 py-2 bg-white/[0.02] border-t border-[var(--tf-border)] flex items-center justify-between text-[10px] text-slate-400">
        <span>Use <kbd class="font-mono text-slate-300">↑</kbd> <kbd class="font-mono text-slate-300">↓</kbd> to navigate</span>
        <span>Press <kbd class="font-mono text-slate-300">Enter</kbd> to select</span>
        <span>Press <kbd class="font-mono text-slate-300">Esc</kbd> to close</span>
      </div>
    </div>
  </div>
</template>

