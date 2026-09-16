<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useModerationStore } from '../stores/moderation'
import { useBotStore } from '../stores/bot'
import { useWebhookStore } from '../stores/webhook'
import { useToast } from '../composables/useToast'
import {
  ShieldAlert,
  Link2,
  Sticker,
  AlertCircle,
  Power,
  Webhook,
  RefreshCw,
  FileX,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Ban,
  Clock,
  Trash2,
  Tag
} from 'lucide-vue-next'

const moderationStore = useModerationStore()
const botStore = useBotStore()
const webhookStore = useWebhookStore()
const toast = useToast()

const showExtensionsList = ref(false)

// Keywords filter tags
const blockedKeywords = ref<string[]>(['scam', 'spam', 'crypto investment', 'xxx', 'free nitro', 'airdrop'])
const newKeyword = ref('')

// Recent Moderation Actions Log
const recentActions = ref([
  { id: 1, user: '@crypto_bot_99', rule: 'Blocked URL', detail: 'suspicious-airdrop.xyz', time: '2 minutes ago' },
  { id: 2, user: '@ad_poster', rule: 'Banned Keyword', detail: 'Detected "free nitro"', time: '14 minutes ago' },
  { id: 3, user: '@unknown_user', rule: 'Restricted Attachment', detail: 'payload.exe', time: '45 minutes ago' },
  { id: 4, user: '@sticker_spammer', rule: 'Blocked Stickers', detail: 'Animated sticker burst', time: '2 hours ago' }
])

// File Extensions
const restrictedExtensions = [
  '.exe', '.bat', '.cmd', '.com', '.scr', '.msi', '.ps1', '.vbs', '.js',
  '.sh', '.bash', '.py', '.php', '.dll', '.apk', '.dmg', '.pkg', '.zip', '.rar'
]

onMounted(async () => {
  await Promise.all([
    moderationStore.fetchSettings(),
    botStore.fetchBot(),
    webhookStore.fetchInfo()
  ])
})

const handleSetupWebhook = async () => {
  try {
    const res = await webhookStore.setup()
    if (res.success) toast.success(`Webhook registered: ${res.url}`)
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to register webhook')
  }
}

const toggle = async (key: 'enabled' | 'deleteLinks' | 'deleteStickers' | 'deleteFiles') => {
  const next = !moderationStore.settings[key]
  try {
    await moderationStore.updateSettings({ [key]: next })
    toast.success(`Rule updated`)
  } catch {
    toast.error('Failed to update rule')
  }
}

const addKeyword = () => {
  const kw = newKeyword.value.trim().toLowerCase()
  if (kw && !blockedKeywords.value.includes(kw)) {
    blockedKeywords.value.push(kw)
    newKeyword.value = ''
    toast.success(`Added "${kw}" to blocked keywords`)
  }
}

const removeKeyword = (kw: string) => {
  blockedKeywords.value = blockedKeywords.value.filter(k => k !== kw)
  toast.success(`Removed "${kw}"`)
}

const isExtensionBlocked = (ext: string) => {
  const clean = ext.replace(/^\./, '').toLowerCase()
  const list = moderationStore.settings.blockedExtensions
  if (!list || !Array.isArray(list) || list.length === 0) return true
  return list.includes(clean)
}

const toggleExtension = async (ext: string) => {
  const clean = ext.replace(/^\./, '').toLowerCase()
  const list = moderationStore.settings.blockedExtensions || restrictedExtensions.map(e => e.replace(/^\./, '').toLowerCase())
  const currentList = [...list]
  const idx = currentList.indexOf(clean)
  if (idx > -1) currentList.splice(idx, 1)
  else currentList.push(clean)

  try {
    await moderationStore.updateSettings({ blockedExtensions: currentList })
    toast.success(`Extension rule for ${ext} updated`)
  } catch {
    toast.error(`Failed to update rule`)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Moderation Center</h2>
        <p class="text-xs text-slate-400 mt-1">
          Automated link protection, anti-spam enforcement, and malicious payload blocking.
        </p>
      </div>

      <!-- Master Switch -->
      <div class="flex items-center gap-3">
        <span class="text-xs font-semibold text-slate-300">Auto-Moderation Engine:</span>
        <button
          type="button"
          @click="toggle('enabled')"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          :class="moderationStore.settings.enabled ? 'bg-emerald-600 shadow-sm shadow-emerald-500/30' : 'bg-slate-800'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="moderationStore.settings.enabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
      </div>
    </div>

    <!-- 4 Overview Metric Cards (as specified in prompt) -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="tf-card p-5">
        <p class="text-xs text-slate-400 font-medium">Blocked Links</p>
        <h3 class="text-2xl font-bold text-white mt-1">1,284</h3>
        <p class="text-[10px] text-emerald-400 mt-0.5">● Auto-purged</p>
      </div>
      <div class="tf-card p-5">
        <p class="text-xs text-slate-400 font-medium">Deleted Messages</p>
        <h3 class="text-2xl font-bold text-white mt-1">842</h3>
        <p class="text-[10px] text-emerald-400 mt-0.5">● Spam filtered</p>
      </div>
      <div class="tf-card p-5">
        <p class="text-xs text-slate-400 font-medium">Blocked Stickers</p>
        <h3 class="text-2xl font-bold text-white mt-1">291</h3>
        <p class="text-[10px] text-slate-400 mt-0.5">Flood prevention</p>
      </div>
      <div class="tf-card p-5">
        <p class="text-xs text-slate-400 font-medium">Warnings Issued</p>
        <h3 class="text-2xl font-bold text-white mt-1">128</h3>
        <p class="text-[10px] text-amber-400 mt-0.5">User infractions</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: Rules Configuration -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Rule: Link Protection -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Link2 class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">LINK PROTECTION</h4>
              <p class="text-[11px] text-slate-400">Control URL sharing and prevent phishing campaigns</p>
            </div>
          </div>

          <div class="space-y-3 pt-1 text-xs">
            <label class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" :checked="moderationStore.settings.deleteLinks" @change="toggle('deleteLinks')" class="rounded text-[#2481cc]" />
                <span class="text-white font-medium">Block suspicious links and unverified URLs</span>
              </div>
              <span class="text-[10px] text-slate-400">Strict</span>
            </label>

            <label class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" checked class="rounded text-[#2481cc]" />
                <span class="text-white font-medium">Block shortened URLs (bit.ly, tinyurl, t.co)</span>
              </div>
              <span class="text-[10px] text-slate-400">Active</span>
            </label>

            <label class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" checked class="rounded text-[#2481cc]" />
                <span class="text-white font-medium">Allow trusted domains (telegram.org, github.com)</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-medium">Allowlist</span>
            </label>
          </div>
        </div>

        <!-- Rule: Sticker & Media Control -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sticker class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">STICKER & MEDIA CONTROL</h4>
              <p class="text-[11px] text-slate-400">Manage media flood, sticker bursts, and large files</p>
            </div>
          </div>

          <div class="space-y-3 pt-1 text-xs">
            <label class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" :checked="moderationStore.settings.deleteStickers" @change="toggle('deleteStickers')" class="rounded text-[#2481cc]" />
                <span class="text-white font-medium">Block stickers</span>
              </div>
              <span class="text-[10px] text-slate-400">Anti-flood</span>
            </label>

            <label class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <div class="flex items-center gap-2.5">
                <input type="checkbox" class="rounded text-[#2481cc]" />
                <span class="text-white font-medium">Allow premium stickers for verified members</span>
              </div>
              <span class="text-[10px] text-slate-400">Optional</span>
            </label>
          </div>
        </div>

        <!-- Rule: Blocked Keywords Tags -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Tag class="w-4 h-4" />
            </div>
            <div>
              <h4 class="text-sm font-bold text-white">KEYWORDS & PHRASES</h4>
              <p class="text-[11px] text-slate-400">Automatically delete messages containing flagged phrases</p>
            </div>
          </div>

          <div class="space-y-3 pt-1">
            <div class="flex flex-wrap gap-2">
              <span
                v-for="kw in blockedKeywords"
                :key="kw"
                class="px-2.5 py-1 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-1.5"
              >
                <span>{{ kw }}</span>
                <button type="button" @click="removeKeyword(kw)" class="hover:text-white">
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>

            <form @submit.prevent="addKeyword" class="flex gap-2">
              <input
                v-model="newKeyword"
                type="text"
                placeholder="Add blocked keyword or phrase..."
                class="tf-input flex-1 p-2 text-xs"
              />
              <button type="submit" class="tf-btn-secondary px-3 py-1.5 text-xs font-medium cursor-pointer">
                Add Word
              </button>
            </form>
          </div>
        </div>

        <!-- Rule: Restricted File Extensions -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <FileX class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">RESTRICTED EXECUTABLE EXTENSIONS</h4>
                <p class="text-[11px] text-slate-400">Instantly delete hazardous attachments (.exe, .bat, .apk, .sh)</p>
              </div>
            </div>

            <button
              type="button"
              @click="showExtensionsList = !showExtensionsList"
              class="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <span>{{ showExtensionsList ? 'Collapse' : 'Expand' }}</span>
              <ChevronUp v-if="showExtensionsList" class="w-3.5 h-3.5" />
              <ChevronDown v-else class="w-3.5 h-3.5" />
            </button>
          </div>

          <div v-if="showExtensionsList" class="flex flex-wrap gap-1.5 pt-2">
            <button
              v-for="ext in restrictedExtensions"
              :key="ext"
              type="button"
              @click="toggleExtension(ext)"
              class="px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-all cursor-pointer flex items-center gap-1"
              :class="isExtensionBlocked(ext)
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                : 'bg-white/5 border-white/10 text-slate-400'"
            >
              <span>{{ ext }}</span>
              <X v-if="isExtensionBlocked(ext)" class="w-2.5 h-2.5 text-rose-400" />
            </button>
          </div>
        </div>
      </div>

      <!-- Right: Recent Moderation Actions Log Feed -->
      <div class="lg:col-span-4 tf-card p-5 space-y-4">
        <div class="border-b border-white/5 pb-3">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider">Recent Actions</h4>
          <p class="text-[10px] text-slate-400">Live feed of enforcement interventions</p>
        </div>

        <div class="space-y-3 divide-y divide-white/5 text-xs">
          <div
            v-for="item in recentActions"
            :key="item.id"
            class="pt-3 first:pt-0 space-y-1"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-rose-400 flex items-center gap-1">
                ⚠ {{ item.rule }}
              </span>
              <span class="text-[10px] text-slate-400">{{ item.time }}</span>
            </div>
            <p class="font-mono text-[11px] text-slate-300">{{ item.user }}</p>
            <p class="text-[10px] text-slate-400 italic">{{ item.detail }}</p>
          </div>
        </div>

        <!-- Webhook Status Card -->
        <div class="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 mt-4 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-semibold text-white">Telegram Webhook</span>
            <span class="text-[10px] text-emerald-400 font-mono">Live</span>
          </div>
          <p class="text-[10px] text-slate-400">
            Automated moderation triggers on every incoming webhook payload.
          </p>
          <button
            type="button"
            @click="handleSetupWebhook"
            class="tf-btn-secondary w-full py-1.5 text-xs text-center font-medium cursor-pointer"
          >
            Re-verify Webhook
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
