<template>
  <div class="approval-page ft-page">
    <div class="head ft-head">
      <a-tabs v-model:activeKey="scope" class="tabs" @change="handleScopeChange">
        <a-tab-pane v-for="t in scopes" :key="t.key">
          <template #tab>
            <span class="tab">
              {{ t.label }}
              <a-badge
                v-if="t.key === 'pending' && pendingCount > 0"
                :count="pendingCount"
                :overflow-count="99"
                class="badge"
              />
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
      <div class="head-actions">
        <a-space v-if="scope === 'pending' && selectedRowKeys.length">
          <span class="muted">已选 {{ selectedRowKeys.length }} 条</span>
          <a-button size="small" type="primary" @click="openBatch(true)">批量通过</a-button>
          <a-button size="small" danger @click="openBatch(false)">批量驳回</a-button>
        </a-space>
        <a-dropdown v-if="store.can('approval:ops')">
          <a-button>导出</a-button>
          <template #overlay>
            <a-menu @click="handleExport">
              <a-menu-item key="pending">我的待办（CSV）</a-menu-item>
              <a-menu-item key="instances">审批流水（CSV）</a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-button @click="load">刷新</a-button>
      </div>
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <section v-if="scope !== 'ops'" class="ft-scroll ft-bottom">
    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :row-key="rowKey"
      :row-selection="rowSelection"
      size="middle"
      :custom-row="rowProps"
      class="tbl ft-table"
      :class="{ 'tbl-approved': scope === 'approved', 'tbl-empty-mode': !loading && !rows.length }"
      @change="handleTableChange"
    >
      <!-- 空态直接用业务文案，避免 antd 默认「暂无数据」与页面级 a-empty 叠成两个 -->
      <template #emptyText>
        <div class="tbl-empty">
          <a-empty v-if="!loading" :description="emptyText" />
        </div>
      </template>

      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'approvalType'">
          <a-tag color="blue">{{ record.bizName || record.bizType }}</a-tag>
        </template>

        <template v-else-if="column.key === 'title'">
          <div class="title-cell">
            <span class="tt">{{ record.title || record.bizName || '未命名单据' }}</span>
            <span class="sub">{{ record.bizName || record.bizType }}<template v-if="record.apprNo"> · {{ record.apprNo }}</template></span>
          </div>
        </template>

        <template v-else-if="column.key === 'applicant'">
          <div class="applicant">
            <a-avatar :size="22" class="av">{{ (record.applicantName || '?').slice(0, 1) }}</a-avatar>
            <span>{{ record.applicantName || '—' }}</span>
          </div>
        </template>

        <template v-else-if="column.key === 'progress'">
          <span v-if="record.status === 0" class="progress">
            第 {{ record.currentStep || 1 }} / {{ record.totalStep || 1 }} 步
          </span>
          <span v-else class="muted">—</span>
        </template>

        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ record.statusName || statusText(record.status) }}</a-tag>
          <a-tooltip v-if="record.callbackStatus === 3" title="审批已结束，但结果没能回传到业务系统">
            <a-tag color="orange" class="warn-tag">业务未同步</a-tag>
          </a-tooltip>
        </template>

        <template v-else-if="column.key === 'myApproval'">
          <div class="my-approval">
            <a-tag :color="record.myApprovalStatus === 2 ? 'red' : 'green'">
              {{ record.myApprovalStatusName || '已审批' }}
            </a-tag>
            <span class="muted">{{ fmtTime(record.myApprovalAt) }}</span>
            <div v-if="record.myApprovalStepName || record.myApprovalOpinion" class="my-approval-sub">
              <span v-if="record.myApprovalStepName">{{ record.myApprovalStepName }}</span>
              <a-tooltip v-if="record.myApprovalOpinion" :title="record.myApprovalOpinion">
                <span>{{ record.myApprovalOpinion }}</span>
              </a-tooltip>
            </div>
          </div>
        </template>

        <template v-else-if="column.key === 'createdAt'">
          <span class="muted">{{ fmtTime(record.createdAt) }}</span>
        </template>

        <template v-else-if="column.key === 'action'">
          <a-space @click.stop>
            <a-button type="link" size="small" @click="openDetail(record, 'view')">查看</a-button>
            <a-button
              v-if="scope === 'pending' || record.myTaskId"
              type="link"
              size="small"
              @click="openDetail(record, 'approve')"
            >
              审批
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <!-- 运营：时效卡片 + 积压看板 + 审批人时效 -->
    <section v-if="scope === 'ops'" class="ft-scroll ops">
      <div class="ops-filters">
        <a-range-picker
          v-model:value="opsRange"
          value-format="YYYY-MM-DD"
          :placeholder="['开始日期', '结束日期']"
          @change="loadOps"
        />
        <a-button @click="loadOps">查询</a-button>
        <span class="muted">统计口径：按发起时间过滤；时长只计已结束单据</span>
      </div>

      <a-spin :spinning="opsLoading">
        <div class="ops-body">
        <div class="stat-grid">
          <div v-for="c in statCards" :key="c.key" class="stat-card">
            <div class="stat-label">{{ c.label }}</div>
            <div class="stat-value" :class="c.tone">{{ c.value }}</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span>积压单据</span>
            <span class="muted">在途且当前步骤有待办，按等待时长倒序</span>
          </div>
          <a-table
            :columns="backlogColumns"
            :data-source="backlogRows"
            :pagination="false"
            row-key="id"
            size="small"
          >
            <template #emptyText>
              <div class="tbl-empty">
                <a-empty :description="stats && stats.backlog ? '暂无积压单据' : '当前没有在途单据'" />
              </div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'spec'">
                <div class="title-cell">
                  <span class="tt">{{ record.title || record.bizName || '未命名单据' }}</span>
                  <span class="sub">
                    {{ record.bizName || record.bizType }}<template v-if="record.apprNo"> · {{ record.apprNo }}</template>
                  </span>
                </div>
              </template>
              <template v-else-if="column.key === 'waiting'">
                <span :class="{ 'overdue-text': record.overdue }">{{ fmtHours(record.waitingHours) }}</span>
                <a-tag v-if="record.overdue" color="red" class="warn-tag">超时</a-tag>
              </template>
              <template v-else-if="column.key === 'sla'">
                <span :class="record.slaHours ? '' : 'muted'">
                  {{ record.slaHours ? `${record.slaHours} 小时` : '未设置' }}
                </span>
              </template>
              <template v-else-if="column.key === 'urge'">
                <a-space>
                  <span class="muted">{{ record.urgeCount || 0 }} 次</span>
                  <a-popconfirm
                    title="给当前待办审批人发催办提醒？"
                    ok-text="催办"
                    @confirm="handleUrge(record)"
                  >
                    <a-button type="link" size="small" @click.stop>催办</a-button>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>

        <div class="panel">
          <div class="panel-head">
            <span>审批人时效</span>
            <span class="muted">按处理量排序，时长=任务创建到处理的时间</span>
          </div>
          <a-table
            :columns="approverColumns"
            :data-source="approverRows"
            :pagination="false"
            row-key="approverId"
            size="small"
          >
            <template #emptyText>
              <div class="tbl-empty">
                <a-empty description="统计周期内还没有已处理的审批任务" />
              </div>
            </template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'avg'">{{ fmtHours(record.avgHours) }}</template>
              <template v-else-if="column.key === 'p90'">{{ fmtHours(record.p90Hours) }}</template>
            </template>
          </a-table>
        </div>
        </div>
      </a-spin>
    </section>

    <ApprovalDetailDrawer
      v-model:open="drawerOpen"
      :instance-id="activeId"
      :mode="drawerMode"
      @done="load"
    />

    <!-- 批量审批：统一意见，逐条提交，部分失败会在结果里列出原因 -->
    <a-modal
      v-model:open="batch.open"
      :title="batch.pass ? '批量通过审批' : '批量驳回审批'"
      :confirm-loading="batch.loading"
      ok-text="确定"
      @ok="submitBatch"
    >
      <p class="batch-tip">
        将对已选的 {{ selectedRowKeys.length }} 条待办统一{{ batch.pass ? '通过' : '驳回' }}，
        单条失败不会影响其它单据。
      </p>
      <a-textarea
        v-model:value="batch.note"
        :rows="3"
        :maxlength="200"
        show-count
        :placeholder="batch.pass ? '审批意见（可选）' : '请填写驳回意见（可选）'"
      />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import {
  batchApproveTasks,
  exportApprovals,
  fetchApprovalBacklog,
  fetchApprovals,
  fetchApprovalStats,
  fetchApproverStats,
  urgeApproval,
  type ApprovalApproverStats,
  type ApprovalBacklogItem,
  type ApprovalOpsQuery,
  type ApprovalScope,
  type ApprovalStats
} from '@/api/approvals'
import { fmtTime } from '@/utils/time'
import ApprovalDetailDrawer from './components/ApprovalDetailDrawer.vue'
import type { ApprovalInstance } from '@/types'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const store = useUserStore()

/** 页签键：五个办理视图 + 运营（运营需要 approval:ops） */
type TabKey = ApprovalScope | 'ops'

/** 页签 -> 基本权限码：审批是基本权限，所有角色默认拥有，缺少该码时隐藏页签 */
const SCOPE_PERMS: Record<ApprovalScope, string> = {
  pending: 'approval:todo',
  approved: 'approval:done',
  mine: 'approval:started',
  cc: 'approval:cc',
  delegated: 'approval:delegated'
}

const allScopes: Array<{ key: ApprovalScope; label: string }> = [
  { key: 'pending', label: '待我审批' },
  { key: 'approved', label: '已审批' },
  { key: 'mine', label: '我发起的' },
  { key: 'cc', label: '抄送我' },
  { key: 'delegated', label: '我委托的' }
]
const scopes = computed<Array<{ key: TabKey; label: string }>>(() => [
  ...allScopes.filter((t) => store.can(SCOPE_PERMS[t.key])),
  ...(store.can('approval:ops') ? [{ key: 'ops' as const, label: '运营' }] : [])
])

const scope = ref<TabKey>((route.query.scope as TabKey) || 'pending')
/** 当前页签无权限时自动落到第一个可见页签 */
watch(
  scopes,
  (list) => {
    if (list.length && !list.some((t) => t.key === scope.value)) scope.value = list[0].key
  },
  { immediate: true }
)
const loading = ref(false)
const rows = ref<ApprovalInstance[]>([])
const errorMsg = ref('')
const drawerOpen = ref(false)
const activeId = ref<string | null>(null)
/** view=只读查看（不显示通过/驳回）；approve=可处理 */
const drawerMode = ref<'view' | 'approve'>('view')
const current = ref(1)
const pageSize = ref(10)

/** 接口一次返回全量单据，这里做前端分页；分页条由 .ft-bottom 固定到滚动容器底部 */
const pagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: rows.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

function handleTableChange(pag: any) {
  current.value = pag?.current || 1
  pageSize.value = pag?.pageSize || pageSize.value
}

/** 待办数量角标：独立维护，只在「待我审批」接口真正返回后更新。
 *  不能直接用 rows.length，否则切页签时 rows 还停留在上一个页签的数据，
 *  会出现「我发起的」有 11 行 → 切到「待我审批」角标闪一下 11 的问题。 */
const pendingCount = ref(0)

/** 列宽总和保持 1000px（与 .tbl 的 --ft-min-width 一致），加「审批类型」后不触发横向滚动 */
const baseColumns = [
  { title: '审批类型', key: 'approvalType', width: 130 },
  { title: '单据', key: 'title', width: 220, ellipsis: true },
  { title: '发起人', key: 'applicant', width: 120 },
  { title: '进度', key: 'progress', width: 110 },
  { title: '状态', key: 'status', width: 140 },
  { title: '提交时间', key: 'createdAt', width: 160 },
  // 不再用 antd 的 fixed:'right'：它会在表格内部再开一层横向滚动条。
  // 操作列固定统一交给 global.css 的 .ft-table（sticky right），滚动只发生在 .ft-scroll。
  { title: '操作', key: 'action', width: 120 }
]

/** 「已审批」额外显示我这一票的结果、时间与意见；其它视图保持原有列 */
const columns = computed(() => {
  if (scope.value !== 'approved') return baseColumns
  return [
    ...baseColumns.slice(0, 4),
    { title: '我的审批', key: 'myApproval', width: 200 },
    ...baseColumns.slice(4)
  ]
})

const emptyText = computed(() => {
  if (scope.value === 'ops') return ''
  const map: Record<ApprovalScope, string> = {
    pending: '没有待你审批的单据',
    approved: '你还没有审批过单据',
    mine: '你还没有发起过审批',
    cc: '暂无抄送给你的单据',
    delegated: '你没有设置委托代收'
  }
  return map[scope.value]
})

function statusText(s?: number) {
  return ({ 0: '进行中', 1: '已通过', 2: '已驳回', 3: '已撤回', 4: '已终止' } as Record<number, string>)[s ?? -1] || '未知'
}

function statusColor(s?: number) {
  return ({ 0: 'processing', 1: 'green', 2: 'red', 3: 'default', 4: 'default' } as Record<number, string>)[s ?? -1] || 'default'
}

function rowProps(record: ApprovalInstance) {
  return {
    style: 'cursor: pointer',
    onClick: (e: MouseEvent) => {
      // 多选列 / 复选框的点击只勾选，不要顺带打开详情抽屉
      const target = e.target as HTMLElement | null
      if (target?.closest('.ant-checkbox-wrapper') || target?.closest('.ant-table-selection-column')) return
      openDetail(record)
    }
  }
}

/** view=只读查看（不显示通过/驳回）；approve=带处理按钮 */
function openDetail(record: ApprovalInstance, mode: 'view' | 'approve' = 'view') {
  activeId.value = record.id
  drawerMode.value = mode
  drawerOpen.value = true
}

/** 切换页签：先清空旧数据再请求，避免上一页签的行数与角标在新页签上短暂闪现 */
function handleScopeChange() {
  rows.value = []
  selectedRowKeys.value = []
  load()
}

async function load() {
  if (scope.value === 'ops') {
    await loadOps()
    return
  }
  const target = scope.value as ApprovalScope
  // 切换视图 / 刷新后回到第一页，避免停在一个已经不存在的页码上
  current.value = 1
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchApprovals(target)
    const list = res.data || []
    // 角标是全局待办数，与当前停留页签无关，拿到就更新
    if (target === 'pending') pendingCount.value = list.length
    // 请求返回时用户已切到别的页签：丢弃这批数据，避免覆盖当前页签内容
    if (target !== scope.value) return
    rows.value = list
  } catch (e) {
    if (target !== scope.value) return
    rows.value = []
    errorMsg.value = (e as Error).message
  } finally {
    if (target === scope.value) loading.value = false
  }
}

/* ---------------- 批量审批（待我审批页签） ---------------- */

const selectedRowKeys = ref<string[]>([])
const batch = reactive({ open: false, pass: true, note: '', loading: false })

/** 待办行用「我的任务 ID」做 rowKey，勾选结果可直接当批量接口的 taskIds */
const rowKey = computed(() => (scope.value === 'pending' ? 'myTaskId' : 'id'))

const rowSelection = computed(() =>
  scope.value === 'pending'
    ? {
        selectedRowKeys: selectedRowKeys.value,
        preserveSelectedRowKeys: true,
        onChange: (keys: Array<string | number>) => {
          selectedRowKeys.value = keys.map(String)
        }
      }
    : undefined
)

function openBatch(pass: boolean) {
  if (!selectedRowKeys.value.length) {
    message.warning('请先勾选待办')
    return
  }
  batch.pass = pass
  batch.note = ''
  batch.open = true
}

async function submitBatch() {
  batch.loading = true
  try {
    const res = await batchApproveTasks(selectedRowKeys.value, batch.pass, batch.note)
    const okCount = res.data?.success?.length || 0
    const failed = res.data?.failed || []
    batch.open = false
    selectedRowKeys.value = []
    await load()
    if (okCount) message.success(`已成功处理 ${okCount} 条`)
    if (failed.length) {
      Modal.warning({
        title: `${failed.length} 条未处理`,
        content:
          failed
            .slice(0, 8)
            .map((f) => `${f.taskId}：${f.reason}`)
            .join('；') + (failed.length > 8 ? ' …' : '')
      })
    }
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    batch.loading = false
  }
}

/* ---------------- 运营：时效 / 积压 / 催办 / 导出 ---------------- */

const opsLoading = ref(false)
const stats = ref<ApprovalStats | null>(null)
const approverRows = ref<ApprovalApproverStats[]>([])
const backlogRows = ref<ApprovalBacklogItem[]>([])
const opsRange = ref<string[] | null>(null)

const backlogColumns = [
  { title: '单据', key: 'spec', width: 280, ellipsis: true },
  { title: '发起人', dataIndex: 'applicantName', width: 100 },
  { title: '当前步骤', dataIndex: 'stepName', width: 120, ellipsis: true },
  { title: '已等待', key: 'waiting', width: 140 },
  { title: '时效', key: 'sla', width: 100 },
  { title: '催办', key: 'urge', width: 120 }
]

const approverColumns = [
  { title: '审批人', dataIndex: 'approverName', width: 140, ellipsis: true },
  { title: '处理量', dataIndex: 'handled', width: 90 },
  { title: '通过', dataIndex: 'approved', width: 80 },
  { title: '驳回', dataIndex: 'rejected', width: 80 },
  { title: '平均时长', key: 'avg', width: 110 },
  { title: 'P90 时长', key: 'p90', width: 110 }
]

/** 空值一律给占位，页面上不出现 NaN */
function fmtHours(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const n = Number(v)
  if (n < 1) return `${Math.round(n * 60)} 分钟`
  return `${n.toFixed(1)} 小时`
}

function fmtPercent(v?: number | null) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  return `${Number(v).toFixed(1)}%`
}

const statCards = computed(() => {
  const s = stats.value
  return [
    { key: 'total', label: '审批总量', value: s?.total ?? 0, tone: '' },
    { key: 'approved', label: '已通过', value: s?.approved ?? 0, tone: 'ok' },
    { key: 'rejected', label: '已驳回', value: s?.rejected ?? 0, tone: 'bad' },
    { key: 'backlog', label: '积压中', value: s?.backlog ?? 0, tone: 'warn' },
    { key: 'avg', label: '平均处理时长', value: fmtHours(s?.avgHours), tone: '' },
    { key: 'p90', label: 'P90 处理时长', value: fmtHours(s?.p90Hours), tone: '' },
    { key: 'rejectRate', label: '驳回率', value: fmtPercent(s?.rejectRate), tone: 'bad' }
  ]
})

function opsQuery(): ApprovalOpsQuery {
  const q: ApprovalOpsQuery = {}
  if (opsRange.value && opsRange.value.length === 2) {
    q.from = opsRange.value[0]
    q.to = opsRange.value[1]
  }
  return q
}

async function loadOps() {
  opsLoading.value = true
  errorMsg.value = ''
  try {
    const params = opsQuery()
    const [statRes, approverRes, backlogRes] = await Promise.all([
      fetchApprovalStats(params),
      fetchApproverStats(params),
      fetchApprovalBacklog({ ...params, limit: 100 })
    ])
    stats.value = statRes.data
    approverRows.value = approverRes.data || []
    backlogRows.value = backlogRes.data || []
  } catch (e) {
    errorMsg.value = (e as Error).message
  } finally {
    opsLoading.value = false
  }
}

async function handleUrge(record: ApprovalBacklogItem) {
  try {
    await urgeApproval(record.id)
    message.success('已发送催办提醒')
    await loadOps()
  } catch (e) {
    message.error((e as Error).message)
  }
}

/** 导出 CSV：内容带 BOM，前端直接转 Blob 下载 */
async function handleExport(info: { key: string }) {
  const type = info.key === 'instances' ? 'instances' : 'pending'
  try {
    const res = await exportApprovals(type, opsQuery())
    const text = res.data || ''
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `审批${type === 'pending' ? '待办' : '流水'}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    message.success('导出成功')
  } catch (e) {
    message.error((e as Error).message)
  }
}

onMounted(load)
</script>

<style scoped>
/* 整页高度由 global.css 的 .ft-page 统一控制（顶栏 64 + 内容区上下 padding 32 = 96），
   这里不再叠加 padding，否则滚动容器会比可视区高出一截。 */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.tabs {
  flex: 1;
  min-width: 0;
}
.tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.badge :deep(.ant-badge-count) {
  box-shadow: none;
  font-size: 11px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
}
.title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title-cell .tt {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-cell .sub {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.applicant {
  display: flex;
  align-items: center;
  gap: 8px;
}
.av {
  background: rgba(99, 102, 241, 0.16);
  color: #6366f1;
  font-size: 11px;
  flex: none;
}
.progress {
  font-size: 12.5px;
}
.warn-tag {
  margin-left: 6px;
  font-size: 11px;
}
.my-approval {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}
.my-approval-sub {
  flex: 0 0 100%;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-approval-sub > * + *::before {
  content: ' · ';
}
.muted {
  color: var(--muted);
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
/* 运营页：整块在 .ft-scroll 里纵向滚动，卡片与表格共用 panel 边框 */
.ops {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ops-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
/* 运营页撑满可视高度：spin 与内容层逐级拉满，交给下面两个面板平分剩余高度 */
.ops :deep(.ant-spin-nested-loading),
.ops :deep(.ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 统计卡片、积压面板、审批人时效面板之间的统一间距 */
.ops-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}
/* 7 张时效卡片等分整行宽度，不再按 160px 最小宽度自动折行留白 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 12px;
  flex: none;
}

@media (max-width: 1200px) {
  .stat-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.stat-card {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--header-bg);
  padding: 14px 16px;
  min-width: 0;
}
.stat-label {
  font-size: 12.5px;
  color: var(--muted);
  margin-bottom: 6px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat-value.ok {
  color: #16a34a;
}
.stat-value.bad {
  color: #dc2626;
}
.stat-value.warn {
  color: #d97706;
}
.panel {
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--header-bg);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 200px;
  overflow: hidden;
}
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-weight: 600;
  margin-bottom: 10px;
  flex: none;
}
/* 面板内的表格吃掉面板剩余高度，表头吸顶、表体在面板内部滚动 */
.panel :deep(.ant-table-wrapper) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel :deep(.ant-table-wrapper .ant-spin-nested-loading),
.panel :deep(.ant-table-wrapper .ant-spin-container) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel :deep(.ant-table) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.panel :deep(.ant-table-container) {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
.panel :deep(.ant-table-content) {
  flex: 1 0 auto;
  overflow: auto;
}
.panel :deep(.ant-table-content > table) {
  height: 100%;
}
.panel :deep(.ant-table-thead > tr > th) {
  position: sticky;
  top: 0;
  z-index: 3;
  background: var(--table-head-bg, #fafafa);
}
.panel :deep(.ant-table-placeholder > td) {
  height: 100%;
  padding: 0;
  border-bottom: none;
}
/* 空态填满拉伸后的面板并居中，不受全局 .tbl-empty 最小高度影响 */
.ops-body .tbl-empty {
  min-height: 0;
  height: 100%;
}
.panel-head .muted {
  font-weight: 400;
  font-size: 12.5px;
}
.overdue-text {
  color: #dc2626;
  font-weight: 600;
}
.batch-tip {
  margin-bottom: 10px;
  color: var(--muted);
}
/* 表格最小宽度 = 列宽合计（普通视图 1000px，「已审批」多一列 1200px）。
   横向滚动由 .ft-scroll 承担，操作列由 .ft-table 的 sticky 承担。 */
.tbl {
  --ft-min-width: 1000px;
}
.tbl-approved {
  --ft-min-width: 1200px;
}
/* 空态填满整张表格区域（表头之下、分页条之上），而不是只占中间一小块。
   .ft-bottom 已经把剩余高度交给 .ant-table，这里沿着 antd 内部链继续往下传，
   直到 placeholder 行；只在无数据时生效，有数据时不改表格布局，避免拉伸行高。 */
.tbl-empty-mode :deep(.ant-table-container) {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}
.tbl-empty-mode :deep(.ant-table-content) {
  flex: 1 0 auto;
}
.tbl-empty-mode :deep(.ant-table-content > table) {
  height: 100%;
}
.tbl-empty-mode :deep(.ant-table-placeholder > td) {
  height: 100%;
  padding: 0;
  border-bottom: none;
}
.tbl-empty {
  height: 100%;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
