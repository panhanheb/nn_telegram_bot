<script setup lang="ts">
import { useNavTab } from '../composables/useNavTab'
import DashboardStats from '../components/DashboardStats.vue'
import BotManager from '../components/BotManager.vue'
import GroupManager from '../components/GroupManager.vue'
import GroupChat from '../components/GroupChat.vue'
import BroadcastCenter from '../components/BroadcastCenter.vue'
import ScheduleManager from '../components/ScheduleManager.vue'
import AiSettings from '../components/AiSettings.vue'
import ModerationManager from '../components/ModerationManager.vue'
import AnalyticsDashboard from '../components/AnalyticsDashboard.vue'
import LogViewer from '../components/LogViewer.vue'
import SettingsManager from '../components/SettingsManager.vue'
import MemberManager from '../components/MemberManager.vue'

const { activeTab, setTab } = useNavTab()
</script>

<template>
  <div class="transition-opacity duration-200">
    <!-- Overview / Dashboard -->
    <DashboardStats
      v-if="activeTab === 'overview'"
      @navigate="setTab"
      @open-add-bot="setTab('bots')"
    />

    <!-- Bots Management -->
    <BotManager
      v-else-if="activeTab === 'bots'"
      @navigate="setTab"
    />

    <!-- Groups & Channels -->
    <GroupManager
      v-else-if="activeTab === 'groups' || activeTab === 'channels'"
      @navigate="setTab"
    />

    <!-- Live Telegram-style Chat -->
    <GroupChat
      v-else-if="activeTab === 'chat' || activeTab === 'messages'"
    />

    <!-- Broadcast Center -->
    <BroadcastCenter
      v-else-if="activeTab === 'broadcasts'"
      @navigate="setTab"
    />

    <!-- Broadcast Scheduler -->
    <ScheduleManager
      v-else-if="activeTab === 'schedules'"
    />

    <!-- AI Assistant -->
    <AiSettings
      v-else-if="activeTab === 'ai'"
    />

    <!-- Moderation Center -->
    <ModerationManager
      v-else-if="activeTab === 'moderation'"
    />

    <!-- Analytics Dashboard -->
    <AnalyticsDashboard
      v-else-if="activeTab === 'analytics'"
    />

    <!-- Activity Logs -->
    <LogViewer
      v-else-if="activeTab === 'logs'"
    />

    <!-- Settings -->
    <SettingsManager
      v-else-if="activeTab === 'settings'"
    />

    <!-- Members Management -->
    <MemberManager
      v-else-if="activeTab === 'members'"
      @navigate="setTab"
    />
  </div>
</template>
