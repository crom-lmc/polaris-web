<template>
  <div class="dash-page">
    <a-alert
      v-if="denied"
      type="warning"
      show-icon
      style="margin-bottom: 16px"
      :message="`你没有「${denied}」权限，已跳过该页面`"
    />

    <a-row :gutter="16" align="stretch" class="dash-row">
      <a-col :span="8">
        <a-card title="当前账号" size="small" class="equal-card">
          <a-descriptions :column="1" size="small">
            <a-descriptions-item label="登录名">
              {{ store.user?.username || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="昵称">
              {{ store.user?.nickname || '-' }}
            </a-descriptions-item>
            <a-descriptions-item label="身份">
              <!-- 与 LOGO 徽标/主按钮/侧栏选中态同一支品牌靛蓝，避免预设 blue 的亮青蓝跳出 -->
              <a-tag :color="store.isSuperAdmin ? '#2f54eb' : 'default'">
                {{ store.isSuperAdmin ? '超级管理员' : '普通账号' }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="权限码">
              <a-tag>{{ store.permissions.length }} 项</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="可访问应用">
              <a-tag>{{ store.appList.length }} 个</a-tag>
            </a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>

      <a-col :span="16">
        <a-card title="我的应用" size="small" class="equal-card">
          <template #extra>
            <a-button v-if="store.can('my-apps')" type="link" size="small" @click="goMyApps">查看全部</a-button>
          </template>

          <a-empty v-if="!store.appList.length" description="还没有被授权任何应用" />

          <div v-else class="app-grid">
            <div v-for="app in overviewApps" :key="app.id" class="app-tile">
              <img class="app-logo" :src="logoOf(app)" :alt="app.name" />
              <div class="app-name">{{ app.name }}</div>
              <div class="app-code">{{ app.code }}</div>
              <!-- 统一账号中心是平台自身（当前控制台），没有可跳转的目标地址，不显示「进入」 -->
              <a-button
                v-if="!isBuiltin(app)"
                size="small"
                type="primary"
                :loading="entering === app.code"
                @click="enter(app)"
              >
                进入
              </a-button>
            </div>
          </div>

          <a-alert
            v-if="enterError"
            type="error"
            show-icon
            style="margin-top: 12px"
            :message="enterError"
          />
        </a-card>
      </a-col>
    </a-row>

    <!-- 概览数字：与配置中心概览同一套视觉语言（色块图标 + 数字 + 说明），比纯数字卡片更有信息量 -->
    <a-row :gutter="16" align="stretch" class="stat-row">
      <a-col v-for="item in statCards" :key="item.label" :span="8">
        <a-card size="small" hoverable :loading="statLoading" class="stat-card" @click="item.go()">
          <div class="stat-main">
            <div class="stat-icon" :style="{ color: item.color, background: item.bg }">
              <component :is="item.icon" />
            </div>
            <div class="stat-text">
              <div class="stat-value">{{ item.value }}</div>
              <div class="stat-sub">
                <span class="stat-label">{{ item.label }}</span>
                <span class="stat-note">{{ item.note }}</span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 平台运营概览：账号/应用/角色/权限/登录等规模数字，色块图标风格与上方一致 -->
    <a-row :gutter="16" align="stretch" class="stat-row">
      <a-col v-for="item in overviewCards" :key="item.label" :span="4">
        <a-card size="small" hoverable :loading="overviewLoading" class="stat-card mini-stat-card">
          <div class="stat-main">
            <div class="stat-icon" :style="{ color: item.color, background: item.bg }">
              <component :is="item.icon" />
            </div>
            <div class="stat-text">
              <div class="stat-value small">{{ item.value }}</div>
              <div class="stat-sub">
                <span class="stat-label">{{ item.label }}</span>
              </div>
            </div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 统计图：近 14 天登录趋势（折线）+ 账号状态/登录方式分布（环形），纯 SVG 无图表库 -->
    <a-row :gutter="16" align="stretch" class="stat-row chart-row">
      <a-col :span="14">
        <a-card title="近 14 天登录趋势" size="small" :loading="overviewLoading" class="chart-card">
          <template #extra>
            <span class="chart-legend"><i class="dot success" />成功 <i class="dot fail" />失败</span>
          </template>
          <div class="line-chart">
            <svg viewBox="0 0 560 180" preserveAspectRatio="none" role="img" aria-label="登录趋势折线图">
              <defs>
                <linearGradient id="loginSuccessFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#2f54eb" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="#2f54eb" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <!-- 横向网格线与刻度 -->
              <g v-for="i in 5" :key="'g' + i">
                <line x1="34" :y1="20 + (i - 1) * 34" x2="552" :y2="20 + (i - 1) * 34"
                      stroke="var(--border-subtle, #eee)" stroke-width="1" />
                <text x="30" :y="24 + (i - 1) * 34" text-anchor="end" class="chart-axis-text">
                  {{ trendMax - Math.round((i - 1) * trendMax / 4) }}
                </text>
              </g>
              <!-- 成功面积 + 折线，失败折线 -->
              <path :d="trendAreaPath" fill="url(#loginSuccessFill)" />
              <path :d="trendLinePath.success" fill="none" stroke="#2f54eb" stroke-width="2.5"
                    stroke-linejoin="round" stroke-linecap="round" />
              <path :d="trendLinePath.fail" fill="none" stroke="#fa541c" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4" />
              <!-- x 轴日期（隔点显示避免拥挤） -->
              <g v-for="(p, idx) in trendPoints" :key="'x' + idx">
                <text v-if="idx % 2 === 0 || idx === trendPoints.length - 1" :x="p.x" y="172"
                      text-anchor="middle" class="chart-axis-text">{{ p.label }}</text>
              </g>
            </svg>
            <a-empty v-if="!trendHasData" class="chart-empty" description="暂无登录记录" />
          </div>
        </a-card>
      </a-col>

      <a-col :span="5">
        <a-card title="账号状态" size="small" :loading="overviewLoading" class="chart-card donut-card">
          <div class="donut-wrap">
            <svg viewBox="0 0 120 120" class="donut" role="img" aria-label="账号状态分布环形图">
              <circle v-for="(seg, i) in statusSegments" :key="i" cx="60" cy="60" r="46" fill="none"
                      :stroke="seg.color" stroke-width="16" :stroke-dasharray="seg.dash"
                      :stroke-dashoffset="seg.offset" transform="rotate(-90 60 60)" />
              <circle cx="60" cy="60" r="46" fill="none" stroke="var(--border-subtle, #eee)" stroke-width="16"
                      v-if="!statusSegments.length" />
            </svg>
            <div class="donut-center">
              <b>{{ overview.accountCount }}</b>
              <span>账号总数</span>
            </div>
          </div>
          <div class="donut-legend">
            <div v-for="(seg, i) in statusSegments" :key="i" class="legend-row">
              <i class="dot" :style="{ background: seg.color }" />
              <span class="legend-name">{{ seg.name }}</span>
              <b>{{ seg.value }}</b>
            </div>
            <a-empty v-if="!statusSegments.length" :image-style="{ height: '30px' }" description="暂无数据" />
          </div>
        </a-card>
      </a-col>

      <a-col :span="5">
        <a-card title="登录方式" size="small" :loading="overviewLoading" class="chart-card">
          <div class="bar-list">
            <div v-for="(row, i) in loginTypeBars" :key="i" class="bar-item">
              <div class="bar-head">
                <span>{{ row.name }}</span><b>{{ row.value }}</b>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: row.percent + '%', background: row.color }" />
              </div>
            </div>
            <a-empty v-if="!loginTypeBars.length" :image-style="{ height: '40px' }" description="暂无数据" />
          </div>
        </a-card>
      </a-col>
    </a-row>

    <!-- 员工快捷查询：按姓名/工号找人，结果只展示非隐私信息；宽度与「当前账号」同列（span=8） -->
    <a-row :gutter="16" align="stretch" class="lookup-row">
      <a-col :span="8">
        <a-card title="员工快捷查询" size="small" class="lookup-card">
          <template #extra>
            <span class="tip">姓名 / 工号</span>
          </template>

          <a-input-search
            v-model:value="lookupKeyword"
            placeholder="输入姓名或工号后查询"
            enter-button="查询"
            allow-clear
            class="lookup-input"
            :loading="lookupLoading"
            @search="doLookup"
          />

          <div class="lookup-result">
            <div v-if="lookupResults.length" class="lookup-list">
              <div v-for="item in lookupResults" :key="item.employeeId" class="lookup-item">
                <div class="lookup-main">
                  <span class="lookup-name">{{ item.name || '-' }}</span>
                  <span class="lookup-meta">职位：{{ item.position || '-' }}</span>
                  <span class="lookup-meta">邮件：{{ item.email || '-' }}</span>
                </div>
                <a-button type="link" size="small" @click="openLookupDetail(item.employeeId)">
                  查看详情
                </a-button>
              </div>
            </div>
            <!-- 未查询或查无结果都显示暂无数据，水平垂直居中，避免卡片大面积留白 -->
            <a-empty v-else class="lookup-empty" description="暂无数据" />
          </div>
        </a-card>
      </a-col>

      <!-- 通知列表：只展示已发布且当前账号可见的通知，不做搜索；点标题进通知中心看详情 -->
      <a-col v-if="canNotice" :span="16">
        <a-card title="通知" size="small" class="notice-card">
          <template #extra>
            <a class="tip link" @click="goNotices">查看全部</a>
          </template>

          <a-spin :spinning="noticeLoading">
            <a-table
              v-if="noticeRows.length"
              class="notice-table"
              table-layout="fixed"
              size="small"
              :columns="noticeColumns"
              :data-source="noticeRows"
              :pagination="false"
              row-key="id"
              :row-class-name="noticeRowClass"
              :custom-row="noticeRowProps"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'title'">
                  <span class="notice-title" :title="record.title">{{ record.title }}</span>
                  <a-tag v-if="record.pinned" color="red" class="pin-tag">置顶</a-tag>
                </template>
                <template v-else-if="column.key === 'category'">
                  {{ record.categoryName || categoryMap[record.category] || '其他' }}
                </template>
                <template v-else-if="column.key === 'target'">
                  <span class="notice-target" :title="targetText(record)">
                    {{ targetText(record) }}
                  </span>
                </template>
                <template v-else-if="column.key === 'publisher'">
                  {{ record.publisherName || '—' }}
                </template>
                <template v-else-if="column.key === 'time'">
                  {{ formatTime(record.publishAt) }}
                </template>
              </template>
            </a-table>
            <a-empty v-else-if="!noticeLoading" class="notice-empty" description="暂无通知" />
          </a-spin>
        </a-card>
      </a-col>
    </a-row>

    <a-modal v-model:open="detailOpen" title="员工信息" :footer="null" :width="600" centered>
      <a-spin :spinning="detailLoading">
        <a-descriptions v-if="lookupDetail" :column="1" bordered size="small">
          <a-descriptions-item label="姓名">{{ lookupDetail.name || '-' }}</a-descriptions-item>
          <a-descriptions-item label="工号">{{ lookupDetail.empNo || '-' }}</a-descriptions-item>
          <a-descriptions-item label="账号">{{ lookupDetail.account || '-' }}</a-descriptions-item>
          <a-descriptions-item label="性别">{{ lookupDetail.gender || '-' }}</a-descriptions-item>
          <a-descriptions-item label="职位">{{ lookupDetail.position || '-' }}</a-descriptions-item>
          <a-descriptions-item label="部门">{{ lookupDetail.department || '-' }}</a-descriptions-item>
          <a-descriptions-item label="邮件">{{ lookupDetail.email || '-' }}</a-descriptions-item>
        </a-descriptions>
      </a-spin>
    </a-modal>

    <!-- 通知详情：打开即记读，后端按 (通知, 账号) 幂等 -->
    <a-modal
      v-model:open="noticeOpen"
      :title="currentNotice?.title || '通知详情'"
      :footer="null"
      width="760px"
      centered
    >
      <a-spin :spinning="noticeDetailLoading">
        <div v-if="currentNotice" class="notice-meta">
          <a-tag color="blue">
            {{ currentNotice.categoryName || categoryMap[currentNotice.category] || '其他' }}
          </a-tag>
          <a-tag v-if="currentNotice.pinned" color="red">置顶</a-tag>
          <span class="tip">目标：{{ targetText(currentNotice) }}</span>
          <span class="tip">
            发布：{{ formatTime(currentNotice.publishAt) }} · {{ currentNotice.publisherName || '—' }}
          </span>
        </div>
        <div v-if="currentNotice" class="notice-content" v-html="sanitizeHtml(currentNotice.content)" />
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { AuditOutlined, BellOutlined, CarryOutOutlined, DatabaseOutlined, RiseOutlined, TeamOutlined, AppstoreOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import { fetchOverview } from '@/api/accounts'
import { oauthAuthorize } from '@/api/oauth'
import { fetchApprovals } from '@/api/approvals'
import { fetchUnreadNoticeCount } from '@/api/notice'
import { fetchNoticeDetail, pageNotices, type NoticeItem } from '@/api/announcement'
import {
  fetchEmployeeLookupDetail,
  searchEmployees,
  type EmployeeLookupDetail,
  type EmployeeLookupItem
} from '@/api/employeeLookup'
import type { ApplicationVO } from '@/types'
import { sanitizeHtml } from '@/utils/html'

const route = useRoute()
const store = useUserStore()

const denied = computed(() => (route.query.denied as string) || '')
const overviewApps = computed(() => store.appList.slice(0, 5))
const entering = ref('')
const enterError = ref('')

/* ---------- 概览数字卡片：待审批 / 待办 / 未读消息 ---------- */
const statLoading = ref(false)
const pendingCount = ref(0)
const todoCount = ref(0)
const unreadMsgCount = ref(0)

/** 三个数字卡：图标/配色沿用配置中心概览，点击进入对应列表 */
const statCards = computed(() => [
  {
    label: '待审批',
    value: pendingCount.value,
    note: '等待我处理',
    icon: AuditOutlined,
    color: '#2f54eb',
    bg: '#eef2ff',
    go: goPendingApprovals
  },
  {
    label: '待办',
    value: todoCount.value,
    note: '待处理事项',
    icon: CarryOutOutlined,
    color: '#fa8c16',
    bg: '#fff7e6',
    go: () => goMessages(1)
  },
  {
    label: '未读消息',
    value: unreadMsgCount.value,
    note: '站内未读',
    icon: BellOutlined,
    color: '#eb2f96',
    bg: '#fff0f6',
    go: () => goMessages(2)
  }
])

async function loadStats() {
  statLoading.value = true
  try {
    // 三个数字互不依赖，任一接口失败不影响另外两个展示
    const [pending, todo, msg] = await Promise.allSettled([
      fetchApprovals('pending'),
      fetchUnreadNoticeCount(1),
      fetchUnreadNoticeCount(2)
    ])
    if (pending.status === 'fulfilled') pendingCount.value = pending.value.data?.length ?? 0
    // fetchUnreadNoticeCount 返回 { data: number }，拦截器解包后 todo.value.data 就是 number 本体
    if (todo.status === 'fulfilled') todoCount.value = Number(todo.value.data ?? 0)
    if (msg.status === 'fulfilled') unreadMsgCount.value = Number(msg.value.data ?? 0)
  } finally {
    statLoading.value = false
  }
}

/* ---------- 平台运营概览：规模数字卡 + 登录趋势/分布统计图 ---------- */
const overviewLoading = ref(false)
const overview = ref<import('@/types').OverviewVO>({
  accountCount: 0, appCount: 0, roleCount: 0, permissionCount: 0,
  todayLoginCount: 0, monthNewAccountCount: 0,
  loginTrend: [], accountStatus: [], loginTypes: []
})

/** 6 个规模数字卡：图标/配色沿用既有色块风格 */
const overviewCards = computed(() => [
  { label: '账号总数', value: overview.value.accountCount, icon: TeamOutlined, color: '#2f54eb', bg: '#eef2ff' },
  { label: '接入应用', value: overview.value.appCount, icon: AppstoreOutlined, color: '#13a8a8', bg: '#e6fffb' },
  { label: '角色', value: overview.value.roleCount, icon: SafetyCertificateOutlined, color: '#722ed1', bg: '#f9f0ff' },
  { label: '权限码', value: overview.value.permissionCount, icon: SafetyCertificateOutlined, color: '#597ef7', bg: '#eef2ff' },
  { label: '今日登录', value: overview.value.todayLoginCount, icon: RiseOutlined, color: '#fa8c16', bg: '#fff7e6' },
  { label: '本月新增', value: overview.value.monthNewAccountCount, icon: DatabaseOutlined, color: '#52c41a', bg: '#f6ffed' }
])

async function loadOverview() {
  overviewLoading.value = true
  try {
    const res = await fetchOverview()
    overview.value = res.data
  } catch {
    // 概览统计失败不阻塞页面其它模块，保留全 0 默认态
  } finally {
    overviewLoading.value = false
  }
}

/* 折线图坐标计算：viewBox 560x180，绘图区 x∈[34,552]，y∈[20,156] */
const trendMax = computed(() => {
  const max = Math.max(1, ...overview.value.loginTrend.flatMap(p => [p.success, p.fail]))
  // 向上取整到便于阅读的刻度
  return Math.ceil(max / 4) * 4 || 4
})
const trendHasData = computed(() =>
  overview.value.loginTrend.some(p => p.success > 0 || p.fail > 0))

const trendPoints = computed(() => {
  const rows = overview.value.loginTrend
  const n = rows.length
  const max = trendMax.value
  return rows.map((p, i) => ({
    x: n <= 1 ? 34 : 34 + i * (518 / (n - 1)),
    sy: 156 - (p.success / max) * 136,
    fy: 156 - (p.fail / max) * 136,
    label: p.date.slice(5)
  }))
})

const trendLinePath = computed(() => {
  const pts = trendPoints.value
  const line = (key: 'sy' | 'fy') =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(' ')
  return { success: line('sy'), fail: line('fy') }
})

const trendAreaPath = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return ''
  const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.sy.toFixed(1)}`).join(' ')
  return `${top} L${pts[pts.length - 1].x.toFixed(1)},156 L${pts[0].x.toFixed(1)},156 Z`
})

/** 账号状态环形图：按占比分配 stroke-dasharray，周长 = 2πr = 289.03 */
const STATUS_COLORS = ['#52c41a', '#faad14', '#ff4d4f', '#bfbfbf']
const statusSegments = computed(() => {
  const rows = overview.value.accountStatus
  const total = rows.reduce((s, r) => s + r.value, 0)
  if (!total) return []
  const circumference = 2 * Math.PI * 46
  let acc = 0
  return rows.map((r, i) => {
    const fraction = r.value / total
    const len = fraction * circumference
    const seg = {
      name: r.name,
      value: r.value,
      color: STATUS_COLORS[i % STATUS_COLORS.length],
      dash: `${len.toFixed(2)} ${(circumference - len).toFixed(2)}`,
      offset: `${(-acc).toFixed(2)}`
    }
    acc += len
    return seg
  })
})

/** 登录方式条形图：按最大值归一百分比 */
const loginTypeBars = computed(() => {
  const rows = overview.value.loginTypes
  const max = Math.max(1, ...rows.map(r => r.value))
  const colors = ['#2f54eb', '#13a8a8', '#fa8c16', '#722ed1']
  return rows.map((r, i) => ({
    name: r.name,
    value: r.value,
    percent: Math.round((r.value / max) * 100),
    color: colors[i % colors.length]
  }))
})

onMounted(() => {
  loadStats()
  loadOverview()
  loadNotices()
})

/* ---------- 概览「通知」列表：无搜索，只展示标题/类型/目标/发布人/发布时间 ---------- */
const canNotice = computed(() => store.can('notice'))
const noticeLoading = ref(false)
const noticeRows = ref<NoticeItem[]>([])
const noticeOpen = ref(false)
const noticeDetailLoading = ref(false)
const currentNotice = ref<NoticeItem | null>(null)

const noticeColumns = [
  { key: 'title', title: '通知标题', dataIndex: 'title', width: '34%' },
  { key: 'category', title: '类型', width: '12%' },
  { key: 'target', title: '通知目标', width: '22%' },
  { key: 'publisher', title: '发布人', width: '16%' },
  { key: 'time', title: '发布时间', width: '16%' }
]

const categoryMap: Record<string, string> = {
  HOLIDAY: '节假日通知',
  COMMENDATION: '表彰通知',
  DEPARTMENT: '部门通知',
  POLICY: '制度通知',
  APPOINTMENT: '部门任命',
  OTHER: '其他'
}

async function loadNotices() {
  if (!canNotice.value) {
    return
  }
  noticeLoading.value = true
  try {
    const res = await pageNotices({ page: 1, size: 8 })
    noticeRows.value = res.data?.list ?? []
  } catch (e: any) {
    message.error(e?.message || '通知加载失败')
  } finally {
    noticeLoading.value = false
  }
}

function targetText(item: NoticeItem) {
  return item.targetType === 0 ? '全员（集团）' : item.targetOrgNames || '—'
}

/** 已读通知整行文字淡化（与「待办提醒」消息列表一致） */
function noticeRowClass(record: NoticeItem) {
  return record.read ? 'read-row' : ''
}

/** a-table 没有 row-click 事件，行点击通过 customRow 注入 */
function noticeRowProps(record: NoticeItem) {
  return { onClick: () => openNotice(record) }
}

/** 打开详情即记读：后端按 (通知, 账号) 幂等，成功后刷新列表 */
async function openNotice(row: NoticeItem) {
  noticeOpen.value = true
  noticeDetailLoading.value = true
  currentNotice.value = null
  try {
    const res = await fetchNoticeDetail(row.id)
    currentNotice.value = res.data
    loadNotices()
  } catch (e: any) {
    message.error(e?.message || '通知详情加载失败')
    noticeOpen.value = false
  } finally {
    noticeDetailLoading.value = false
  }
}

function formatTime(value?: string) {
  return value ? value.replace('T', ' ').slice(0, 16) : '—'
}

function goNotices() {
  router.push('/notices')
}

function goMyApps() {
  router.push({ name: 'my-apps' })
}

/* 数字卡片点击：待审批进「待我审批」，待办/未读消息进待办提醒页 */
const router = useRouter()

function goPendingApprovals() {
  router.push({ name: 'approvals', query: { scope: 'pending' } })
}

/** kind=1 落在「待办」页签，kind=2 落在「消息」页签 */
function goMessages(kind: 1 | 2) {
  router.push({ name: 'messages', query: { kind } })
}

/* ---------- 员工快捷查询：列表只展示姓名/职位/邮件，详情弹窗纵向展示 ---------- */
const lookupKeyword = ref('')
const lookupLoading = ref(false)
const lookupResults = ref<EmployeeLookupItem[]>([])
const detailOpen = ref(false)
const detailLoading = ref(false)
const lookupDetail = ref<EmployeeLookupDetail | null>(null)

async function doLookup() {
  const keyword = lookupKeyword.value.trim()
  if (!keyword) {
    message.warning('请输入姓名或工号')
    return
  }
  lookupLoading.value = true
  try {
    const res = await searchEmployees(keyword)
    lookupResults.value = res.data ?? []
  } catch (e: any) {
    message.error(e?.message || '查询失败')
  } finally {
    lookupLoading.value = false
  }
}

async function openLookupDetail(employeeId: string) {
  lookupDetail.value = null
  detailOpen.value = true
  detailLoading.value = true
  try {
    const res = await fetchEmployeeLookupDetail(employeeId)
    lookupDetail.value = res.data
  } catch (e: any) {
    message.error(e?.message || '加载员工信息失败')
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

/** 平台内置应用（统一账号中心）：只是列表里的常驻标识，不提供跳转 */
function isBuiltin(app: ApplicationVO) {
  return app.code === 'sso-center' || !!app.builtIn
}

/** 应用 logo：优先用中心配置的 icon，缺省回退到内置图标包（/public/icons） */
function logoOf(app: ApplicationVO) {
  return app.icon || `/icons/${app.code}.svg`
}

function randomState(): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 单点跳转（OAuth2 授权码模式）。
 * <p>
 * 关键：不经过账号中心自身的 /authorize 路由守卫（整页重载时 me() 偶发 401 会被守卫踢回登录页）。
 * 这里直接以【当前已登录的 Bearer 令牌】调后端 /api/auth/oauth/authorize 静默签码，
 * 拿回 redirectTo（应用侧带 code 的回跳地址）后整页跳转；应用侧换票即登录，无需再次输密码。
 * 与 AuthorizeView 用的是同一个 oauthAuthorize，已验证可用。
 * 无 redirectUri 的存量应用退化为打开 baseUrl，由应用自身守卫完成登录。
 */
async function enter(app: ApplicationVO) {
  enterError.value = ''
  const target = (app.redirectUri && app.redirectUri.trim()) || (app.baseUrl || '').trim()
  if (!target) {
    enterError.value = '该应用未配置访问地址'
    return
  }

  // 必须在 await 之前同步开窗：异步回调里的 window.open 会被浏览器当成弹窗拦截。
  // 先开一个空白页签占位，拿到 redirectTo 后再把它的 location 改掉。
  const tab = window.open('about:blank', '_blank')

  entering.value = app.code
  try {
    const res = await oauthAuthorize({
      responseType: 'code',
      clientId: app.code,
      redirectUri: target,
      state: randomState()
    })
    // 拿回的 redirectTo 形如 http://localhost:5177/callback?code=xxx&state=yyy
    const url = res.data.redirectTo
    if (tab) {
      tab.location.href = url
      // 断开新页签与本控制台的 opener 引用，防止目标站点反向操作当前页
      try {
        tab.opener = null
      } catch {
        /* 跨源后不可写，忽略 */
      }
    } else {
      // 被拦截（多数是浏览器设置问题）时退化为新开一次，再不行才当前页跳
      const fallback = window.open(url, '_blank')
      if (!fallback) window.location.href = url
    }
  } catch (e: any) {
    // 签码失败：关掉占位页签，控制台留在原地
    try {
      tab?.close()
    } catch {
      /* ignore */
    }
    enterError.value = e?.message || '跳转失败'
  } finally {
    entering.value = ''
  }
}
</script>

<style scoped>
/* 上方两张卡统一高度，保证「我的应用」与「当前账号」严格等高 */
.dash-row {
  --dash-card-height: 180px;
}

.equal-card {
  /* height:100% 让同行卡片被拉伸到同一高度，
     min-height 兜底保证不会低于统一基准高度 */
  height: 100%;
  min-height: var(--dash-card-height);
  display: flex;
  flex-direction: column;
}

.equal-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* 数字卡在下方，与上方卡片留出间距 */
.stat-row {
  margin-top: 16px;
}

.stat-card {
  height: 100%;
  cursor: pointer;
}

.stat-card :deep(.ant-card-body) {
  min-height: 160px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
}

/* 色块图标 + 数字/说明：与配置中心概览统计卡保持同一视觉语言 */
.stat-main {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.stat-icon {
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 22px;
}

.stat-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.stat-value {
  color: var(--text-base, var(--color-text, inherit));
  font-size: 30px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.stat-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat-label {
  color: var(--muted);
  font-size: 13px;
}

.stat-note {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}

.tip {
  font-size: 12px;
  color: var(--muted);
}

.link {
  cursor: pointer;
}

/* 通知列表：与员工快捷查询同高，卡片体内滚动，空态居中 */
.notice-card {
  flex: 1;
  min-width: 0;
}

.notice-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.notice-table {
  flex: 0 0 auto;
}

.notice-title {
  font-weight: 500;
}

.pin-tag {
  margin-left: 6px;
}

.notice-target {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
  white-space: nowrap;
}

.notice-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.notice-table :deep(.ant-table-tbody > tr) {
  cursor: pointer;
}

.notice-table :deep(.read-row > td) {
  color: #9aa4b2;
}

.notice-table :deep(.read-row) .notice-title {
  color: #9aa4b2;
}

.notice-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}

.notice-content {
  max-height: 56vh;
  overflow-y: auto;
  line-height: 1.8;
  word-break: break-word;
}

.notice-content :deep(h3) {
  margin: 8px 0 6px;
  font-size: 16px;
  font-weight: 600;
}

/* 概览页内容较多（卡片 + 统计图 + 查询 + 通知），交给父级 .content 滚动，
   这里不再强制 100% + flex 撑满，否则新增的统计图会被压缩 */
.dash-page {
  width: 100%;
}

/* 员工快捷查询：与「当前账号」同列宽（span=8），给定最小高度即可，不再吃满剩余空间 */
.lookup-row {
  min-height: 300px;
  margin-top: 16px;
}

/* 统计图区：卡片内固定高度，折线自适应宽度 */
.chart-row {
  margin-top: 16px;
}

.chart-card {
  height: 100%;
}

.chart-card :deep(.ant-card-body) {
  min-height: 220px;
}

.line-chart {
  position: relative;
  width: 100%;
  height: 200px;
}

.line-chart svg {
  width: 100%;
  height: 100%;
  display: block;
}

.chart-axis-text {
  fill: var(--muted, #8c8c8c);
  font-size: 11px;
}

.chart-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.success { background: #2f54eb; }
.dot.fail { background: #fa541c; }

.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 环形图 + 中心数字 */
.donut-card :deep(.ant-card-body) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 220px;
}

.donut-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  flex: 0 0 auto;
}

.donut {
  width: 120px;
  height: 120px;
}

.donut-center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.donut-center b {
  font-size: 22px;
  line-height: 1.1;
}

.donut-center span {
  font-size: 11px;
  color: var(--muted);
}

.donut-legend {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.legend-name {
  flex: 1;
  color: var(--muted);
}

/* 登录方式条形图 */
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.bar-head {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 5px;
}

.bar-head span { color: var(--muted); }

.bar-track {
  height: 8px;
  border-radius: 4px;
  background: var(--border-subtle, #f0f0f0);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
}

/* 6 张规模卡比上面的卡略紧凑 */
.mini-stat-card :deep(.ant-card-body) {
  min-height: 92px;
  padding: 14px;
}

.mini-stat-card .stat-icon {
  width: 40px;
  height: 40px;
  font-size: 19px;
}

.stat-value.small {
  font-size: 24px;
}

.lookup-row :deep(.ant-col),
.lookup-row .lookup-card {
  display: flex;
  flex-direction: column;
}

.lookup-card {
  flex: 1;
}

.lookup-card :deep(.ant-card-body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.lookup-input {
  width: 100%;
}

.lookup-result {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  min-height: 0;
}

/* a-spin 多包了一层容器，flex 高度要继续传下去 */
.lookup-result :deep(.ant-spin-container) {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 结果多时卡片内部滚动，不把卡片撑破 */
.lookup-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

/* 未查询 / 无结果：空状态用 auto 外边距在卡片剩余区域内水平、垂直居中（不改成 flex，避免图标和文字横向排布） */
.lookup-empty {
  margin: auto;
}

/* 表格式对齐：姓名、职位、邮件每行都从同一列起点开始 */
.lookup-item {
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) minmax(0, 1.25fr) auto;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border-subtle);
}

.lookup-item:last-child {
  border-bottom: none;
}

/* 让姓名/职位/邮件直接参与外层网格，保证逐行对齐 */
.lookup-main {
  display: contents;
}

.lookup-name {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.lookup-meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-grid {
  display: grid;
  /* 150 起步：4 个应用在 1440 宽的窗口里也能排成一行，不会出现 3+1 的孤儿磁贴 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  /* 磁贴网格撑满卡片体剩余高度，每行等高拉伸 */
  flex: 1;
  grid-auto-rows: 1fr;
  gap: 12px;
}

.app-tile {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.app-tile:hover {
  /* 用品牌蓝的半透明高亮，避免深色下出现刺眼的浅蓝描边 */
  border-color: rgba(47, 84, 235, 0.7);
  box-shadow: 0 4px 16px rgba(47, 84, 235, 0.22);
}

/* 应用 logo：与浏览器 favicon 同一套图形，保持品牌一致 */
.app-logo {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: block;
  margin-bottom: 2px;
}

/* 把「进入」按钮推到磁贴底部，跨磁贴水平对齐（磁贴高度被网格撑成等高） */
.app-tile :deep(.ant-btn) {
  margin-top: auto;
}

.app-name {
  font-weight: 600;
  font-size: 14px;
}

.app-code {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}
</style>
