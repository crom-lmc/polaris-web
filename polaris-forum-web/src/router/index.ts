import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import BoardView from '@/views/BoardView.vue'
import ThreadView from '@/views/ThreadView.vue'
import NewThreadView from '@/views/NewThreadView.vue'
import CallbackView from '@/views/CallbackView.vue'
import PointsView from '@/views/PointsView.vue'
import LevelsView from '@/views/LevelsView.vue'
import LotteryView from '@/views/LotteryView.vue'
import GiftsView from '@/views/GiftsView.vue'
import DraftsView from '@/views/DraftsView.vue'
import MemberView from '@/views/MemberView.vue'
import ProfileView from '@/views/ProfileView.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import ProfileEditView from '@/views/ProfileEditView.vue'
import BadgesView from '@/views/BadgesView.vue'
import NotificationsView from '@/views/NotificationsView.vue'
import AboutView from '@/views/AboutView.vue'
import { authReady, clearAuth, currentUser, forumAdminOrigin, redirectToSsoLogin, refreshCurrentUser } from '@/auth'
import { featureFlags, loadFeatureSwitch } from '@/composables/useFeatureSwitch'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: to => to.hash ? { el: to.hash, top: 90 } : { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/boards/:key', name: 'board', component: BoardView },
    { path: '/threads/:id', name: 'thread', component: ThreadView },
    { path: '/new', name: 'new-thread', component: NewThreadView, meta: { requiresAuth: true } },
    { path: '/drafts', name: 'drafts', component: DraftsView, meta: { requiresAuth: true } },
    { path: '/members/:accountId', name: 'member', component: MemberView },
    { path: '/me', name: 'profile', component: ProfileView, meta: { requiresAuth: true } },
    { path: '/favorites', name: 'favorites', component: FavoritesView, meta: { requiresAuth: true } },
    { path: '/settings/profile', name: 'profile-edit', component: ProfileEditView, meta: { requiresAuth: true } },
    { path: '/badges', name: 'badges', component: BadgesView },
    { path: '/notifications', name: 'notifications', component: NotificationsView, meta: { requiresAuth: true } },
    {
      path: '/admin',
      name: 'forum-admin',
      component: HomeView,
      beforeEnter: () => {
        window.location.assign(forumAdminOrigin())
        return false
      }
    },
    { path: '/points', name: 'points', component: PointsView, meta: { requiresAuth: true } },
    { path: '/levels', name: 'levels', component: LevelsView },
    { path: '/lottery', name: 'lottery', component: LotteryView, meta: { requiresAuth: true, feature: 'lottery' } },
    { path: '/gifts', name: 'gifts', component: GiftsView, meta: { requiresAuth: true, feature: 'exchange' } },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/auth/callback', name: 'auth-callback', component: CallbackView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async to => {
  // 抽奖/兑换功能关闭时拦截直接访问（含刷新、历史记录、收藏地址），回到首页
  const feature = to.meta.feature as 'lottery' | 'exchange' | undefined
  if (feature) {
    await loadFeatureSwitch()
    const disabled = feature === 'lottery' ? !featureFlags.lotteryEnabled : !featureFlags.exchangeEnabled
    if (disabled) return '/'
  }
  if (!to.meta.requiresAuth) return true
  if (!authReady.value) await refreshCurrentUser()
  if (!currentUser.value) {
    // 需要登录的页面直接走单点，不再弹引导框；本地可能残留失效令牌，先清掉再交给 SSO 判定
    // 是静默续登还是落到统一登录页
    clearAuth()
    redirectToSsoLogin(to.fullPath)
    return false
  }
  return true
})

export default router
