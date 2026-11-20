<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" aria-label="Polaris 社区首页">
        <img class="brand-mark" src="/favicon.svg" alt="" aria-hidden="true" /><span class="brand-copy"><b>Polaris</b></span>
      </RouterLink>

      <nav class="main-nav" aria-label="主导航">
        <RouterLink to="/" :class="{ active: !activeBoard }">最新</RouterLink>
        <div v-for="board in boards" :key="board.key" class="category-item" @mouseenter="openKey = board.key" @mouseleave="openKey = ''">
          <RouterLink :to="`/?board=${board.key}`" :class="{ active: activeBoard === board.key }">{{ board.name }}<span class="category-caret">▾</span></RouterLink>
          <div v-if="board.children?.length && openKey === board.key" class="category-submenu" @mouseenter="openKey = board.key">
            <button v-for="child in board.children" :key="child.key" type="button" :class="{ active: activeBoard === board.key && activeTag === child.name }" @click="selectTag(board.key, child.name)">{{ child.name }}</button>
          </div>
        </div>
      </nav>

      <div class="header-actions">
        <form class="header-search" role="search" @submit.prevent="search">
          <search-outlined /><input v-model.trim="keyword" aria-label="搜索帖子" placeholder="搜索帖子、用户…" />
        </form>
        <div class="header-tools" :class="{ 'header-tools--guest': !currentUser }">
          <button class="header-icon-button" :aria-label="isDark ? '切换为浅色模式' : '切换为深色模式'" :title="isDark ? '浅色模式' : '深色模式'" @click="toggleTheme">
            <bulb-filled v-if="isDark" /><bulb-outlined v-else />
          </button>
          <div ref="publishMenu" class="publish-menu">
            <!-- 未登录点「发布」直接走单点：下拉里的内容都要登录才能用，先展开再被踢走反而多一次点击 -->
            <button class="header-icon-button create-button" title="发布内容" aria-label="发布内容" @click.stop="openPublishMenu"><svg class="create-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg></button>
            <div v-if="publishOpen" class="publish-dropdown">
              <RouterLink to="/new" @click="publishOpen = false"><edit-outlined /><span><b>发帖子</b><small>分享想法、经验与故事</small></span></RouterLink>
              <RouterLink v-if="currentUser" to="/drafts" @click="publishOpen = false"><save-outlined /><span><b>我的草稿</b><small>恢复服务端保存的内容</small></span></RouterLink>
            </div>
          </div>
          <template v-if="currentUser">
            <RouterLink to="/notifications" class="header-icon-button notification-link" aria-label="论坛消息">
              <bell-outlined /><span v-if="unreadCount" class="unread-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            </RouterLink>
            <div ref="userMenu" class="user-menu">
              <button class="user-menu-trigger" @click.stop="userOpen = !userOpen">
                <UserAvatar :name="displayName" :avatar-url="headerAvatar" :size="30" />
                <span class="header-user-name">{{ displayName }}</span><down-outlined />
              </button>
              <div v-if="userOpen" class="user-dropdown">
                <RouterLink to="/me" @click="userOpen = false"><user-outlined />个人中心</RouterLink>
                <RouterLink to="/points" @click="userOpen = false"><thunderbolt-outlined />我的任务</RouterLink>
                <RouterLink to="/favorites" @click="userOpen = false"><heart-outlined />我的收藏</RouterLink>
                <RouterLink to="/settings/profile" @click="userOpen = false"><idcard-outlined />个人资料</RouterLink>
                <RouterLink to="/badges" @click="userOpen = false"><trophy-outlined />勋章墙</RouterLink>
                <button @click="handleLogout"><logout-outlined />退出登录</button>
              </div>
            </div>
          </template>
          <button v-else class="login-button" @click="requireLogin('参与社区讨论')"><user-outlined />统一登录</button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { BellOutlined, BulbFilled, BulbOutlined, DownOutlined, EditOutlined, HeartOutlined, IdcardOutlined, LogoutOutlined, SaveOutlined, SearchOutlined, ThunderboltOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { fetchBoards } from '@/api/forum'
import { currentUser, isLoggedIn, logout, refreshUnreadCount, requireLogin, unreadCount } from '@/auth'
import { isDark, toggleTheme } from '@/theme'
import type { Board } from '@/types'

const keyword = ref('')
const publishOpen = ref(false)
const userOpen = ref(false)
const publishMenu = ref<HTMLElement>()
const userMenu = ref<HTMLElement>()
const router = useRouter()
const route = useRoute()
const boards = ref<Board[]>([])
const openKey = ref('')
const activeBoard = computed(() => String(route.query.board || ''))
const activeTag = computed(() => String(route.query.q || ''))
const displayName = computed(() => currentUser.value?.member?.displayName || currentUser.value?.member?.nickname || currentUser.value?.username || '')
const headerAvatar = computed(() => currentUser.value?.member?.avatarUrl || (currentUser.value?.member?.avatarAttachmentId ? `/api/forum/public/attachments/${currentUser.value.member.avatarAttachmentId}` : ''))
function search() {
  router.push({ path: '/', query: keyword.value ? { q: keyword.value } : {} })
}
/** 顶部导航二级标签：回到首页并按一级分类 + 标签筛选 */
function selectTag(board: string, tag: string) {
  openKey.value = ''
  router.push({ path: '/', query: { board, q: tag } })
}
/** 未登录时不展开下拉，直接把人送去统一登录 */
function openPublishMenu() {
  if (!isLoggedIn.value) {
    publishOpen.value = false
    requireLogin('发布内容')
    return
  }
  publishOpen.value = !publishOpen.value
}
async function handleLogout() {
  userOpen.value = false
  await logout()
  if (router.currentRoute.value.meta.requiresAuth) router.push('/')
}
function closeMenus(event: MouseEvent) {
  if (!publishMenu.value?.contains(event.target as Node)) publishOpen.value = false
  if (!userMenu.value?.contains(event.target as Node)) userOpen.value = false
}
watch(isLoggedIn, logged => {
  if (logged) refreshUnreadCount()
  else unreadCount.value = 0
}, { immediate: true })
onMounted(async () => {
  document.addEventListener('click', closeMenus)
  // 顶部导航的一级分类由后台板块配置维护，与首页分类栏同源
  try {
    boards.value = await fetchBoards()
  } catch {
    boards.value = []
  }
})
onUnmounted(() => document.removeEventListener('click', closeMenus))
</script>
