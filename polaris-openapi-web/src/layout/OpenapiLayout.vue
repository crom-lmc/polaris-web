<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <menu-outlined class="menu-toggle" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse" />
        <span class="logo-text">接口开放平台</span>
      </div>
      <div class="right">
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
            {{ store.username || '未登录' }}
            <down-outlined class="caret" />
          </span>
          <template #overlay>
            <a-menu @click="onUserMenuClick">
              <a-menu-item key="logout">
                <logout-outlined class="mi" />退出登录
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
        <a-menu mode="inline" :selected-keys="selectedKeys" @click="handleMenuClick">
          <a-menu-item v-if="store.can('openapi:dashboard')" key="/dashboard">
            <template #icon><dashboard-outlined /></template>
            概览
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:endpoint')" key="/endpoints">
            <template #icon><api-outlined /></template>
            API 管理
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:app')" key="/apps">
            <template #icon><appstore-outlined /></template>
            对接应用
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:channel')" key="/channels">
            <template #icon><send-outlined /></template>
            出站渠道
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:log')" key="/logs">
            <template #icon><file-search-outlined /></template>
            调用日志
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:stat')" key="/stats">
            <template #icon><bar-chart-outlined /></template>
            统计报表
          </a-menu-item>
          <a-menu-item v-if="store.can('openapi:setting')" key="/settings">
            <template #icon><setting-outlined /></template>
            平台设置
          </a-menu-item>
        </a-menu>
      </a-layout-sider>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  ApiOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  DashboardOutlined,
  DownOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuOutlined,
  SendOutlined,
  SettingOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { Modal } from 'ant-design-vue'
import { gotoAuthorize, logoutSso } from '@/api/openapi'
import { getRefreshToken } from '@/utils/token'
import { useSessionGuard } from '@/composables/useSessionGuard'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const theme = useThemeStore()

const collapsed = ref(false)

useSessionGuard()

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

const selectedKeys = computed(() => [route.path])

function handleMenuClick({ key }: { key: string }) {
  router.push(key as string)
}

function onUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    Modal.confirm({
      title: '退出登录',
      content: '退出后需要重新登录才能继续使用接口开放平台，确定吗？',
      okText: '确定退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        try {
          await logoutSso(getRefreshToken())
        } catch { /* 忽略：本地照样退出 */ }
        store.logout()
        gotoAuthorize('/')
      }
    })
  }
}
</script>

<style scoped>
.shell { height: 100vh; overflow: hidden; }
.body { min-height: 0; }
.header {
  display: flex; align-items: center; justify-content: space-between; padding: 0;
  flex: 0 0 auto; background: var(--header-bg); color: var(--header-text);
  border-bottom: 1px solid var(--header-border);
}
.logo {
  display: flex; align-items: center; gap: 6px; padding-left: 24px;
  color: var(--header-text); font-weight: 600; font-size: 14px;
  flex: 0 0 auto; white-space: nowrap; transition: padding-left 0.2s;
}
.logo.is-collapsed { padding-left: 29px; }
.logo-text { white-space: nowrap; }
.menu-toggle {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; font-size: 16px; border-radius: 5px;
  cursor: pointer; transition: background 0.2s, color 0.2s; color: var(--header-text);
}
.menu-toggle:hover { background: var(--header-hover); }
.right { display: flex; align-items: center; gap: 8px; line-height: normal; padding-right: 16px; }
.sider { background: var(--sider-bg) !important; }
.sider :deep(.ant-menu) { background: transparent !important; }
.sider :deep(.ant-menu-item:not(.ant-menu-item-selected):not(:hover)),
.sider :deep(.ant-menu-submenu-title:not(:hover)) { background: transparent !important; }
.right .theme-toggle {
  color: var(--header-text); display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; min-width: 32px; padding: 0; line-height: 1;
}
.right .theme-toggle :deep(svg) { display: block; }
.right .who {
  color: var(--header-text); font-size: 13px; cursor: pointer; display: inline-flex;
  align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; transition: background 0.2s;
}
.right .who:hover { background: var(--header-hover); }
.right .caret { font-size: 11px; opacity: 0.7; }
.mi { margin-right: 8px; }
.content { padding: 16px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; }
.sider :deep(.ant-layout-sider-children) { height: 100%; overflow-y: auto; }
</style>
