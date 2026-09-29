<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useBotStore } from '../stores/bot'
import { useAuthStore } from '../stores/auth'
import { useTheme } from '../composables/useTheme'
import { useNavTab } from '../composables/useNavTab'
import { useNotifications } from '../composables/useNotifications'
import AppSidebar from '../components/ui/AppSidebar.vue'
import AppTopbar from '../components/ui/AppTopbar.vue'
import CommandPalette from '../components/ui/CommandPalette.vue'
import NotificationCenter from '../components/ui/NotificationCenter.vue'
import HelpModal from '../components/ui/HelpModal.vue'
import MobileNavigation from '../components/ui/MobileNavigation.vue'
import ToastList from '../components/ToastList.vue'

const botStore = useBotStore()
const authStore = useAuthStore()
const { init } = useTheme()
const {
  activeTab,
  sidebarCollapsed,
  mobileSidebarOpen,
  commandPaletteOpen,
  notificationCenterOpen,
  helpModalOpen,
  setTab
} = useNavTab()

const notifications = useNotifications()
let notificationTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  init()
  botStore.fetchBot()
  notifications.load()
  notificationTimer = setInterval(notifications.load, 60000)
})

onBeforeUnmount(() => clearInterval(notificationTimer))
</script>

<template>
  <div class="min-h-screen bg-[var(--tf-bg)] text-[var(--tf-text)] flex font-sans overflow-x-hidden relative">
    <!-- Desktop Collapsible Sidebar -->
    <div class="hidden lg:block shrink-0 relative z-20">
      <AppSidebar
        :active-tab="activeTab"
        :collapsed="sidebarCollapsed"
        @update:active-tab="setTab"
        @update:collapsed="sidebarCollapsed = $event"
        @open-help="helpModalOpen = true"
      />
    </div>

    <!-- Mobile Drawer Overlay -->
    <div
      v-if="mobileSidebarOpen"
      class="lg:hidden fixed inset-0 z-50 flex"
    >
      <div
        @click="mobileSidebarOpen = false"
        class="fixed inset-0 bg-slate-950/60"
      ></div>
      <div class="relative w-64 max-w-[80vw] h-full z-10">
        <AppSidebar
          :active-tab="activeTab"
          :collapsed="false"
          @update:active-tab="setTab"
          @update:collapsed="mobileSidebarOpen = false"
          @open-help="helpModalOpen = true; mobileSidebarOpen = false"
        />
      </div>
    </div>

    <!-- Main Content Flow -->
    <div class="flex-1 flex flex-col min-w-0 min-h-screen relative z-10">
      <!-- Topbar Header -->
      <AppTopbar
        :active-tab="activeTab"
        :unread-notification-count="notifications.unreadCount.value"
        @toggle-mobile-sidebar="mobileSidebarOpen = !mobileSidebarOpen"
        @open-search="commandPaletteOpen = true"
        @toggle-notifications="notificationCenterOpen = !notificationCenterOpen"
        @open-help="helpModalOpen = true"
        @navigate="setTab"
      />

      <!-- Notification Center Dropdown Container -->
      <div class="max-w-7xl w-full mx-auto px-4 sm:px-6 relative">
        <NotificationCenter
          :open="notificationCenterOpen"
          @update:open="notificationCenterOpen = $event"
          @navigate="setTab"
        />
      </div>

      <!-- Main Page Slot -->
      <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8">
        <slot />
      </main>
    </div>

    <!-- Mobile Bottom Navigation Bar -->
    <MobileNavigation
      :active-tab="activeTab"
      @navigate="setTab"
      @open-drawer="mobileSidebarOpen = true"
    />

    <!-- Global Command Palette (⌘K) -->
    <CommandPalette
      :open="commandPaletteOpen"
      @update:open="commandPaletteOpen = $event"
      @select-tab="setTab"
    />

    <!-- Help & Documentation Modal -->
    <HelpModal
      :open="helpModalOpen"
      @update:open="helpModalOpen = $event"
    />

    <!-- Toast Notifications List -->
    <ToastList />
  </div>
</template>
