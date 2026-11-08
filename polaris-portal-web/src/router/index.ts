import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { IS_PREVIEW } from '@/api/portal'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: () => import('@/views/HomeView.vue'), meta: { title: '首页' } },
    { path: '/article/:id', component: () => import('@/views/ArticleView.vue'), meta: { title: '文章详情' } },
    { path: '/list', component: () => import('@/views/ArticleListView.vue'), meta: { title: '内容列表' } },
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true, title: '登录中' } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ],
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 内容门户` : '内容门户'
  // 后台嵌入的布局预览：只渲染首页，任何跳转都拦下来，避免跑出预览框
  if (IS_PREVIEW) return to.path === '/' ? true : false
  // 门户大多页面公开；仅在进入时静默尝试恢复登录态（不强制）
  const store = useUserStore()
  if (!store.ready) {
    store.bootstrap().catch(() => {})
  }
  return true
})

export default router
