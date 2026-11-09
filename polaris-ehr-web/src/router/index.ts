import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { gotoAuthorize } from '@/api/ehr'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/callback', component: () => import('@/views/CallbackView.vue'), meta: { public: true } },
    { path: '/approval/emp-change', component: () => import('@/views/EmpChangeApprovalView.vue'), meta: { title: '人员信息变更审批' } },
    {
      path: '/',
      component: () => import('@/layout/EhrLayout.vue'),
      children: [
        { path: '', redirect: '/orgs' },
        { path: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { title: '工作台' } },
        { path: 'orgs', component: () => import('@/views/OrgView.vue'), meta: { title: '组织架构', perm: 'org:view' } },
        { path: 'employees', component: () => import('@/views/EmployeeView.vue'), meta: { title: '人员管理', perm: 'employee:view' } },
        { path: 'recruits', component: () => import('@/views/RecruitView.vue'), meta: { title: '招聘管理', perm: 'recruit:view' } },
        { path: 'leaves', component: () => import('@/views/LeaveView.vue'), meta: { title: '请假管理', perm: 'leave:view' } },
        { path: 'attendance', component: () => import('@/views/AttendanceView.vue'), meta: { title: '考勤管理', perm: 'overtime:view' } },
        { path: 'my-resign', component: () => import('@/views/MyResignView.vue'), meta: { title: '离职申请', perm: 'resign:apply' } },
        { path: 'my-regularize', component: () => import('@/views/MyRegularizeView.vue'), meta: { title: '转正申请', perm: 'regularize:apply' } },
        { path: 'approvals', component: () => import('@/views/ApprovalView.vue'), meta: { title: '审批中心', perm: 'approval:todo' } },
        { path: 'announcements', component: () => import('@/views/AnnouncementView.vue'), meta: { title: '通知管理', perm: 'announcement:manage' } },
        { path: 'audit-logs', component: () => import('@/views/AuditLogView.vue'), meta: { title: '审计日志', perm: 'audit:view' } },
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
  return true
})

export default router
