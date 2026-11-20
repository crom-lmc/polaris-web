<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <menu-outlined class="menu-toggle" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse" />
        <span class="logo-text">{{ appName }}</span>
      </div>
      <div class="right">
        <a-button type="text" class="theme-toggle" :title="theme.mode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'" @click="theme.toggle()">
          <ThemeToggleIcon :mode="theme.mode" />
        </a-button>
        <a-dropdown :trigger="['hover']">
          <span class="who">{{ store.username || '未登录' }}<down-outlined class="caret" /></span>
          <template #overlay>
            <a-menu @click="onUserMenuClick">
              <a-menu-item key="logout"><logout-outlined class="menu-item-icon" />退出登录</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
    </a-layout-header>
    <a-layout class="body">
      <a-layout-sider class="sider" :theme="theme.mode" :width="208" collapsible :collapsed="collapsed" :trigger="null">
        <a-menu mode="inline" :inline-collapsed="collapsed" :selected-keys="selectedKeys" @click="handleMenuClick">
          <a-menu-item v-if="store.can('forum:overview')" key="/">
            <template #icon><dashboard-outlined /></template>概览
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:content')" key="/threads">
            <template #icon><file-text-outlined /></template>内容管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:comment')" key="/comments">
            <template #icon><comment-outlined /></template>评论管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:report')" key="/reports">
            <template #icon><flag-outlined /></template>举报管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:taxonomy')" key="/taxonomy">
            <template #icon><appstore-outlined /></template>板块与标签
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:site')" key="/site">
            <template #icon><setting-outlined /></template>站点管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:sensitive')" key="/sensitive-words">
            <template #icon><safety-certificate-outlined /></template>敏感词管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:exchange')" key="/exchanges">
            <template #icon><gift-outlined /></template>礼品发放
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:gift')" key="/gifts">
            <template #icon><shopping-outlined /></template>礼品管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:badge')" key="/badges">
            <template #icon><trophy-outlined /></template>勋章管理
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:level')" key="/levels">
            <template #icon><rise-outlined /></template>等级晋升
          </a-menu-item>
          <a-menu-item v-if="store.can('forum:lottery')" key="/lottery">
            <template #icon><aim-outlined /></template>抽奖配置
          </a-menu-item>
        </a-menu>
      </a-layout-sider>
      <a-layout-content class="content"><router-view /></a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import {
  AimOutlined,
  AppstoreOutlined,
  CommentOutlined,
  DashboardOutlined,
  DownOutlined,
  FileTextOutlined,
  FlagOutlined,
  GiftOutlined,
  LogoutOutlined,
  MenuOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TrophyOutlined
} from '@ant-design/icons-vue'
import { gotoAuthorize, logoutSso } from '@/api/forum'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'
import { useSessionGuard } from '@/composables/useSessionGuard'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { appName, resolveAppName } from '@/utils/appTitle'
import { getRefreshToken } from '@/utils/token'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const theme = useThemeStore()
const collapsed = ref(false)
const selectedKeys = computed(() => [route.path])

useSessionGuard()

onMounted(async () => {
  const code = store.me?.appCode
  if (code) await resolveAppName(code)
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

function handleMenuClick({ key }: { key: string }) {
  void router.push(key)
}

function onUserMenuClick({ key }: { key: string }) {
  if (key !== 'logout') return
  Modal.confirm({
    title: '退出登录',
    content: '退出后需要重新登录才能继续管理论坛，确定吗？',
    okText: '确定退出',
    cancelText: '取消',
    okButtonProps: { danger: true },
    centered: true,
    onOk: async () => {
      try {
        await logoutSso(getRefreshToken())
      } catch {
        // 中心登出失败时仍清理本应用令牌
      }
      store.logout()
      gotoAuthorize('/')
    }
  })
}
</script>

<style scoped>
.shell { height: 100vh; overflow: hidden; }
.body { min-height: 0; }
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  flex: 0 0 auto;
  background: var(--header-bg);
  color: var(--header-text);
  border-bottom: 1px solid var(--header-border);
}
.logo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 24px;
  font-weight: 600;
  white-space: nowrap;
  transition: padding-left 0.2s;
}
.logo.is-collapsed { padding-left: 29px; }
.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
}
.menu-toggle:hover { background: var(--header-hover); }
.right { display: flex; align-items: center; gap: 8px; padding-right: 16px; }
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  color: var(--header-text);
}
.who {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--header-text);
  font-size: 13px;
  cursor: pointer;
}
.who:hover { background: var(--header-hover); }
.caret { font-size: 11px; opacity: 0.7; }
.menu-item-icon { margin-right: 8px; }
.sider { background: var(--sider-bg) !important; }
.sider :deep(.ant-menu) { background: transparent !important; }
.sider :deep(.ant-menu-item:not(.ant-menu-item-selected):not(:hover)) { background: transparent !important; }
.sider :deep(.ant-layout-sider-children) { height: 100%; overflow-y: auto; }
.content {
  padding: 16px;
  overflow-y: hidden;
  overflow-x: hidden;
  /* 让页面根节点（.admin-page）撑满可视高度，滚动只发生在表格容器内 */
  display: flex;
  flex-direction: column;
}
@media (max-width: 640px) {
  .content { padding: 12px; }
  .logo { padding-left: 14px; }
  .logo.is-collapsed { padding-left: 20px; }
  .logo-text { font-size: 13px; }
  .right { padding-right: 8px; }
}
</style>
