import { createRouter, createWebHistory } from 'vue-router'
import LoginView from '@/views/LoginView.vue'
import AdminLayout from '@/views/admin/AdminLayout.vue'
import { useUserStore } from '@/stores/user'

/**
 * 路由表。
 * <p>
 * meta.perm 声明进入该页面所需的权限码——与后端 @Permit 的码一一对应。
 * 菜单是否显示、守卫是否放行都读这里，避免前后端两套硬编码走偏。
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView,
      meta: { title: '登录', public: true }
    },
    {
      // OAuth2 /authorize 落点：守卫保证已登录（未登录自动带 redirect 跳登录页），
      // 页面自身只负责静默签码并跳回应用
      path: '/authorize',
      name: 'authorize',
      component: () => import('@/views/AuthorizeView.vue'),
      meta: { title: '授权跳转' }
    },
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/admin/DashboardView.vue'),
          meta: { title: '概览' }
        },
        {
          path: 'approvals',
          name: 'approvals',
          component: () => import('@/views/admin/ApprovalListView.vue'),
          // 审批中心是基本权限：所有角色默认授予 approval:todo，缺少该码才会被拦截
          meta: { title: '审批中心', perm: 'approval:todo' }
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('@/views/admin/NoticeCenterView.vue'),
          // 待办/消息是员工基本能力：权限码 messages:view，默认授权给 EMPLOYEE_SELF
          meta: { title: '待办提醒', perm: 'messages:view' }
        },
        {
          path: 'notices',
          name: 'notices',
          component: () => import('@/views/admin/NotificationCenterView.vue'),
          // 通知中心：展示人力中心发布的内部通知，权限码 notice:view，默认授权给 EMPLOYEE_SELF
          meta: { title: '通知中心', perm: 'notice:view' }
        },
        {
          path: 'accounts',
          name: 'accounts',
          component: () => import('@/views/admin/AccountListView.vue'),
          meta: { title: '账户管理', perm: 'account:list' }
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/views/admin/RoleListView.vue'),
          meta: { title: '角色管理', perm: 'role:list' }
        },
        {
          path: 'permissions',
          name: 'permissions',
          component: () => import('@/views/admin/PermissionListView.vue'),
          meta: { title: '权限管理', perm: 'permission:list' }
        },
        {
          path: 'apps',
          name: 'apps',
          component: () => import('@/views/admin/ApplicationListView.vue'),
          meta: { title: '应用管理', perm: 'app:list' }
        },
        {
          path: 'logs',
          name: 'logs',
          component: () => import('@/views/admin/LoginLogView.vue'),
          meta: { title: '登录日志', perm: 'account:log:view' }
        },
        {
          path: 'profile',
          name: 'profile',
          component: () => import('@/views/admin/ProfileView.vue'),
          meta: { title: '个人信息' }
        },
        {
          path: 'password',
          name: 'password',
          component: () => import('@/views/admin/PasswordView.vue'),
          meta: { title: '修改密码' }
        }
      ]
    },
    // 未匹配的路径回首页；没有兜底会在 404 时白屏
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach(async (to) => {
  if (to.meta.public) {
    return true
  }
  const store = useUserStore()
  const loggedIn = await store.bootstrap()
  if (!loggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  const perm = to.meta.perm as string | undefined
  if (perm && !store.can(perm)) {
    // 没有该菜单权限：回概览并带上原因，由页面提示，而不是静默跳走
    return { path: '/dashboard', query: { denied: perm } }
  }
  return true
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} · 统一账号中心` : '统一账号中心'
})

export default router
