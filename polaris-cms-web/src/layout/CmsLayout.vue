<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <menu-outlined class="menu-toggle" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse" />
        <span class="logo-text">内容中心</span>
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
          <a-menu-item v-if="store.can('dashboard:view')" key="/dashboard">
            <template #icon><dashboard-outlined /></template>
            概览
          </a-menu-item>
          <a-menu-item v-if="store.can('article:view')" key="/articles">
            <template #icon><file-text-outlined /></template>
            内容管理
          </a-menu-item>
          <a-menu-item v-if="store.can('category:view')" key="/categories">
            <template #icon><folder-outlined /></template>
            分类管理
          </a-menu-item>
          <a-menu-item v-if="store.can('tag:view')" key="/tags">
            <template #icon><tags-outlined /></template>
            标签管理
          </a-menu-item>
          <a-menu-item v-if="store.can('media:view')" key="/media">
            <template #icon><picture-outlined /></template>
            媒体库
          </a-menu-item>
          <a-menu-item v-if="store.can('banner:view')" key="/banners">
            <template #icon><flag-outlined /></template>
            Banner 管理
          </a-menu-item>
          <a-menu-item v-if="store.can('link:view')" key="/links">
            <template #icon><link-outlined /></template>
            友情链接
          </a-menu-item>
          <a-menu-item v-if="store.can('portal:view')" key="/portal">
            <template #icon><global-outlined /></template>
            门户设置
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
  DashboardOutlined,
  DownOutlined,
  FileTextOutlined,
  FlagOutlined,
  FolderOutlined,
  GlobalOutlined,
  LinkOutlined,
  LogoutOutlined,
  MenuOutlined,
  PictureOutlined,
  TagsOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { Modal } from 'ant-design-vue'
import { SSO_AUTHORIZE_URL, logoutSso } from '@/api/cms'
import { getRefreshToken } from '@/utils/token'
import { useSessionGuard } from '@/composables/useSessionGuard'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'

const router = useRouter()
const route = useRoute()
const store = useUserStore()

// 别处登出后，本页要能自己发现（静置页面不发请求，全靠这个心跳）
useSessionGuard()
const theme = useThemeStore()

const collapsed = ref(false)

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
      content: '退出后需要重新登录才能继续管理内容，确定吗？',
      okText: '确定退出',
      cancelText: '取消',
      okButtonProps: { danger: true },
      centered: true,
      onOk: async () => {
        // 先作废中心会话（连带其它应用令牌）再清本地；网络异常也要继续，别把人卡在登录态
        try {
          await logoutSso(getRefreshToken())
        } catch {
          /* 忽略：本地照样退出 */
        }
        store.logout()
        // 回到登录页而不是重新授权，避免账号中心凭残余登录态静默签码、立刻登回来
        window.location.replace(`${SSO_AUTHORIZE_URL}/login?gl=1`)
      }
    })
  }
}
</script>

<style scoped>
/* 整页固定：顶栏 + 侧栏不动，只有内容区自己滚动 */
.shell {
  height: 100vh;
  overflow: hidden;
}

.body {
  min-height: 0;
}

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
  color: var(--header-text);
  font-weight: 600;
  font-size: 14px;
  /* 系统名常驻：不随侧栏折叠收窄，也不做宽度裁切 */
  flex: 0 0 auto;
  white-space: nowrap;
  transition: padding-left 0.2s;
}

/* 折叠态：汉堡图标落在 80px 图标列的中线上（40px），系统名照常显示在其右侧 */
.logo.is-collapsed {
  padding-left: 29px;
}

.logo-text {
  white-space: nowrap;
}

.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  font-size: 16px;
  border-radius: 5px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  color: var(--header-text);
}

.menu-toggle:hover {
  background: var(--header-hover);
}

.right {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 16px;
}

.sider :deep(.ant-menu-inline.ant-menu-root:not(.ant-menu-inline-collapsed) > .ant-menu-item),
.sider :deep(.ant-menu-inline.ant-menu-root:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title) {
  padding-inline-start: 24px;
}

.sider :deep(.ant-menu) {
  background: transparent !important;
}

.sider {
  background: var(--sider-bg) !important;
}

.sider :deep(.ant-menu-item:not(.ant-menu-item-selected):not(:hover)),
.sider :deep(.ant-menu-submenu-title:not(:hover)) {
  background: transparent !important;
}

.right .theme-toggle {
  color: var(--header-text);
}

.right .who {
  color: var(--header-text);
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.right .who:hover {
  background: var(--header-hover);
}

.right .caret {
  font-size: 11px;
  opacity: 0.7;
}

.mi {
  margin-right: 8px;
}

.content {
  /* 原 margin:16px 改成 padding：滚动条贴内容区边缘，页面整体不跟着滚 */
  padding: 16px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 侧栏自身占满剩余高度，菜单过长时侧栏内部滚动，不推动页面 */
.sider :deep(.ant-layout-sider-children) {
  height: 100%;
  overflow-y: auto;
}
</style>
