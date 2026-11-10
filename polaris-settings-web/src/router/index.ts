import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { gotoAuthorize } from '@/api/settings'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layout/SettingsLayout.vue'),
      children: [
        { path: '', redirect: '/dicts' },
        { path: 'dicts', component: () => import('@/views/DictView.vue'), meta: { title: '字典管理', perm: 'dict:view' } },
        { path: 'biz-data', redirect: '/biz-data/bank' },
        { path: 'biz-data/:type', component: () => import('@/views/BizDataView.vue'), meta: { title: '主数据', perm: 'biz:view' } },
        { path: 'approvals', component: () => import('@/views/ApprovalView.vue'), meta: { title: '审批模板', perm: 'approval:template' } },
        { path: 'approval-scenes', component: () => import('@/views/ApprovalSceneView.vue'), meta: { title: '业务场景', perm: 'approval:scene' } },
        { path: 'biz-points', component: () => import('@/views/BizPointView.vue'), meta: { title: '业务点配置', perm: 'approval:bizpoint' } },
        { path: 'security', component: () => import('@/views/SecurityView.vue'), meta: { title: '安全配置', perm: 'security:view' } },
        { path: 'notices', component: () => import('@/views/NoticeConfigView.vue'), meta: { title: '消息配置', perm: 'notice:view' } },
        { path: 'embed-points', component: () => import('@/views/EmbedPointView.vue'), meta: { title: '埋点管理', perm: 'embed:view' } },
        { path: 'code-rules', component: () => import('@/views/CodeRuleView.vue'), meta: { title: '单号规则', perm: 'code:view' } },
        { path: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无权限', public: true } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dicts' }
  ]
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 配置中心` : '配置中心'
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
