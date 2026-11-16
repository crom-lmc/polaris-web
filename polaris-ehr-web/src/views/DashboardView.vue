<template>
  <div class="page-root dash">
    <section class="hero">
      <div>
        <div class="hello">你好，{{ store.username || '同事' }}</div>
        <div class="sub">这里是人力中心：组织架构、人员档案与请假都在这一处维护。</div>
      </div>
      <div class="hero-actions">
        <a-button v-if="store.can('org:view')" @click="$router.push('/orgs')">组织架构</a-button>
        <a-button v-if="store.can('employee:view')" @click="$router.push('/employees')">人员名录</a-button>
        <a-button v-if="store.can('leave:mine:apply')" type="primary" @click="$router.push('/leaves')">请假</a-button>
      </div>
    </section>

    <a-spin :spinning="dashLoading">
      <div class="stat-grid">
        <div v-for="c in cards" :key="c.key" class="stat-card clickable" @click="openCard(c)">
          <div class="stat-icon" :class="`stat-icon--${c.tone}`">
            <component :is="c.icon" />
          </div>
          <div class="stat-label">{{ c.label }}</div>
          <div class="stat-value">{{ c.value }}</div>
          <div class="muted">{{ c.hint }}</div>
        </div>
      </div>

    </a-spin>

    <section class="panel">
      <div class="panel-head">
        <span>最近请假</span>
        <a v-if="canViewLeave" @click="$router.push('/leaves')">查看全部</a>
      </div>
      <div class="panel-body">
        <a-empty v-if="!recent.length" description="暂无请假记录" />
        <a-list v-else :data-source="recent" size="small">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta>
                <template #title>
                  <span>{{ item.applicantName }} · {{ item.leaveTypeName }}</span>
                  <a-tag :color="statusColor(item.status)" class="ml8">{{ item.statusName }}</a-tag>
                </template>
                <template #description>
                  {{ item.startDate }} ~ {{ item.endDate }}（{{ item.days }} 天）· {{ item.reason }}
                </template>
              </a-list-item-meta>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <span>
          试用期提醒
          <span v-if="unread" class="badge">{{ unread }}</span>
        </span>
        <a v-if="unread" @click="markAll">全部标记已读</a>
      </div>
      <div class="panel-body">
        <a-empty v-if="!reminders.length" description="暂无提醒" />
        <a-list v-else :data-source="reminders" size="small">
          <template #renderItem="{ item }">
            <a-list-item :class="{ 'reminder-read': item.readFlag === 1 }">
              <a-list-item-meta>
                <template #title>
                  <span>{{ item.title }}</span>
                  <a-tag v-if="item.employeeName" color="blue" class="ml8">{{ item.employeeName }}</a-tag>
                  <a-tag v-if="item.readFlag === 1" class="ml8">已读</a-tag>
                </template>
                <template #description>{{ item.content }}</template>
              </a-list-item-meta>
              <template #actions>
                <a v-if="item.readFlag !== 1" @click="markRead(item)">标记已读</a>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  LoginOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserDeleteOutlined
} from '@ant-design/icons-vue'
import {
  dashboardSummary,
  myReminderUnreadCount,
  orgFlatten,
  pageLeaves,
  pageMyReminders,
  readAllReminders,
  readReminder,
  type DashboardSummary,
  type LeaveItem,
  type ReminderItem
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const router = useRouter()
const canViewLeave = computed(() => store.canAny('leave:mine', 'leave:all', 'leave:team'))
const canApprove = computed(() => store.can('leave:all'))

const stats = reactive({ orgNodes: 0, pending: 0 })
const recent = ref<LeaveItem[]>([])
const reminders = ref<ReminderItem[]>([])
const unread = ref(0)

/* ---------------- 人力看板 ---------------- */

const dash = ref<DashboardSummary | null>(null)
const dashLoading = ref(false)

interface DashCard {
  key: string
  label: string
  value: number | string
  hint: string
  icon: Component
  tone: 'blue' | 'gold' | 'green' | 'red' | 'cyan' | 'orange' | 'purple'
  /** 人员状态筛选：点击后带 status 跳人员名录 */
  status?: number
  /** 直接跳转的路径（组织架构 / 审批） */
  path?: string
}

const cards = computed<DashCard[]>(() => {
  const o = dash.value?.overview
  const list: DashCard[] = [
    { key: 'active', label: '在职', value: o?.active ?? 0, hint: '正式员工', status: 40, icon: TeamOutlined, tone: 'blue' },
    { key: 'probation', label: '试用期', value: o?.probation ?? 0, hint: '待转正', status: 30, icon: ClockCircleOutlined, tone: 'gold' },
    { key: 'onboarding', label: '待入职', value: o?.onboarding ?? 0, hint: '含入职审批中', status: 10, icon: UserAddOutlined, tone: 'green' },
    { key: 'terminating', label: '离职中', value: o?.terminating ?? 0, hint: '交接处理中', status: 50, icon: UserDeleteOutlined, tone: 'red' }
  ]
  if (store.can('contract:view')) {
    list.push({
      key: 'contractExpiring',
      label: '合同到期',
      value: o?.contractExpiring30Days ?? 0,
      hint: '未来 30 天内到期',
      path: '/hr-ledgers',
      icon: FileTextOutlined,
      tone: 'red'
    })
  }
  list.push(
    { key: 'onboardMonth', label: '本月入职', value: o?.onboardThisMonth ?? 0, hint: '按入职日期统计', status: 30, icon: LoginOutlined, tone: 'cyan' },
    { key: 'resignMonth', label: '本月离职', value: o?.resignThisMonth ?? 0, hint: '按离职日期统计', status: 60, icon: LogoutOutlined, tone: 'orange' },
    { key: 'regularMonth', label: '本月转正', value: o?.regularizedThisMonth ?? 0, hint: '按转正日期统计', status: 40, icon: CheckCircleOutlined, tone: 'green' },
    { key: 'orgNodes', label: '组织节点', value: stats.orgNodes, hint: '集团/子公司/部门/项目', path: '/orgs', icon: ApartmentOutlined, tone: 'purple' },
    {
      key: 'pending',
      label: canApprove.value ? '待我审批' : '我的待审批',
      value: stats.pending,
      hint: canApprove.value ? '其他人提交、等待你处理' : '你提交、等待审批的请假',
      path: store.can('approval:todo') ? '/approvals' : '/leaves',
      icon: AuditOutlined,
      tone: 'blue'
    }
  )
  return list
})

function openCard(c: DashCard) {
  if (c.path) {
    if (c.path === '/orgs' && !store.can('org:view')) return
    if (c.path === '/hr-ledgers' && !store.can('contract:view')) return
    router.push(c.path)
    return
  }
  if (c.status !== undefined) {
    if (!store.can('employee:view')) return
    router.push({ path: '/employees', query: { status: String(c.status) } })
  }
}

async function loadDashboard() {
  if (!store.can('employee:view')) return
  dashLoading.value = true
  try {
    dash.value = await dashboardSummary()
  } catch {
    /* 看板汇总失败不影响提醒与请假列表 */
  } finally {
    dashLoading.value = false
  }
}

async function loadReminders() {
  try {
    const [list, count] = await Promise.all([
      pageMyReminders({ unreadOnly: false, type: 'PROBATION_DUE', page: 1, size: 20 }),
      myReminderUnreadCount('PROBATION_DUE')
    ])
    reminders.value = list.list || []
    unread.value = Number(count) || 0
  } catch {
    /* 提醒加载失败不影响看板其它卡片 */
  }
}

async function markRead(item: ReminderItem) {
  try {
    await readReminder(item.id)
    await loadReminders()
  } catch {
    /* ignore */
  }
}

async function markAll() {
  try {
    await readAllReminders()
    await loadReminders()
  } catch {
    /* ignore */
  }
}

function statusColor(status: number) {
  return status === 0 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

onMounted(async () => {
  try {
    if (store.can('org:view')) {
      const flat = await orgFlatten()
      stats.orgNodes = flat?.length || 0
    }
  } catch {
    /* 统计失败不影响页面 */
  }
  await loadDashboard()
  try {
    if (store.can('leave:mine')) {
      const mine = await pageLeaves({ scope: 'mine', page: 1, size: 5 })
      recent.value = mine.list || []
      stats.pending = (mine.list || []).filter((x) => x.status === 0).length
    }
    if (canApprove.value) {
      const todo = await pageLeaves({ scope: 'all', status: 0, page: 1, size: 1 })
      stats.pending = todo.total || 0
    }
  } catch {
    /* ignore */
  }
  await loadReminders()
})
</script>

<style scoped>
/* 看板至少占满内容区，最近请假和试用期提醒平分剩余高度。 */
.dash {
  flex: 1;
  min-height: 100%;
}

.dash > .panel {
  flex: 1 1 0;
  min-height: 160px;
}

.dash > .panel .panel-body {
  display: flex;
  flex-direction: column;
}

.dash > .panel .panel-body > :deep(.ant-empty) {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 4px 2px 0;
}

.hello {
  font-size: 20px;
  font-weight: 600;
}

.sub {
  margin-top: 4px;
  color: var(--muted);
  font-size: 13px;
}

.hero-actions {
  display: flex;
  gap: 8px;
}

.stat-grid {
  display: grid;
  /* 桌面端固定每行 5 张，10 张指标卡整齐分为两行 */
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.stat-card {
  position: relative;
  overflow: hidden;
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 14px 16px;
}

.stat-icon {
  position: absolute;
  top: 14px;
  right: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  font-size: 18px;
}

.stat-icon--blue { color: #1677ff; background: rgba(22, 119, 255, .1); }
.stat-icon--gold { color: #d4a106; background: rgba(212, 161, 6, .12); }
.stat-icon--green { color: #389e0d; background: rgba(56, 158, 13, .1); }
.stat-icon--red { color: #cf1322; background: rgba(207, 19, 34, .09); }
.stat-icon--cyan { color: #08979c; background: rgba(8, 151, 156, .1); }
.stat-icon--orange { color: #d46b08; background: rgba(212, 107, 8, .1); }
.stat-icon--purple { color: #722ed1; background: rgba(114, 46, 209, .1); }

/* 概览数字卡片可点击跳转：给出手型光标与轻微悬浮反馈 */
.stat-card.clickable {
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
}

.stat-card.clickable:hover {
  border-color: var(--primary-color, #1677ff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
}

.stat-label {
  padding-right: 42px;
  color: var(--muted);
  font-size: 12px;
}

.stat-value {
  font-size: 26px;
  font-weight: 600;
  line-height: 1.4;
}

.ml8 {
  margin-left: 8px;
}

/* 已读提醒保留展示但置灰：消息不是待办，转正/离职后才从列表消失 */
.reminder-read :deep(.ant-list-item-meta-title),
.reminder-read :deep(.ant-list-item-meta-description) {
  color: var(--color-text-tertiary, #8c8c8c);
}

/* 未读徽标：与列表里的状态色保持一致，用 antd 默认红 */
.badge {
  display: inline-block;
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 9px;
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
}

@media (max-width: 800px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }
}
</style>
