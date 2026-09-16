<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBotStore } from '../stores/bot'
import { useGroupsStore } from '../stores/groups'
import { useToast } from '../composables/useToast'
import { Key, Send, RefreshCw, Eye, EyeOff, ShieldCheck, Trash2 } from 'lucide-vue-next'

defineProps<{
  sidebar?: boolean
}>()

const botStore = useBotStore()
const groupsStore = useGroupsStore()
const toast = useToast()

const tokenInput = ref('')
const showToken = ref(false)

const isTesting = ref(false)
const testChatId = ref('')
const testMessageContent = ref('')

onMounted(async () => {
  await botStore.fetchBot()
  await groupsStore.fetchGroups()
})

const handleSaveToken = async () => {
  if (!tokenInput.value.trim()) {
    toast.error('Token cannot be empty')
    return
  }
  try {
    const res = await botStore.saveBot(tokenInput.value.trim())
    if (res.success) {
      toast.success(`Bot @${res.bot.username} saved and verified successfully!`)
      tokenInput.value = ''
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to save bot token')
  }
}

const handleVerifyBot = async () => {
  try {
    const res = await botStore.verifyBot()
    if (res.success) {
      toast.success(`Bot verified successfully! Connected as @${res.bot.username}`)
    } else {
      toast.error(`Verification failed. Bot offline: ${res.message}`)
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Verification failed. Double check your token.')
  }
}

const handleToggleBot = async () => {
  if (!botStore.bot) return
  try {
    await botStore.toggleBotStatus(!botStore.bot.active)
    toast.success('Bot status updated')
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to update bot status')
  }
}

const handleDeleteBot = async () => {
  if (!confirm('Are you sure you want to remove this bot? Scheduled broadcasts will stop until a new bot is configured.')) {
    return
  }
  try {
    await botStore.deleteBot()
    toast.success('Bot removed successfully')
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to remove bot')
  }
}

const handleSendTest = async () => {
  if (!botStore.isConfigured) {
    toast.error('Configure a bot first')
    return
  }
  if (!testChatId.value) {
    toast.error('Please select a target group first')
    return
  }
  if (!testMessageContent.value.trim()) {
    toast.error('Message content cannot be empty')
    return
  }

  isTesting.value = true
  try {
    const res = await botStore.testMessage(testChatId.value, testMessageContent.value.trim())
    if (res.success) {
      toast.success('Test message sent and logged successfully!')
      testMessageContent.value = ''
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to send test message')
  } finally {
    isTesting.value = false
  }
}
</script>

<template>
  <div :class="sidebar ? 'flex flex-col gap-6' : 'grid grid-cols-1 lg:grid-cols-12 gap-6'">
    <!-- Left: Configure Bot Token & Bot Info -->
    <div :class="sidebar ? 'w-full' : 'lg:col-span-8'" class="space-y-6">

      <!-- Bot Registration Card -->
      <div class="liquid-glass rounded-2xl p-6 relative overflow-hidden">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400 shadow-sm shadow-purple-500/20 backdrop-blur-md">
            <Key class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-white">Telegram Bot Token</h3>
            <p class="text-xs text-slate-400">Register your Telegram bot credentials securely</p>
          </div>
        </div>

        <form @submit.prevent="handleSaveToken" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Telegram Bot Token</label>
            <div class="relative rounded-xl overflow-hidden">
              <input
                :type="showToken ? 'text' : 'password'"
                v-model="tokenInput"
                placeholder="Paste your Telegram Bot Token (e.g. 123456789:ABCdef...)"
                class="w-full liquid-glass-input rounded-xl py-3 px-4 text-sm font-mono pr-12"
              />
              <button
                type="button"
                @click="showToken = !showToken"
                class="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <EyeOff v-if="showToken" class="w-5 h-5" />
                <Eye v-else class="w-5 h-5" />
              </button>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">
              Note: The token is encrypted using AES-256-CBC and stored locally inside <code class="text-xs text-purple-300">data/bot.json</code>.
            </p>
          </div>

          <div class="pt-1">
            <button
              type="submit"
              :disabled="botStore.isLoading"
              class="w-full liquid-glass-button text-white text-sm font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <RefreshCw v-if="botStore.isLoading" class="w-4 h-4 animate-spin" />
              {{ botStore.isConfigured ? 'Replace & Re-verify Bot' : 'Save & Verify Bot' }}
            </button>
          </div>
        </form>
      </div>

      <!-- Configured Bot Card -->
      <div v-if="!sidebar" class="liquid-glass rounded-2xl p-6 relative overflow-hidden">
        <div class="flex items-center gap-3 mb-6">
          <div class="p-2.5 bg-indigo-500/15 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-sm shadow-indigo-500/20 backdrop-blur-md">
            <ShieldCheck class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-white">Configured Bot</h3>
            <p class="text-xs text-slate-400">View status, check API permissions, and manage the bot</p>
          </div>
        </div>

        <div v-if="!botStore.bot" class="text-center py-8 text-slate-400 border border-dashed border-white/10 rounded-xl">
          No bot configured yet. Add one using the form above.
        </div>

        <div v-else class="space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p class="text-base font-bold text-white">{{ botStore.bot.firstName }}</p>
              <a :href="`https://t.me/${botStore.bot.username}`" target="_blank" class="text-sm text-slate-400 hover:text-purple-400 transition-colors font-mono">
                @{{ botStore.bot.username }}
              </a>
            </div>
            <span
              class="px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 liquid-glass-pill"
              :class="botStore.bot.status === 'ONLINE' ? 'text-emerald-400 border-emerald-500/30' : 'text-rose-400 border-rose-500/30'"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="botStore.bot.status === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
              {{ botStore.bot.status }}
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3 text-xs">
            <div class="flex items-center gap-2 text-slate-300">
              <span class="w-1.5 h-1.5 rounded-full" :class="botStore.bot.permissions?.can_join_groups ? 'bg-emerald-400' : 'bg-rose-400'"></span>
              Join Groups
            </div>
            <div class="flex items-center gap-2 text-slate-300">
              <span class="w-1.5 h-1.5 rounded-full" :class="botStore.bot.permissions?.can_read_all_group_messages ? 'bg-emerald-400' : 'bg-rose-400'"></span>
              Read Messages
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10">
            <div class="flex items-center gap-2 text-xs text-slate-300">
              <span>Active</span>
              <button
                @click="handleToggleBot"
                class="w-10 h-6 rounded-full p-0.5 transition-all outline-none cursor-pointer"
                :class="botStore.bot.active ? 'bg-purple-600 flex justify-end shadow-sm shadow-purple-500/40' : 'bg-slate-800 flex justify-start'"
              >
                <span class="bg-white w-5 h-5 rounded-full shadow-md"></span>
              </button>
            </div>
            <div class="flex-1"></div>
            <button
              @click="handleVerifyBot"
              class="px-3 py-1.5 liquid-glass-pill rounded-lg text-slate-200 hover:text-white transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Verify Bot Connection"
            >
              <ShieldCheck class="w-4 h-4 text-emerald-400" />
              Verify
            </button>
            <button
              @click="handleDeleteBot"
              class="px-3 py-1.5 liquid-glass-pill border-rose-500/30 text-rose-400 hover:text-rose-300 rounded-lg transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
              title="Remove Bot"
            >
              <Trash2 class="w-4 h-4" />
              Remove
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- Right: Test Dispatcher -->
    <div :class="sidebar ? 'w-full' : 'lg:col-span-4'" class="space-y-6">

      <!-- Quick Info -->
      <div v-if="sidebar && botStore.bot" class="liquid-glass rounded-2xl p-6 relative overflow-hidden">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Bot Overview</h3>
        <div class="flex items-center justify-between">
          <div class="truncate pr-2">
            <p class="text-sm font-semibold text-white truncate">{{ botStore.bot.firstName }}</p>
            <p class="text-xs text-slate-400 font-mono">@{{ botStore.bot.username }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full" :class="botStore.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'"></span>
            <button @click="handleVerifyBot" class="text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer">Verify</button>
          </div>
        </div>
      </div>

      <!-- Test Dispatcher Card -->
      <div class="liquid-glass rounded-2xl p-6 relative overflow-hidden">
        <div class="flex items-center gap-3 mb-4">
          <div class="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl text-amber-400 shadow-sm shadow-amber-500/20 backdrop-blur-md">
            <Send class="w-5 h-5" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-white">Test Dispatcher</h3>
            <p class="text-xs text-slate-400">Send direct manual messages to groups</p>
          </div>
        </div>

        <div class="space-y-3">
          <!-- Target Selector -->
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Target Destination</label>
            <select
              v-model="testChatId"
              class="w-full liquid-glass-input rounded-xl py-2.5 px-3 text-sm transition-all"
            >
              <option value="">Select target destination...</option>
              <option v-for="g in groupsStore.groups" :key="g.id" :value="g.chatId">
                [{{ g.type.toUpperCase() }}] {{ g.name }}
              </option>
            </select>
          </div>

          <!-- Message Text -->
          <div>
            <label class="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Message Content</label>
            <div class="relative">
              <textarea
                v-model="testMessageContent"
                placeholder="Write test message here (HTML mode)..."
                rows="3"
                class="w-full liquid-glass-input rounded-xl py-2.5 px-3.5 text-sm resize-none pr-10"
              ></textarea>
              <button
                @click="handleSendTest"
                :disabled="isTesting || !botStore.isConfigured || !testChatId || !testMessageContent"
                class="absolute right-2.5 bottom-3.5 text-purple-400 hover:text-purple-300 disabled:opacity-40 transition-colors p-1 cursor-pointer"
              >
                <RefreshCw v-if="isTesting" class="w-4 h-4 animate-spin" />
                <Send v-else class="w-4 h-4" />
              </button>
            </div>
            <p v-if="!botStore.isConfigured" class="text-[11px] text-amber-400 mt-2">
              Configure a bot above before sending test messages.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
