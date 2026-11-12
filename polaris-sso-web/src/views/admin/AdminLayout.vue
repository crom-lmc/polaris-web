<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <!-- 汉堡菜单图标：点击折叠/展开侧栏，替代底部原生触发器 -->
        <menu-outlined class="menu-toggle" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse" />
        <span class="logo-text">统一账号中心</span>
      </div>
      <div class="right">
        <!-- 待办提醒入口：进消息中心（左侧业务类型树 + 右侧待办/消息列表）。
             不用 a-badge：antd-vue 4.2 + Vue 3.5 下 Badge 更新会触发 _isTeleport 报错，这里手写角标。 -->
        <span
          v-if="store.can('messages:view')"
          class="notice-entry"
          :title="unreadCount ? `${unreadCount} 条未读` : '待办提醒'"
          @click="goMessages"
        >
          <bell-outlined class="notice-bell" />
          <span v-if="unreadCount" class="notice-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </span>
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
            {{ store.user?.nickname || store.user?.username || '未登录' }}
            <down-outlined class="caret" />
          </span>
          <template #overlay>
            <a-menu @click="onUserMenuClick">
              <a-menu-item key="profile">
                <user-outlined class="mi" />个人信息
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="password">
                <lock-outlined class="mi" />修改密码
              </a-menu-item>
              <a-menu-divider />
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
          <a-menu-item key="dashboard">
            <template #icon><dashboard-outlined /></template>
            概览
          </a-menu-item>
          <!-- 审批中心是基本权限：所有角色默认授予 approval:todo -->
          <a-menu-item v-if="store.can('approval:todo')" key="approvals">
            <template #icon><carry-out-outlined /></template>
            审批中心
          </a-menu-item>
          <!-- 待办提醒/消息中心：员工基本功能，权限码 messages 默认授予 EMPLOYEE_SELF -->
          <a-menu-item v-if="store.can('messages')" key="messages">
            <template #icon><bell-outlined /></template>
            待办提醒
          </a-menu-item>
          <!-- 通知中心：人力中心发布的内部通知，员工基本功能，权限码 notice 默认授予 EMPLOYEE_SELF -->
          <a-menu-item v-if="store.can('notice')" key="notices">
            <template #icon><notification-outlined /></template>
            通知中心
          </a-menu-item>
          <!-- 菜单按权限码显隐：没有该权限的人看不到入口，后端同样会 403，双保险 -->
          <a-menu-item v-if="store.can('account:list')" key="accounts">
            <template #icon><team-outlined /></template>
            账户管理
          </a-menu-item>
          <a-menu-item v-if="store.can('role:list')" key="roles">
            <template #icon><safety-certificate-outlined /></template>
            角色管理
          </a-menu-item>
          <a-menu-item v-if="store.can('permission:list')" key="permissions">
            <template #icon><key-outlined /></template>
            权限管理
          </a-menu-item>
          <a-menu-item v-if="store.can('app:list')" key="apps">
            <template #icon><appstore-outlined /></template>
            应用管理
          </a-menu-item>
          <a-menu-item v-if="store.can('account:log:view')" key="logs">
            <template #icon><audit-outlined /></template>
            登录日志
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  CarryOutOutlined,
  DashboardOutlined,
  DownOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { Modal } from 'ant-design-vue'
import { logout } from '@/api/auth'
import { fetchApprovals } from '@/api/approvals'
import { fetchUnreadNoticeCount } from '@/api/notice'
import { getRefreshToken } from '@/utils/token'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const theme = useThemeStore()

// 侧栏可折叠：由顶栏汉堡图标点击切换（底部原生触发器已置 null 隐藏）
const collapsed = ref(false)

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

/* ---------------- 右上角消息 ---------------- */

const unreadCount = ref(0)
let noticeTimer: number | undefined

// 角标 = 待办数 + 未读消息数，60s 轮询；两路互不拖累，一路失败用另一路
onMounted(() => {
  refreshUnread()
  noticeTimer = window.setInterval(refreshUnread, 60000)
})

onUnmounted(() => {
  if (noticeTimer) window.clearInterval(noticeTimer)
})

// 在消息中心读过之后返回，角标要立刻跟着变，不等下一次轮询
watch(
  () => route.fullPath,
  () => refreshUnread()
)

async function refreshUnread() {
  const [noticeRes, pendingRes] = await Promise.all([
    fetchUnreadNoticeCount().catch(() => null),
    fetchApprovals('pending').catch(() => null)
  ])
  const noticeUnread = noticeRes ? Number(noticeRes.data) || 0 : 0
  const pendingCount = pendingRes?.data?.length || 0
  unreadCount.value = noticeUnread + pendingCount
}

function goMessages() {
  if (route.name !== 'messages') {
    router.push('/messages')
  }
}

const selectedKeys = computed(() => [route.name as string])

async function handleLogout() {
  try {
    // 带上 refreshToken：一并拉黑，避免退出后旧 refresh 还能换新 access
    await logout(getRefreshToken())
  } catch {
    // 网络异常也要让本地退出，否则用户会卡在"看起来已登录"的状态
  } finally {
    store.clear()
    // 走全局登出：带 gl=1，让 /login 连本地令牌一起清掉并强制显示登录框，
    // 避免中心会话（SSO_SID）万一没被销毁时凭 cookie 静默重登回控制台
    router.replace('/login?gl=1')
  }
}

function handleMenuClick({ key }: { key: string }) {
  router.push({ name: key })
}

/** 右上角 hover 下拉：修改密码 / 个人信息 / 退出登录 */
function onUserMenuClick({ key }: { key: string }) {
  if (key === 'logout') {
    confirmLogout()
  } else {
    router.push({ name: key })
  }
}

/** 退出前二次确认，避免误点直接登出 */
function confirmLogout() {
  Modal.confirm({
    title: '退出登录',
    content: '退出后需要重新登录统一账号中心，确定吗？',
    okText: '确定退出',
    cancelText: '取消',
    okButtonProps: { danger: true },
    centered: true,
    onOk: () => handleLogout()
  })
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
  /* 覆盖 a-layout-header 默认的 padding: 0 50px，否则 logo 会被右推 50px 与下方菜单错位 */
  padding: 0;
  flex: 0 0 auto;
  background: var(--header-bg);
  color: var(--header-text);
  border-bottom: 1px solid var(--header-border);
}

.logo {
  display: flex;
  align-items: center;
  /* 24(左缩进) + 22(汉堡) + 6 = 52，与侧栏菜单文字列(24+图标14+span距10=52)严格对齐 */
  gap: 6px;
  /* 与下方菜单项图标列对齐（菜单项左内边距统一覆盖为 24px） */
  padding-left: 24px;
  height: 32px;
  color: var(--header-text);
  font-weight: 600;
  /* 与侧栏菜单文字字号统一为 14px */
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
  /* 与侧栏菜单图标（14px 量级）一致的大小，点击折叠/展开侧栏 */
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
  /* header 已清零内边距，这里给右侧控件留出呼吸空间，避免贴边 */
  padding-right: 16px;
}

.notice-entry {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.notice-entry:hover {
  background: var(--header-hover);
}

.notice-count {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  font-size: 10px;
  line-height: 15px;
  text-align: center;
  color: #fff;
  background: #ff4d4f;
  border-radius: 8px;
  white-space: nowrap;
}

.notice-bell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: var(--header-text);
}

/* 让菜单项（含图标列）与顶部 logo 左缩进严格对齐；折叠态（图标列）不应用，避免图标被顶歪 */
.sider :deep(.ant-menu-inline.ant-menu-root:not(.ant-menu-inline-collapsed) > .ant-menu-item),
.sider :deep(.ant-menu-inline.ant-menu-root:not(.ant-menu-inline-collapsed) > .ant-menu-submenu > .ant-menu-submenu-title) {
  padding-inline-start: 24px;
}

/* 菜单背景透明，直接继承侧栏底色，消除菜单区与下方空白区两段色拼接 */
.sider :deep(.ant-menu) {
  background: transparent !important;
}

/* antd-vue 4.2.6 深色 Layout/Menu 的 siderBg/darkItemBg 等 token 不生效
   （Layout 样式实际读 colorBgHeader，深色 itemBg 是 #131629），
   这里用 CSS 变量直接钉死：sider 同顶栏底色，非选中菜单项透明让底色透出；
   排除 :hover 与选中项，保留 hover 高亮和品牌蓝选中态 */
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
  justify-content: center;
  gap: 4px;
  height: 32px;
  padding: 0 10px;
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

/* 下拉菜单项：图标与文字留出间隔（浮层虽传送渲染，元素仍带本组件 scoped 属性） */
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
