<script setup lang="ts">
import { HelpCircle, X, ExternalLink, Keyboard, ShieldCheck, Sparkles, BookOpen } from 'lucide-vue-next'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div
      @click="emit('update:open', false)"
      class="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
    ></div>

    <!-- Modal Content -->
    <div class="relative w-full max-w-2xl tf-card-elevated z-10 max-h-[85vh] overflow-y-auto">
      <div class="p-5 border-b border-[var(--tf-border)] flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="p-2 rounded-lg bg-[#2481cc]/15 text-[#2481cc]">
            <BookOpen class="w-4 h-4" />
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">TeleFlow Pro Documentation</h3>
            <p class="text-xs text-slate-400">Architecture overview, shortcuts, and BotFather setup guide</p>
          </div>
        </div>
        <button
          @click="emit('update:open', false)"
          class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>
      </div>

      <div class="p-6 space-y-6 text-xs text-slate-300">
        <!-- Quick Keyboard Shortcuts -->
        <div>
          <h4 class="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Keyboard class="w-3.5 h-3.5 text-[#2481cc]" /> Keyboard Shortcuts
          </h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span>Open Command Palette</span>
              <kbd class="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[10px]">⌘K / Ctrl+K</kbd>
            </div>
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span>Close Modals / Drawers</span>
              <kbd class="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[10px]">Esc</kbd>
            </div>
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span>Send Chat Message</span>
              <kbd class="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[10px]">Enter</kbd>
            </div>
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span>New Line in Chat</span>
              <kbd class="px-2 py-0.5 rounded bg-white/10 text-slate-200 font-mono text-[10px]">Shift + Enter</kbd>
            </div>
          </div>
        </div>

        <!-- BotFather Setup Steps -->
        <div class="p-4 rounded-xl bg-sky-500/10 border border-sky-500/20 space-y-3">
          <h4 class="text-xs font-bold text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck class="w-3.5 h-3.5 text-sky-400" /> Essential BotFather Commands
          </h4>
          <p class="text-[11px] text-slate-300 leading-relaxed">
            For TeleFlow Pro's live group chat, auto-moderation, and Gemini auto-reply to function properly, run these commands in <a href="https://t.me/BotFather" target="_blank" class="text-sky-400 hover:underline font-semibold">@BotFather</a>:
          </p>
          <ul class="space-y-2 font-mono text-[11px]">
            <li class="p-2 rounded bg-black/30 border border-white/5">
              <span class="text-sky-400 font-bold">/setprivacy</span> → Select your bot → Choose <span class="text-emerald-400">Disable</span>
              <p class="text-[10px] text-slate-400 font-sans mt-0.5">Allows the bot to read incoming group messages for moderation & AI replies.</p>
            </li>
            <li class="p-2 rounded bg-black/30 border border-white/5">
              <span class="text-sky-400 font-bold">/setjoingroups</span> → Select your bot → Choose <span class="text-emerald-400">Enable</span>
              <p class="text-[10px] text-slate-400 font-sans mt-0.5">Permits your bot to be added to Telegram groups and supergroups.</p>
            </li>
          </ul>
        </div>

        <!-- System Architecture -->
        <div class="space-y-2">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles class="w-3.5 h-3.5 text-purple-400" /> Technology Stack
          </h4>
          <p class="text-[11px] text-slate-400 leading-relaxed">
            TeleFlow Pro is built with <span class="text-white font-medium">Nuxt 4</span>, <span class="text-white font-medium">Vue 3 Composition API</span>, <span class="text-white font-medium">Pinia</span>, <span class="text-white font-medium">Tailwind CSS</span>, and <span class="text-white font-medium">Nitro Cloudflare Edge runtime</span>. It features military-grade AES-256-CBC token encryption and real-time webhook listeners.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

