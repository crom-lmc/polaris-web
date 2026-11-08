import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { redirectToSsoLogin } from '@/api/sso'

/**
 * 路由表。
 * <p>
 * 每条业务路由带两套权限码：
 * - `meta.menu` 账号中心里的页面菜单节点（`article` / `comment` …），管「这个页面给不给你」
 * - `meta.perm` 接口权限码，与后端 `@Permit("...")` 一一对应，管「进去之后能做什么」
 * 守卫按 `perm` 放行（没接口权限进去也是白屏），侧边栏按 `menu || perm` 显示。
 */
const routes: RouteRecordRaw[] = [
  // 统一账号中心回跳：带着一次性 ticket 进来，换令牌后回到原页面
  { path: '/sso/callback', name: 'sso-callback', component: () => import('@/views/SsoCallbackView.vue'), meta: { public: true } },
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layout/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '仪表盘', menu: 'dashboard', perm: 'stat:view' } },
      { path: 'articles', name: 'articles', component: () => import('@/views/ArticlesView.vue'), meta: { title: '文章管理', menu: 'article', perm: 'article:list' } },
      { path: 'articles/edit/:id?', name: 'article-edit', component: () => import('@/views/ArticleEditView.vue'), meta: { title: '文章编辑', menu: 'article', perm: 'article:list' } },
      { path: 'categories', name: 'categories', component: () => import('@/views/CategoriesView.vue'), meta: { title: '分类管理', menu: 'category', perm: 'category:list' } },
      { path: 'tags', name: 'tags', component: () => import('@/views/TagsView.vue'), meta: { title: '标签管理', menu: 'tag', perm: 'tag:list' } },
      { path: 'comments', name: 'comments', component: () => import('@/views/CommentsView.vue'), meta: { title: '评论管理', menu: 'comment', perm: 'comment:list' } },
      { path: 'media', name: 'media', component: () => import('@/views/MediaView.vue'), meta: { title: '媒体库', menu: 'media', perm: 'media:list' } },
      { path: 'theme', name: 'theme', component: () => import('@/views/ThemeEditorView.vue'), meta: { title: '主题编辑器', menu: 'theme', perm: 'theme:list' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { title: '站点设置', menu: 'setting', perm: 'setting:view' } },
      { path: 'logs', name: 'logs', component: () => import('@/views/LogsView.vue'), meta: { title: '操作日志', menu: 'log', perm: 'log:list' } },
      // 兜底页：一个权限都没有时停在这里，避免在 dashboard 上反复重定向
      { path: 'no-access', name: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无访问权限' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
]

/** 业务页清单（不含兜底页），用于算「第一个有权限的页面」 */
const pageRoutes = routes[2].children!.filter((r) => r.name !== 'no-access')

function firstAllowedPath(auth: ReturnType<typeof useAuthStore>): string | null {
  const hit = pageRoutes.find((r) => {
    const perm = r.meta?.perm as string | undefined
    return !!perm && auth.can(perm)
  })
  return hit ? '/' + hit.path : null
}

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const auth = useAuthStore()
  const loggedIn = await auth.bootstrap()
  if (!loggedIn) {
    // 没有可用令牌：整页跳到统一登录，回来时带着 ticket
    redirectToSsoLogin()
    return false
  }

  const perm = to.meta.perm as string | undefined
  if (perm && !auth.can(perm)) {
    // 没有该页面权限：去第一个有权限的页面；一个都没有就停到 no-access。
    // 注意不能直接 return '/dashboard'——对仪表盘也无权限时会无限重定向。
    const fallback = firstAllowedPath(auth)
    if (!fallback || to.path === fallback) {
      return to.path === '/no-access' ? true : { path: '/no-access' }
    }
    return { path: fallback }
  }
  return true
})

export default router
