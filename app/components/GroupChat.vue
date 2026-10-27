<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useGroupsStore } from '../stores/groups'
import { useChatStore, type ReplyTarget, type ChatMessage } from '../stores/chat'
import { useWebhookStore } from '../stores/webhook'
import { useToast } from '../composables/useToast'
import { useRealtimeChat } from '../composables/useRealtimeChat'
import {
  getTelegramSenderColorIndex,
  formatTelegramMessageTime,
  formatTelegramChatListTime,
  isClusterBoundary
} from '../utils/telegram-ui'
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
  Plus,
  ExternalLink,
  MousePointerClick,
  Play,
  Pause,
  Maximize2
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
const showAttachMenu = ref(false)
const showStickerPicker = ref(false)
const showEmojiPicker = ref(false)
const showButtonAttachment = ref(false)
const attachedButtonText = ref('')
const attachedButtonUrl = ref('')
const stickerTab = ref<'featured' | 'recents' | 'custom'>('featured')
const customStickerInput = ref('')
const isEnablingWebhook = ref(false)

// Lightbox modal for media
const selectedMedia = ref<{ url: string; type: 'photo' | 'video'; name?: string } | null>(null)

// Audio playing simulation
const playingAudioId = ref<string | null>(null)

// Interactive message reactions map: messageId -> Array<{ emoji: string, count: number, reacted: boolean }>
const messageReactions = ref<Record<string, Array<{ emoji: string; count: number; reacted: boolean }>>>({})

// Quick reactions bar
const quickReactions = ['👍', '❤️', '🔥', '😂', '👏', '🎉']

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
const newMessageCount = ref(0)
const highlightedMessageId = ref<number | null>(null)

// Real-time SSE Chat Engine
const realtime = useRealtimeChat(activeGroupId)

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

// Common emojis for quick drawer
const commonEmojis = ['👍', '❤️', '🔥', '👏', '🎉', '🚀', '😂', '🙏', '💯', '✨', '⚡', '🤖', '👀', '💡', '✅', '⚠️', '😍', '🙌', '💪', '🤝', '🥳', '🤩', '🎯', '🌟']

// Fallback dummy groups if empty
const defaultGroups = [
  { id: 'g1', chatId: '-100148291024', name: 'Developers Community', type: 'supergroup', membersCount: 12482 },
  { id: 'g2', chatId: '-100189201948', name: 'Tech Announcements', type: 'channel', membersCount: 24820 },
  { id: 'g3', chatId: '-100199482911', name: 'Product Growth', type: 'group', membersCount: 8291 }
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

const scrollToBottom = async (smooth = true) => {
  await nextTick()
  if (messagesEnd.value) {
    messagesEnd.value.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
  }
}

const handleScroll = () => {
  if (!messagesContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value
  showScrollBottom.value = scrollHeight - scrollTop - clientHeight > 180
  if (!showScrollBottom.value) newMessageCount.value = 0
}

const loadChat = async (id: string) => {
  activeGroupId.value = id
  replyingTo.value = null
  showAttachMenu.value = false
  showStickerPicker.value = false
  showEmojiPicker.value = false
  chatStore.reset()
  newMessageCount.value = 0
  
  // Connect Real-time SSE
  realtime.connect()

  await Promise.all([chatStore.fetchMessages(id), chatStore.fetchMembers(id)])
  await scrollToBottom(false)
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

const scrollToOriginalMessage = (replyMessageId?: number | null) => {
  if (!replyMessageId) return
  const el = document.getElementById(`msg-${replyMessageId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    highlightedMessageId.value = replyMessageId
    setTimeout(() => {
      highlightedMessageId.value = null
    }, 2000)
  }
}

const copyMessage = (text: string) => {
  if (!text) return
  navigator.clipboard.writeText(text)
  toast.success('Message copied to clipboard')
}

const forwardMessage = (text: string) => {
  draft.value = text
  toast.success('Message loaded into composer')
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

const toggleReaction = (msgId: string, emoji: string) => {
  if (!messageReactions.value[msgId]) {
    messageReactions.value[msgId] = []
  }
  const reactions = messageReactions.value[msgId]
  const existing = reactions.find(r => r.emoji === emoji)
  if (existing) {
    if (existing.reacted) {
      existing.count--
      existing.reacted = false
      if (existing.count <= 0) {
        messageReactions.value[msgId] = reactions.filter(r => r.emoji !== emoji)
      }
    } else {
      existing.count++
      existing.reacted = true
    }
  } else {
    reactions.push({ emoji, count: 1, reacted: true })
  }
}

const refresh = async () => {
  if (!activeGroupId.value) return
  await Promise.all([
    chatStore.fetchMessages(activeGroupId.value),
    chatStore.fetchMembers(activeGroupId.value)
  ])
}

const jumpToLatest = async () => {
  newMessageCount.value = 0
  await scrollToBottom()
}

const handleSend = async () => {
  const text = draft.value.trim()
  if (!text || !activeGroupId.value) return
  const groupId = activeGroupId.value
  const replyTo = replyingTo.value
  const btnText = attachedButtonText.value.trim()
  const btnUrl = attachedButtonUrl.value.trim()
  const buttons = (btnText && btnUrl) ? [{ text: btnText, url: btnUrl }] : undefined

  draft.value = ''
  replyingTo.value = null
  showEmojiPicker.value = false
  showAttachMenu.value = false
  attachedButtonText.value = ''
  attachedButtonUrl.value = ''
  showButtonAttachment.value = false

  try {
    await chatStore.sendMessage(groupId, text, replyTo, 'HTML', buttons)
    await scrollToBottom()
  } catch (error: any) {
    draft.value = text
    replyingTo.value = replyTo
    if (btnText && btnUrl) {
      attachedButtonText.value = btnText
      attachedButtonUrl.value = btnUrl
      showButtonAttachment.value = true
    }
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
    toast.success('Sticker sent')
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to send sticker')
  }
}

const handleMediaSelect = async (event: Event, mediaType: 'photo' | 'video') => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !activeGroupId.value) return

  const groupId = activeGroupId.value
  const caption = draft.value.trim()
  const replyTo = replyingTo.value
  showAttachMenu.value = false
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

const initials = (name: string) =>
  name.replace(/^@/, '').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?'

const mediaSrc = (fileId?: string) => (fileId ? `/api/media/${fileId}` : '')

const isSyncingTelegram = ref(false)
const handleSyncTelegram = async () => {
  isSyncingTelegram.value = true
  try {
    const res = await groupsStore.syncWithTelegram()
    toast.success(`✨ Synced live from Telegram! Found ${res.totalGroups} groups and ${res.totalMessages} messages.`)
    if (availableChats.value.length > 0 && !activeGroupId.value) {
      loadChat(availableChats.value[0].id)
    }
  } catch (err: any) {
    toast.error(err.data?.statusMessage || err.message || 'Failed to sync with Telegram')
  } finally {
    isSyncingTelegram.value = false
  }
}

// Watch messages length to auto-scroll if already at bottom
watch(
  () => chatStore.messages.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      const el = messagesContainer.value
      if (!el || el.scrollHeight - el.scrollTop - el.clientHeight < 220) {
        scrollToBottom()
      } else {
        newMessageCount.value += newLen - oldLen
      }
    }
  }
)

onMounted(async () => {
  webhookStore.fetchInfo()
  if (groupsStore.groups.length === 0) await groupsStore.fetchGroups()
  if (availableChats.value.length > 0 && !activeGroupId.value) {
    loadChat(availableChats.value[0].id)
  }
})

onBeforeUnmount(() => {
  realtime.disconnect()
})
</script>

<template>
  <div class="tf-card overflow-hidden h-[760px] flex flex-col select-none relative shadow-sm border border-[var(--tf-border)]">
    <div class="grid grid-cols-1 lg:grid-cols-12 flex-1 h-full min-h-0">
      
      <!-- 1. LEFT PANE: Native Telegram Chat List -->
      <aside
        class="lg:col-span-4 xl:col-span-3 border-r border-[var(--tf-border)] flex flex-col min-h-0 bg-[var(--tf-card)]"
        :class="activeGroupId ? 'hidden lg:flex' : 'flex'"
      >
        <!-- Header & Search -->
        <div class="p-3 border-b border-[var(--tf-border)] space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-xs font-bold text-white tracking-tight">Chats</span>
              <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#2481cc]/20 text-[#50a7ea]">
                {{ chatList.length }}
              </span>
            </div>
            
            <div class="flex items-center gap-1">
              <button
                type="button"
                @click="handleSyncTelegram"
                :disabled="isSyncingTelegram"
                class="p-1.5 rounded-lg text-slate-400 hover:text-[#50a7ea] hover:bg-white/5 transition flex items-center cursor-pointer disabled:opacity-50"
                title="Sync Live Groups from Telegram"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="{ 'animate-spin': isSyncingTelegram }" />
              </button>
              <button
                type="button"
                @click="showAddGroupModal = true"
                class="p-1.5 rounded-lg text-[#2481cc] hover:text-[#50a7ea] hover:bg-white/5 transition flex items-center cursor-pointer"
                title="Connect Group"
              >
                <Plus class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Telegram Pill Search Input -->
          <div class="relative">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search"
              class="tf-input w-full pl-9 pr-3 py-1.5 text-xs rounded-full bg-[var(--tf-input)] placeholder:text-slate-500"
            />
          </div>
        </div>

        <!-- Chat Items List -->
        <div v-if="chatList.length > 0" class="flex-1 overflow-y-auto no-scrollbar divide-y divide-white/5">
          <button
            v-for="g in chatList"
            :key="g.id"
            @click="loadChat(g.id)"
            class="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors cursor-pointer relative group"
            :class="activeGroupId === g.id ? 'bg-[#2481cc]/20' : 'hover:bg-white/[0.04]'"
          >
            <!-- Authentic Telegram Circular Avatar -->
            <div
              class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-xs shrink-0 relative shadow-sm"
              :class="activeGroupId === g.id ? 'bg-[#2481cc] text-white' : 'bg-gradient-to-tr from-sky-600 to-indigo-500 text-white'"
            >
              {{ initials(g.name) }}
              <span class="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[var(--tf-card)]"></span>
            </div>

            <!-- Chat Info Details -->
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-1">
                <p class="text-xs font-semibold text-white truncate">{{ g.name }}</p>
                <span class="text-[10px] text-slate-400 shrink-0 font-medium">
                  {{ formatTelegramChatListTime(g.lastMessageDate) || '14:28' }}
                </span>
              </div>
              <div class="flex items-center justify-between gap-1 mt-0.5">
                <p class="text-[11px] text-slate-400 truncate max-w-[150px]">
                  {{ g.chatId }}
                </p>
                <span
                  v-if="g.membersCount"
                  class="text-[9px] font-semibold px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300 shrink-0"
                >
                  {{ g.membersCount.toLocaleString() }}
                </span>
              </div>
            </div>
          </button>
        </div>

        <!-- Empty State in Chat List -->
        <div v-else class="p-6 text-center space-y-3 my-auto">
          <div class="w-10 h-10 rounded-full bg-[#2481cc]/15 text-[#50a7ea] flex items-center justify-center mx-auto">
            <MessageSquare class="w-5 h-5" />
          </div>
          <p class="text-xs text-white font-medium">No chats found</p>
          <button
            @click="showAddGroupModal = true"
            class="tf-btn-primary text-xs py-1.5 px-3 w-full justify-center cursor-pointer"
          >
            Connect Telegram Group
          </button>
        </div>
      </aside>

      <!-- 2. MIDDLE PANE: Main Telegram Chat Canvas -->
      <section
        class="flex flex-col min-h-0 relative telegram-wallpaper"
        :class="[
          activeGroupId ? 'flex' : 'hidden lg:flex',
          showRightPanel && activeGroup ? 'lg:col-span-5 xl:col-span-6' : 'lg:col-span-8 xl:col-span-9'
        ]"
      >
        <!-- Top Chat Header -->
        <header v-if="activeGroup" class="h-14 px-4 border-b border-[var(--tf-border)] flex items-center justify-between bg-[var(--tf-card)]/90 backdrop-blur shrink-0 z-20">
          <div class="flex items-center gap-3 min-w-0">
            <button @click="activeGroupId = null" class="lg:hidden p-1 text-slate-400 hover:text-white cursor-pointer">
              <ArrowLeft class="w-4 h-4" />
            </button>
            
            <!-- Avatar -->
            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
              {{ initials(activeGroup.name) }}
            </div>

            <!-- Title & Status Subtitle -->
            <div class="min-w-0 cursor-pointer" @click="showRightPanel = !showRightPanel">
              <p class="text-xs font-bold text-white truncate flex items-center gap-1.5">
                {{ activeGroup.name }}
              </p>
              <p class="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <template v-if="realtime.typingUsers.value.length > 0">
                  <span class="text-[#50a7ea] font-medium flex items-center gap-1">
                    {{ realtime.typingUsers.value.map(u => u.name).join(', ') }} is typing
                    <span class="flex items-center gap-0.5 ml-0.5">
                      <span class="tg-typing-dot"></span>
                      <span class="tg-typing-dot"></span>
                      <span class="tg-typing-dot"></span>
                    </span>
                  </span>
                </template>
                <template v-else-if="chatStore.totalCount !== null">
                  {{ chatStore.totalCount.toLocaleString() }} members
                </template>
                <template v-else>
                  {{ activeGroup.type }}
                </template>
              </p>
            </div>
          </div>

          <!-- Header Actions -->
          <div class="flex items-center gap-1 sm:gap-2">
            <!-- SSE Status Badge -->
            <div
              class="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border"
              :class="realtime.status.value === 'connected'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'"
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="realtime.status.value === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'"
              ></span>
              <span>{{ realtime.status.value === 'connected' ? 'Live' : 'Connecting' }}</span>
            </div>

            <!-- In-Chat Search Toggle -->
            <button
              @click="isSearchingInChat = !isSearchingInChat"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Search messages"
            >
              <Search class="w-4 h-4" />
            </button>

            <!-- Refresh Messages -->
            <button
              @click="refresh"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              title="Refresh"
            >
              <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': chatStore.isLoadingMessages }" />
            </button>

            <!-- Clear Conversation -->
            <button
              @click="handleClearChat"
              class="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              title="Clear chat"
            >
              <Trash2 class="w-4 h-4" />
            </button>

            <!-- Group Info Drawer Toggle -->
            <button
              @click="showRightPanel = !showRightPanel"
              class="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer"
              :class="showRightPanel ? 'text-[#2481cc] bg-[#2481cc]/10' : ''"
              title="Info"
            >
              <Info class="w-4 h-4" />
            </button>
          </div>
        </header>

        <!-- In-Chat Search Bar -->
        <div v-if="isSearchingInChat" class="p-2 bg-[var(--tf-card-elevated)] border-b border-[var(--tf-border)] flex items-center gap-2 z-10">
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
        <div v-if="!activeGroup" class="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
          <div class="w-16 h-16 rounded-full bg-[#2481cc]/10 border border-[#2481cc]/20 flex items-center justify-center text-[#50a7ea]">
            <MessageSquare class="w-8 h-8" />
          </div>
          <h3 class="text-sm font-bold text-white">Select a Chat to Start</h3>
          <p class="text-xs text-slate-400 max-w-sm">
            Choose a Telegram group from the list to view incoming messages in real-time.
          </p>
          <button
            @click="showAddGroupModal = true"
            class="tf-btn-primary text-xs py-2 px-4 cursor-pointer"
          >
            <Plus class="w-4 h-4 mr-1.5" />
            Connect Telegram Group
          </button>
        </div>

        <!-- Messages Area (Telegram Native Layout) -->
        <div
          v-else
          ref="messagesContainer"
          @scroll="handleScroll"
          class="flex-1 overflow-y-auto px-4 py-3 space-y-1 relative"
        >
          <!-- Chat Date Badge (Telegram Translucent Pill) -->
          <div class="flex justify-center my-3 sticky top-2 z-10">
            <span class="px-3 py-0.5 rounded-full bg-black/50 text-slate-200 text-[11px] font-medium backdrop-blur shadow-sm">
              Today
            </span>
          </div>

          <!-- Empty Notice -->
          <div v-if="chatStore.messages.length === 0" class="py-20 text-center space-y-2">
            <div class="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-slate-400 mx-auto">
              <MessageSquare class="w-6 h-6" />
            </div>
            <p class="text-xs font-semibold text-slate-200">No messages in this chat yet</p>
            <p class="text-[11px] text-slate-400 max-w-xs mx-auto">
              Send a message or wait for incoming activity from Telegram members.
            </p>
          </div>

          <!-- Telegram Message Bubble Group -->
          <div
            v-for="(msg, idx) in filteredMessages"
            :key="msg.id || idx"
            :id="msg.messageId ? `msg-${msg.messageId}` : undefined"
            class="flex items-end gap-2 group relative transition-all duration-300"
            :class="[
              msg.direction === 'out' ? 'flex-row-reverse' : 'flex-row',
              isClusterBoundary(filteredMessages, idx).isLast ? 'mb-2.5' : 'mb-0.5',
              highlightedMessageId === msg.messageId ? 'scale-[1.02] bg-[#2481cc]/20 p-1 rounded-xl' : ''
            ]"
          >
            <!-- 1. Avatar (Displayed only on the last message in a cluster for incoming) -->
            <div
              v-if="msg.direction === 'in'"
              class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-0.5 shadow-sm"
              :class="[
                isClusterBoundary(filteredMessages, idx).isLast ? 'opacity-100' : 'opacity-0 pointer-events-none',
                msg.isBot ? 'bg-sky-500/20 text-sky-300' : 'bg-indigo-500/20 text-indigo-300'
              ]"
            >
              {{ initials(msg.fromName) }}
            </div>

            <!-- 2. Authentic Telegram Bubble -->
            <div
              class="relative max-w-[82%] sm:max-w-[72%] text-xs"
              :class="[
                msg.mediaType === 'sticker'
                  ? 'bg-transparent p-0'
                  : (msg.direction === 'out'
                      ? 'chat-bubble-out px-3.5 py-2'
                      : 'chat-bubble-in px-3.5 py-2'),
                msg.mediaType !== 'sticker' ? [
                  'rounded-2xl',
                  msg.direction === 'out' && !isClusterBoundary(filteredMessages, idx).isLast ? 'rounded-br-md' : '',
                  msg.direction === 'in' && !isClusterBoundary(filteredMessages, idx).isLast ? 'rounded-bl-md' : ''
                ] : ''
              ]"
            >
              <!-- Authentic Corner Tail SVG on last message of cluster -->
              <template v-if="msg.mediaType !== 'sticker' && isClusterBoundary(filteredMessages, idx).isLast">
                <!-- Outgoing Tail (Bottom Right) -->
                <svg
                  v-if="msg.direction === 'out'"
                  class="bubble-tail-out"
                  viewBox="0 0 11 20"
                >
                  <path d="M0,0 C3,0 11,8 11,20 C11,11 6,3 0,0" />
                </svg>

                <!-- Incoming Tail (Bottom Left) -->
                <svg
                  v-else
                  class="bubble-tail-in"
                  viewBox="0 0 11 20"
                >
                  <path d="M11,0 C8,0 0,8 0,20 C0,11 5,3 11,0" />
                </svg>
              </template>

              <!-- Sender Name (shown on first message in incoming cluster) -->
              <p
                v-if="msg.direction === 'in' && isClusterBoundary(filteredMessages, idx).isFirst"
                class="text-[11px] font-bold mb-1 flex items-center gap-1 select-none"
                :class="'tg-color-' + getTelegramSenderColorIndex(msg.fromName, msg.fromId)"
              >
                <span>{{ msg.fromName }}</span>
                <span v-if="msg.isBot" class="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 font-normal">bot</span>
              </p>

              <!-- Telegram Reply Quote Banner -->
              <div
                v-if="msg.replyToMessageId"
                @click="scrollToOriginalMessage(msg.replyToMessageId)"
                class="mb-2 pl-2.5 py-1 border-l-2 rounded-r-md text-[11px] leading-tight cursor-pointer select-none transition-colors"
                :class="msg.direction === 'out'
                  ? 'border-white/70 bg-white/10 hover:bg-white/20'
                  : 'bg-black/20 hover:bg-black/30 ' + ('tg-border-' + getTelegramSenderColorIndex(msg.replyToName))"
              >
                <span
                  class="font-bold block truncate"
                  :class="msg.direction === 'out' ? 'text-white' : ('tg-color-' + getTelegramSenderColorIndex(msg.replyToName))"
                >
                  {{ msg.replyToName || 'Reply' }}
                </span>
                <span class="block opacity-80 truncate max-w-[240px] text-[10px]">
                  {{ msg.replyToText }}
                </span>
              </div>

              <!-- Media Attachments -->
              <div v-if="msg.mediaType" :class="msg.text ? 'mb-2' : ''">
                <!-- 1. Photo -->
                <div
                  v-if="msg.mediaType === 'photo'"
                  class="relative group/media cursor-pointer rounded-xl overflow-hidden"
                  @click="selectedMedia = { url: mediaSrc(msg.mediaFileId), type: 'photo', name: msg.fromName }"
                >
                  <img
                    :src="mediaSrc(msg.mediaFileId)"
                    loading="lazy"
                    class="rounded-xl max-h-72 w-auto object-cover hover:opacity-95 transition"
                  />
                  <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/media:opacity-100 transition flex items-center justify-center text-white">
                    <Maximize2 class="w-6 h-6 drop-shadow" />
                  </div>
                </div>

                <!-- 2. Transparent Floating Sticker -->
                <div v-else-if="msg.mediaType === 'sticker'" class="relative inline-block">
                  <!-- Static Sticker -->
                  <img
                    v-if="msg.stickerFormat === 'static' || !msg.stickerFormat"
                    :src="mediaSrc(msg.mediaFileId)"
                    loading="lazy"
                    class="w-32 h-32 object-contain drop-shadow-md select-none pointer-events-none"
                  />
                  <!-- Video Sticker -->
                  <video
                    v-else-if="msg.stickerFormat === 'video'"
                    :src="mediaSrc(msg.mediaFileId)"
                    autoplay loop muted playsinline
                    class="w-32 h-32 object-contain drop-shadow-md pointer-events-none"
                  ></video>
                  <!-- Emoji Sticker -->
                  <div v-else class="text-6xl drop-shadow select-none">
                    {{ msg.mediaEmoji || '🎯' }}
                  </div>

                  <!-- Floating Oval Timestamp Badge on Sticker -->
                  <span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 text-white text-[9px] font-medium backdrop-blur">
                    {{ formatTelegramMessageTime(msg.date) }}
                  </span>
                </div>

                <!-- 3. Video -->
                <div
                  v-else-if="msg.mediaType === 'video'"
                  class="rounded-xl overflow-hidden max-h-72 max-w-full"
                >
                  <video
                    :src="mediaSrc(msg.mediaFileId)"
                    controls
                    preload="metadata"
                    class="rounded-xl max-h-72 max-w-full"
                  ></video>
                </div>

                <!-- 4. Audio / Voice Message Waveform Player -->
                <div
                  v-else-if="msg.mediaType === 'audio' || msg.mediaType === 'voice'"
                  class="flex items-center gap-3 p-2 rounded-xl bg-black/15 select-none min-w-[200px]"
                >
                  <button
                    type="button"
                    @click="playingAudioId = playingAudioId === msg.id ? null : msg.id"
                    class="w-9 h-9 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0 cursor-pointer shadow-sm hover:scale-105 transition"
                  >
                    <Pause v-if="playingAudioId === msg.id" class="w-4 h-4 fill-white" />
                    <Play v-else class="w-4 h-4 fill-white ml-0.5" />
                  </button>
                  <div class="flex-1">
                    <!-- Fake Audio Waveform bars -->
                    <div class="flex items-center gap-0.5 h-6">
                      <span
                        v-for="bar in [4, 8, 14, 20, 10, 6, 16, 22, 12, 18, 8, 14, 6, 10, 16, 12, 8, 4]"
                        :key="bar"
                        class="w-1 rounded-full transition-all"
                        :style="{ height: `${bar}px` }"
                        :class="playingAudioId === msg.id ? 'bg-[#50a7ea]' : 'bg-slate-400/50'"
                      ></span>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>{{ playingAudioId === msg.id ? 'Playing...' : (msg.mediaType === 'voice' ? 'Voice Message' : 'Audio') }}</span>
                      <span>0:24</span>
                    </div>
                  </div>
                </div>

                <!-- 5. Document / File Attachment -->
                <a
                  v-else-if="msg.mediaType === 'document'"
                  :href="mediaSrc(msg.mediaFileId)"
                  target="_blank"
                  rel="noopener"
                  class="flex items-center gap-3 rounded-xl p-2.5 transition-colors select-none"
                  :class="msg.direction === 'out' ? 'bg-white/15 hover:bg-white/25' : 'bg-black/15 hover:bg-black/25'"
                >
                  <div class="w-9 h-9 rounded-full bg-[#2481cc] text-white flex items-center justify-center shrink-0">
                    <File class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-semibold leading-tight">{{ msg.mediaFileName || 'Document' }}</p>
                    <span class="text-[10px] opacity-70">2.4 MB</span>
                  </div>
                  <Download class="w-4 h-4 shrink-0 opacity-80" />
                </a>
              </div>

              <!-- Message Text -->
              <p
                v-if="msg.text"
                class="whitespace-pre-wrap break-words leading-relaxed select-text font-normal inline"
              >
                {{ msg.text }}
              </p>

              <!-- Telegram Embedded Timestamp & Read Status -->
              <span
                v-if="msg.mediaType !== 'sticker'"
                class="inline-flex items-center gap-1 float-right text-[10px] select-none ml-2.5 mt-1 font-medium leading-none align-bottom"
                :class="msg.direction === 'out' ? 'text-sky-200' : 'text-slate-400'"
              >
                <span>{{ formatTelegramMessageTime(msg.date) }}</span>
                <template v-if="msg.direction === 'out'">
                  <CheckCheck class="w-3.5 h-3.5 inline text-[#50a7ea]" />
                </template>
              </span>

              <!-- Attached Clickable Inline Buttons Grid -->
              <div v-if="msg.buttons && msg.buttons.length > 0" class="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1.5 select-none">
                <template v-for="(btn, bIdx) in msg.buttons" :key="bIdx">
                  <a
                    v-if="btn.url"
                    :href="btn.url"
                    target="_blank"
                    rel="noopener"
                    class="w-full text-center py-1.5 px-3 rounded-lg text-[11px] font-semibold bg-black/20 hover:bg-black/35 text-white transition flex items-center justify-center gap-1.5 border border-white/10 shadow-sm"
                  >
                    <span>{{ btn.text }}</span>
                    <ExternalLink class="w-3 h-3 opacity-70" />
                  </a>
                  <div
                    v-else
                    class="w-full text-center py-1.5 px-3 rounded-lg text-[11px] font-semibold bg-black/20 text-white border border-white/10 flex items-center justify-center gap-1 shadow-sm"
                  >
                    <span>{{ btn.text }}</span>
                  </div>
                </template>
              </div>

              <!-- Telegram Reaction Pills under bubble -->
              <div
                v-if="(messageReactions[msg.id]?.length ?? 0) > 0"
                class="flex flex-wrap gap-1 mt-1.5 select-none"
              >
                <button
                  v-for="react in (messageReactions[msg.id] || [])"
                  :key="react.emoji"
                  type="button"
                  @click="toggleReaction(msg.id, react.emoji)"
                  class="tg-reaction-pill"
                  :class="react.reacted ? 'bg-[#2481cc] text-white' : 'bg-black/30 text-slate-200 hover:bg-black/50'"
                >
                  <span>{{ react.emoji }}</span>
                  <span class="text-[10px]">{{ react.count }}</span>
                </button>
              </div>
            </div>

            <!-- Message Hover Quick Reactions & Action Bar (Telegram Desktop Style) -->
            <div
              class="self-center flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur rounded-full px-1.5 py-0.5 border border-white/10 shadow-md select-none"
              :class="msg.direction === 'out' ? 'flex-row-reverse' : 'flex-row'"
            >
              <!-- Quick Emoji React -->
              <button
                v-for="em in quickReactions.slice(0, 3)"
                :key="em"
                type="button"
                @click="toggleReaction(msg.id, em)"
                class="p-1 hover:scale-125 transition text-xs cursor-pointer"
                :title="`React ${em}`"
              >
                {{ em }}
              </button>

              <div class="w-px h-3 bg-white/20 mx-0.5"></div>

              <!-- Reply -->
              <button
                type="button"
                @click="startReply(msg)"
                class="p-1 text-slate-300 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
                title="Reply"
              >
                <Reply class="w-3 h-3" />
              </button>

              <!-- Copy Text -->
              <button
                v-if="msg.text"
                type="button"
                @click="copyMessage(msg.text)"
                class="p-1 text-slate-300 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
                title="Copy"
              >
                <Copy class="w-3 h-3" />
              </button>

              <!-- Forward -->
              <button
                v-if="msg.text"
                type="button"
                @click="forwardMessage(msg.text)"
                class="p-1 text-slate-300 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
                title="Forward"
              >
                <Share2 class="w-3 h-3" />
              </button>

              <!-- Delete -->
              <button
                v-if="msg.messageId"
                type="button"
                @click="handleDelete(msg)"
                class="p-1 text-slate-300 hover:text-rose-400 rounded-full hover:bg-rose-500/20 cursor-pointer"
                title="Delete"
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
          @click="jumpToLatest"
          class="absolute bottom-20 right-6 p-2.5 rounded-full bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] text-slate-300 hover:text-white shadow-lg cursor-pointer transition-all hover:scale-105 z-20"
          :title="newMessageCount ? `${newMessageCount} new message(s)` : 'Scroll to bottom'"
        >
          <ChevronDown class="w-4 h-4" />
          <span
            v-if="newMessageCount"
            class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2481cc] text-white text-[10px] font-bold flex items-center justify-center animate-bounce"
          >
            {{ newMessageCount > 99 ? '99+' : newMessageCount }}
          </span>
        </button>

        <!-- Active Reply Target Banner -->
        <div v-if="replyingTo" class="px-4 py-2 bg-[var(--tf-card)] border-t border-[var(--tf-border)] flex items-center justify-between shrink-0 z-10">
          <div class="flex items-center gap-2.5 text-xs border-l-2 border-[#2481cc] pl-3 py-0.5">
            <Reply class="w-4 h-4 text-[#2481cc]" />
            <div>
              <p class="font-bold text-white text-xs">Replying to {{ replyingTo.name }}</p>
              <p class="text-[11px] text-slate-400 truncate max-w-md">{{ replyingTo.text }}</p>
            </div>
          </div>
          <button @click="cancelReply" class="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <!-- Sticker Drawer -->
        <div v-if="showStickerPicker" class="p-3 bg-[var(--tf-card-elevated)] border-t border-[var(--tf-border)] space-y-2.5 z-20">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-bold text-white mr-1">Stickers</span>
              <button
                type="button"
                @click="stickerTab = 'featured'"
                class="px-2.5 py-1 text-[11px] rounded-lg transition cursor-pointer font-medium"
                :class="stickerTab === 'featured' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Featured
              </button>
              <button
                type="button"
                @click="stickerTab = 'recents'"
                class="px-2.5 py-1 text-[11px] rounded-lg transition cursor-pointer font-medium"
                :class="stickerTab === 'recents' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Recents ({{ stickers.length }})
              </button>
              <button
                type="button"
                @click="stickerTab = 'custom'"
                class="px-2.5 py-1 text-[11px] rounded-lg transition cursor-pointer font-medium"
                :class="stickerTab === 'custom' ? 'bg-[#2481cc] text-white' : 'text-slate-400 hover:text-white'"
              >
                Upload .webp
              </button>
            </div>
            <button @click="showStickerPicker = false" class="p-1 text-slate-400 hover:text-white cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Featured Stickers Tab -->
          <div v-if="stickerTab === 'featured'" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 max-h-36 overflow-y-auto p-1">
            <button
              v-for="st in featuredStickers"
              :key="st.id"
              type="button"
              @click="handleSendFeaturedSticker(st)"
              class="p-1 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center cursor-pointer transition hover:scale-110"
              :title="st.name"
            >
              <img :src="st.url" :alt="st.name" class="w-10 h-10 object-contain pointer-events-none" loading="lazy" />
              <span class="text-[10px] text-slate-400 mt-0.5">{{ st.emoji }}</span>
            </button>
          </div>

          <!-- Recents Tab -->
          <div v-else-if="stickerTab === 'recents'">
            <div v-if="stickers.length > 0" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2 max-h-36 overflow-y-auto p-1">
              <button
                v-for="s in stickers"
                :key="s.mediaFileId"
                type="button"
                @click="handleSendSticker(s)"
                class="p-1 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition hover:scale-110"
              >
                <img :src="mediaSrc(s.mediaFileId)" class="w-10 h-10 object-contain" />
              </button>
            </div>
            <p v-else class="text-[11px] text-slate-400 py-4 text-center">
              No stickers received yet. Choose from "Featured" or upload custom sticker!
            </p>
          </div>

          <!-- Custom / Upload Tab -->
          <div v-else-if="stickerTab === 'custom'" class="space-y-2 py-1">
            <div class="flex items-center gap-2">
              <input
                v-model="customStickerInput"
                type="text"
                placeholder="Telegram sticker file_id or .webp image URL..."
                class="tf-input flex-1 py-1 px-3 text-xs"
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
              >
                <Upload class="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Emoji Picker Drawer -->
        <div v-if="showEmojiPicker" class="p-3 bg-[var(--tf-card-elevated)] border-t border-[var(--tf-border)] flex flex-wrap gap-2 max-h-36 overflow-y-auto z-20">
          <button
            v-for="em in commonEmojis"
            :key="em"
            type="button"
            @click="insertEmoji(em)"
            class="text-xl p-1.5 rounded-lg hover:bg-white/10 hover:scale-125 transition cursor-pointer select-none"
          >
            {{ em }}
          </button>
        </div>

        <!-- Button Attachment Drawer -->
        <div v-if="showButtonAttachment" class="p-3 bg-[var(--tf-card-elevated)] border-t border-[var(--tf-border)] space-y-2 z-20">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white flex items-center gap-1.5">
              <MousePointerClick class="w-4 h-4 text-[#50a7ea]" />
              <span>Attach Inline URL Button</span>
            </span>
            <button type="button" @click="showButtonAttachment = false" class="text-slate-400 hover:text-white p-1">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              v-model="attachedButtonText"
              type="text"
              placeholder="Button Label (e.g. 🌐 Visit Community)"
              class="tf-input py-1.5 px-3 text-xs"
            />
            <input
              v-model="attachedButtonUrl"
              type="url"
              placeholder="Button URL (e.g. https://t.me/...)"
              class="tf-input py-1.5 px-3 text-xs"
            />
          </div>
        </div>

        <!-- Attachment Popover Menu -->
        <div
          v-if="showAttachMenu"
          class="absolute bottom-16 left-4 bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl p-2 shadow-xl flex flex-col gap-1 z-30 min-w-[160px]"
        >
          <button
            type="button"
            @click="photoInput?.click(); showAttachMenu = false"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer text-left"
          >
            <Image class="w-4 h-4 text-emerald-400" />
            <span>Photo</span>
          </button>
          <button
            type="button"
            @click="videoInput?.click(); showAttachMenu = false"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer text-left"
          >
            <Video class="w-4 h-4 text-sky-400" />
            <span>Video</span>
          </button>
          <button
            type="button"
            @click="showStickerPicker = true; showAttachMenu = false"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer text-left"
          >
            <Sticker class="w-4 h-4 text-amber-400" />
            <span>Sticker</span>
          </button>
          <button
            type="button"
            @click="showButtonAttachment = true; showAttachMenu = false"
            class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 cursor-pointer text-left"
          >
            <MousePointerClick class="w-4 h-4 text-purple-400" />
            <span>Inline Button</span>
          </button>
        </div>

        <!-- 3. Telegram Native Composer Footer -->
        <form
          v-if="activeGroup"
          @submit.prevent="handleSend"
          class="p-2.5 bg-[var(--tf-card)] border-t border-[var(--tf-border)] flex items-end gap-2 shrink-0 z-20"
        >
          <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="handleMediaSelect($event, 'photo')" />
          <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="handleMediaSelect($event, 'video')" />
          <input ref="stickerFileInput" type="file" accept=".webp,image/webp,image/png" class="hidden" @change="handleStickerFileSelect" />

          <!-- Attachment Clip Button (Native Telegram Paperclip) -->
          <button
            type="button"
            @click="showAttachMenu = !showAttachMenu"
            class="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/5 cursor-pointer transition"
            :class="showAttachMenu ? 'text-[#2481cc] bg-[#2481cc]/10' : ''"
            title="Attach file"
          >
            <Paperclip class="w-5 h-5 rotate-45" />
          </button>

          <!-- Telegram Seamless Expanding Textarea -->
          <div class="flex-1 relative flex items-center">
            <textarea
              v-model="draft"
              rows="1"
              placeholder="Write a message..."
              @keydown.enter.exact.prevent="handleSend"
              class="w-full bg-[var(--tf-input)] border border-[var(--tf-border)] rounded-2xl py-2 px-3.5 pr-10 text-xs text-white placeholder-slate-400 resize-none max-h-28 focus:outline-none focus:border-[#2481cc]"
            ></textarea>

            <!-- Emoji Toggle inside input right -->
            <button
              type="button"
              @click="showEmojiPicker = !showEmojiPicker"
              class="absolute right-2.5 text-slate-400 hover:text-white cursor-pointer"
              title="Emoji"
            >
              <Smile class="w-4 h-4" />
            </button>
          </div>

          <!-- Telegram Circular Send Button -->
          <button
            type="submit"
            :disabled="!draft.trim() || chatStore.isSending"
            class="w-9 h-9 rounded-full bg-[#2481cc] hover:bg-[#1f72b5] flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer shadow-md transition-transform active:scale-95 text-white"
            title="Send"
          >
            <RefreshCw v-if="chatStore.isSending" class="w-4 h-4 animate-spin" />
            <Send v-else class="w-4 h-4 ml-0.5" />
          </button>
        </form>
      </section>

      <!-- 3. RIGHT PANE: Telegram Group Info Drawer -->
      <aside
        v-if="showRightPanel && activeGroup"
        class="lg:col-span-3 border-l border-[var(--tf-border)] flex flex-col min-h-0 bg-[var(--tf-card)] text-xs z-10"
      >
        <!-- Panel Header -->
        <div class="h-14 px-4 border-b border-[var(--tf-border)] flex items-center justify-between shrink-0">
          <h4 class="font-bold text-white text-xs">Chat Info</h4>
          <button @click="showRightPanel = false" class="p-1 text-slate-400 hover:text-white cursor-pointer">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          <!-- Group Profile Avatar -->
          <div class="text-center space-y-2">
            <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-500 text-white font-bold text-xl flex items-center justify-center mx-auto shadow-md ring-4 ring-white/5">
              {{ initials(activeGroup.name) }}
            </div>
            <div>
              <h3 class="text-sm font-bold text-white">{{ activeGroup.name }}</h3>
              <p class="text-[11px] text-slate-400 font-mono mt-0.5">{{ activeGroup.chatId }}</p>
              <p v-if="chatStore.totalCount !== null" class="text-[11px] text-[#50a7ea] font-semibold mt-1">
                {{ chatStore.totalCount.toLocaleString() }} members
              </p>
            </div>
          </div>

          <!-- Telegram Tabbed Content Browser -->
          <div class="border-t border-b border-white/5 py-3">
            <div class="grid grid-cols-4 gap-1 text-center font-medium text-[11px]">
              <button
                @click="rightPanelTab = 'info'"
                class="py-1.5 rounded-lg transition"
                :class="rightPanelTab === 'info' ? 'bg-[#2481cc] text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                Info
              </button>
              <button
                @click="rightPanelTab = 'members'"
                class="py-1.5 rounded-lg transition"
                :class="rightPanelTab === 'members' ? 'bg-[#2481cc] text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                Members
              </button>
              <button
                @click="rightPanelTab = 'media'"
                class="py-1.5 rounded-lg transition"
                :class="rightPanelTab === 'media' ? 'bg-[#2481cc] text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                Media
              </button>
              <button
                @click="rightPanelTab = 'files'"
                class="py-1.5 rounded-lg transition"
                :class="rightPanelTab === 'files' ? 'bg-[#2481cc] text-white font-bold' : 'text-slate-400 hover:text-white'"
              >
                Files
              </button>
            </div>

            <!-- Tab: Members List -->
            <div v-if="rightPanelTab === 'members'" class="mt-3 space-y-2 max-h-56 overflow-y-auto no-scrollbar">
              <div
                v-for="m in chatStore.members"
                :key="m.userId"
                class="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <div class="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                  {{ initials(m.firstName || m.username || 'U') }}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="text-xs font-semibold text-white truncate flex items-center gap-1">
                    {{ [m.firstName, m.lastName].filter(Boolean).join(' ') || m.username || 'User' }}
                    <Crown v-if="m.status === 'creator'" class="w-3 h-3 text-amber-400 inline" />
                    <Shield v-else-if="m.status === 'administrator'" class="w-3 h-3 text-sky-400 inline" />
                    <Bot v-else-if="m.isBot" class="w-3 h-3 text-purple-400 inline" />
                  </p>
                  <p class="text-[10px] text-slate-400">{{ m.status || 'member' }}</p>
                </div>
              </div>
            </div>

            <!-- Tab: Media / Files Preview -->
            <div v-else-if="rightPanelTab === 'media' || rightPanelTab === 'files'" class="mt-3 text-center text-slate-400 text-[11px] py-4">
              <span>No shared attachments yet</span>
            </div>

            <!-- Tab: Info / Status -->
            <div v-else class="mt-3 space-y-2 text-slate-300 text-[11px]">
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-slate-400">Chat Type:</span>
                <span class="font-semibold capitalize text-white">{{ activeGroup.type }}</span>
              </div>
              <div class="flex justify-between py-1 border-b border-white/5">
                <span class="text-slate-400">SSE Realtime:</span>
                <span class="font-semibold text-emerald-400">Active (0ms latency)</span>
              </div>
              <div class="flex justify-between py-1">
                <span class="text-slate-400">Telegram Bot API:</span>
                <span class="font-semibold text-white">Version 10.3</span>
              </div>
            </div>
          </div>

          <!-- Quick Automation Controls -->
          <div class="space-y-2">
            <h5 class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group Security</h5>

            <div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <ShieldAlert class="w-4 h-4 text-purple-400" />
                <span class="text-slate-200 font-medium">Auto-Moderation</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-bold">Enabled</span>
            </div>

            <div class="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Sparkles class="w-4 h-4 text-sky-400" />
                <span class="text-slate-200 font-medium">AI Auto-Reply</span>
              </div>
              <span class="text-[10px] text-emerald-400 font-bold">Active</span>
            </div>
          </div>
        </div>
      </aside>
    </div>

    <!-- Media Full-Screen Lightbox Modal (Telegram Native Lightbox) -->
    <div
      v-if="selectedMedia"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
      @click.self="selectedMedia = null"
    >
      <button
        type="button"
        @click="selectedMedia = null"
        class="absolute top-4 right-4 p-2 text-white/70 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
      >
        <X class="w-6 h-6" />
      </button>

      <div class="max-w-4xl max-h-[85vh] flex flex-col items-center">
        <img
          v-if="selectedMedia.type === 'photo'"
          :src="selectedMedia.url"
          class="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
        />
        <video
          v-else-if="selectedMedia.type === 'video'"
          :src="selectedMedia.url"
          controls
          autoplay
          class="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
        ></video>
        <div class="mt-3 flex items-center gap-3">
          <a
            :href="selectedMedia.url"
            target="_blank"
            download
            class="tf-btn-primary py-1.5 px-4 text-xs flex items-center gap-2 cursor-pointer"
          >
            <Download class="w-4 h-4" />
            <span>Download</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Add Group Modal -->
    <div
      v-if="showAddGroupModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      @click.self="showAddGroupModal = false"
    >
      <div class="bg-[var(--tf-card-elevated)] border border-[var(--tf-border)] rounded-xl w-full max-w-md p-6 space-y-4 shadow-sm">
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
          Enter your Telegram group's Chat ID (e.g. <code class="text-[#50a7ea] bg-black/30 px-1 py-0.5 rounded">-1001234567890</code>) or public username.
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
            <label class="block text-[11px] font-medium text-slate-400 mb-1">Group Name (optional)</label>
            <input
              v-model="newGroupName"
              type="text"
              placeholder="e.g. Developers Cambodia"
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
            <span>{{ isAddingGroup ? 'Connecting...' : 'Connect' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
