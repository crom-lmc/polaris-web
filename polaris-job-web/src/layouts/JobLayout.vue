<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

const collapsed = ref(false)
const userMenu = ref(false)

const navs = [
  { key: 'jobs', label: '任务管理' },
  { key: 'logs', label: '调度日志' },
  { key: 'executors', label: '执行器' },
  { key: 'alarms', label: '报警配置' }
]

const current = computed(() => {
  const seg = route.path.split('/')[1] || 'jobs'
  return seg === 'dashboard' ? 'jobs' : seg
})
const isJobs = computed(() => current.value === 'jobs')

function go(key: string) {
  if (key !== current.value) router.push('/' + key)
}

function logout() {
  userMenu.value = false
  user.logout()
}
</script>

<template>
  <div class="shell">
    <header class="header">
      <div class="logo">
        <span class="menu-toggle" title="收起菜单" @click="collapsed = !collapsed">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M2 4h12M2 8h12M2 12h12" stroke-linecap="round" />
          </svg>
        </span>
        <span>调度中心</span>
      </div>
      <div class="header-right">
        <span class="env-tag">本地环境</span>
        <div class="who-wrap">
          <span class="who" @click="userMenu = !userMenu">
            {{ user.accountName || user.accountId || '未登录' }} <span class="caret">▼</span>
          </span>
          <div v-if="userMenu" class="user-menu">
            <div class="user-menu-item" @click="logout">退出登录</div>
          </div>
        </div>
      </div>
    </header>

    <div class="body">
      <aside class="sider" :class="{ collapsed }">
        <div
          v-for="n in navs"
          :key="n.key"
          class="nav-item"
          :class="{ active: current === n.key }"
          @click="go(n.key)"
        >
          <svg v-if="n.key === 'jobs'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <circle cx="8" cy="8" r="6.2" /><path d="M8 4.6V8l2.4 1.4" stroke-linecap="round" />
          </svg>
          <svg v-else-if="n.key === 'logs'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M4 1.8h6l3 3v9.4H4z" stroke-linejoin="round" />
            <path d="M9.8 1.9v3.1h3.1M6 8h4.5M6 10.6h4.5" stroke-linecap="round" />
          </svg>
          <svg v-else-if="n.key === 'executors'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="1.8" y="6" width="4" height="4" rx="1" />
            <rect x="10.2" y="1.8" width="4" height="4" rx="1" />
            <rect x="10.2" y="10.2" width="4" height="4" rx="1" />
            <path d="M5.8 8h2.2V3.8h2.2M8 8v4.2h2.2" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M8 2a4 4 0 0 0-4 4v2.2L3 10h10l-1-1.8V6a4 4 0 0 0-4-4Z" stroke-linejoin="round" />
            <path d="M6.4 12.4a1.7 1.7 0 0 0 3.2 0" stroke-linecap="round" />
          </svg>
          {{ n.label }}
        </div>
      </aside>

      <main class="content" :class="{ 'no-scroll': isJobs }">
        <RouterView />
      </main>
    </div>
  </div>
</template>
