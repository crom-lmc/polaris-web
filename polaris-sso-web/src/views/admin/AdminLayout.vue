<template>
  <a-layout class="shell">
    <a-layout-header class="header">
      <div class="logo" :class="{ 'is-collapsed': collapsed }">
        <!-- 汉堡菜单图标：点击折叠/展开侧栏，替代底部原生触发器 -->
        <menu-outlined class="menu-toggle" :title="collapsed ? '展开菜单' : '收起菜单'" @click="toggleCollapse" />
        <span class="logo-text">统一账号中心</span>
      </div>
      <div class="right">
        <a-popover
          v-model:open="noticeOpen"
          trigger="click"
          placement="bottomRight"
          :overlay-style="{ width: '380px' }"
        >
          <template #content>
            <div class="notice-pop">
              <div class="notice-head">
                <span class="notice-head-title">未读消息</span>
                <a-button type="link" size="small" :disabled="!unreadCount" @click="readAll">全部已读</a-button>
              </div>
              <a-spin :spinning="noticeLoading">
                <div v-if="notices.length" class="notice-list">
                  <div v-for="m in notices" :key="m.id" class="notice-item" @click="openNotice(m)">
                    <div class="notice-title">
                      <a-tag v-if="m.kind === 1" color="blue" class="notice-tag">待办</a-tag>
                      <span class="notice-title-text">{{ m.title }}</span>
                    </div>
                    <div v-if="m.content" class="notice-content">{{ m.content }}</div>
                    <div class="notice-time">{{ m.createdAt }}</div>
                  </div>
                </div>
                <a-empty v-else :image-style="{ height: '48px' }" description="暂无未读消息" />
              </a-spin>
            </div>
          </template>
          <a-badge :count="unreadCount" :offset="[-2, 2]" size="small">
            <bell-outlined class="notice-bell" :title="unreadCount ? `${unreadCount} 条未读` : '消息'" />
          </a-badge>
        </a-popover>
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
        <a-menu
          mode="inline"
          :inline-collapsed="collapsed"
          :selected-keys="selectedKeys"
          @click="handleMenuClick"
        >
          <a-menu-item key="dashboard">
            <template #icon><dashboard-outlined /></template>
            概览
          </a-menu-item>
          <a-menu-item v-if="store.can('my-apps')" key="my-apps">
            <template #icon><appstore-outlined /></template>
            我的应用
          </a-menu-item>
          <a-menu-item key="approvals">
            <template #icon><carry-out-outlined /></template>
            审批中心
          </a-menu-item>
          <a-menu-item key="messages">
            <template #icon><message-outlined /></template>
            待办提醒
          </a-menu-item>
          <a-menu-item key="notices">
            <template #icon><notification-outlined /></template>
            通知中心
          </a-menu-item>
          <a-menu-item v-if="store.can('account:list')" key="accounts">
            <template #icon><user-outlined /></template>
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
  MessageOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { Modal } from 'ant-design-vue'
import { logout } from '@/api/auth'
import {
  fetchMyNotices,
  fetchUnreadNoticeCount,
  markAllNoticesRead,
  markNoticesRead,
  type NoticeMessage
} from '@/api/notice'
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
const notices = ref<NoticeMessage[]>([])
const noticeOpen = ref(false)
const noticeLoading = ref(false)
let noticeTimer: number | undefined

// 未读数轮询：审批被通过/驳回时由 settings 落消息，这里只负责把数字刷新出来
onMounted(() => {
  refreshUnread()
  noticeTimer = window.setInterval(refreshUnread, 60000)
})

onUnmounted(() => {
  if (noticeTimer) window.clearInterval(noticeTimer)
})

// 打开面板时才拉未读列表，避免每次进后台都多打一次接口
watch(noticeOpen, (open) => {
  if (open) loadNotices()
})

async function refreshUnread() {
  try {
    const res = await fetchUnreadNoticeCount()
    unreadCount.value = res.data ?? 0
  } catch {
    /* 消息接口异常不影响主界面使用 */
  }
}

async function loadNotices() {
  noticeLoading.value = true
  try {
    const res = await fetchMyNotices({ unreadOnly: true, limit: 20 })
    notices.value = res.data ?? []
  } catch {
    notices.value = []
  } finally {
    noticeLoading.value = false
  }
}

/** 点开即已读；有路由则跳过去（如审批中心） */
async function openNotice(m: NoticeMessage) {
  try {
    await markNoticesRead([m.id])
  } catch {
    /* 已读失败不影响跳转，下次打开仍会显示 */
  }
  notices.value = notices.value.filter((x) => x.id !== m.id)
  unreadCount.value = Math.max(0, unreadCount.value - 1)
  noticeOpen.value = false
  if (m.link && m.link !== route.path) {
    router.push(m.link)
  }
}

async function readAll() {
  try {
    await markAllNoticesRead()
    notices.value = []
    unreadCount.value = 0
  } catch {
    /* 失败时保持原样，用户可重试 */
  }
}

const selectedKeys = computed(() => [route.name as string])

async function handleLogout() {
  try {
    await logout(getRefreshToken())
  } catch {
    // 网络异常也要让本地退出
  } finally {
    store.clear()
    // 硬跳转：绕过 Vue Router 内部状态残留，确保登录页干净挂载
    window.location.replace('/login?gl=1')
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
  /* 覆盖 Ant Design 默认 64px 行高，让顶栏 Flex 垂直居中生效 */
  line-height: 1;
}

.logo {
  display: flex;
  align-items: center;
  /* 24(左缩进) + 22(汉堡) + 6 = 52，与侧栏菜单文字列(24+图标14+span距10=52)严格对齐 */
  gap: 6px;
  /* 与下方菜单项图标列对齐（菜单项左内边距统一覆盖为 24px） */
  padding-left: 24px;
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
  line-height: normal;
  /* header 已清零内边距，这里给右侧控件留出呼吸空间，避免贴边 */
  padding-right: 16px;
}

/* 右上角消息铃铛 */
.notice-bell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  font-size: 17px;
  color: var(--header-text);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.notice-bell:hover {
  background: var(--header-hover);
}

.notice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--header-border);
}

.notice-head-title {
  font-weight: 600;
  font-size: 13px;
}

.notice-list {
  max-height: 360px;
  overflow-y: auto;
}

.notice-item {
  padding: 10px 4px;
  border-bottom: 1px dashed var(--header-border);
  cursor: pointer;
}

.notice-item:hover {
  background: var(--header-hover);
}

.notice-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
}

.notice-title-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notice-tag {
  margin-right: 2px;
}

.notice-content {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted, #8c8c8c);
}

.notice-time {
  margin-top: 2px;
  font-size: 11px;
  color: var(--muted, #8c8c8c);
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
  /* SVG 默认按文本基线排版，用 flex 让图标在 32px 按钮内精确居中 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  min-width: 32px;
  padding: 0;
  line-height: 1;
}

.right .theme-toggle :deep(svg) {
  display: block;
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
