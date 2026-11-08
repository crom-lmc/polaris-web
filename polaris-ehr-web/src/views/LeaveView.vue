<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-radio-group v-model:value="scope" button-style="solid" @change="onScopeChange">
          <a-radio-button value="mine">我的请假</a-radio-button>
          <a-radio-button v-if="canApprove" value="all">审批列表</a-radio-button>
        </a-radio-group>
        <a-select
          v-model:value="statusFilter"
          :options="statusFilterOptions"
          allow-clear
          placeholder="全部状态"
          style="width: 130px"
          @change="reload"
        />
        <a-button @click="reload">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
      <div class="toolbar-right">
        <a-button v-if="canApply" type="primary" @click="openApply">
          <template #icon><plus-outlined /></template>
          申请请假
        </a-button>
      </div>
    </div>

    <section class="panel ft-grow">
      <div class="panel-head">
        <span>{{ scope === 'mine' ? '我的请假记录' : '全部请假记录' }}</span>
        <span class="muted">
          {{ scope === 'mine' ? '共 ' + total + ' 条' : '审批动作在「审批中心」处理，这里可查看全部单据与流程' }}
        </span>
      </div>
      <div class="panel-body table-body ft-scroll ft-bottom">
        <a-table class="ft-table"
          :class="{ 'tbl-empty-mode': !loading && !rows.length }"
          table-layout="fixed"
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="id"
          size="middle"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!loading" description="暂无请假申请" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'type'">
              <a-tag color="blue">{{ record.leaveTypeName }}</a-tag>
            </template>
            <template v-else-if="column.key === 'range'">
              <div>{{ record.startDate }} ~ {{ record.endDate }}</div>
              <div class="muted cell-sub">{{ record.days }} 天</div>
            </template>
            <template v-else-if="column.key === 'applicant'">
              <div class="cell-sub">{{ record.applicantName }}</div>
              <div class="muted cell-sub">{{ record.createdAt }}</div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="!record.approvalInstanceId && record.status === 0" class="muted">审批中心流转中</div>
              <div v-else-if="record.status === 1 || record.status === 2" class="muted">
                {{ record.approverName || '—' }}<span v-if="record.approveNote">：{{ record.approveNote }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a
                  v-if="runningBriefForRow(record)"
                  class="act"
                  @click="openApprovalDetail(runningBriefForRow(record)!.id)"
                >审批详情</a>
                <a
                  v-else-if="rejectedBriefForRow(record)"
                  class="act"
                  @click="openApprovalDetail(rejectedBriefForRow(record)!.id)"
                >审批信息</a>
                <a-popconfirm
                  v-if="record.status === 0 && record.mine && canApply"
                  title="撤销后需要重新提交，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancel(record)"
                >
                  <a class="act danger">撤销</a>
                </a-popconfirm>
                <span
                  v-if="!runningBriefForRow(record) && !rejectedBriefForRow(record) && !(record.status === 0 && record.mine)"
                  class="muted"
                >—</span>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </section>

    <a-modal
      v-model:open="applyOpen"
      title="申请请假"
      :confirm-loading="saving"
      ok-text="提交申请"
      cancel-text="取消"
      width="560px"
      centered
      destroy-on-close
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item label="请假类型" required>
          <a-select v-model:value="applyForm.leaveType" :options="leaveTypeOptions" />
        </a-form-item>
        <a-form-item label="请假日期" required>
          <a-range-picker
            v-model:value="applyForm.range"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :placeholder="['开始日期', '结束日期']"
          />
        </a-form-item>
        <a-alert v-if="days" type="info" show-icon :message="`共 ${days} 天（按自然日计算）`" class="mb12" />
        <a-form-item
          v-if="delegateCtx.required"
          label="审批转办给谁"
          required
          extra="你是部门负责人，请假期间需要你审批的事项将转给该人代审，必须指定"
        >
          <a-select
            v-model:value="applyForm.delegateAccountId"
            show-search
            :options="delegateSelectOptions"
            placeholder="请选择审批转办人"
          />
        </a-form-item>
        <a-form-item label="请假事由" required>
          <a-textarea v-model:value="applyForm.reason" :rows="3" :maxlength="500" show-count />
        </a-form-item>
        <a-alert
          type="warning"
          show-icon
          message="提交前请确认已关联员工档案"
          description="账号未关联员工档案时无法提交，请先联系 HR 在「人员管理」建档。"
        />
      </a-form>
    </a-modal>

    <!-- 审批动作、流程进度、意见都在审批中心抽屉里完成，本页不再本地审批 -->
    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="load"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  applyLeave,
  cancelLeave,
  leaveDelegateOptions as fetchLeaveDelegateOptions,
  leaveTypeOptions as fetchLeaveTypeOptions,
  pageLeaves,
  type LeaveDelegateOptions,
  type LeaveItem,
  type TypeOption
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  briefsForRow,
  buildBizRefs,
  fetchLatestApprovals,
  runningBriefOf,
  rejectedBriefOf,
  type ApprovalBrief
} from '@/api/approvals'

const store = useUserStore()
const canApply = computed(() => store.can('leave:apply'))
const canApprove = computed(() => store.can('leave:approve') || store.can('approval:approve'))

const scope = ref<'mine' | 'all'>('mine')
const statusFilter = ref<number | undefined>(undefined)
const rows = ref<LeaveItem[]>([])

/** 当前页每张请假单的最新审批单；终态实例号已被回调清空，驳回提示靠反查审批中心 */
const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadApprovalBriefs(list: LeaveItem[]) {
  const refs = buildBizRefs(list.map((r) => r.id), ['ehr.leave'])
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

/** 只有审批中心里确实在途的单才算「审批中」；业务行残留的已完成实例号不算 */
function runningBriefForRow(r: LeaveItem) {
  return runningBriefOf(
    briefsForRow(approvalBriefs.value, r.id),
    r.status === 0 ? r.approvalInstanceId : null,
    r.approvalBizType
  )
}

/** 审批完成后不再给详情入口，只有被驳回时需要查看驳回意见 */
function rejectedBriefForRow(r: LeaveItem) {
  return rejectedBriefOf(briefsForRow(approvalBriefs.value, r.id))
}
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(10)

const statusFilterOptions = [
  { value: 0, label: '待审批' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已驳回' }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const columns = [
  { title: '申请人', key: 'applicant', width: 170 },
  { title: '类型', key: 'type', width: 110 },
  { title: '请假日期', key: 'range', width: 200 },
  { title: '事由', dataIndex: 'reason', key: 'reason', ellipsis: true },
  { title: '状态 / 审批', key: 'status', width: 220 },
  // 操作列容下「审批详情 / 撤销」两个按钮，窄了会被挤成竖排
  { title: '操作', key: 'action', width: 220 }
]

async function load() {
  loading.value = true
  try {
    const data = await pageLeaves({
      scope: scope.value,
      status: statusFilter.value,
      page: page.value,
      size: size.value
    })
    rows.value = data.list || []
    total.value = data.total || 0
    void loadApprovalBriefs(rows.value)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}

function onScopeChange() {
  // 审批列表默认只看待审批，避免历史单据淹没待办
  statusFilter.value = scope.value === 'all' ? 0 : undefined
  reload()
}

function onTableChange(p: any) {
  page.value = p.current
  size.value = p.pageSize
  load()
}

function statusColor(status: number) {
  return status === 0 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

/* ---------- 申请 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const applyForm = reactive<{
  leaveType: string
  range: string[] | undefined
  reason: string
  delegateAccountId?: string
}>({
  leaveType: 'ANNUAL',
  range: undefined,
  reason: ''
})

/** 部门负责人请假必须指定审批转办人；普通人打开弹窗时 required=false，隐藏该字段 */
const delegateCtx = ref<LeaveDelegateOptions>({ required: false, options: [] })
const delegateSelectOptions = computed(() =>
  delegateCtx.value.options.map((o) => ({
    value: o.accountId,
    label: o.orgName ? `${o.name}（${o.orgName}）` : o.name
  }))
)

/** 请假类型来自配置中心（ehr.leave_type 字典）；接口失败时后端有内置兜底，这里仅留空提示 */
const leaveTypeOptions = ref<TypeOption[]>([])

const days = computed(() => {
  const r = applyForm.range
  if (!r || r.length !== 2) return 0
  return dayjs(r[1]).diff(dayjs(r[0]), 'day') + 1
})

function openApply() {
  applyForm.leaveType = 'ANNUAL'
  applyForm.range = undefined
  applyForm.reason = ''
  applyForm.delegateAccountId = undefined
  delegateCtx.value = { required: false, options: [] }
  applyOpen.value = true
  fetchLeaveDelegateOptions()
    .then((d) => (delegateCtx.value = d))
    .catch(() => {})
}

async function submitApply() {
  if (!applyForm.range || applyForm.range.length !== 2) {
    message.warning('请选择请假日期')
    return
  }
  if (delegateCtx.value.required && !applyForm.delegateAccountId) {
    message.warning('你是部门负责人，必须指定审批转办人')
    return
  }
  if (!applyForm.reason.trim()) {
    message.warning('请填写请假事由')
    return
  }
  saving.value = true
  try {
    await applyLeave({
      leaveType: applyForm.leaveType,
      startDate: applyForm.range[0],
      endDate: applyForm.range[1],
      reason: applyForm.reason.trim(),
      delegateAccountId: applyForm.delegateAccountId
    })
    message.success('已提交，等待审批')
    applyOpen.value = false
    reload()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    saving.value = false
  }
}

/* ---------- 审批详情：通过/驳回/转办/加签/撤回统一走审批中心 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

async function doCancel(row: LeaveItem) {
  try {
    await cancelLeave(row.id)
    message.success('已撤销')
    load()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

onMounted(() => {
  if (!canApply.value && canApprove.value) {
    scope.value = 'all'
    statusFilter.value = 0
  }
  load()
  fetchLeaveTypeOptions().then((opts) => (leaveTypeOptions.value = opts)).catch(() => {})
})
</script>

<style scoped>
/* 横向滚动由 .panel-body/.ft-scroll 承担，操作列由 .ft-table 固定 */
.page-root {
  --ft-min-width: 1100px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.table-body {
  padding: 0;
}

/* 操作列：按钮一律横排、文字不换行，避免被挤成竖排 */
:deep(.ant-table-tbody > tr > td:last-child) {
  white-space: nowrap;
}
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  white-space: nowrap;
}
.row-actions > * {
  flex: 0 0 auto;
}
.row-actions .act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 13px;
  line-height: 1;
  transition: background-color 0.15s;
}
.row-actions .act:hover {
  background: var(--code-bg);
}
.row-actions .act.danger:hover {
  background: rgba(255, 77, 79, 0.1);
}

.mb12 {
  margin-bottom: 12px;
}

.danger {
  color: #ff4d4f;
}

</style>
