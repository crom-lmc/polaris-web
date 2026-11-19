<template>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand" aria-label="Polaris Forum 首页">
        <img class="brand-mark" src="/favicon.svg" alt="" aria-hidden="true" /><span class="brand-copy"><b>Polaris</b><small>FORUM</small></span>
      </RouterLink>

      <nav class="main-nav" aria-label="主导航">
        <RouterLink to="/feed">动态</RouterLink>
        <RouterLink to="/topics">话题</RouterLink>
        <RouterLink to="/questions">问答</RouterLink>
        <RouterLink to="/articles">文章</RouterLink>
        <RouterLink to="/points">任务</RouterLink>
      </nav>

      <div class="header-actions">
        <form class="header-search" role="search" @submit.prevent="search">
          <search-outlined /><input v-model.trim="keyword" aria-label="搜索帖子" placeholder="搜索帖子、文章、用户…" />
        </form>
        <button class="header-icon-button" :aria-label="isDark ? '切换为浅色模式' : '切换为深色模式'" :title="isDark ? '浅色模式' : '深色模式'" @click="toggleTheme">
          <bulb-filled v-if="isDark" /><bulb-outlined v-else />
        </button>
        <div ref="publishMenu" class="publish-menu">
          <!-- 未登录点「发布」直接走单点：下拉里的内容都要登录才能用，先展开再被踢走反而多一次点击 -->
          <button class="primary-button create-button" @click.stop="openPublishMenu"><plus-outlined />发布<down-outlined /></button>
          <div v-if="publishOpen" class="publish-dropdown">
            <RouterLink to="/new?type=feed" @click="publishOpen = false"><comment-outlined /><span><b>动态</b><small>分享此刻的想法</small></span></RouterLink>
            <RouterLink to="/new?type=topic" @click="publishOpen = false"><message-outlined /><span><b>话题</b><small>发起社区讨论</small></span></RouterLink>
            <RouterLink to="/new?type=question" @click="publishOpen = false"><question-circle-outlined /><span><b>问答</b><small>提问并设置悬赏</small></span></RouterLink>
            <RouterLink to="/new?type=article" @click="publishOpen = false"><file-text-outlined /><span><b>文章</b><small>沉淀完整的内容</small></span></RouterLink>
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
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BellOutlined, BulbFilled, BulbOutlined, CommentOutlined, DownOutlined, FileTextOutlined, HeartOutlined, IdcardOutlined, LogoutOutlined, MessageOutlined, PlusOutlined, QuestionCircleOutlined, SaveOutlined, SearchOutlined, TrophyOutlined, UserOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { currentUser, isLoggedIn, logout, refreshUnreadCount, requireLogin, unreadCount } from '@/auth'
import { isDark, toggleTheme } from '@/theme'

const keyword = ref('')
const publishOpen = ref(false)
const userOpen = ref(false)
const publishMenu = ref<HTMLElement>()
const userMenu = ref<HTMLElement>()
const router = useRouter()
const displayName = computed(() => currentUser.value?.member?.displayName || currentUser.value?.member?.nickname || currentUser.value?.username || '')
const headerAvatar = computed(() => currentUser.value?.member?.avatarUrl || (currentUser.value?.member?.avatarAttachmentId ? `/api/forum/public/attachments/${currentUser.value.member.avatarAttachmentId}` : ''))
function search() {
  router.push({ path: '/', query: keyword.value ? { q: keyword.value } : {} })
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
onMounted(() => document.addEventListener('click', closeMenus))
onUnmounted(() => document.removeEventListener('click', closeMenus))
</script>
