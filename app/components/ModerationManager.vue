<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useModerationStore, type ModerationActionKind, type ModerationSettings } from '../stores/moderation'
import { useWebhookStore } from '../stores/webhook'
import { useToast } from '../composables/useToast'
import {
  Link2,
  Sticker,
  FileX,
  Tag,
  VolumeX,
  AlertCircle,
  Trash2,
  Ban,
  Clock,
  X,
  Plus,
  RefreshCw,
  ShieldCheck
} from 'lucide-vue-next'

const moderationStore = useModerationStore()
const webhookStore = useWebhookStore()
const toast = useToast()

const ACTIVITY_DAYS = 7
const MAX_KEYWORDS = 100
const EXTENSIONS_PREVIEW = 24

// Ticks once a minute so relative timestamps stay current.
const now = ref(Date.now())
let clock: ReturnType<typeof setInterval> | undefined

const initialLoad = ref(true)

// Editable copies of the escalation settings, saved together with one button.
const warnLimit = ref(3)
const muteMinutes = ref(60)
const rulesText = ref('')
const isSavingEscalation = ref(false)

const syncEscalationForm = () => {
  warnLimit.value = moderationStore.settings.warnLimit ?? 3
  muteMinutes.value = moderationStore.settings.muteMinutes ?? 60
  rulesText.value = moderationStore.settings.rulesText ?? ''
}

onMounted(async () => {
  clock = setInterval(() => { now.value = Date.now() }, 60_000)
  await Promise.all([
    moderationStore.fetchSettings(),
    moderationStore.fetchActivity(ACTIVITY_DAYS),
    webhookStore.fetchInfo()
  ])
  syncEscalationForm()
  initialLoad.value = false
})

onBeforeUnmount(() => {
  if (clock) clearInterval(clock)
})

const refreshActivity = () => moderationStore.fetchActivity(ACTIVITY_DAYS)

const saveEscalation = async () => {
  isSavingEscalation.value = true
  try {
    await moderationStore.updateSettings({
      warnLimit: Number(warnLimit.value),
      muteMinutes: Number(muteMinutes.value),
      rulesText: rulesText.value
    })
    syncEscalationForm()
    toast.success('Warning and mute settings saved')
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || error?.statusMessage || 'Failed to save settings')
  } finally {
    isSavingEscalation.value = false
  }
}

// ---- Boolean rules --------------------------------------------------------

type ToggleKey = 'enabled' | 'deleteLinks' | 'deleteStickers' | 'deleteFiles' | 'exemptAdmins'
const savingKey = ref<ToggleKey | null>(null)

const toggle = async (key: ToggleKey) => {
  if (savingKey.value) return
  savingKey.value = key
  const next = !moderationStore.settings[key]
  try {
    await moderationStore.updateSettings({ [key]: next } as Partial<ModerationSettings>)
    toast.success(key === 'enabled' ? `Auto-moderation turned ${next ? 'on' : 'off'}` : 'Rule updated')
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || 'Failed to update rule')
  } finally {
    savingKey.value = null
  }
}

const contentRules: { key: 'deleteLinks' | 'deleteStickers' | 'deleteFiles'; label: string; description: string; icon: any }[] = [
  {
    key: 'deleteLinks',
    label: 'Remove links',
    description: 'Deletes messages containing URLs, t.me links or domain-like text (e.g. example.com).',
    icon: Link2
  },
  {
    key: 'deleteStickers',
    label: 'Remove stickers',
    description: 'Deletes every sticker sent in the group.',
    icon: Sticker
  },
  {
    key: 'deleteFiles',
    label: 'Remove blocked file types',
    description: 'Deletes attachments whose extension is on the blocked list below.',
    icon: FileX
  }
]

// ---- Keywords (persisted in settings.blockedKeywords) ----------------------

const newKeyword = ref('')
const isSavingKeywords = ref(false)
const keywords = computed(() => moderationStore.settings.blockedKeywords || [])

const normaliseKeyword = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const saveKeywords = async (list: string[], message: string) => {
  isSavingKeywords.value = true
  try {
    await moderationStore.updateSettings({ blockedKeywords: list })
    toast.success(message)
    return true
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || 'Failed to update blocked words')
    return false
  } finally {
    isSavingKeywords.value = false
  }
}

const addKeyword = async () => {
  const kw = normaliseKeyword(newKeyword.value)
  if (!kw) return
  if (kw.length > 64) {
    toast.error('Keep each word or phrase under 64 characters')
    return
  }
  if (keywords.value.includes(kw)) {
    toast.error(`"${kw}" is already blocked`)
    return
  }
  if (keywords.value.length >= MAX_KEYWORDS) {
    toast.error(`You can block at most ${MAX_KEYWORDS} words or phrases`)
    return
  }
  if (await saveKeywords([...keywords.value, kw], `Blocked "${kw}"`)) newKeyword.value = ''
}

const removeKeyword = (kw: string) =>
  saveKeywords(keywords.value.filter(k => k !== kw), `Removed "${kw}"`)

// ---- File extensions (persisted in settings.blockedExtensions) --------------

const newExtension = ref('')
const isSavingExtensions = ref(false)
const showAllExtensions = ref(false)

const extensions = computed(() =>
  [...(moderationStore.settings.blockedExtensions || [])].sort((a, b) => a.localeCompare(b))
)
const visibleExtensions = computed(() =>
  showAllExtensions.value ? extensions.value : extensions.value.slice(0, EXTENSIONS_PREVIEW)
)
const blocksAllFiles = computed(() => extensions.value.some(e => e === '*' || e === 'all'))

const saveExtensions = async (list: string[], message: string) => {
  isSavingExtensions.value = true
  try {
    await moderationStore.updateSettings({ blockedExtensions: list })
    toast.success(message)
    return true
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || 'Failed to update file types')
    return false
  } finally {
    isSavingExtensions.value = false
  }
}

const addExtension = async () => {
  const ext = newExtension.value.trim().toLowerCase().replace(/^\.+/, '')
  if (!ext) return
  if (!/^(\*|[a-z0-9]{1,16})$/.test(ext)) {
    toast.error('Use letters and numbers only, e.g. "exe" or ".apk"')
    return
  }
  if (extensions.value.includes(ext)) {
    toast.error(`.${ext} is already blocked`)
    return
  }
  const current = moderationStore.settings.blockedExtensions || []
  if (await saveExtensions([...current, ext], ext === '*' ? 'All files are now blocked' : `Blocked .${ext}`)) {
    newExtension.value = ''
  }
}

const removeExtension = (ext: string) => {
  const current = moderationStore.settings.blockedExtensions || []
  return saveExtensions(current.filter(e => e !== ext), `Unblocked ${ext === '*' ? 'all files' : '.' + ext}`)
}

const extLabel = (ext: string) => (ext === '*' || ext === 'all' ? 'all files' : `.${ext}`)

// ---- Activity ---------------------------------------------------------------

const activity = computed(() => moderationStore.activity)

const stats = computed(() => {
  const c = activity.value?.counts
  return [
    { label: 'Links removed', value: c?.link ?? 0, icon: Link2 },
    { label: 'Stickers removed', value: c?.sticker ?? 0, icon: Sticker },
    { label: 'Files removed', value: c?.file ?? 0, icon: FileX },
    { label: 'Blocked-word removals', value: c?.keyword ?? 0, icon: Tag },
    { label: 'Users muted', value: c?.mute ?? 0, icon: VolumeX }
  ]
})

const periodLabel = computed(() => {
  const a = activity.value
  if (!a) return `Last ${ACTIVITY_DAYS} days`
  if (a.truncated) {
    return `Since ${new Date(a.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} (older log entries have been rotated out)`
  }
  return `Last ${a.days} days`
})

const kindMeta: Record<ModerationActionKind, { label: string; icon: any; tone: string }> = {
  link: { label: 'Link removed', icon: Link2, tone: 'text-sky-400' },
  sticker: { label: 'Sticker removed', icon: Sticker, tone: 'text-indigo-400' },
  file: { label: 'File removed', icon: FileX, tone: 'text-amber-400' },
  keyword: { label: 'Blocked word', icon: Tag, tone: 'text-rose-400' },
  mute: { label: 'User muted', icon: VolumeX, tone: 'text-rose-400' },
  mute_failed: { label: 'Mute failed', icon: AlertCircle, tone: 'text-amber-400' },
  manual: { label: 'Removed by admin', icon: Trash2, tone: 'text-slate-300' }
}

const relativeTime = (iso: string) => {
  const diff = Math.max(0, now.value - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ---- Webhook ------------------------------------------------------------------

const webhookState = computed(() => {
  const info = webhookStore.info
  if (!info.configured) return { label: 'Not configured', tone: 'text-slate-400', dot: 'bg-slate-500' }
  if (info.lastError) return { label: 'Error reported', tone: 'text-amber-400', dot: 'bg-amber-400' }
  return { label: 'Connected', tone: 'text-emerald-400', dot: 'bg-emerald-400' }
})

const handleSetupWebhook = async () => {
  try {
    const res = await webhookStore.setup()
    if (res.success) toast.success(`Webhook registered: ${res.url}`)
  } catch (error: any) {
    toast.error(error?.data?.statusMessage || error?.statusMessage || 'Failed to register webhook')
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl font-semibold text-white">Moderation</h2>
        <p class="text-sm text-slate-400 mt-1">
          Rules the bot enforces automatically in every group where it is an admin.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-sm font-medium text-slate-300">Auto-moderation</span>
        <button
          type="button"
          role="switch"
          :aria-checked="moderationStore.settings.enabled"
          aria-label="Toggle auto-moderation"
          :disabled="savingKey === 'enabled' || initialLoad"
          @click="toggle('enabled')"
          class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          :class="moderationStore.settings.enabled ? 'bg-[#2481cc]' : 'bg-slate-700'"
        >
          <span
            class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="moderationStore.settings.enabled ? 'translate-x-5' : 'translate-x-0'"
          />
        </button>
        <span class="text-sm tabular-nums w-7" :class="moderationStore.settings.enabled ? 'text-emerald-400' : 'text-slate-400'">
          {{ moderationStore.settings.enabled ? 'On' : 'Off' }}
        </span>
      </div>
    </div>

    <div
      v-if="!initialLoad && !moderationStore.settings.enabled"
      class="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-sm text-amber-300"
    >
      <AlertCircle class="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p>Auto-moderation is off. The rules below are saved but not enforced until you turn it on.</p>
    </div>

    <!-- Activity stats -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-white">Activity</h3>
          <p class="text-xs text-slate-400">{{ periodLabel }}, from the bot's message log</p>
        </div>
        <button
          type="button"
          @click="refreshActivity"
          :disabled="moderationStore.isLoadingActivity"
          class="tf-btn-secondary px-2.5 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw class="w-3.5 h-3.5" :class="moderationStore.isLoadingActivity ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div v-for="stat in stats" :key="stat.label" class="tf-card p-4">
          <div class="flex items-center gap-2 text-slate-400">
            <component :is="stat.icon" class="w-3.5 h-3.5" />
            <p class="text-xs font-medium">{{ stat.label }}</p>
          </div>
          <div v-if="!activity && moderationStore.isLoadingActivity" class="h-7 w-12 mt-2 rounded-md bg-white/5" />
          <p v-else-if="!activity" class="text-2xl font-semibold text-slate-500 mt-1.5 tabular-nums">–</p>
          <p v-else class="text-2xl font-semibold text-white mt-1.5 tabular-nums">{{ stat.value.toLocaleString() }}</p>
        </div>
      </div>
      <p v-if="moderationStore.activityError" class="text-xs text-rose-400">{{ moderationStore.activityError }}</p>
    </section>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: rules -->
      <div class="lg:col-span-8 space-y-6">
        <!-- Content rules -->
        <div class="tf-card p-5 space-y-4">
          <div>
            <h4 class="text-sm font-semibold text-white">Content rules</h4>
            <p class="text-xs text-slate-400 mt-0.5">Matching messages are deleted and count as a warning for the sender.</p>
          </div>

          <div class="space-y-2">
            <label
              v-for="rule in contentRules"
              :key="rule.key"
              class="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer"
            >
              <input
                type="checkbox"
                class="mt-0.5 rounded"
                :checked="moderationStore.settings[rule.key]"
                :disabled="savingKey !== null || initialLoad"
                @change="toggle(rule.key)"
              />
              <component :is="rule.icon" class="w-4 h-4 mt-0.5 text-slate-400 flex-shrink-0" />
              <span class="min-w-0">
                <span class="block text-sm font-medium text-white">{{ rule.label }}</span>
                <span class="block text-xs text-slate-400 mt-0.5">{{ rule.description }}</span>
              </span>
            </label>
          </div>
        </div>

        <!-- Blocked words -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="text-sm font-semibold text-white">Blocked words and phrases</h4>
              <p class="text-xs text-slate-400 mt-0.5">
                Messages whose text or caption contains any of these are deleted. Matching is case-insensitive and also matches inside longer words.
              </p>
            </div>
            <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{{ keywords.length }} / {{ MAX_KEYWORDS }}</span>
          </div>

          <div v-if="keywords.length" class="flex flex-wrap gap-2">
            <span
              v-for="kw in keywords"
              :key="kw"
              class="pl-2.5 pr-1.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-200 text-xs flex items-center gap-1.5"
            >
              <span>{{ kw }}</span>
              <button
                type="button"
                :disabled="isSavingKeywords"
                @click="removeKeyword(kw)"
                class="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-50"
                :aria-label="`Remove ${kw}`"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
          <p v-else class="text-xs text-slate-400 p-3 rounded-lg border border-dashed border-white/10">
            No blocked words yet. Add one below to start filtering.
          </p>

          <form @submit.prevent="addKeyword" class="flex gap-2">
            <input
              v-model="newKeyword"
              type="text"
              maxlength="64"
              placeholder="Add a word or phrase"
              aria-label="New blocked word or phrase"
              class="tf-input flex-1 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              :disabled="isSavingKeywords || !newKeyword.trim() || keywords.length >= MAX_KEYWORDS"
              class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>

        <!-- Blocked file types -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h4 class="text-sm font-semibold text-white">Blocked file types</h4>
              <p class="text-xs text-slate-400 mt-0.5">
                Enforced when "Remove blocked file types" is on. Add <span class="font-mono">*</span> to block every file.
              </p>
            </div>
            <span class="text-xs text-slate-400 tabular-nums whitespace-nowrap">{{ extensions.length }} blocked</span>
          </div>

          <p
            v-if="!initialLoad && !moderationStore.settings.deleteFiles"
            class="text-xs text-amber-300 flex items-center gap-1.5"
          >
            <AlertCircle class="w-3.5 h-3.5" /> File blocking is off, so this list is not enforced.
          </p>
          <p v-if="blocksAllFiles" class="text-xs text-slate-300">All attachments are blocked because the list contains <span class="font-mono">*</span>.</p>

          <div v-if="extensions.length" class="space-y-2">
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="ext in visibleExtensions"
                :key="ext"
                class="pl-2 pr-1 py-0.5 rounded-md bg-white/5 border border-white/10 text-slate-200 text-xs font-mono flex items-center gap-1"
              >
                {{ extLabel(ext) }}
                <button
                  type="button"
                  :disabled="isSavingExtensions"
                  @click="removeExtension(ext)"
                  class="p-0.5 rounded text-slate-400 hover:text-white disabled:opacity-50"
                  :aria-label="`Unblock ${extLabel(ext)}`"
                >
                  <X class="w-3 h-3" />
                </button>
              </span>
            </div>
            <button
              v-if="extensions.length > EXTENSIONS_PREVIEW"
              type="button"
              @click="showAllExtensions = !showAllExtensions"
              class="text-xs text-slate-400 hover:text-white"
            >
              {{ showAllExtensions ? 'Show fewer' : `Show all ${extensions.length}` }}
            </button>
          </div>
          <p v-else class="text-xs text-slate-400 p-3 rounded-lg border border-dashed border-white/10">
            No file types are blocked.
          </p>

          <form @submit.prevent="addExtension" class="flex gap-2">
            <input
              v-model="newExtension"
              type="text"
              maxlength="17"
              placeholder="e.g. .exe"
              aria-label="New blocked file extension"
              class="tf-input flex-1 px-3 py-2 text-sm font-mono"
            />
            <button
              type="submit"
              :disabled="isSavingExtensions || !newExtension.trim()"
              class="tf-btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-3.5 h-3.5" /> Add
            </button>
          </form>
        </div>

        <!-- Warnings & mute -->
        <div class="tf-card p-5 space-y-4">
          <div class="flex items-center gap-2">
            <Ban class="w-4 h-4 text-slate-400" />
            <div>
              <h4 class="text-sm font-semibold text-white">Warnings and mute</h4>
              <p class="text-xs text-slate-400 mt-0.5">Each deleted message is a warning; users are muted when they reach the limit.</p>
            </div>
          </div>

          <div class="space-y-3 text-xs">
            <label class="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 cursor-pointer">
              <input
                type="checkbox"
                class="rounded"
                :checked="moderationStore.settings.exemptAdmins"
                :disabled="savingKey !== null || initialLoad"
                @change="toggle('exemptAdmins')"
              />
              <span class="text-sm font-medium text-white">Exempt group admins from auto-moderation</span>
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="space-y-1.5">
                <span class="block text-slate-300 font-medium">Warnings before mute (0 = never mute)</span>
                <input v-model.number="warnLimit" type="number" min="0" max="20" class="tf-input w-full px-3 py-2 text-sm tabular-nums" />
              </label>
              <label class="space-y-1.5">
                <span class="text-slate-300 font-medium flex items-center gap-1"><Clock class="w-3 h-3" /> Mute duration (minutes)</span>
                <input v-model.number="muteMinutes" type="number" min="1" class="tf-input w-full px-3 py-2 text-sm tabular-nums" />
              </label>
            </div>
            <p class="text-slate-400">
              Warnings expire 24 hours after a user's last violation. Muting requires a supergroup where the bot has the "Ban users" admin right.
            </p>

            <label class="block space-y-1.5">
              <span class="block text-slate-300 font-medium">Group rules (shown by /rules)</span>
              <textarea v-model="rulesText" rows="4" maxlength="3000" class="tf-input w-full px-3 py-2 text-sm" />
            </label>
            <p class="text-slate-400">
              Bot commands: /help, /rules, /warns, /resetwarns (admins, reply to a user).
            </p>

            <button
              type="button"
              :disabled="isSavingEscalation || initialLoad"
              @click="saveEscalation"
              class="tf-btn-primary px-3 py-2 text-xs cursor-pointer"
            >
              {{ isSavingEscalation ? 'Saving…' : 'Save warning settings' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Right: recent actions + webhook -->
      <div class="lg:col-span-4 space-y-6">
        <div class="tf-card p-5 space-y-4">
          <div class="border-b border-white/5 pb-3">
            <h4 class="text-sm font-semibold text-white">Recent actions</h4>
            <p class="text-xs text-slate-400 mt-0.5">Latest moderation entries from the message log</p>
          </div>

          <div v-if="!activity && moderationStore.isLoadingActivity" class="space-y-3">
            <div v-for="i in 4" :key="i" class="space-y-1.5">
              <div class="h-3 w-2/3 rounded-md bg-white/5" />
              <div class="h-3 w-1/2 rounded-md bg-white/5" />
            </div>
          </div>

          <div v-else-if="activity && activity.recent.length" class="divide-y divide-white/5">
            <div v-for="item in activity.recent" :key="item.id" class="py-3 first:pt-0 last:pb-0 space-y-1">
              <div class="flex items-center justify-between gap-2">
                <span class="flex items-center gap-1.5 text-xs font-medium" :class="kindMeta[item.kind].tone">
                  <component :is="kindMeta[item.kind].icon" class="w-3.5 h-3.5" />
                  {{ kindMeta[item.kind].label }}
                </span>
                <time :datetime="item.sentAt" :title="new Date(item.sentAt).toLocaleString()" class="text-xs text-slate-400 whitespace-nowrap">
                  {{ relativeTime(item.sentAt) }}
                </time>
              </div>
              <p class="text-sm text-white truncate">{{ item.who }}</p>
              <p class="text-xs text-slate-400 truncate">
                {{ item.group }}<template v-if="item.detail"> · <span class="text-slate-300">{{ item.detail }}</span></template>
              </p>
            </div>
          </div>

          <div v-else class="py-6 text-center space-y-2">
            <ShieldCheck class="w-5 h-5 text-slate-500 mx-auto" />
            <p class="text-sm text-slate-300">No moderation actions yet</p>
            <p class="text-xs text-slate-400">Deleted messages and mutes will appear here.</p>
          </div>
        </div>

        <!-- Webhook status (from Telegram getWebhookInfo) -->
        <div class="tf-card p-5 space-y-3 text-xs">
          <div class="flex items-center justify-between gap-2">
            <h4 class="text-sm font-semibold text-white">Telegram webhook</h4>
            <span v-if="webhookStore.isLoading && initialLoad" class="text-slate-400">Checking…</span>
            <span v-else class="flex items-center gap-1.5 font-medium" :class="webhookState.tone">
              <span class="w-1.5 h-1.5 rounded-full" :class="webhookState.dot" />
              {{ webhookState.label }}
            </span>
          </div>
          <p class="text-slate-400">
            Moderation runs on each update Telegram delivers to the webhook. Without it, no rules are enforced.
          </p>
          <p v-if="webhookStore.info.url" class="font-mono text-slate-300 truncate" :title="webhookStore.info.url">
            {{ webhookStore.info.url }}
          </p>
          <p v-if="webhookStore.info.pendingUpdateCount > 0" class="text-slate-300 tabular-nums">
            {{ webhookStore.info.pendingUpdateCount }} pending update{{ webhookStore.info.pendingUpdateCount === 1 ? '' : 's' }}
          </p>
          <p v-if="webhookStore.info.lastError" class="text-amber-300 break-words">
            Last error: {{ webhookStore.info.lastError }}
          </p>
          <button
            type="button"
            :disabled="webhookStore.isLoading"
            @click="handleSetupWebhook"
            class="tf-btn-secondary w-full py-2 text-xs cursor-pointer"
          >
            {{ webhookStore.info.configured ? 'Re-register webhook' : 'Register webhook' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
