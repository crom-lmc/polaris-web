import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { gotoAuthorize } from '@/api/openapi'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layout/OpenapiLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '概览', perm: 'openapi:dashboard' } },
        { path: 'endpoints', component: () => import('@/views/EndpointView.vue'), meta: { title: 'API 管理', perm: 'openapi:endpoint' } },
        { path: 'apps', component: () => import('@/views/AppView.vue'), meta: { title: '对接应用', perm: 'openapi:app' } },
        { path: 'channels', component: () => import('@/views/ChannelView.vue'), meta: { title: '出站渠道', perm: 'openapi:channel' } },
        { path: 'logs', component: () => import('@/views/LogView.vue'), meta: { title: '调用日志', perm: 'openapi:log' } },
        { path: 'stats', component: () => import('@/views/StatView.vue'), meta: { title: '统计报表', perm: 'openapi:stat' } },
        { path: 'settings', component: () => import('@/views/SettingView.vue'), meta: { title: '平台设置', perm: 'openapi:setting' } },
        { path: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无权限', public: true } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 接口开放平台` : '接口开放平台'
  if (to.meta.public) return true
  const store = useUserStore()
  const loggedIn = await store.bootstrap()
  if (!loggedIn) {
    gotoAuthorize(to.fullPath)
    return false
  }
  if (to.meta.perm && !store.can(to.meta.perm as string)) {
    return '/no-access'
  }
  return true
})

export default router
