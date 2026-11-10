<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-radio-group v-model:value="scope" button-style="solid" @change="onScopeChange">
          <a-radio-button value="mine">我的请假</a-radio-button>
          <a-radio-button v-if="canApprove" value="all">审批列表</a-radio-button>
          <a-radio-button v-if="canViewTeam" value="team">团队请假</a-radio-button>
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

    <a-alert
      v-if="carryoverNotice"
      type="warning"
      show-icon
      class="carryover-banner"
      :message="`你还有 ${carryoverRemaining} 天上年结转年假未休完，将于 ${annualQuota?.carryoverExpireAt || ''} 到期作废，请及时休假或签署自动放弃`"
    >
      <template #action>
        <a-button size="small" danger @click="openWaive">自动放弃</a-button>
      </template>
    </a-alert>

    <section class="panel ft-grow">
      <div class="panel-head">
        <span>{{ scope === 'mine' ? '我的请假记录' : scope === 'team' ? '团队请假记录' : '全部请假记录' }}</span>
        <span class="muted">
          {{ scope === 'team' ? '按组织范围展示待审批 / 已通过记录' : scope === 'mine' ? '共 ' + total + ' 条' : '审批动作在「审批中心」处理，这里可查看全部单据与流程' }}
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
              <div>{{ leaveRangeText(record) }}</div>
              <div class="muted cell-sub">
                {{ record.days }} 天
                <span v-if="record.dayMode === 'WORKDAY'">· 工作日</span>
                <span v-if="record.returnDate">· {{ record.returnDate }} 返岗</span>
              </div>
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
                <a class="act" @click="openDetail(record)">详情</a>
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
                <a
                  v-if="record.status === 1 && record.mine && canApply"
                  class="act"
                  @click="openEarlyReturn(record)"
                >销假</a>
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
            @change="onRangeChange"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="开始时间" required>
              <a-time-picker
                v-model:value="applyForm.startTime"
                format="HH:mm"
                value-format="HH:mm"
                :minute-step="30"
                :show-now="false"
                style="width: 100%"
                placeholder="如 09:00"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束时间" required>
              <a-time-picker
                v-model:value="applyForm.endTime"
                format="HH:mm"
                value-format="HH:mm"
                :minute-step="30"
                :show-now="false"
                style="width: 100%"
                placeholder="如 18:00"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="天数计算方式">
          <a-select v-model:value="applyForm.dayMode" :options="dayModeOptions" />
        </a-form-item>
        <a-alert v-if="currentRule" type="info" show-icon class="mb12" :message="ruleHint" />
        <a-alert
          v-if="conflicts.length"
          type="warning"
          show-icon
          class="mb12"
          :message="`所选时段与 ${conflicts.length} 条已有请假单重叠`"
          :description="conflictText"
        />
        <a-form-item
          v-if="currentRule && (currentRule.attachmentRequired === 1 || !!currentRule.proofHint)"
          label="证明材料"
          :required="currentRule.attachmentRequired === 1"
          :extra="proofExtra"
        >
          <a-upload
            multiple
            :custom-request="customUpload"
            :file-list="attachmentFiles"
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.zip"
            @remove="onAttachmentRemove"
          >
            <a-button>
              <template #icon><upload-outlined /></template>
              上传证明
            </a-button>
          </a-upload>
        </a-form-item>
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

    <a-modal
      v-model:open="earlyOpen"
      title="提前返岗销假"
      :confirm-loading="earlySaving"
      ok-text="确认销假"
      cancel-text="取消"
      width="440px"
      centered
      destroy-on-close
      @ok="submitEarlyReturn"
    >
      <a-form layout="vertical">
        <a-form-item label="实际返岗日期" required>
          <a-date-picker
            v-model:value="earlyForm.returnDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="earlyForm.note" :maxlength="100" placeholder="选填" />
        </a-form-item>
        <a-alert
          type="info"
          show-icon
          message="销假后按实际返岗日期重算天数，多请的假期额度会自动退回"
        />
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="detailOpen"
      title="请假详情"
      :footer="null"
      width="640px"
      centered
      destroy-on-close
    >
      <template v-if="detailRecord">
        <a-descriptions :column="2" size="small" bordered>
          <a-descriptions-item label="申请人">{{ detailRecord.applicantName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="类型">{{ detailRecord.leaveTypeName }}</a-descriptions-item>
          <a-descriptions-item label="请假日期" :span="2">
            {{ leaveRangeText(detailRecord) }}
          </a-descriptions-item>
          <a-descriptions-item label="天数">{{ detailRecord.days }} 天</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(detailRecord.status)">{{ detailRecord.statusName }}</a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="事由" :span="2">{{ detailRecord.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item label="审批人">{{ detailRecord.approverName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="审批意见">{{ detailRecord.approveNote || '—' }}</a-descriptions-item>
          <a-descriptions-item label="提交时间" :span="2">{{ detailRecord.createdAt || '—' }}</a-descriptions-item>
        </a-descriptions>
        <div class="detail-proof">
          <div class="detail-proof-title">证明材料</div>
          <a-spin :spinning="detailLoading">
            <a-list v-if="detailAttachments.length" size="small" :data-source="detailAttachments">
              <template #renderItem="{ item }">
                <a-list-item>
                  <span class="proof-name">{{ item.fileName || item.attachmentId }}</span>
                  <a @click="downloadAttachment(item)">下载</a>
                </a-list-item>
              </template>
            </a-list>
            <a-empty v-else description="未上传证明材料" />
          </a-spin>
        </div>
      </template>
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
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import {
  applyLeave,
  cancelLeave,
  downloadEhrAttachment,
  earlyReturnLeave,
  leaveConflicts,
  leaveDelegateOptions as fetchLeaveDelegateOptions,
  leaveRules,
  leaveTypeOptions as fetchLeaveTypeOptions,
  listEhrAttachments,
  myLeaveQuotas,
  pageLeaves,
  teamLeaves,
  uploadEhrAttachment,
  waiveAnnualCarryover,
  type LeaveDelegateOptions,
  type LeaveItem,
  type LeaveQuotaItem,
  type LeaveTypeRule,
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
const canViewTeam = computed(() => store.can('leave:view:team'))

const scope = ref<'mine' | 'all' | 'team'>('mine')
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
  { value: 2, label: '已驳回' },
  { value: 3, label: '已撤销' },
  { value: 4, label: '已销假' }
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
    if (scope.value === 'team') {
      const list = await teamLeaves({})
      rows.value = list || []
      total.value = rows.value.length
      approvalBriefs.value = []
      return
    }
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
  // 审批列表默认只看待审批，避免历史单据淹没待办；团队视图展示待审批 + 已通过
  statusFilter.value = scope.value === 'all' ? 0 : undefined
  reload()
}

function onTableChange(p: any) {
  page.value = p.current
  size.value = p.pageSize
  load()
}

function statusColor(status: number) {
  return status === 0 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : status === 4 ? 'purple' : 'default'
}

function periodText(p?: string | null) {
  if (p === 'AM') return '上午'
  if (p === 'PM') return '下午'
  return ''
}

/** 请假时段展示：优先精确到半小时的时间，旧数据回退到上午/下午 */
function leaveRangeText(record: LeaveItem) {
  const start = record.startTime || periodText(record.startPeriod)
  const end = record.endTime || periodText(record.endPeriod)
  return `${record.startDate} ${start} ~ ${record.endDate} ${end}`
}

/* ---------- 申请 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const applyForm = reactive<{
  leaveType: string
  range: string[] | undefined
  startTime: string
  endTime: string
  dayMode: string
  reason: string
  delegateAccountId?: string
  attachmentId?: string
  attachmentIds: string[]
}>({
  leaveType: 'ANNUAL',
  range: undefined,
  startTime: '09:00',
  endTime: '18:00',
  dayMode: 'NATURAL',
  reason: '',
  attachmentId: undefined,
  attachmentIds: []
})

/** 工作时长口径与默认考勤规则一致：09:00-12:00、13:00-18:00，全天 480 分钟 */
const WORK_WINDOWS: Array<[number, number]> = [
  [9 * 60, 12 * 60],
  [13 * 60, 18 * 60]
]
const WORK_MINUTES_PER_DAY = 480

const dayModeOptions = [
  { value: 'NATURAL', label: '自然日（含周末）' },
  { value: 'WORKDAY', label: '工作日（跳过周末 / 节假日）' }
]

/** 请假类型规则与本人剩余额度：打开弹窗时加载，用于前端提示与必填校验 */
const rules = ref<Record<string, LeaveTypeRule>>({})
const quotas = ref<Record<string, LeaveQuotaItem>>({})
const conflicts = ref<LeaveItem[]>([])
const attachmentFiles = ref<any[]>([])

const currentRule = computed(() => rules.value[applyForm.leaveType])
const quotaItem = computed(() => quotas.value[applyForm.leaveType])
const ruleHint = computed(() => {
  const r = currentRule.value
  if (!r) return ''
  const parts = [`单次 ${r.minDays}~${r.maxDaysPerRequest} 天`]
  if (r.minNoticeDays > 0) parts.push(`需提前 ${r.minNoticeDays} 天申请`)
  if (r.allowPastDays > 0) parts.push(`最多补请 ${r.allowPastDays} 天`)
  if (r.quotaRequired === 1) parts.push(`当前剩余 ${quotaItem.value?.availableDays ?? 0} 天`)
  return parts.join('；')
})
const conflictText = computed(() =>
  conflicts.value
    .map((c) => `${c.startDate}~${c.endDate}（${c.statusName}）`)
    .join('；')
)

/** 证明材料提示：规则 proofHint / proofTypes / proofMinHours 同步展示 */
const proofExtra = computed(() => {
  const r = currentRule.value
  if (!r) return ''
  const parts: string[] = []
  if (r.attachmentRequired === 1) parts.push('该请假类型必须上传证明材料')
  if (r.proofHint) parts.push(r.proofHint)
  if (r.proofTypes) parts.push(`支持格式：${r.proofTypes}`)
  if (r.proofMinHours) parts.push(`请假满 ${r.proofMinHours} 小时需上传证明`)
  return parts.length ? parts.join('；') : '支持 pdf、图片、Word、压缩包'
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
  const start = dayjs(`${r[0]} ${applyForm.startTime}`)
  const end = dayjs(`${r[1]} ${applyForm.endTime}`)
  if (!start.isValid() || !end.isValid() || !start.isBefore(end)) return 0
  let total = 0
  let cur = start.startOf('day')
  while (!cur.isAfter(end, 'day')) {
    const isWorkday = cur.day() !== 0 && cur.day() !== 6
    if (applyForm.dayMode !== 'WORKDAY' || isWorkday) {
      const fromMin = cur.isSame(start, 'day') ? start.hour() * 60 + start.minute() : 0
      const toMin = cur.isSame(end, 'day') ? end.hour() * 60 + end.minute() : 24 * 60
      for (const [ws, we] of WORK_WINDOWS) {
        const from = Math.max(ws, fromMin)
        const to = Math.min(we, toMin)
        if (to > from) total += to - from
      }
    }
    cur = cur.add(1, 'day')
  }
  return Number((total / WORK_MINUTES_PER_DAY).toFixed(2))
})

/** 起止时间校验：结束不能早于开始，且至少半小时 */
function timeRangeError(): string {
  const r = applyForm.range
  if (!r || r.length !== 2) return '请选择请假日期'
  if (!applyForm.startTime || !applyForm.endTime) return '请选择开始时间和结束时间'
  const start = dayjs(`${r[0]} ${applyForm.startTime}`)
  const end = dayjs(`${r[1]} ${applyForm.endTime}`)
  if (!end.isAfter(start)) return '结束时间不能早于开始时间'
  if (end.diff(start, 'minute') < 30) return '请假时长至少 30 分钟'
  return ''
}

function onRangeChange() {
  conflicts.value = []
  const r = applyForm.range
  if (!r || r.length !== 2) return
  leaveConflicts(r[0], r[1])
    .then((d) => (conflicts.value = d || []))
    .catch(() => {})
}

function openApply() {
  applyForm.leaveType = 'ANNUAL'
  applyForm.range = undefined
  applyForm.startTime = '09:00'
  applyForm.endTime = '18:00'
  applyForm.dayMode = 'NATURAL'
  applyForm.reason = ''
  applyForm.delegateAccountId = undefined
  applyForm.attachmentId = undefined
  applyForm.attachmentIds = []
  attachmentFiles.value = []
  conflicts.value = []
  delegateCtx.value = { required: false, options: [] }
  applyOpen.value = true
  fetchLeaveDelegateOptions()
    .then((d) => (delegateCtx.value = d))
    .catch(() => {})
  leaveRules()
    .then((list) => {
      const m: Record<string, LeaveTypeRule> = {}
      ;(list || []).forEach((r) => (m[r.leaveType] = r))
      rules.value = m
    })
    .catch(() => {})
  myLeaveQuotas()
    .then((list) => {
      const m: Record<string, LeaveQuotaItem> = {}
      ;(list || []).forEach((q) => (m[q.leaveType] = q))
      quotas.value = m
    })
    .catch(() => {})
}

/** 证明附件上传：支持多选，逐个直传后端并收集附件ID */
function customUpload(options: any) {
  const file = options.file as File
  uploadEhrAttachment(file)
    .then((res) => {
      if (!applyForm.attachmentIds.includes(res.id)) {
        applyForm.attachmentIds = [...applyForm.attachmentIds, res.id]
      }
      applyForm.attachmentId = applyForm.attachmentIds[0]
      attachmentFiles.value = [
        ...attachmentFiles.value.filter((f) => f.uid !== (file as any).uid && f.uid !== res.id),
        { uid: res.id, name: res.fileName || file.name, status: 'done' }
      ]
      options.onSuccess?.(res)
    })
    .catch((e: any) => {
      message.error(e?.message || '附件上传失败')
      options.onError?.(e)
    })
}

function onAttachmentRemove(file: any) {
  const id = file?.uid
  applyForm.attachmentIds = applyForm.attachmentIds.filter((x) => x !== id)
  attachmentFiles.value = attachmentFiles.value.filter((f) => f.uid !== id)
  applyForm.attachmentId = applyForm.attachmentIds[0]
}

async function submitApply() {
  if (!applyForm.range || applyForm.range.length !== 2) {
    message.warning('请选择请假日期')
    return
  }
  const timeError = timeRangeError()
  if (timeError) {
    message.warning(timeError)
    return
  }
  if (days.value <= 0) {
    message.warning('所选时段请假天数为 0，请调整时间或日期')
    return
  }
  if (currentRule.value && days.value < currentRule.value.minDays) {
    message.warning(`该类型最少请 ${currentRule.value.minDays} 天`)
    return
  }
  if (currentRule.value && currentRule.value.attachmentRequired === 1 && !applyForm.attachmentIds.length) {
    message.warning('该请假类型必须上传证明材料')
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
      startTime: applyForm.startTime,
      endTime: applyForm.endTime,
      dayMode: applyForm.dayMode,
      reason: applyForm.reason.trim(),
      attachmentId: applyForm.attachmentIds[0],
      attachmentIds: [...applyForm.attachmentIds],
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

/* ---------- 销假 ---------- */
const earlyOpen = ref(false)
const earlySaving = ref(false)
const earlyTarget = ref<LeaveItem | null>(null)
const earlyForm = reactive({ returnDate: '', note: '' })

function openEarlyReturn(record: LeaveItem) {
  earlyTarget.value = record
  earlyForm.returnDate = dayjs().format('YYYY-MM-DD')
  earlyForm.note = ''
  earlyOpen.value = true
}

async function submitEarlyReturn() {
  if (!earlyTarget.value) return
  if (!earlyForm.returnDate) {
    message.warning('请选择实际返岗日期')
    return
  }
  earlySaving.value = true
  try {
    await earlyReturnLeave(earlyTarget.value.id, {
      returnDate: earlyForm.returnDate,
      note: earlyForm.note.trim()
    })
    message.success('销假成功，多请的额度已退回')
    earlyOpen.value = false
    reload()
  } catch (e: any) {
    message.error(e?.message || '销假失败')
  } finally {
    earlySaving.value = false
  }
}

/* ---------- 详情 / 证明材料 ---------- */
const detailOpen = ref(false)
const detailLoading = ref(false)
const detailRecord = ref<LeaveItem | null>(null)
const detailAttachments = ref<{ attachmentId: string; fileName?: string }[]>([])

async function openDetail(record: LeaveItem) {
  detailRecord.value = record
  detailAttachments.value = []
  detailOpen.value = true
  detailLoading.value = true
  try {
    const list = await listEhrAttachments('LEAVE', record.id)
    detailAttachments.value = (list || []).map((a) => ({ attachmentId: a.id, fileName: a.fileName }))
  } catch {
    /* 无 employee:view 权限时退回列表里的主附件 */
  } finally {
    if (!detailAttachments.value.length && record.attachmentId) {
      detailAttachments.value = [{ attachmentId: record.attachmentId, fileName: record.attachmentName }]
    }
    detailLoading.value = false
  }
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadAttachment(item: { attachmentId: string; fileName?: string }) {
  try {
    const res: any = await downloadEhrAttachment(item.attachmentId)
    saveBlob(res.data, item.fileName || `证明材料-${item.attachmentId}`)
  } catch (e: any) {
    message.error(e?.message || '证明材料下载失败')
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
  loadAnnualQuota()
  fetchLeaveTypeOptions().then((opts) => (leaveTypeOptions.value = opts)).catch(() => {})
})

/** 我的年假额度：12 月结转到期提示条 + 自动放弃入口 */
const annualQuota = ref<LeaveQuotaItem | null>(null)
const carryoverNotice = computed(() => !!annualQuota.value?.carryoverNotice)
const carryoverRemaining = computed(() => annualQuota.value?.carryoverRemaining ?? 0)

function loadAnnualQuota() {
  myLeaveQuotas()
    .then((list) => {
      annualQuota.value = (list || []).find((q) => q.leaveType === 'ANNUAL') || null
    })
    .catch(() => {})
}

function openWaive() {
  Modal.confirm({
    title: '自动放弃上年结转年假',
    content: `放弃后 ${carryoverRemaining.value} 天结转年假将立即作废且不可恢复，确定放弃吗？`,
    okText: '确定放弃',
    okButtonProps: { danger: true },
    cancelText: '再想想',
    centered: true,
    onOk: () =>
      waiveAnnualCarryover()
        .then((days) => {
          message.success(`已放弃 ${days} 天结转年假`)
          loadAnnualQuota()
        })
        .catch((e: any) => message.error(e?.message || '操作失败'))
  })
}
</script>

<style scoped>
/* 横向滚动由 .panel-body/.ft-scroll 承担，操作列由 .ft-table 固定 */
.carryover-banner {
  margin-bottom: 12px;
}
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

.detail-proof {
  margin-top: 16px;
}
.detail-proof-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}
.proof-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
