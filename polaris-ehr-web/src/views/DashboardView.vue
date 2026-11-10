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
        <a-button v-if="store.can('leave:apply')" type="primary" @click="$router.push('/leaves')">请假</a-button>
      </div>
    </section>

    <a-spin :spinning="dashLoading">
      <div class="stat-grid">
        <div v-for="c in cards" :key="c.key" class="stat-card clickable" @click="openCard(c)">
          <div class="stat-label">{{ c.label }}</div>
          <div class="stat-value">{{ c.value }}</div>
          <div class="muted">{{ c.hint }}</div>
        </div>
      </div>

      <div class="chart-grid">
        <section class="panel">
          <div class="panel-head">
            <span>部门人力分布</span>
            <span class="muted">试用 + 在职，按直属组织</span>
          </div>
          <div class="panel-body">
            <a-empty v-if="!deptSlices.length" description="当前范围还没有在职人员" />
            <div v-else class="pie-wrap">
              <div class="pie" :style="{ background: donutBackground }">
                <div class="pie-hole">
                  <div class="pie-num">{{ deptTotal }}</div>
                  <div class="pie-cap">在岗</div>
                </div>
              </div>
              <div class="legend">
                <div v-for="s in deptSlices" :key="s.name" class="legend-item">
                  <i class="dot" :style="{ background: s.color }"></i>
                  <span class="legend-name" :title="s.name">{{ s.name }}</span>
                  <span class="legend-val">{{ s.count }} 人 · {{ s.pct.toFixed(0) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <span>编制 vs 实有</span>
            <span class="muted">
              整体利用率 {{ fmtPct(dash?.headcountTotal?.utilization) }}
            </span>
          </div>
          <div class="panel-body">
            <a-empty v-if="!headcountRows.length" description="还没有配置编制数据" />
            <div v-else class="hc-list">
              <div class="hc-legend">
                <i class="dot plan"></i><span>编制</span>
                <i class="dot actual"></i><span>实有</span>
              </div>
              <div v-for="r in headcountRows" :key="r.orgId" class="hc-row">
                <div class="hc-name" :title="r.orgName">{{ r.orgName }}</div>
                <div class="hc-bars">
                  <div class="hc-bar">
                    <i class="fill plan" :style="{ width: barWidth(r.headcount) }"></i>
                    <span class="hc-num">{{ r.headcount }}</span>
                  </div>
                  <div class="hc-bar">
                    <i class="fill actual" :style="{ width: barWidth(r.actual) }"></i>
                    <span class="hc-num">{{ r.actual }}</span>
                  </div>
                </div>
                <div class="hc-rate" :class="{ over: r.utilization !== null && r.utilization > 100 }">
                  {{ fmtPct(r.utilization) }}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="panel">
        <div class="panel-head">
          <span>请假趋势</span>
          <span class="muted">近 6 个月已通过的请假天数，按类型堆叠</span>
        </div>
        <div class="panel-body">
          <a-empty v-if="!trendView.rows.length" description="统计周期内暂无已通过的请假" />
          <template v-else>
            <div class="trend">
              <div v-for="r in trendView.rows" :key="r.month" class="trend-col">
                <div class="trend-stack" :style="{ height: trendHeight(r.total) }">
                  <div
                    v-for="seg in r.segments"
                    :key="seg.name"
                    class="trend-seg"
                    :style="{ height: seg.pct + '%', background: seg.color }"
                    :title="`${seg.name} ${seg.days} 天`"
                  ></div>
                </div>
                <div class="trend-label">{{ r.month.slice(5) }} 月</div>
                <div class="trend-total">{{ r.total || '' }}</div>
              </div>
            </div>
            <div class="legend trend-legend">
              <div v-for="l in trendView.legend" :key="l.name" class="legend-item">
                <i class="dot" :style="{ background: l.color }"></i>
                <span class="legend-name">{{ l.name }}</span>
              </div>
            </div>
          </template>
        </div>
      </section>
    </a-spin>

    <section class="panel">
      <div class="panel-head">
        <span>最近请假</span>
        <a v-if="store.can('leave:view')" @click="$router.push('/leaves')">查看全部</a>
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
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
const canApprove = computed(() => store.can('leave:approve'))

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
  /** 人员状态筛选：点击后带 status 跳人员名录 */
  status?: number
  /** 直接跳转的路径（组织架构 / 审批） */
  path?: string
}

const cards = computed<DashCard[]>(() => {
  const o = dash.value?.overview
  return [
    { key: 'active', label: '在职', value: o?.active ?? 0, hint: '正式员工', status: 40 },
    { key: 'probation', label: '试用期', value: o?.probation ?? 0, hint: '待转正', status: 30 },
    { key: 'onboarding', label: '待入职', value: o?.onboarding ?? 0, hint: '含入职审批中', status: 10 },
    { key: 'terminating', label: '离职中', value: o?.terminating ?? 0, hint: '交接处理中', status: 50 },
    { key: 'onboardMonth', label: '本月入职', value: o?.onboardThisMonth ?? 0, hint: '按入职日期统计', status: 30 },
    { key: 'resignMonth', label: '本月离职', value: o?.resignThisMonth ?? 0, hint: '按离职日期统计', status: 60 },
    { key: 'regularMonth', label: '本月转正', value: o?.regularizedThisMonth ?? 0, hint: '按转正日期统计', status: 40 },
    { key: 'orgNodes', label: '组织节点', value: stats.orgNodes, hint: '集团/子公司/部门/项目', path: '/orgs' },
    {
      key: 'pending',
      label: canApprove.value ? '待我审批' : '我的待审批',
      value: stats.pending,
      hint: canApprove.value ? '其他人提交、等待你处理' : '你提交、等待审批的请假',
      path: store.can('approval:todo') ? '/approvals' : '/leaves'
    }
  ]
})

function openCard(c: DashCard) {
  if (c.path) {
    if (c.path === '/orgs' && !store.can('org:view')) return
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

/* 部门分布：取前 6 个组织，其余合并为「其他」 */
const PALETTE = ['#1677ff', '#13c2c2', '#faad14', '#eb2f96', '#722ed1', '#52c41a', '#8c8c8c']
const deptSlices = computed(() => {
  const list = dash.value?.orgDistribution || []
  const total = list.reduce((s, x) => s + x.employees, 0)
  if (!total) return []
  const head = list.slice(0, 6).map((x, i) => ({
    name: x.orgName || '未知组织',
    count: x.employees,
    pct: (x.employees / total) * 100,
    color: PALETTE[i]
  }))
  const rest = list.slice(6).reduce((s, x) => s + x.employees, 0)
  if (rest > 0) {
    head.push({ name: '其他', count: rest, pct: (rest / total) * 100, color: PALETTE[6] })
  }
  return head
})
const deptTotal = computed(() => deptSlices.value.reduce((s, x) => s + x.count, 0))
const donutBackground = computed(() => {
  if (!deptSlices.value.length) return '#f0f0f0'
  let acc = 0
  const stops = deptSlices.value.map((s) => {
    const start = acc
    acc += s.pct
    return `${s.color} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(',')})`
})

/* 编制 vs 实有：最多展示 8 个组织，条形按两者最大值归一 */
const headcountRows = computed(() => (dash.value?.headcount || []).slice(0, 8))
const barMax = computed(() =>
  Math.max(1, ...headcountRows.value.map((r) => Math.max(r.headcount, r.actual)))
)

function barWidth(value: number) {
  return `${Math.round((value / barMax.value) * 100)}%`
}

function fmtPct(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(1)}%`
}

/* 请假趋势：按月份堆叠，颜色按类型出现顺序固定 */
const trendView = computed(() => {
  const rows = dash.value?.leaveTrend || []
  const legendMap = new Map<string, { name: string; color: string }>()
  const byMonth = new Map<string, { month: string; total: number; segments: Record<string, number> }>()
  for (const t of rows) {
    if (!legendMap.has(t.leaveType)) {
      legendMap.set(t.leaveType, {
        name: t.leaveTypeName || t.leaveType,
        color: PALETTE[legendMap.size % PALETTE.length]
      })
    }
    const row = byMonth.get(t.month) || { month: t.month, total: 0, segments: {} }
    row.total += Number(t.days) || 0
    row.segments[t.leaveType] = (row.segments[t.leaveType] || 0) + (Number(t.days) || 0)
    byMonth.set(t.month, row)
  }
  const months = Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
  const max = Math.max(0, ...months.map((m) => m.total))
  return {
    legend: Array.from(legendMap.values()),
    rows: months.map((m) => ({
      month: m.month,
      total: Number(m.total.toFixed(2)),
      segments: legendMap.size
        ? Array.from(legendMap.entries()).map(([type, l]) => ({
            name: l.name,
            color: l.color,
            days: Number((m.segments[type] || 0).toFixed(2)),
            pct: m.total > 0 ? ((m.segments[type] || 0) / m.total) * 100 : 0
          })).filter((s) => s.days > 0)
        : []
    })),
    max
  }
})

/** 最高月份占 170px，其余按比例；没有数据时为 0 */
function trendHeight(total: number) {
  if (!trendView.value.max) return '0px'
  return `${Math.round((total / trendView.value.max) * 170)}px`
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
    if (store.can('leave:view')) {
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
/* 卡片与图表随内容自然增高：不参与父级 flex 压缩，超出视口时由外层 .content
   出现纵向滚动条，避免下方的请假趋势/最近请假/试用期提醒被压扁或裁掉。 */
.dash {
  flex: 0 0 auto;
  min-height: 100%;
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
  /* auto-fit 折叠多余空轨道，9 张指标卡等分整行宽度，auto-fill 会在右侧留空列 */
  grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.chart-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}

.pie-wrap {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.pie {
  position: relative;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  flex: none;
}

.pie-hole {
  position: absolute;
  inset: 24px;
  border-radius: 50%;
  background: var(--panel-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.pie-num {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.1;
}

.pie-cap {
  font-size: 11px;
  color: var(--muted);
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  min-width: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}

.dot.plan {
  background: #bfbfbf;
}

.dot.actual {
  background: #1677ff;
}

.legend-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-2, #595959);
}

.legend-val {
  color: var(--muted);
  flex: none;
}

.hc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hc-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 2px;
}

.hc-row {
  display: grid;
  grid-template-columns: 108px 1fr 56px;
  align-items: center;
  gap: 10px;
}

.hc-name {
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hc-bars {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.hc-bar {
  position: relative;
  height: 12px;
  border-radius: 3px;
  background: var(--track-bg, #f0f0f0);
  overflow: hidden;
}

.hc-bar .fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 3px;
  min-width: 2px;
}

.hc-bar .fill.plan {
  background: #bfbfbf;
}

.hc-bar .fill.actual {
  background: #1677ff;
}

.hc-num {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 10.5px;
  color: var(--muted);
}

.hc-rate {
  font-size: 12.5px;
  text-align: right;
  color: var(--muted);
}

.hc-rate.over {
  color: #cf1322;
  font-weight: 600;
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 18px;
  height: 210px;
  padding: 0 8px 0;
  overflow-x: auto;
}

.trend-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 44px;
  flex: 1;
  height: 100%;
}

.trend-stack {
  width: 26px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  border-radius: 4px 4px 0 0;
  overflow: hidden;
  transition: height .2s;
}

.trend-seg {
  width: 100%;
}

.trend-label {
  font-size: 12px;
  color: var(--muted);
  margin-top: 6px;
}

.trend-total {
  font-size: 11.5px;
  color: var(--muted);
  min-height: 15px;
}

.trend-legend {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.trend-legend .legend-item {
  flex: none;
}

.stat-card {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 14px 16px;
}

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
  .stat-grid,
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
