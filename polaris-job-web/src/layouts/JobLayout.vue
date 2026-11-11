<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  BellOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  DownOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const theme = useThemeStore()

const collapsed = ref(false)

const currentPath = computed(() => {
  const seg = route.path.split('/')[1] || 'jobs'
  return '/' + (seg === 'dashboard' ? 'jobs' : seg)
})

const selectedKeys = computed(() => [currentPath.value])

function onMenuClick({ key }: { key: string }) {
  if (key !== currentPath.value) router.push(key)
}

function onUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') user.logout()
}
</script>

<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <menu-outlined
          class="menu-toggle"
          :title="collapsed ? '展开菜单' : '收起菜单'"
          @click="collapsed = !collapsed"
        />
        <span>调度中心</span>
      </div>
      <div class="right">
        <a-tag color="blue">本地环境</a-tag>
        <a-button
          type="text"
          class="theme-toggle"
          :title="theme.mode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
          @click="theme.toggle()"
        >
          <ThemeToggleIcon :mode="theme.mode" />
        </a-button>
        <a-dropdown :trigger="['hover']">
          <span class="who">
            {{ user.accountName || user.accountId || '未登录' }}
            <down-outlined class="caret" />
          </span>
          <template #overlay>
            <a-menu @click="onUserMenuClick">
              <a-menu-item key="logout">
                <logout-outlined style="margin-right: 8px" />退出登录
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>

    <a-layout class="body">
      <a-layout-sider
        class="sider"
        :theme="theme.mode === 'dark' ? 'dark' : 'light'"
        width="208"
        collapsible
        :collapsed="collapsed"
        :trigger="null"
        @collapse="(v: boolean) => (collapsed = v)"
      >
        <a-menu mode="inline" :selected-keys="selectedKeys" @click="onMenuClick">
          <a-menu-item key="/jobs">
            <template #icon><clock-circle-outlined /></template>
            任务管理
          </a-menu-item>
          <a-menu-item key="/logs">
            <template #icon><file-text-outlined /></template>
            调度日志
          </a-menu-item>
          <a-menu-item key="/executors">
            <template #icon><cluster-outlined /></template>
            执行器
          </a-menu-item>
          <a-menu-item key="/alarms">
            <template #icon><bell-outlined /></template>
            报警配置
          </a-menu-item>
        </a-menu>
      </a-layout-sider>

      <a-layout-content class="content" :class="{ 'is-fixed': currentPath === '/jobs' }">
        <RouterView />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>
