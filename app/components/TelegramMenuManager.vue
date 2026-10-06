<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useToast } from '../composables/useToast'
import {
  MousePointerClick,
  Sparkles,
  RefreshCw,
  Zap,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Globe,
  Sliders,
  CheckCircle2,
  ExternalLink,
  MessageSquare,
  Shield,
  Bot,
  RotateCcw,
  Smartphone,
  ChevronRight,
  Terminal,
  HelpCircle,
  Eye
} from 'lucide-vue-next'

interface BotMenuButton {
  id: string
  text: string
  type: 'callback' | 'url' | 'command'
  value: string
}

interface BotMenuSettings {
  enabled: boolean
  persistentKeyboard: boolean
  inlineMenuOnStart: boolean
  chatMenuButton: 'commands' | 'web_app' | 'default'
  webAppUrl?: string
  buttons: BotMenuButton[]
}

const toast = useToast()

const isLoading = ref(true)
const isSaving = ref(false)
const isSyncing = ref(false)
const liveCommands = ref<Array<{ command: string; description: string }>>([])
const liveMenuButton = ref<any>(null)

const settings = ref<BotMenuSettings>({
  enabled: true,
  persistentKeyboard: true,
  inlineMenuOnStart: true,
  chatMenuButton: 'commands',
  webAppUrl: '',
  buttons: [
    { id: '1', text: '🤖 Ask AI', type: 'callback', value: 'menu:ai' },
    { id: '2', text: '📜 Group Rules', type: 'callback', value: 'menu:rules' },
    { id: '3', text: '⚠️ My Warnings', type: 'callback', value: 'menu:warns' },
    { id: '4', text: '📊 Bot Status', type: 'callback', value: 'menu:status' },
    { id: '5', text: '🌐 Web Dashboard', type: 'url', value: '' },
    { id: '6', text: '❓ Help & Info', type: 'callback', value: 'menu:help' }
  ]
})

// Preview interactive state
const previewScreen = ref<'main' | 'rules' | 'warns' | 'status' | 'ai' | 'help' | 'dashboard'>('main')

const presetOptions = [
  { label: '🤖 Ask AI Assistant', value: 'menu:ai', description: 'Explains AI usage & commands' },
  { label: '📜 Group Rules', value: 'menu:rules', description: 'Shows chat guidelines' },
  { label: '⚠️ Warning Strikes', value: 'menu:warns', description: 'Displays user strike count' },
  { label: '📊 Bot System Status', value: 'menu:status', description: 'Uptime, groups & AI metrics' },
  { label: '❓ Help & Commands', value: 'menu:help', description: 'Quick commands cheat-sheet' },
  { label: '🌐 Web Dashboard Info', value: 'menu:dashboard', description: 'Information about the portal' }
]

const loadMenuSettings = async () => {
  isLoading.value = true
  try {
    const data = await $fetch<{
      settings: BotMenuSettings
      liveCommands: Array<{ command: string; description: string }>
      liveMenuButton: any
    }>('/api/telegram/menu')
    if (data?.settings) {
      settings.value = {
        ...data.settings,
        buttons: Array.isArray(data.settings.buttons) && data.settings.buttons.length > 0
          ? data.settings.buttons
          : settings.value.buttons
      }
    }
    if (data?.liveCommands) liveCommands.value = data.liveCommands
    if (data?.liveMenuButton) liveMenuButton.value = data.liveMenuButton
  } catch (error: any) {
    toast.error('Failed to load menu settings: ' + (error?.message || 'Network error'))
  } finally {
    isLoading.value = false
  }
}

const saveSettings = async (showNotice = true) => {
  isSaving.value = true
  try {
    const res = await $fetch<{ ok: boolean; settings: BotMenuSettings }>('/api/telegram/menu', {
      method: 'POST',
      body: settings.value
    })
    if (res?.settings) settings.value = res.settings
    if (showNotice) toast.success('Menu settings saved successfully')
    return true
  } catch (error: any) {
    toast.error('Failed to save settings: ' + (error?.message || 'Error'))
    return false
  } finally {
    isSaving.value = false
  }
}

const syncToTelegram = async () => {
  // First save any unsaved changes
  const saved = await saveSettings(false)
  if (!saved) return

  isSyncing.value = true
  try {
    const res = await $fetch<{
      ok: boolean
      commands: Array<{ command: string; description: string }>
      menuButton: string
    }>('/api/telegram/menu/sync', { method: 'POST' })
    if (res?.ok) {
      if (res.commands) liveCommands.value = res.commands
      toast.success('⚡ Menu & Commands successfully synced to Telegram!')
    }
  } catch (error: any) {
    toast.error('Sync failed: ' + (error?.statusMessage || error?.message || 'Verify bot connection'))
  } finally {
    isSyncing.value = false
  }
}

const addButton = () => {
  const newId = String(Date.now())
  settings.value.buttons.push({
    id: newId,
    text: '⚡ New Button',
    type: 'callback',
    value: 'menu:help'
  })
}

const removeButton = (idx: number) => {
  settings.value.buttons.splice(idx, 1)
}

const moveButton = (idx: number, direction: 'up' | 'down') => {
  const targetIdx = direction === 'up' ? idx - 1 : idx + 1
  if (targetIdx < 0 || targetIdx >= settings.value.buttons.length) return
  const temp = settings.value.buttons[idx]
  settings.value.buttons[idx] = settings.value.buttons[targetIdx]
  settings.value.buttons[targetIdx] = temp
}

const resetDefaults = () => {
  settings.value.buttons = [
    { id: '1', text: '🤖 Ask AI', type: 'callback', value: 'menu:ai' },
    { id: '2', text: '📜 Group Rules', type: 'callback', value: 'menu:rules' },
    { id: '3', text: '⚠️ My Warnings', type: 'callback', value: 'menu:warns' },
    { id: '4', text: '📊 Bot Status', type: 'callback', value: 'menu:status' },
    { id: '5', text: '🌐 Web Dashboard', type: 'url', value: '' },
    { id: '6', text: '❓ Help & Info', type: 'callback', value: 'menu:help' }
  ]
  settings.value.enabled = true
  settings.value.persistentKeyboard = true
  settings.value.inlineMenuOnStart = true
  settings.value.chatMenuButton = 'commands'
  toast.info('Restored default button configuration')
}

const handlePreviewButtonClick = (btn: BotMenuButton) => {
  if (btn.type === 'url') {
    previewScreen.value = 'dashboard'
    return
  }
  if (btn.value === 'menu:rules' || btn.value.includes('rules')) {
    previewScreen.value = 'rules'
  } else if (btn.value === 'menu:warns' || btn.value.includes('warn')) {
    previewScreen.value = 'warns'
  } else if (btn.value === 'menu:status' || btn.value.includes('status')) {
    previewScreen.value = 'status'
  } else if (btn.value === 'menu:ai' || btn.value.includes('ai') || btn.value.includes('ask')) {
    previewScreen.value = 'ai'
  } else if (btn.value === 'menu:help' || btn.value.includes('help')) {
    previewScreen.value = 'help'
  } else {
    previewScreen.value = 'main'
  }
}

onMounted(() => {
  loadMenuSettings()
})
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-12">
    <!-- Header banner -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-2xl p-6 backdrop-blur-xl">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2481cc]/20 to-blue-500/20 border border-[#2481cc]/30 flex items-center justify-center text-[#50a7ea] shadow-lg shrink-0">
          <MousePointerClick class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-bold text-white tracking-tight">Interactive Telegram Button Menu</h1>
            <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Edge Ready
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-1 max-w-2xl">
            Configure clickable inline buttons under messages, persistent bottom keyboards in private chats, and synchronize commands directly with Telegram.
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2.5 shrink-0 flex-wrap">
        <button
          type="button"
          @click="resetDefaults"
          class="px-3 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition cursor-pointer flex items-center gap-1.5"
          title="Reset to default menu buttons"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <button
          type="button"
          @click="saveSettings(true)"
          :disabled="isSaving"
          class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-white/15 transition cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
        >
          <RefreshCw v-if="isSaving" class="w-3.5 h-3.5 animate-spin" />
          <Save v-else class="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>

        <button
          type="button"
          @click="syncToTelegram"
          :disabled="isSyncing"
          class="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-[#2481cc] to-blue-600 hover:from-[#1d70b3] hover:to-blue-700 shadow-lg shadow-[#2481cc]/25 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw v-if="isSyncing" class="w-3.5 h-3.5 animate-spin" />
          <Zap v-else class="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
          <span>⚡ Sync to Telegram</span>
        </button>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left Column: Settings & Button Editor (7 cols) -->
      <div class="lg:col-span-7 space-y-6">
        <!-- Menu Behavior Toggles Card -->
        <div class="bg-[var(--tf-card)] border border-[var(--tf-border)] rounded-2xl p-6 backdrop-blur-xl space-y-5">
          <div class="flex items-center gap-2 border-b border-[var(--tf-border)] pb-3">
            <Sliders class="w-4 h-4 text-[#50a7ea]" />
            <h2 class="text-sm font-semibold text-white">Display & Activation Settings</h2>
          </div>

          <div class="space-y-4">
            <!-- Toggle: Enabled -->
            <label class="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition cursor-pointer">
              <div class="space-y-0.5">
                <div class="text-xs font-semibold text-white">Enable Interactive Button Menu</div>
                <div class="text-[11px] text-slate-400">Activates callback processing and inline button keyboards when users interact with the bot.</div>
              </div>
              <input
                type="checkbox"
                v-model="settings.enabled"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2481cc] shrink-0 relative"></div>
            </label>

            <!-- Toggle: Persistent Reply Keyboard -->
            <label class="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition cursor-pointer">
              <div class="space-y-0.5">
                <div class="text-xs font-semibold text-white">Persistent Keyboard in Private Chat</div>
                <div class="text-[11px] text-slate-400">Fixes large clickable buttons at the bottom of the screen in 1-on-1 chats with the bot.</div>
              </div>
              <input
                type="checkbox"
                v-model="settings.persistentKeyboard"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2481cc] shrink-0 relative"></div>
            </label>

            <!-- Toggle: Inline Menu on Start -->
            <label class="flex items-start justify-between gap-4 p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition cursor-pointer">
              <div class="space-y-0.5">
                <div class="text-xs font-semibold text-white">Attach Inline Menu to /start & /menu</div>
                <div class="text-[11px] text-slate-400">Automatically appends the clickable button grid whenever a user triggers /start or /menu.</div>
              </div>
              <input
                type="checkbox"
                v-model="settings.inlineMenuOnStart"
                class="sr-only peer"
              />
              <div class="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2481cc] shrink-0 relative"></div>
            </label>

            <!-- Chat Menu Button Setting -->
            <div class="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div>
                <label class="text-xs font-semibold text-white block">Bottom-Left Telegram Menu Button [ ≡ ]</label>
                <p class="text-[11px] text-slate-400 mt-0.5">Choose what happens when the user taps the Telegram native menu button in the chat bar.</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  @click="settings.chatMenuButton = 'commands'"
                  class="p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
                  :class="settings.chatMenuButton === 'commands' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white shadow-sm' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10'"
                >
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <Terminal class="w-3.5 h-3.5 text-[#50a7ea]" />
                    <span>Commands Menu</span>
                  </div>
                  <span class="text-[10px] text-slate-400 mt-1">Shows slash command list</span>
                </button>

                <button
                  type="button"
                  @click="settings.chatMenuButton = 'web_app'"
                  class="p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
                  :class="settings.chatMenuButton === 'web_app' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white shadow-sm' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10'"
                >
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <Globe class="w-3.5 h-3.5 text-emerald-400" />
                    <span>Web Mini App</span>
                  </div>
                  <span class="text-[10px] text-slate-400 mt-1">Opens Dashboard directly</span>
                </button>

                <button
                  type="button"
                  @click="settings.chatMenuButton = 'default'"
                  class="p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between"
                  :class="settings.chatMenuButton === 'default' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white shadow-sm' : 'bg-white/[0.02] border-white/5 text-slate-400 hover:border-white/10'"
                >
                  <div class="text-xs font-semibold flex items-center gap-1.5">
                    <Bot class="w-3.5 h-3.5 text-amber-400" />
                    <span>Default Menu</span>
                  </div>
                  <span class="text-[10px] text-slate-400 mt-1">Standard Telegram default</span>
                </button>
              </div>

              <!-- Web App URL Input if Web App selected -->
              <div v-if="settings.chatMenuButton === 'web_app'" class="pt-2 border-t border-white/5">
                <label class="text-[11px] font-medium text-slate-300 block mb-1">Web App HTTPS URL (Optional, defaults to this site):</label>
                <input
                  v-model="settings.webAppUrl"
                  type="url"
                  placeholder="https://nn-telegram-bot.nhebpanha78.workers.dev"
                  class="w-full px-3 py-2 text-xs bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[#2481cc]"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Buttons Grid Editor Card -->
        <div class="bg-[var(--tf-card)] border border-[var(--tf-border)] rounded-2xl p-6 backdrop-blur-xl space-y-4">
          <div class="flex items-center justify-between border-b border-[var(--tf-border)] pb-3">
            <div class="flex items-center gap-2">
              <MousePointerClick class="w-4 h-4 text-emerald-400" />
              <h2 class="text-sm font-semibold text-white">Menu Buttons Configuration ({{ settings.buttons.length }})</h2>
            </div>
            <button
              type="button"
              @click="addButton"
              class="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition cursor-pointer flex items-center gap-1 shadow"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Add Button</span>
            </button>
          </div>

          <div class="space-y-3">
            <div
              v-for="(btn, idx) in settings.buttons"
              :key="btn.id || idx"
              class="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition space-y-3"
            >
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                  {{ idx + 1 }}
                </span>

                <!-- Button Text Input -->
                <input
                  v-model="btn.text"
                  type="text"
                  placeholder="Button Label (e.g. 🤖 Ask AI)"
                  class="flex-1 px-3 py-1.5 text-xs bg-slate-900/80 border border-white/10 rounded-lg text-white font-medium placeholder-slate-500 focus:outline-none focus:border-[#2481cc]"
                />

                <!-- Reorder buttons -->
                <button
                  type="button"
                  @click="moveButton(idx, 'up')"
                  :disabled="idx === 0"
                  class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                  title="Move Up"
                >
                  <ArrowUp class="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  @click="moveButton(idx, 'down')"
                  :disabled="idx === settings.buttons.length - 1"
                  class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 disabled:opacity-30 cursor-pointer"
                  title="Move Down"
                >
                  <ArrowDown class="w-3.5 h-3.5" />
                </button>

                <!-- Delete button -->
                <button
                  type="button"
                  @click="removeButton(idx)"
                  class="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                  title="Remove Button"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>

              <!-- Button Type & Value selector -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">Button Action Type</label>
                  <select
                    v-model="btn.type"
                    class="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#2481cc]"
                  >
                    <option value="callback">⚡ Instant Action (Callback)</option>
                    <option value="url">🔗 Open URL / Link</option>
                    <option value="command">⌨️ Trigger Command (/cmd)</option>
                  </select>
                </div>

                <div>
                  <label class="text-[10px] text-slate-400 block mb-1">
                    {{ btn.type === 'callback' ? 'Target Action' : (btn.type === 'url' ? 'Destination URL' : 'Command') }}
                  </label>

                  <!-- Preset Callback Select -->
                  <select
                    v-if="btn.type === 'callback'"
                    v-model="btn.value"
                    class="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#2481cc]"
                  >
                    <option v-for="opt in presetOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>

                  <!-- URL Input -->
                  <input
                    v-else-if="btn.type === 'url'"
                    v-model="btn.value"
                    type="url"
                    placeholder="https://..."
                    class="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#2481cc]"
                  />

                  <!-- Command Input -->
                  <input
                    v-else
                    v-model="btn.value"
                    type="text"
                    placeholder="e.g. /rules or /help"
                    class="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-[#2481cc]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Interactive Phone Simulator (5 cols) -->
      <div class="lg:col-span-5 space-y-6 sticky top-6">
        <div class="bg-[var(--tf-card)] border border-[var(--tf-border)] rounded-2xl p-5 backdrop-blur-xl">
          <div class="flex items-center justify-between border-b border-[var(--tf-border)] pb-3 mb-4">
            <div class="flex items-center gap-2">
              <Smartphone class="w-4 h-4 text-[#50a7ea]" />
              <h2 class="text-sm font-semibold text-white">Live Telegram Mobile Simulator</h2>
            </div>
            <span class="text-[10px] text-slate-400">Click buttons to preview</span>
          </div>

          <!-- Telegram Mobile Shell -->
          <div class="w-full max-w-sm mx-auto bg-[#0e1621] rounded-3xl border-4 border-slate-700/60 shadow-2xl overflow-hidden flex flex-col h-[520px] relative font-sans">
            <!-- Telegram Phone Status Bar -->
            <div class="bg-[#17212b] px-4 py-2 flex items-center justify-between text-[11px] text-slate-300 border-b border-black/40 shrink-0">
              <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full bg-gradient-to-tr from-[#2481cc] to-blue-400 flex items-center justify-center text-white text-xs font-bold">
                  🤖
                </div>
                <div>
                  <div class="text-xs font-bold text-white leading-tight">NN Community Bot</div>
                  <div class="text-[10px] text-slate-400">bot</div>
                </div>
              </div>
              <div class="flex items-center gap-1.5 text-emerald-400 text-[10px] font-medium">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>online</span>
              </div>
            </div>

            <!-- Chat Message Canvas -->
            <div class="flex-1 p-3 overflow-y-auto space-y-3 bg-[#0e1621]/95 text-xs text-white">
              <div class="flex justify-center">
                <span class="px-2.5 py-0.5 rounded-full bg-[#182533] text-[9px] text-slate-400 border border-white/5">
                  Today
                </span>
              </div>

              <!-- Bot Response Bubble -->
              <div class="bg-[#182533] rounded-2xl rounded-tl-sm p-3.5 border border-white/5 space-y-3 shadow">
                <!-- Screen 1: Main Menu -->
                <template v-if="previewScreen === 'main'">
                  <div class="space-y-1">
                    <p class="font-bold text-white flex items-center gap-1.5">
                      <span>🤖</span>
                      <span>Interactive Bot Menu</span>
                    </p>
                    <p class="text-[11px] text-slate-300 leading-relaxed">
                      Click any button below to check your status, explore group rules, talk with AI, or get instant help:
                    </p>
                  </div>

                  <!-- Inline Keyboard Grid -->
                  <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      v-for="btn in settings.buttons"
                      :key="btn.id"
                      @click="handlePreviewButtonClick(btn)"
                      type="button"
                      class="px-2.5 py-2 rounded-lg bg-[#2481cc]/25 hover:bg-[#2481cc]/45 text-[#50a7ea] hover:text-white text-[11px] font-medium text-center transition border border-[#2481cc]/30 cursor-pointer truncate"
                      :title="btn.text"
                    >
                      {{ btn.text }}
                    </button>
                  </div>
                </template>

                <!-- Screen 2: Rules -->
                <template v-else-if="previewScreen === 'rules'">
                  <div class="space-y-2">
                    <p class="font-bold text-white">📜 Group Rules & Guidelines</p>
                    <p class="text-[11px] text-slate-300 leading-relaxed">
                      1. Be respectful to all members.<br />
                      2. No spamming, flooding, or scam links.<br />
                      3. Keep technical discussions constructive!
                    </p>
                    <p class="text-[10px] text-amber-400 italic">⚠️ Violating rules will result in strikes.</p>
                  </div>

                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>

                <!-- Screen 3: Warnings -->
                <template v-else-if="previewScreen === 'warns'">
                  <div class="space-y-2">
                    <p class="font-bold text-amber-300">⚠️ Warning Status</p>
                    <p class="text-[11px] text-slate-300">
                      👤 User: <b>Guest User</b> (@guest)<br />
                      📊 Active strikes: <b>0 / 3</b><br />
                      🛡️ Status: <span class="text-emerald-400 font-semibold">🟢 Clean Record</span>
                    </p>
                    <p class="text-[10px] text-slate-400 italic">Strikes expire after 24 hours.</p>
                  </div>

                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>

                <!-- Screen 4: Status -->
                <template v-else-if="previewScreen === 'status'">
                  <div class="space-y-2">
                    <p class="font-bold text-white">📊 Bot System Status</p>
                    <p class="text-[11px] text-slate-300 leading-relaxed">
                      🤖 Bot: <b>NN Bot</b><br />
                      👥 Monitored Groups: <b>Active</b><br />
                      🧠 AI Assistant: <span class="text-emerald-400 font-semibold">🟢 Online</span> (Gemini)<br />
                      ⚡ Runtime: <b>Cloudflare Workers</b>
                    </p>
                  </div>

                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>

                <!-- Screen 5: AI -->
                <template v-else-if="previewScreen === 'ai'">
                  <div class="space-y-2">
                    <p class="font-bold text-cyan-300">🤖 Ask AI Assistant</p>
                    <p class="text-[11px] text-slate-300 leading-relaxed">
                      • <b>In Groups:</b> Mention @bot or reply to bot messages.<br />
                      • <b>Command:</b> <code>/ask &lt;your question&gt;</code><br />
                      • <b>In Private:</b> Send question directly here!
                    </p>
                  </div>

                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>

                <!-- Screen 6: Help -->
                <template v-else-if="previewScreen === 'help'">
                  <div class="space-y-1.5 text-[11px] text-slate-300">
                    <p class="font-bold text-white">❓ Bot Commands</p>
                    <p>• <code>/menu</code> - Open button menu</p>
                    <p>• <code>/rules</code> - View rules</p>
                    <p>• <code>/warns</code> - Check strikes</p>
                    <p>• <code>/ask</code> - Ask AI</p>
                  </div>

                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>

                <!-- Screen 7: Dashboard -->
                <template v-else>
                  <div class="space-y-2 text-[11px] text-slate-300">
                    <p class="font-bold text-white">🌐 Web Dashboard</p>
                    <p>Opens the real-time bot management portal directly in your browser.</p>
                  </div>
                  <div class="pt-1">
                    <button
                      @click="previewScreen = 'main'"
                      type="button"
                      class="w-full py-1.5 rounded-lg bg-[#2481cc]/30 hover:bg-[#2481cc]/50 text-white text-[11px] font-medium text-center border border-[#2481cc]/40 cursor-pointer"
                    >
                      🔙 Back to Menu
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <!-- Persistent Bottom Reply Keyboard (if enabled) -->
            <div
              v-if="settings.persistentKeyboard"
              class="bg-[#17212b] p-2 border-t border-black/40 space-y-1.5 shrink-0"
            >
              <div class="text-[9px] text-slate-400 font-medium px-1 flex items-center justify-between">
                <span>Fixed Bottom Reply Keyboard</span>
                <span class="text-[8px] text-emerald-400 font-mono">Active</span>
              </div>
              <div class="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
                <button
                  v-for="btn in settings.buttons.slice(0, 4)"
                  :key="btn.id"
                  @click="handlePreviewButtonClick(btn)"
                  type="button"
                  class="py-1.5 px-2 rounded-lg bg-[#242f3d] hover:bg-[#2e3b4d] text-[10px] font-medium text-slate-200 truncate border border-white/5 cursor-pointer text-center"
                >
                  {{ btn.text }}
                </button>
              </div>
            </div>

            <!-- Telegram Input Bar with [ ≡ Menu ] Button -->
            <div class="bg-[#17212b] px-2.5 py-2 border-t border-black/40 flex items-center gap-2 shrink-0">
              <!-- [ ≡ Menu ] Button -->
              <div class="px-2 py-1 rounded-md bg-[#2481cc]/20 border border-[#2481cc]/40 text-[#50a7ea] text-[10px] font-bold flex items-center gap-1 shrink-0">
                <span>≡</span>
                <span v-if="settings.chatMenuButton === 'web_app'">App</span>
                <span v-else>Menu</span>
              </div>

              <div class="flex-1 bg-[#242f3d] rounded-full px-3 py-1 text-[11px] text-slate-400 truncate">
                Message...
              </div>

              <div class="w-6 h-6 rounded-full bg-[#2481cc] flex items-center justify-center text-white text-xs shrink-0">
                ➤
              </div>
            </div>
          </div>

          <!-- Telegram Commands List Card -->
          <div class="mt-4 pt-4 border-t border-[var(--tf-border)] space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-white">Registered Telegram Commands</span>
              <span class="text-[10px] text-[#50a7ea] font-medium">{{ liveCommands.length }} active</span>
            </div>
            <div class="space-y-1 max-h-36 overflow-y-auto">
              <div
                v-for="cmd in (liveCommands.length > 0 ? liveCommands : [
                  { command: 'menu', description: '📱 Open interactive button menu' },
                  { command: 'start', description: '🚀 Start bot & open menu' },
                  { command: 'help', description: '❓ Bot commands & assistance' },
                  { command: 'ask', description: '🤖 Ask AI assistant anything' },
                  { command: 'rules', description: '📜 View community guidelines & rules' },
                  { command: 'status', description: '📊 Bot status & statistics' },
                  { command: 'warns', description: '⚠️ Check warning strikes' }
                ])"
                :key="cmd.command"
                class="flex items-center justify-between px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/5 text-[11px]"
              >
                <code class="text-[#50a7ea] font-mono">/{{ cmd.command }}</code>
                <span class="text-slate-400 truncate max-w-[200px] text-[10px]">{{ cmd.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

