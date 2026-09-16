import { useState } from '#imports'

export function useNavTab() {
  const activeTab = useState<string>('teleflow-active-tab', () => 'overview')
  const sidebarCollapsed = useState<boolean>('teleflow-sidebar-collapsed', () => false)
  const mobileSidebarOpen = useState<boolean>('teleflow-mobile-sidebar-open', () => false)
  const commandPaletteOpen = useState<boolean>('teleflow-command-palette-open', () => false)
  const notificationCenterOpen = useState<boolean>('teleflow-notifications-open', () => false)
  const helpModalOpen = useState<boolean>('teleflow-help-modal-open', () => false)
  const addBotModalOpen = useState<boolean>('teleflow-add-bot-modal-open', () => false)

  const setTab = (tab: string) => {
    activeTab.value = tab
    mobileSidebarOpen.value = false
  }

  return {
    activeTab,
    sidebarCollapsed,
    mobileSidebarOpen,
    commandPaletteOpen,
    notificationCenterOpen,
    helpModalOpen,
    addBotModalOpen,
    setTab
  }
}

