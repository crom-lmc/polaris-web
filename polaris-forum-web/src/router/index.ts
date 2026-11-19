import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '@/views/HomeView.vue'
import BoardView from '@/views/BoardView.vue'
import ThreadView from '@/views/ThreadView.vue'
import NewThreadView from '@/views/NewThreadView.vue'
import CallbackView from '@/views/CallbackView.vue'
import PointsView from '@/views/PointsView.vue'
import LotteryView from '@/views/LotteryView.vue'
import GiftsView from '@/views/GiftsView.vue'
import ContentFeedView from '@/views/ContentFeedView.vue'
import DraftsView from '@/views/DraftsView.vue'
import MemberView from '@/views/MemberView.vue'
import ProfileView from '@/views/ProfileView.vue'
import FavoritesView from '@/views/FavoritesView.vue'
import ProfileEditView from '@/views/ProfileEditView.vue'
import BadgesView from '@/views/BadgesView.vue'
import NotificationsView from '@/views/NotificationsView.vue'
import AboutView from '@/views/AboutView.vue'
import { authReady, clearAuth, currentUser, forumAdminOrigin, redirectToSsoLogin, refreshCurrentUser } from '@/auth'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: to => to.hash ? { el: to.hash, top: 90 } : { top: 0 },
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/feed', name: 'feed', component: ContentFeedView, meta: { kind: 'feed' } },
    { path: '/topics', name: 'topics', component: ContentFeedView, meta: { kind: 'topic' } },
    { path: '/questions', name: 'questions', component: ContentFeedView, meta: { kind: 'question' } },
    { path: '/articles', name: 'articles', component: ContentFeedView, meta: { kind: 'article' } },
    { path: '/boards/:key', name: 'board', component: BoardView },
    { path: '/threads/:id', name: 'thread', component: ThreadView },
    { path: '/new', name: 'new-thread', component: NewThreadView },
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
    { path: '/points', name: 'points', component: PointsView },
    { path: '/lottery', name: 'lottery', component: LotteryView },
    { path: '/gifts', name: 'gifts', component: GiftsView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/auth/callback', name: 'auth-callback', component: CallbackView },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async to => {
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
