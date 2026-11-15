import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { gotoAuthorize } from '@/api/cms'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layout/CmsLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '仪表盘', perm: 'dashboard:view' } },
        { path: 'articles', component: () => import('@/views/ArticleListView.vue'), meta: { title: '内容管理', perm: 'article:view' } },
        { path: 'articles/new', component: () => import('@/views/ArticleEditView.vue'), meta: { title: '新建文章', perm: 'article:create' } },
        { path: 'articles/:id/edit', component: () => import('@/views/ArticleEditView.vue'), meta: { title: '编辑文章', perm: 'article:view' } },
        { path: 'categories', component: () => import('@/views/CategoryView.vue'), meta: { title: '分类管理', perm: 'category:view' } },
        { path: 'tags', component: () => import('@/views/TagView.vue'), meta: { title: '标签管理', perm: 'tag:view' } },
        { path: 'media', component: () => import('@/views/MediaView.vue'), meta: { title: '媒体库', perm: 'media:view' } },
        { path: 'banners', component: () => import('@/views/BannerView.vue'), meta: { title: 'Banner 管理', perm: 'banner:view' } },
        { path: 'links', component: () => import('@/views/FriendLinkView.vue'), meta: { title: '友情链接', perm: 'link:view' } },
        { path: 'portal', component: () => import('@/views/PortalLayoutView.vue'), meta: { title: '门户设置', perm: 'portal:view' } },
        { path: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无权限', public: true } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 内容中心` : '内容中心'
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
