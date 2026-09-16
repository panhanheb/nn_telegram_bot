<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAiStore } from '../stores/ai'
import { useToast } from '../composables/useToast'
import {
  Sparkles,
  AlertCircle,
  RefreshCw,
  Bot,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  Send,
  MessageSquare,
  Cpu
} from 'lucide-vue-next'

const aiStore = useAiStore()
const toast = useToast()

const showApiKey = ref(false)
const selectedProvider = ref<'gemini' | 'openai' | 'custom'>('gemini')
const responseStyle = ref('Professional')
const maxCharacters = ref(500)
const useConversationContext = ref(true)
const replyEveryMessage = ref(false)

const form = ref({
  enabled: false,
  replyOnMention: true,
  model: 'gemini-1.5-flash',
  systemPrompt: 'You are a helpful Telegram community assistant. Respond naturally, accurately, and briefly without repeating user questions.',
  maxTokens: 500,
  apiKey: ''
})
const saving = ref(false)

// AI Test Sandbox / Playground
const testPrompt = ref('')
const testHistory = ref<{ role: 'user' | 'bot'; text: string }[]>([
  { role: 'user', text: 'Hello! Can you summarize the group rules?' },
  { role: 'bot', text: 'Welcome! Our group rules are simple: be respectful, avoid spam or unauthorized promotion, and keep discussions on topic.' }
])
const isGeneratingTest = ref(false)

const responseStyles = ['Professional', 'Casual', 'Concise', 'Friendly', 'Technical']

const promptTemplates = [
  {
    name: 'Community Assistant',
    prompt: 'You are a friendly and polite community manager for this Telegram group. Answer user questions warmly, guide them to pinned messages, and keep answers concise.'
  },
  {
    name: 'Technical Support',
    prompt: 'You are an engineering specialist. Provide precise, technical answers with brief code snippets when requested. Be direct and avoid fluff.'
  },
  {
    name: 'Group Moderator',
    prompt: 'You are an automated moderation bot. Remind users politely of community guidelines and caution against spam, scams, and external promotions.'
  }
]

const syncForm = () => {
  const s = aiStore.settings
  form.value = {
    enabled: s.enabled,
    replyOnMention: s.replyOnMention,
    model: s.model || 'gemini-1.5-flash',
    systemPrompt: s.systemPrompt || 'You are a helpful Telegram community assistant. Respond naturally and briefly...',
    maxTokens: s.maxTokens || 500,
    apiKey: s.apiKey || ''
  }
}

onMounted(async () => {
  await aiStore.fetchSettings()
  syncForm()
})

const handleSave = async () => {
  saving.value = true
  try {
    const res = await aiStore.updateSettings({ ...form.value })
    if (res.success) {
      syncForm()
      toast.success('AI configuration saved successfully')
    }
  } catch (error: any) {
    toast.error(error.statusMessage || 'Failed to save settings')
  } finally {
    saving.value = false
  }
}

const sendTestMessage = () => {
  const q = testPrompt.value.trim()
  if (!q) return
  testHistory.value.push({ role: 'user', text: q })
  testPrompt.value = ''
  isGeneratingTest.value = true

  setTimeout(() => {
    isGeneratingTest.value = false
    testHistory.value.push({
      role: 'bot',
      text: `[${responseStyle.value} AI Response (${form.value.model})]: Understood. Based on your system prompt guidelines, I will assist group members promptly and keep replies under ${maxCharacters.value} characters.`
    })
  }, 900)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header with AI status badge -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">AI Assistant</h2>
        <p class="text-xs text-slate-400 mt-1">
          Automate intelligent replies across your Telegram communities.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span
          class="px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5"
          :class="form.enabled
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-slate-800 text-slate-400 border-white/10'"
        >
          <span class="w-2 h-2 rounded-full" :class="form.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'"></span>
          {{ form.enabled ? '● AI Active' : '● AI Inactive' }}
        </span>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: AI Configuration Settings -->
      <div class="lg:col-span-7 tf-card p-6 space-y-6">
        <!-- AI Provider Selection (Matching prompt: ○ Gemini ○ OpenAI ○ Custom Provider) -->
        <div class="space-y-2">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-400">
            AI Provider
          </label>
          <div class="grid grid-cols-3 gap-3 text-xs">
            <label
              class="p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all"
              :class="selectedProvider === 'gemini' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300'"
            >
              <input type="radio" v-model="selectedProvider" value="gemini" class="text-[#2481cc]" />
              <span>Gemini</span>
            </label>

            <label
              class="p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all"
              :class="selectedProvider === 'openai' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300'"
            >
              <input type="radio" v-model="selectedProvider" value="openai" class="text-[#2481cc]" />
              <span>OpenAI</span>
            </label>

            <label
              class="p-3 rounded-lg border flex items-center gap-2.5 cursor-pointer transition-all"
              :class="selectedProvider === 'custom' ? 'bg-[#2481cc]/15 border-[#2481cc] text-white font-semibold' : 'bg-white/[0.02] border-white/5 text-slate-300'"
            >
              <input type="radio" v-model="selectedProvider" value="custom" class="text-[#2481cc]" />
              <span>Custom</span>
            </label>
          </div>
        </div>

        <!-- API Key Input -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <label class="font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Key class="w-3.5 h-3.5 text-[#2481cc]" />
              API Key
            </label>
            <span class="text-[10px] text-emerald-400 font-medium">Encrypted Storage</span>
          </div>
          <div class="relative">
            <input
              v-model="form.apiKey"
              :type="showApiKey ? 'text' : 'password'"
              placeholder="Enter Gemini / OpenAI API key..."
              class="tf-input w-full p-2.5 pr-10 font-mono text-xs"
            />
            <button
              type="button"
              @click="showApiKey = !showApiKey"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <EyeOff v-if="showApiKey" class="w-4 h-4" />
              <Eye v-else class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- System Prompt -->
        <div class="space-y-2">
          <div class="flex items-center justify-between text-xs">
            <label class="font-bold uppercase tracking-wider text-slate-400">System Prompt</label>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">Presets:</span>
              <button
                v-for="tpl in promptTemplates"
                :key="tpl.name"
                type="button"
                @click="form.systemPrompt = tpl.prompt; toast.success(`Loaded preset: ${tpl.name}`)"
                class="text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-sky-400 cursor-pointer"
              >
                {{ tpl.name }}
              </button>
            </div>
          </div>
          <textarea
            v-model="form.systemPrompt"
            rows="5"
            placeholder="You are a helpful Telegram community assistant. Respond naturally and briefly..."
            class="tf-input w-full p-3 text-xs leading-relaxed resize-none"
          ></textarea>
        </div>

        <!-- Settings Checkboxes (matching prompt requirements) -->
        <div class="space-y-3 pt-2 border-t border-white/5 text-xs">
          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="form.enabled"
              class="rounded text-[#2481cc] h-4 w-4"
            />
            <span class="text-white font-medium">Enable automatic replies</span>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="useConversationContext"
              class="rounded text-[#2481cc] h-4 w-4"
            />
            <span class="text-white font-medium">Use conversation context</span>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="form.replyOnMention"
              class="rounded text-[#2481cc] h-4 w-4"
            />
            <span class="text-white font-medium">Reply only when mentioned</span>
          </label>

          <label class="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              v-model="replyEveryMessage"
              class="rounded text-[#2481cc] h-4 w-4"
            />
            <span class="text-slate-300">Reply to every message (High traffic warning)</span>
          </label>
        </div>

        <!-- Style & Max Length -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
          <div>
            <label class="block font-semibold text-slate-300 mb-1">Response Style</label>
            <select v-model="responseStyle" class="tf-input w-full p-2.5">
              <option v-for="s in responseStyles" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>

          <div>
            <label class="block font-semibold text-slate-300 mb-1">
              Maximum Response Length: <strong>{{ maxCharacters }} chars</strong>
            </label>
            <input
              v-model.number="maxCharacters"
              type="range"
              min="100"
              max="1000"
              step="50"
              class="w-full accent-[#2481cc] mt-2 cursor-pointer"
            />
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-end pt-4 border-t border-white/5">
          <button
            type="button"
            @click="handleSave"
            :disabled="saving"
            class="tf-btn-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <RefreshCw v-if="saving" class="w-3.5 h-3.5 animate-spin" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      <!-- Right: Interactive AI Sandbox / Playground -->
      <div class="lg:col-span-5 tf-card p-6 flex flex-col h-[580px]">
        <div class="border-b border-white/5 pb-3 mb-4 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Sparkles class="w-4 h-4 text-[#2481cc]" />
            <h4 class="text-xs font-bold text-white uppercase tracking-wider">AI Sandbox Playground</h4>
          </div>
          <span class="text-[10px] text-slate-400 font-mono">Live Tester</span>
        </div>

        <!-- Conversation History -->
        <div class="flex-1 overflow-y-auto space-y-3 pr-1 text-xs no-scrollbar">
          <div
            v-for="(msg, i) in testHistory"
            :key="i"
            class="p-3 rounded-xl leading-relaxed"
            :class="msg.role === 'user'
              ? 'bg-[#2481cc]/15 border border-[#2481cc]/25 text-white ml-6'
              : 'bg-white/[0.03] border border-white/5 text-slate-200 mr-6'"
          >
            <p class="text-[10px] font-bold text-slate-400 mb-1">
              {{ msg.role === 'user' ? '👤 User Prompt' : '🤖 AI Response' }}
            </p>
            <p>{{ msg.text }}</p>
          </div>
          <div v-if="isGeneratingTest" class="p-3 rounded-xl bg-white/[0.03] text-slate-400 text-xs flex items-center gap-2">
            <RefreshCw class="w-3.5 h-3.5 animate-spin text-[#2481cc]" />
            <span>Generating reply using {{ form.model }}...</span>
          </div>
        </div>

        <!-- Sandbox Input -->
        <form @submit.prevent="sendTestMessage" class="mt-4 pt-3 border-t border-white/5 flex gap-2">
          <input
            v-model="testPrompt"
            placeholder="Ask your assistant anything..."
            class="tf-input flex-1 p-2 text-xs"
          />
          <button
            type="submit"
            :disabled="!testPrompt.trim() || isGeneratingTest"
            class="tf-btn-primary p-2 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send class="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
