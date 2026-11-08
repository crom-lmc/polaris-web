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
      <a-button @click="load">刷新</a-button>
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <section class="ft-scroll ft-bottom">
    <a-table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
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

    <ApprovalDetailDrawer
      v-model:open="drawerOpen"
      :instance-id="activeId"
      :mode="drawerMode"
      @done="load"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { fetchApprovals, type ApprovalScope } from '@/api/approvals'
import { fmtTime } from '@/utils/time'
import ApprovalDetailDrawer from './components/ApprovalDetailDrawer.vue'
import type { ApprovalInstance } from '@/types'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const store = useUserStore()

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
const scopes = computed(() => allScopes.filter((t) => store.can(SCOPE_PERMS[t.key])))

const scope = ref<ApprovalScope>((route.query.scope as ApprovalScope) || 'pending')
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
    onClick: () => openDetail(record)
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
  load()
}

async function load() {
  const target = scope.value
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
