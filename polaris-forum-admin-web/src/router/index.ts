import { createRouter, createWebHistory } from 'vue-router'
import { gotoAuthorize } from '@/api/forum'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layout/CmsLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/views/HomeRedirectView.vue'), meta: { title: '论坛管理' } },
        { path: 'threads', component: () => import('@/views/ThreadsView.vue'), meta: { title: '内容管理', perm: 'forum:content' } },
        { path: 'comments', component: () => import('@/views/CommentsView.vue'), meta: { title: '评论管理', perm: 'forum:content' } },
        { path: 'reports', component: () => import('@/views/ReportsView.vue'), meta: { title: '举报管理', perm: 'forum:report' } },
        { path: 'taxonomy', component: () => import('@/views/TaxonomyView.vue'), meta: { title: '板块与标签', perm: 'forum:taxonomy' } },
        { path: 'site', component: () => import('@/views/SiteView.vue'), meta: { title: '站点管理', perm: 'forum:site' } },
        { path: 'sensitive-words', component: () => import('@/views/SensitiveWordsView.vue'), meta: { title: '敏感词管理', perm: 'forum:sensitive' } },
        { path: 'exchanges', component: () => import('@/views/ExchangesView.vue'), meta: { title: '礼品发放', perm: 'forum:exchange' } },
        { path: 'badges', component: () => import('@/views/BadgesView.vue'), meta: { title: '勋章管理', perm: 'forum:badge' } },
        { path: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无权限' } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 论坛管理端` : '论坛管理端'
  if (to.meta.public) return true
  const store = useUserStore()
  if (!(await store.bootstrap())) {
    gotoAuthorize(to.fullPath)
    return false
  }
  if (to.meta.perm && !store.can(to.meta.perm as string)) return '/no-access'
  return true
})

export default router
