import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { gotoAuthorize } from '@/api/ehr'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layout/EhrLayout.vue'),
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '概览' } },
        { path: 'orgs', component: () => import('@/views/OrgView.vue'), meta: { title: '组织架构', perm: 'org:view' } },
        { path: 'employees', component: () => import('@/views/EmployeeView.vue'), meta: { title: '人员管理', perm: 'employee:view' } },
        {
          path: 'leaves',
          component: () => import('@/views/LeaveView.vue'),
          meta: { title: '请假管理', perms: ['leave:mine', 'leave:all', 'leave:team'] }
        },
        {
          path: 'my-resign',
          component: () => import('@/views/MyResignView.vue'),
          meta: { title: '离职申请', perms: ['resign:apply', 'approval:resign:apply'] }
        },
        { path: 'my-regularize', component: () => import('@/views/MyRegularizeView.vue'), meta: { title: '转正申请', perm: 'regularize:apply' } },
        {
          path: 'approvals',
          component: () => import('@/views/ApprovalView.vue'),
          meta: {
            title: '审批中心',
            perms: [
              'approval:todo',
              'approval:approved',
              'approval:started',
              'approval:cc',
              'approval:delegated',
              'approval:handover',
              'approval:resign'
            ]
          }
        },
        {
          path: 'recruit',
          component: () => import('@/views/RecruitView.vue'),
          meta: { title: '招聘管理', perms: ['recruit:board', 'recruit:offers', 'recruit:jobs', 'recruit:interviews'] }
        },
        { path: 'announcements', component: () => import('@/views/AnnouncementView.vue'), meta: { title: '通知管理', perm: 'announcement:view' } },
        { path: 'audit-logs', component: () => import('@/views/AuditLogView.vue'), meta: { title: '审计日志', perm: 'audit:view' } },
        {
          path: 'hr-ledgers',
          component: () => import('@/views/HrLedgerView.vue'),
          meta: {
            title: '人力台账',
            perms: [
              'ledger:workforce',
              'ledger:regularization',
              'ledger:recruitment',
              'ledger:contract',
              'ledger:movement',
              'ledger:leaves',
              'ledger:overtimes',
              'ledger:attendance'
            ]
          }
        },
        {
          path: 'attendance',
          component: () => import('@/views/AttendanceView.vue'),
          meta: {
            title: '考勤管理',
            perms: [
              'attendance:overtime',
              'attendance:monthly',
              'attendance:my',
              'attendance:daily',
              'attendance:punches',
              'attendance:corrections',
              'attendance:rules',
              'attendance:calendar',
              'attendance:annual'
            ]
          }
        },
        { path: 'no-access', component: () => import('@/views/NoAccessView.vue'), meta: { title: '无权限', public: true } }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
  ]
})

router.beforeEach(async (to) => {
  document.title = to.meta.title ? `${to.meta.title} · 人力中心` : '人力中心'
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
  const perms = to.meta.perms as string[] | undefined
  if (perms?.length && !store.canAny(...perms)) {
    return '/no-access'
  }
  return true
})

export default router
