<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useGroupsStore } from '../stores/groups'
import { useChatStore, type ReplyTarget, type ChatMessage } from '../stores/chat'
import { useWebhookStore } from '../stores/webhook'
import { useToast } from '../composables/useToast'
import {
  Send,
  Users,
  RefreshCw,
  Search,
  Crown,
  Shield,
  Bot,
  MessageSquare,
  ArrowLeft,
  Reply,
  X,
  Trash2,
  File,
  Download,
  Sticker,
  Image,
  Video,
  Smile,
  Paperclip,
  Check,
  CheckCheck,
  Copy,
  Share2,
  ChevronDown,
  Info,
  Link,
  ShieldAlert,
  Sparkles,
  Lock,
  Upload,
  AlertTriangle,
  Zap,
  Plus
} from 'lucide-vue-next'

const groupsStore = useGroupsStore()
const chatStore = useChatStore()
const webhookStore = useWebhookStore()
const toast = useToast()

const activeGroupId = ref<string | null>(null)
const draft = ref('')
const searchQuery = ref('')
const messageSearchQuery = ref('')
const isSearchingInChat = ref(false)

const showRightPanel = ref(true)
const rightPanelTab = ref<'info' | 'members' | 'media' | 'files' | 'links'>('info')

const replyingTo = ref<ReplyTarget | null>(null)
const showStickerPicker = ref(false)
const showEmojiPicker = ref(false)
const stickerTab = ref<'featured' | 'recents' | 'custom'>('featured')
const customStickerInput = ref('')
const isEnablingWebhook = ref(false)

const showAddGroupModal = ref(false)
const newGroupChatId = ref('')
const newGroupName = ref('')
const isAddingGroup = ref(false)

const messagesContainer = ref<HTMLElement | null>(null)
const messagesEnd = ref<HTMLElement | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const videoInput = ref<HTMLInputElement | null>(null)
const stickerFileInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const showScrollBottom = ref(false)

let pollTimer: ReturnType<typeof setInterval> | null = null

// Curated Telegram-compatible featured stickers
const featuredStickers = [
  { id: '1', emoji: '👍', name: 'Thumbs Up', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f44d.png' },
  { id: '2', emoji: '❤️', name: 'Heart', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/2764.png' },
  { id: '3', emoji: '🔥', name: 'Fire', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f525.png' },
  { id: '4', emoji: '🎉', name: 'Party', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f389.png' },
  { id: '5', emoji: '🚀', name: 'Rocket', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f680.png' },
  { id: '6', emoji: '😂', name: 'Joy', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f602.png' },
  { id: '7', emoji: '🤖', name: 'Robot', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f916.png' },
  { id: '8', emoji: '👏', name: 'Clap', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f44f.png' },
  { id: '9', emoji: '💯', name: 'Hundred', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f4af.png' },
  { id: '10', emoji: '✨', name: 'Sparkles', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/2728.png' },
  { id: '11', emoji: '🙏', name: 'Pray', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f64f.png' },
  { id: '12', emoji: '😎', name: 'Cool', url: 'https://images.emojiterra.com/google/noto-color-emoji/v15.1/512px/1f60e.png' }
]

// Sample emoji list for quick picker
const commonEmojis = ['👍', '❤️', '🔥', '👏', '🎉', '🚀', '😂', '🙏', '💯', '✨', '⚡', '🤖', '👀', '💡', '✅', '⚠️']

// Default groups if empty
const defaultGroups = [
  { id: 'g1', chatId: '-100148291024', name: 'Developers Cambodia', type: 'supergroup', membersCount: 12482 },
  { id: 'g2', chatId: '-100189201948', name: 'Flutter Dev Community', type: 'supergroup', membersCount: 2482 },
  { id: 'g3', chatId: '-100199482911', name: 'Marketing & Growth', type: 'group', membersCount: 8291 }
]

const availableChats = computed(() => {
  if (groupsStore.groups.length > 0) return groupsStore.groups
  return defaultGroups as any[]
})

const activeGroup = computed(() => {
  return availableChats.value.find(g => g.id === activeGroupId.value) || null
})

const stickers = computed(() => {
  const seen = new Set<string>()
  return chatStore.messages.filter(msg => {
    if (msg.mediaType !== 'sticker' || !msg.mediaFileId || seen.has(msg.mediaFileId)) return false
    seen.add(msg.mediaFileId)
    return true
  })
})

const chatList = computed(() =>
  availableChats.value.filter(g =>
    g.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    g.chatId.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

const filteredMessages = computed(() => {
  const q = messageSearchQuery.value.trim().toLowerCase()
  if (!q) return chatStore.messages
  return chatStore.messages.filter(m =>
    (m.text && m.text.toLowerCase().includes(q)) ||
    m.fromName.toLowerCase().includes(q)
  )
})

const scrollToBottom = async () => {
  await nextTick()
  messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
}

const handleScroll = () => {
  if (!messagesContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  showScrollBottom.value = scrollHeight - scrollTop - clientHeight > 180
}

const loadChat = async (id: string) => {
  activeGroupId.value = id
  replyingTo.value = null
  showStickerPicker.value = false
  showEmojiPicker.value = false
  chatStore.reset()
  await Promise.all([chatStore.fetchMessages(id), chatStore.fetchMembers(id)])
  await scrollToBottom()
}

const startReply = (msg: ChatMessage) => {
  if (!msg.messageId) {
    toast.error('This message cannot be replied to.')
    return
  }
  replyingTo.value = { messageId: msg.messageId, name: msg.fromName, text: msg.text || 'Attachment' }
}

const cancelReply = () => {
  replyingTo.value = null
}

const copyMessage = (text: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.success('Message copied to clipboard')
}

const forwardMessage = (text: string) => {
  draft.value = text
  toast.success('Message loaded into composer for forwarding')
}

const handleClearChat = async () => {
  if (!activeGroupId.value || !activeGroup.value) return
  if (!confirm(`Clear local chat history for "${activeGroup.value.name}"?`)) return
  try {
    const res = await chatStore.clearChat(activeGroupId.value)
    replyingTo.value = null
    toast.success(`Chat cleared (${res.removed} messages removed)`)
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to clear chat')
  }
}

const handleDelete = async (msg: ChatMessage) => {
  if (!msg.messageId || !activeGroupId.value) return
  if (!confirm('Delete this message from the group?')) return
  try {
    await chatStore.deleteMessage(activeGroupId.value, msg.messageId)
    if (replyingTo.value?.messageId === msg.messageId) replyingTo.value = null
    toast.success('Message deleted')
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to delete message')
  }
}

const refresh = async () => {
  if (!activeGroupId.value) return
  await Promise.all([
    chatStore.fetchMessages(activeGroupId.value),
    chatStore.fetchMembers(activeGroupId.value)
  ])
}

const handleSend = async () => {
  const text = draft.value.trim()
  if (!text || !activeGroupId.value) return
  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  draft.value = ''
  replyingTo.value = null
  showEmojiPicker.value = false
  try {
    await chatStore.sendMessage(groupId, text, replyTo)
    await scrollToBottom()
  } catch (error: any) {
    draft.value = text
    replyingTo.value = replyTo
    toast.error(error.statusMessage || 'Failed to send message')
  }
}

const handleSendSticker = async (sticker: ChatMessage) => {
  if (!activeGroupId.value || !sticker.mediaFileId) return
  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  showStickerPicker.value = false
  replyingTo.value = null
  try {
    await chatStore.sendSticker(groupId, sticker, replyTo)
    await scrollToBottom()
    toast.success('Sticker sent')
  } catch (error: any) {
    replyingTo.value = replyTo
    toast.error(error.statusMessage || 'Failed to send sticker')
  }
}

const handleSendFeaturedSticker = async (st: { url: string; emoji?: string }) => {
  if (!activeGroupId.value) return
  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  showStickerPicker.value = false
  replyingTo.value = null
  try {
    await chatStore.sendSticker(groupId, { url: st.url, emoji: st.emoji }, replyTo)
    await scrollToBottom()
    toast.success('Sticker sent')
  } catch (error: any) {
    replyingTo.value = replyTo
    toast.error(error.statusMessage || 'Failed to send sticker')
  }
}

const handleSendCustomSticker = async () => {
  const target = customStickerInput.value.trim()
  if (!activeGroupId.value || !target) return
  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  customStickerInput.value = ''
  showStickerPicker.value = false
  replyingTo.value = null
  try {
    await chatStore.sendSticker(groupId, { fileId: target }, replyTo)
    await scrollToBottom()
    toast.success('Sticker sent')
  } catch (error: any) {
    replyingTo.value = replyTo
    toast.error(error.statusMessage || 'Failed to send custom sticker')
  }
}

const handleStickerFileSelect = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !activeGroupId.value) return

  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  showStickerPicker.value = false
  try {
    await chatStore.sendMedia(groupId, file, 'sticker', '', replyTo)
    replyingTo.value = null
    await scrollToBottom()
    toast.success('Sticker uploaded & sent')
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to send sticker')
  }
}

const handleEnableWebhook = async () => {
  isEnablingWebhook.value = true
  try {
    await webhookStore.setup()
    toast.success('Real-time Telegram webhook connected successfully!')
  } catch (err: any) {
    toast.error(err.statusMessage || 'Failed to connect webhook')
  } finally {
    isEnablingWebhook.value = false
  }
}

const handleAddGroup = async () => {
  const chatId = newGroupChatId.value.trim()
  if (!chatId) {
    toast.error('Chat ID or username is required')
    return
  }
  isAddingGroup.value = true
  try {
    const res = await groupsStore.addGroup(chatId, newGroupName.value.trim())
    showAddGroupModal.value = false
    newGroupChatId.value = ''
    newGroupName.value = ''
    toast.success('Group connected successfully!')
    if (res.group?.id) {
      loadChat(res.group.id)
    }
  } catch (err: any) {
    toast.error(err.statusMessage || err.message || 'Failed to connect group')
  } finally {
    isAddingGroup.value = false
  }
}

const insertEmoji = (emoji: string) => {
  draft.value += emoji
  showEmojiPicker.value = false
}

const handleMediaSelect = async (event: Event, mediaType: 'photo' | 'video') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !activeGroupId.value) return

  const groupId = activeGroupId.value
  const caption = draft.value.trim()
  const replyTo = replyingTo.value
  try {
    await chatStore.sendMedia(groupId, file, mediaType, caption, replyTo)
    draft.value = ''
    replyingTo.value = null
    await scrollToBottom()
    toast.success(`${mediaType === 'photo' ? 'Image' : 'Video'} sent`)
  } catch (error: any) {
    toast.error(error.statusMessage || `Failed to send ${mediaType}`)
  }
}

const initials = (name: string) =>
  name.replace(/^@/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const mediaSrc = (fileId?: string) => (fileId ? `/api/media/${fileId}` : '')

watch(() => chatStore.messages.length, scrollToBottom)

onMounted(async () => {
  webhookStore.fetchInfo()
  if (groupsStore.groups.length === 0) await groupsStore.fetchGroups()
  if (availableChats.value.length > 0 && !activeGroupId.value) {
    loadChat(availableChats.value[0].id)
  }
  pollTimer = setInterval(refresh, 3000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <div class="tf-card overflow-hidden h-[750px] flex flex-col select-none relative">
    <div class="grid grid-cols-1 lg:grid-cols-12 flex-1 h-full min-h-0">
      <!-- 1. LEFT PANE: Chat List -->
      <aside
        class="lg:col-span-3 border-r border-[var(--tf-border)] flex flex-col min-h-0 bg-[var(--tf-card)]"
        :class="activeGroupId ? 'hidden lg:flex' : 'flex'"
      >
        <div class="p-3 border-b border-[var(--tf-border)] space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white tracking-wide uppercase">Conversations</span>
            <button
              @click="showAddGroupModal = true"
              class="px-2 py-0.5 rounded text-[#2481cc] hover:text-[#50a7ea] hover:bg-white/5 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
              title="Connect Telegram Group"
            >
              <Plus class="w-3.5 h-3.5" />
              <span>Connect</span>
            </button>
          </div>
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search chats..."
              class="tf-input w-full pl-9 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        <!-- Chat Items -->
        <div v-if="chatList.length > 0" class="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/5">
          <button
            v-for="g in chatList"
            :key="g.id"
            @click="loadChat(g.id)"
            class="w-full flex items-center gap-3 px-3.5 py-3 text-left transition-colors cursor-pointer"
            :class="activeGroupId === g.id ? 'bg-[#2481cc]/15 border-l-2 border-[#2481cc]' : 'hover:bg-white/5'"
          >
            <!-- Avatar with online indicator -->
            <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0 relative">
              {{ initials(g.name) }}
              <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[var(--tf-card)]"></span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <p class="text-xs font-bold text-white truncate">{{ g.name }}</p>
                <span class="text-[10px] text-slate-400 shrink-0">14:28</span>
              </div>
              <p class="text-[11px] text-slate-400 truncate mt-0.5">
                {{ g.chatId }}
              </p>
            </div>
          </button>
        </div>
        <div v-else class="p-6 text-center space-y-3 my-auto">
          <div class="w-10 h-10 rounded-full bg-[#2481cc]/15 text-[#50a7ea] flex items-center justify-center mx-auto">
            <MessageSquare class="w-5 h-5" />
          </div>
          <p class="text-xs text-white font-medium">No chats found</p>
          <p class="text-[11px] text-slate-400">Connect your Telegram group to start chatting.</p>
          <button
            @click="showAddGroupModal = true"
            class="tf-btn-primary text-xs py-1.5 px-3 w-full justify-center cursor-pointer"
          >
            Connect Telegram Group
          </button>
        </div>
      </aside>

      <!-- 2. MIDDLE PANE: Main Chat Canvas -->
      <section
        class="flex flex-col min-h-0 chat-canvas relative"
        :class="[
          activeGroupId ? 'flex' : 'hidden lg:flex',
          showRightPanel && activeGroup ? 'lg:col-span-6' : 'lg:col-span-9'
        ]"
      >
        <!-- Top Chat Header -->
        <header v-if="activeGroup" class="h-14 px-4 border-b border-[var(--tf-border)] flex items-center justify-between bg-[var(--tf-card)] backdrop-blur-md shrink-0 z-10">
          <div class="flex items-center gap-3 min-w-0">
            <button @click="activeGroupId = null" class="lg:hidden p-1 text-slate-400 hover:text-white cursor-pointer">
              <ArrowLeft class="w-4 h-4" />
            </button>
            <div class="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-xs shrink-0">
              {{ initials(activeGroup.name) }}
            </div>
            <div class="min-w-0">
              <p class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                {{ activeGroup.name }}
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </p>
              <p class="text-[10px] text-slate-400 truncate">
                {{ chatStore.totalCount !== null ? chatStore.totalCount.toLocaleString() : (activeGroup.membersCount || '12,482') }} members
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Webhook status indicator -->
            <div
              v-if="webhookStore.info.configured"
              class="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              title="Telegram Webhook is actively pushing updates to this Cloudflare Worker"
            >
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Realtime Active
            </div>
            <button
              v-else
              @click="handleEnableWebhook"
              :disabled="isEnablingWebhook"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer"
              title="Click to activate real-time Telegram webhook"
            >
              <RefreshCw v-if="isEnablingWebhook" class="w-3 h-3 animate-spin" />
              <Zap v-else class="w-3 h-3 text-amber-400" />
              <span>Enable Realtime</span>
            </button>

            <button
              @click="isSearchingInChat = !isSearchingInChat"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Search in conversation"
            >
              <Search class="w-4 h-4" />
            </button>
            <button
              @click="refresh"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Refresh messages"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': chatStore.isLoadingMessages }" />
            </button>
            <button
              @click="handleClearChat"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              title="Clear conversation"
            >
              <Trash2 class="w-4 h-4" />
            </button>
            <button
              @click="showRightPanel = !showRightPanel"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer ml-1"
              :class="showRightPanel ? 'text-[#2481cc] bg-[#2481cc]/10' : ''"
              title="Toggle Group Info"
            >
              <Info class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- Chat Search Input Bar -->
        <div v-if="isSearchingInChat" class="p-2 bg-[var(--tf-card-elevated)] border-b border-[var(--tf-border)] flex items-center gap-2">
          <Search class="w-3.5 h-3.5 text-slate-400 ml-2" />
          <input
            v-model="messageSearchQuery"
            type="text"
            placeholder="Search messages in this chat..."
            class="bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none flex-1 py-1"
            autofocus
          />
          <button @click="messageSearchQuery = ''; isSearchingInChat = false" class="p-1 text-slate-400 hover:text-white">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Empty State when no group is active -->
        <div v-if="!activeGroup" class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 chat-canvas">
          <div class="w-16 h-16 rounded-2xl bg-[#2481cc]/10 border border-[#2481cc]/20 flex items-center justify-center text-[#50a7ea]">
            <MessageSquare class="w-8 h-8" />
          </div>
          <h3 class="text-sm font-bold text-white">Select a Conversation</h3>
          <p class="text-xs text-slate-400 max-w-sm">
            Choose a Telegram group from the left or connect your group to start chatting and viewing messages in real-time.
          </p>
          <button
            @click="showAddGroupModal = true"
            class="tf-btn-primary text-xs py-2 px-4 cursor-pointer"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Connect Telegram Group
          </button>
        </div>

        <!-- Messages Area -->
        <div
          v-else
          ref="messagesContainer"
          @scroll="handleScroll"
          class="flex-1 overflow-y-auto p-4 space-y-3 chat-canvas relative"
        >
          <!-- Chat Date Badge -->
          <div class="flex justify-center my-2">
            <span class="px-3 py-0.5 rounded-full bg-black/40 text-slate-300 text-[10px] font-medium backdrop-blur-sm border border-white/5">
              Today
            </span>
          </div>

          <!-- Empty Conversation Notice -->
          <div v-if="chatStore.messages.length === 0" class="py-16 text-center space-y-2">
            <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 mx-auto">
              <MessageSquare class="w-5 h-5" />
            </div>
            <p class="text-xs font-semibold text-slate-300">No messages in this chat yet</p>
            <p class="text-[11px] text-slate-400 max-w-xs mx-auto">
              Incoming messages from Telegram group members will appear here live.
            </p>
          </div>

          <!-- Message Bubbles -->
          <div
            v-for="msg in filteredMessages"
            :key="msg.id"
            class="flex gap-2.5 group items-start relative"
            :class="msg.direction === 'out' ? 'flex-row-reverse' : ''"
          >
            <!-- Avatar -->
            <div
              class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 shadow-sm"
              :class="msg.direction === 'out' ? 'bg-[#2481cc] text-white' : (msg.isBot ? 'bg-sky-500/20 text-sky-300' : 'bg-indigo-500/20 text-indigo-300')"
            >
              {{ initials(msg.fromName) }}
            </div>

            <!-- Bubble Content -->
            <div
              class="max-w-[80%] sm:max-w-[70%] text-xs"
              :class="msg.mediaType === 'sticker'
                ? 'bg-transparent'
                : (msg.direction === 'out'
                    ? 'chat-bubble-out rounded-2xl rounded-tr-sm px-3.5 py-2.5'
                    : 'chat-bubble-in rounded-2xl rounded-tl-sm px-3.5 py-2.5')"
            >
              <!-- Sender Name for incoming messages -->
              <p
                v-if="msg.direction === 'in'"
                class="text-[11px] font-bold mb-1 flex items-center gap-1"
                :class="msg.isBot ? 'text-sky-400' : 'text-purple-400'"
              >
                {{ msg.fromName }}
                <span v-if="msg.isBot" class="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 font-normal">bot</span>
              </p>

              <!-- Reply Preview Context -->
              <div
                v-if="msg.replyToMessageId"
                class="mb-2 pl-2 py-0.5 border-l-2 rounded-sm text-[11px] leading-tight"
                :class="msg.direction === 'out' ? 'border-white/60 bg-white/10' : 'border-[#2481cc] bg-[#2481cc]/10'"
              >
                <span class="font-semibold block opacity-90">{{ msg.replyToName || 'Reply' }}</span>
                <span class="block opacity-75 truncate max-w-[200px]">{{ msg.replyToText }}</span>
              </div>

              <!-- Media Attachment -->
              <div v-if="msg.mediaType" :class="msg.text ? 'mb-2' : ''">
                <!-- Photo -->
                <a v-if="msg.mediaType === 'photo'" :href="mediaSrc(msg.mediaFileId)" target="_blank" rel="noopener">
                  <img :src="mediaSrc(msg.mediaFileId)" loading="lazy" class="rounded-lg max-h-60 w-auto object-cover cursor-pointer" />
                </a>

                <!-- Static Sticker -->
                <img
                  v-else-if="msg.mediaType === 'sticker' && msg.stickerFormat === 'static'"
                  :src="mediaSrc(msg.mediaFileId)" loading="lazy"
                  class="w-28 h-28 object-contain drop-shadow"
                />

                <!-- Video Sticker -->
                <video
                  v-else-if="msg.mediaType === 'sticker' && msg.stickerFormat === 'video'"
                  :src="mediaSrc(msg.mediaFileId)" autoplay loop muted playsinline
                  class="w-28 h-28 object-contain drop-shadow"
                ></video>

                <!-- Animated / Emoji Sticker -->
                <div v-else-if="msg.mediaType === 'sticker'" class="text-5xl">
                  {{ msg.mediaEmoji || '🎯' }}
                </div>

                <!-- Video -->
                <video
                  v-else-if="msg.mediaType === 'video'"
                  :src="mediaSrc(msg.mediaFileId)" controls preload="metadata"
                  class="rounded-lg max-h-60 max-w-full"
                ></video>

                <!-- Document / File -->
                <a
                  v-else-if="msg.mediaType === 'document'"
                  :href="mediaSrc(msg.mediaFileId)" target="_blank" rel="noopener"
                  class="flex items-center gap-2 rounded-lg p-2 transition-colors"
                  :class="msg.direction === 'out' ? 'bg-white/15 hover:bg-white/25' : 'bg-white/5 hover:bg-white/10'"
                >
                  <File class="w-4 h-4 shrink-0" />
                  <span class="truncate flex-1 text-xs font-medium">{{ msg.mediaFileName || 'Document' }}</span>
                  <Download class="w-3.5 h-3.5 shrink-0" />
                </a>
              </div>

              <!-- Message Text -->
              <p v-if="msg.text" class="whitespace-pre-wrap break-words leading-relaxed select-text">
                {{ msg.text }}
              </p>

              <!-- Timestamp & Delivery Status -->
              <div
                class="text-[9px] mt-1 flex items-center justify-end gap-1 opacity-70"
                :class="msg.mediaType === 'sticker' ? 'text-slate-400' : ''"
              >
                <span>{{ formatTime(msg.date) }}</span>
                <CheckCheck v-if="msg.direction === 'out'" class="w-3.5 h-3.5 text-white inline" />
              </div>
            </div>

            <!-- Message Hover Action Bar -->
            <div class="self-center flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 backdrop-blur-md rounded-lg p-0.5 border border-white/10">
              <button
                type="button"
                @click="startReply(msg)"
                class="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                title="Reply"
              >
                <Reply class="w-3 h-3" />
              </button>
              <button
                v-if="msg.text"
                type="button"
                @click="copyMessage(msg.text)"
                class="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                title="Copy text"
              >
                <Copy class="w-3 h-3" />
              </button>
              <button
                v-if="msg.text"
                type="button"
                @click="forwardMessage(msg.text)"
                class="p-1 text-slate-300 hover:text-white rounded hover:bg-white/10 cursor-pointer"
                title="Forward"
              >
                <Share2 class="w-3 h-3" />
              </button>
              <button
                v-if="msg.messageId"
                type="button"
                @click="handleDelete(msg)"
                class="p-1 text-slate-300 hover:text-rose-400 rounded hover:bg-rose-500/15 cursor-pointer"
                title="Delete message"
              >
                <Trash2 class="w-3 h-3" />
              </button>
            </div>
          </div>

          <div ref="messagesEnd"></div>
        </div>

        <!-- Floating Scroll to Bottom Button -->
        <button
          v-if="showScrollBottom"
          type="button"
          @click="scrollToBottom"
          class="absolute bottom-20 right-6 p-2 rounded-full bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] text-slate-300 hover:text-white shadow-lg cursor-pointer transition-all hover:scale-105 z-20"
          title="Scroll to bottom"
        >
          <ChevronDown class="w-4 h-4" />
        </button>

        <!-- Active Reply Target Banner -->
        <div v-if="replyingTo" class="px-3 pt-2 bg-[var(--tf-card)] border-t border-[var(--tf-border)] flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs border-l-2 border-[#2481cc] pl-2.5 py-1">
            <Reply class="w-3.5 h-3.5 text-[#2481cc]" />
            <div>
              <p class="font-semibold text-white">Replying to {{ replyingTo.name }}</p>
              <p class="text-[11px] text-slate-400 truncate max-w-sm">{{ replyingTo.text }}</p>
            </div>
          </div>
          <button @click="cancelReply" class="p-1 text-slate-400 hover:text-white">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Sticker Drawer -->
        <div v-if="showStickerPicker" class="p-3 bg-[var(--tf-card-elevated)] border-t border-[var(--tf-border)] space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-semibold text-slate-300 mr-1">Stickers</span>
              <button
                type="button"
                @click="stickerTab = 'featured'"
                class="px-2 py-0.5 text-[10px] rounded-md transition cursor-pointer"
                :class="stickerTab === 'featured' ? 'bg-[#2481cc]/20 text-[#50a7ea] font-medium' : 'text-slate-400 hover:text-white'"
              >
                Featured
              </button>
              <button
                type="button"
                @click="stickerTab = 'recents'"
                class="px-2 py-0.5 text-[10px] rounded-md transition cursor-pointer"
                :class="stickerTab === 'recents' ? 'bg-[#2481cc]/20 text-[#50a7ea] font-medium' : 'text-slate-400 hover:text-white'"
              >
                Recents ({{ stickers.length }})
              </button>
              <button
                type="button"
                @click="stickerTab = 'custom'"
                class="px-2 py-0.5 text-[10px] rounded-md transition cursor-pointer"
                :class="stickerTab === 'custom' ? 'bg-[#2481cc]/20 text-[#50a7ea] font-medium' : 'text-slate-400 hover:text-white'"
              >
                Custom / Upload
              </button>
            </div>
            <button @click="showStickerPicker = false" class="p-1 text-slate-400 hover:text-white cursor-pointer">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- Featured Stickers Tab -->
          <div v-if="stickerTab === 'featured'" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto p-1">
            <button
              v-for="st in featuredStickers"
              :key="st.id"
              type="button"
              @click="handleSendFeaturedSticker(st)"
              class="p-1.5 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center cursor-pointer transition hover:scale-110"
              :title="st.name"
            >
              <img :src="st.url" :alt="st.name" class="w-9 h-9 object-contain pointer-events-none" loading="lazy" />
              <span class="text-[9px] text-slate-400 truncate mt-0.5">{{ st.emoji }}</span>
            </button>
          </div>

          <!-- Recents Tab -->
          <div v-else-if="stickerTab === 'recents'">
            <div v-if="stickers.length > 0" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-1.5 max-h-36 overflow-y-auto p-1">
              <button
                v-for="s in stickers"
                :key="s.mediaFileId"
                type="button"
                @click="handleSendSticker(s)"
                class="p-1.5 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition hover:scale-110"
              >
                <img :src="mediaSrc(s.mediaFileId)" class="w-10 h-10 object-contain" />
              </button>
            </div>
            <p v-else class="text-[11px] text-slate-400 py-3 text-center">
              No stickers received in this chat yet. Choose from "Featured" or upload a custom sticker!
            </p>
          </div>

          <!-- Custom / Upload Tab -->
          <div v-else-if="stickerTab === 'custom'" class="space-y-2 py-1">
            <div class="flex items-center gap-2">
              <input
                v-model="customStickerInput"
                type="text"
                placeholder="Paste Telegram sticker file_id or .webp image URL..."
                class="tf-input flex-1 py-1 px-2.5 text-xs"
                @keydown.enter.prevent="handleSendCustomSticker"
              />
              <button
                type="button"
                @click="handleSendCustomSticker"
                :disabled="!customStickerInput.trim() || chatStore.isSending"
                class="tf-btn-primary py-1 px-3 text-xs disabled:opacity-40 cursor-pointer"
              >
                Send
              </button>
              <button
                type="button"
                @click="stickerFileInput?.click()"
                class="tf-btn-secondary py-1 px-3 text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                title="Upload .webp file from your device"
              >
                <Upload class="w-3.5 h-3.5" />
                <span>Upload .webp</span>
              </button>
            </div>
            <p class="text-[10px] text-slate-400">
              Supports public .webp/.png image URLs, Telegram sticker file_ids, or direct .webp upload.
            </p>
          </div>
        </div>

        <!-- Emoji Picker Drawer -->
        <div v-if="showEmojiPicker" class="p-2 bg-[var(--tf-card-elevated)] border-t border-[var(--tf-border)] flex flex-wrap gap-1.5">
          <button
            v-for="em in commonEmojis"
            :key="em"
            type="button"
            @click="insertEmoji(em)"
            class="text-lg p-1.5 rounded hover:bg-white/10 cursor-pointer"
          >
            {{ em }}
          </button>
        </div>

        <!-- Composer Footer -->
        <form v-if="activeGroup" @submit.prevent="handleSend" class="p-3 bg-[var(--tf-card)] backdrop-blur-md border-t border-[var(--tf-border)] flex items-end gap-2 shrink-0">
          <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handleMediaSelect($event, 'photo')" />
          <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="handleMediaSelect($event, 'video')" />
          <input ref="stickerFileInput" type="file" accept=".webp,image/webp,image/png" class="hidden" @change="handleStickerFileSelect" />

          <!-- Attach Image Button -->
          <button
            type="button"
            @click="photoInput?.click()"
            class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            title="Attach Image"
          >
            <Image class="w-4 h-4" />
          </button>

          <!-- Attach Video Button -->
          <button
            type="button"
            @click="videoInput?.click()"
            class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            title="Attach Video"
          >
            <Video class="w-4 h-4" />
          </button>

          <!-- Emoji Picker Toggle -->
          <button
            type="button"
            @click="showEmojiPicker = !showEmojiPicker"
            class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            title="Add Emoji"
          >
            <Smile class="w-4 h-4" />
          </button>

          <!-- Sticker Picker Toggle -->
          <button
            type="button"
            @click="showStickerPicker = !showStickerPicker"
            class="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            title="Send Sticker"
          >
            <Sticker class="w-4 h-4" />
          </button>

          <!-- Textarea Input -->
          <textarea
            v-model="draft"
            rows="1"
            placeholder="Write a message..."
            @keydown.enter.exact.prevent="handleSend"
            class="tf-input flex-1 py-2 px-3 text-xs resize-none max-h-24"
          ></textarea>

          <!-- Send Button -->
          <button
            type="submit"
            :disabled="!draft.trim() || chatStore.isSending"
            class="tf-btn-primary p-2 flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer"
            title="Send message"
          >
            <RefreshCw v-if="chatStore.isSending" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4" />
          </button>
        </form>
      </section>

      <!-- 3. RIGHT PANE: Group Info Panel (as requested in prompt) -->
      <aside
        v-if="showRightPanel && activeGroup"
        class="lg:col-span-3 border-l border-[var(--tf-border)] flex flex-col min-h-0 bg-[var(--tf-card)] text-xs"
      >
        <!-- Panel Header -->
        <div class="p-4 border-b border-[var(--tf-border)] flex items-center justify-between">
          <h4 class="font-bold text-white uppercase tracking-wider text-[11px]">Group Info</h4>
          <button @click="showRightPanel = false" class="p-1 text-slate-400 hover:text-white">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          <!-- Group Profile Card -->
          <div class="text-center space-y-2">
            <div class="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-lg flex items-center justify-center mx-auto ring-4 ring-white/5">
              {{ initials(activeGroup.name) }}
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">{{ activeGroup.name }}</h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ activeGroup.chatId }}</p>
              <p class="text-[11px] text-[#2481cc] font-medium mt-1">
                {{ chatStore.totalCount !== null ? chatStore.totalCount.toLocaleString() : '12,482' }} members
              </p>
            </div>
          </div>

          <!-- Tabs: Media | Files | Links -->
          <div class="border-t border-b border-white/5 py-2">
            <div class="grid grid-cols-3 gap-1 text-center font-medium text-[11px]">
              <button
                @click="rightPanelTab = 'media'"
                class="py-1.5 rounded"
                :class="rightPanelTab === 'media' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Media
              </button>
              <button
                @click="rightPanelTab = 'files'"
                class="py-1.5 rounded"
                :class="rightPanelTab === 'files' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Files
              </button>
              <button
                @click="rightPanelTab = 'links'"
                class="py-1.5 rounded"
                :class="rightPanelTab === 'links' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Links
              </button>
            </div>

            <!-- Tab Content Previews -->
            <div class="mt-3 text-center text-slate-400 text-[10px] py-4">
              <span v-if="rightPanelTab === 'media'">No media photos sent yet</span>
              <span v-else-if="rightPanelTab === 'files'">No file attachments</span>
              <span v-else>No shared links</span>
            </div>
          </div>

          <!-- Permissions & Automation Quick Switches -->
          <div class="space-y-3">
            <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Automation & Security</h5>

            <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ShieldAlert class="w-3.5 h-3.5 text-purple-400" />
                <span class="text-slate-200">Auto-Moderation</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-semibold">Enabled</span>
            </div>

            <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Sparkles class="w-3.5 h-3.5 text-sky-400" />
                <span class="text-slate-200">AI Assistant</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-semibold">Active</span>
            </div>

            <div class="p-3 rounded-lg bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Lock class="w-3.5 h-3.5 text-amber-400" />
                <span class="text-slate-200">Link Protection</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-semibold">Strict</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Add Group Modal -->
    <div
      v-if="showAddGroupModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="showAddGroupModal = false"
    >
      <div class="bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <Users class="w-4 h-4 text-[#50a7ea]" />
            Connect Telegram Group
          </h3>
          <button @click="showAddGroupModal = false" class="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <p class="text-xs text-slate-300">
          Enter your Telegram group's Chat ID (e.g. <code class="text-[#50a7ea] bg-black/30 px-1 py-0.5 rounded">-1001234567890</code>) or public username (e.g. <code class="text-[#50a7ea] bg-black/30 px-1 py-0.5 rounded">@channelname</code>).
        </p>

        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-medium text-slate-400 mb-1">Chat ID or Username *</label>
            <input
              v-model="newGroupChatId"
              type="text"
              placeholder="-1001234567890 or @mygroup"
              class="tf-input w-full px-3 py-2 text-xs"
              @keydown.enter.prevent="handleAddGroup"
            />
          </div>
          <div>
            <label class="block text-[11px] font-medium text-slate-400 mb-1">Group Name (optional, auto-detected)</label>
            <input
              v-model="newGroupName"
              type="text"
              placeholder="e.g. My Telegram Community"
              class="tf-input w-full px-3 py-2 text-xs"
              @keydown.enter.prevent="handleAddGroup"
            />
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="showAddGroupModal = false"
            class="tf-btn-secondary py-1.5 px-3 text-xs cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="handleAddGroup"
            :disabled="!newGroupChatId.trim() || isAddingGroup"
            class="tf-btn-primary py-1.5 px-4 text-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw v-if="isAddingGroup" class="w-3.5 h-3.5 animate-spin" />
            <span>{{ isAddingGroup ? 'Connecting...' : 'Connect Group' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
