<script setup lang="ts">
import { LayoutDashboard, Bot, MessageSquare, Send, Menu } from 'lucide-vue-next'

const props = defineProps<{
  activeTab: string
}>()

const emit = defineEmits<{
  (e: 'navigate', tab: string): void
  (e: 'open-drawer'): void
}>()

const navItems = [
  { id: 'overview', name: 'Home', icon: LayoutDashboard },
  { id: 'bots', name: 'Bots', icon: Bot },
  { id: 'chat', name: 'Chats', icon: MessageSquare },
  { id: 'broadcasts', name: 'Broadcast', icon: Send }
]
</script>

<template>
  <nav class="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[var(--tf-card)] backdrop-blur-2xl border-t border-[var(--tf-border)] shadow-[0_-4px_24px_rgba(0,0,0,0.1)] flex items-center justify-around z-40 px-2 select-none">
    <button
      v-for="item in navItems"
      :key="item.id"
      type="button"
      @click="emit('navigate', item.id)"
      class="flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer"
      :class="activeTab === item.id ? 'text-[#2481cc]' : 'text-slate-400 hover:text-slate-200'"
    >
      <component :is="item.icon" class="w-5 h-5" />
      <span class="text-[10px] font-medium mt-1">{{ item.name }}</span>
    </button>

    <!-- More button to trigger mobile sidebar drawer -->
    <button
      type="button"
      @click="emit('open-drawer')"
      class="flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
    >
      <Menu class="w-5 h-5" />
      <span class="text-[10px] font-medium mt-1">More</span>
    </button>
  </nav>
</template>

