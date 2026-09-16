<script setup lang="ts">
import { ref } from 'vue'
import {
  BarChart3,
  TrendingUp,
  Users,
  MessageSquare,
  Sparkles,
  Send,
  ShieldAlert,
  Calendar,
  Clock,
  ArrowUpRight
} from 'lucide-vue-next'

const activeFilter = ref<'Today' | '7 Days' | '30 Days' | '90 Days'>('7 Days')
const filters = ['Today', '7 Days', '30 Days', '90 Days'] as const

const metrics = [
  { label: 'Messages', value: '128,492', change: '+18.6%', icon: MessageSquare, color: 'text-sky-400' },
  { label: 'Active Users', value: '48,291', change: '+12.4%', icon: Users, color: 'text-indigo-400' },
  { label: 'New Members', value: '+1,240', change: '+9.2%', icon: TrendingUp, color: 'text-emerald-400' },
  { label: 'AI Responses', value: '34,120', change: '+24.1%', icon: Sparkles, color: 'text-purple-400' },
  { label: 'Broadcast Delivery', value: '99.4%', change: '+0.8%', icon: Send, color: 'text-amber-400' },
  { label: 'Moderation Actions', value: '2,417', change: '-4.2%', icon: ShieldAlert, color: 'text-rose-400' }
]

// 24 Hour activity bar distribution
const hourlyActivity = [
  { hour: '00:00', val: 20 },
  { hour: '02:00', val: 12 },
  { hour: '04:00', val: 8 },
  { hour: '06:00', val: 35 },
  { hour: '08:00', val: 78 },
  { hour: '10:00', val: 92 },
  { hour: '12:00', val: 85 },
  { hour: '14:00', val: 98 },
  { hour: '16:00', val: 94 },
  { hour: '18:00', val: 88 },
  { hour: '20:00', val: 72 },
  { hour: '22:00', val: 45 }
]

// Top groups
const topGroups = [
  { name: 'Developers Cambodia', messages: 48291, members: 12482, share: 42 },
  { name: 'Flutter Dev Community', messages: 31200, members: 8490, share: 28 },
  { name: 'Startup Builders Hub', messages: 14200, members: 3410, share: 15 },
  { name: 'Tech News & Releases', messages: 5410, members: 24800, share: 15 }
]
</script>

<template>
  <div class="space-y-6">
    <!-- Header with Time Filters -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-xl sm:text-2xl font-bold text-white tracking-tight">Analytics Overview</h2>
        <p class="text-xs text-slate-400 mt-1">
          Audience engagement, message volume, and delivery efficiency.
        </p>
      </div>

      <!-- Time Filter Selector -->
      <div class="flex items-center rounded-lg bg-white/[0.04] p-1 border border-white/5 gap-1 text-xs self-start sm:self-auto">
        <button
          v-for="f in filters"
          :key="f"
          type="button"
          @click="activeFilter = f"
          class="px-2.5 py-1 rounded-md transition-all font-medium cursor-pointer"
          :class="activeFilter === f ? 'bg-[#2481cc] text-white font-semibold shadow-sm' : 'text-slate-400 hover:text-white'"
        >
          {{ f }}
        </button>
      </div>
    </div>

    <!-- 6 Primary Metric Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      <div
        v-for="m in metrics"
        :key="m.label"
        class="tf-card p-4 space-y-2"
      >
        <div class="flex items-center justify-between">
          <component :is="m.icon" class="w-4 h-4" :class="m.color" />
          <span class="text-[10px] font-semibold text-emerald-400">{{ m.change }}</span>
        </div>
        <div>
          <p class="text-[11px] text-slate-400">{{ m.label }}</p>
          <h4 class="text-lg font-bold text-white mt-0.5">{{ m.value }}</h4>
        </div>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <!-- Left: Hourly Activity Heatmap/Bars -->
      <div class="lg:col-span-7 tf-card p-6 space-y-5">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-white">Peak Hourly Activity</h3>
            <p class="text-[11px] text-slate-400">Message traffic distribution over 24 hours</p>
          </div>
          <span class="text-xs text-slate-400 font-mono">Peak: 14:00</span>
        </div>

        <div class="h-48 flex items-end justify-between gap-2 pt-4">
          <div
            v-for="item in hourlyActivity"
            :key="item.hour"
            class="flex-1 flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div class="w-full bg-white/5 rounded-t-md relative flex items-end h-36 overflow-hidden">
              <div
                class="w-full bg-[#2481cc] group-hover:bg-[#1d73b8] transition-all rounded-t-md"
                :style="{ height: `${item.val}%` }"
              ></div>
            </div>
            <span class="text-[9px] text-slate-400 font-mono truncate">{{ item.hour }}</span>
          </div>
        </div>
      </div>

      <!-- Right: Top Active Communities -->
      <div class="lg:col-span-5 tf-card p-6 space-y-5">
        <div>
          <h3 class="text-sm font-bold text-white">Top Active Communities</h3>
          <p class="text-[11px] text-slate-400">Groups generating the highest conversation density</p>
        </div>

        <div class="space-y-4">
          <div
            v-for="g in topGroups"
            :key="g.name"
            class="space-y-1 text-xs"
          >
            <div class="flex items-center justify-between">
              <span class="font-semibold text-white truncate max-w-[200px]">{{ g.name }}</span>
              <span class="font-mono text-slate-300 text-[11px]">{{ g.messages.toLocaleString() }} msgs</span>
            </div>
            <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
              <div
                class="bg-[#2481cc] h-full rounded-full transition-all duration-500"
                :style="{ width: `${g.share}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

