<template>
  <div class="page-root">
    <!-- 我的档案 + 发起入口 -->
    <section class="panel">
      <div class="panel-head">
        <span>员工自助 · 转正申请</span>
        <a-space size="small">
          <a-button size="small" :loading="profileLoading" @click="reload">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
          <a-tooltip :title="disabledReason || ''">
            <a-button type="primary" :disabled="!!disabledReason" @click="openApply">
              <template #icon><export-outlined /></template>
              发起转正申请
            </a-button>
          </a-tooltip>
        </a-space>
      </div>
      <div class="panel-body profile-body">
        <a-skeleton v-if="profileLoading && !profile" active :paragraph="{ rows: 2 }" />
        <a-alert
          v-else-if="!profile"
          type="error"
          show-icon
          message="当前账号未关联员工档案"
          description="转正申请需要落到档案上。请先联系 HR 在「人员管理」里为你建档并绑定这个登录账号，之后再回来提交。"
        />
        <template v-else>
          <div class="profile">
            <div class="avatar">{{ profile.name?.slice(0, 1) }}</div>
            <div class="profile-main">
              <div class="p-name">
                {{ profile.name }}
                <a-tag :color="empStatusColor(profile.status)">
                  {{ empStatusLabel(profile.status, profile.statusName) }}
                </a-tag>
              </div>
              <div class="p-meta">
                {{ profile.empNo }} · {{ profile.position || '未填职位' }} ·
                {{ profile.orgPathName || profile.orgName || '未分配组织' }}
              </div>
              <div class="p-meta">
                入职日期 {{ profile.hireDate || '—' }}
                <span v-if="profile.probationMonths"> · 试用期 {{ profile.probationMonths }} 个月</span>
                <span v-if="profile.exemptProbation"> · 免试用期</span>
                <span v-if="profile.expectedRegularizeDate"> · 预计转正 {{ profile.expectedRegularizeDate }}</span>
              </div>
            </div>
          </div>

          <a-steps :current="stepIndex" size="small" class="steps">
            <a-step title="提交申请" description="填自评、业绩与理由" />
            <a-step title="部门负责人审批" />
            <a-step title="人事主管审批" />
            <a-step title="生效" description="档案转为正式在职" />
          </a-steps>

          <a-alert
            v-if="pendingApply"
            type="warning"
            show-icon
            class="tip"
            message="已有一张待审批的转正申请"
            :description="`申请转正日期 ${pendingApply.regularizeDate || '—'}，正在审批中心流转中。需要改内容请先在下方撤销后重新提交。`"
          />
          <a-alert
            v-else
            type="info"
            show-icon
            class="tip"
            message="提交后不会立即转正"
            description="先由本部门负责人审批，再由人事主管审批；两级都通过后档案才转为正式在职。审批前你可以随时撤销。"
          />
        </template>
      </div>
    </section>

    <!-- 我的申请记录 -->
    <section class="panel ft-grow">
      <div class="panel-head">
        <span>我的转正申请</span>
        <span class="muted">共 {{ total }} 条</span>
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
            <div class="tbl-empty"><a-empty v-if="!loading" description="还没有提交过转正申请" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'subject'">
              <b>{{ record.employeeName }}</b>
              <div class="muted cell-sub">{{ record.orgName || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'regularizeDate'">
              <div>{{ record.regularizeDate || '—' }}</div>
              <div class="muted cell-sub">{{ record.createdAt }} 提交</div>
            </template>
            <template v-else-if="column.key === 'summary'">
              <div class="ellipsis-2" :title="record.reason || ''">{{ record.reason || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="!record.approvalInstanceId && record.status === 0" class="muted cell-sub">
                审批中心流转中
              </div>
              <div v-else-if="(record.status === 1 || record.status === 2) && (record.applicantName)" class="muted cell-sub">
                提交人 {{ record.applicantName }}
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
                  v-if="record.status === 0"
                  title="撤销后需要重新提交，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancel(record)"
                >
                  <a class="act danger">撤销</a>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </section>

    <!-- 提交申请 -->
    <a-modal
      v-model:open="applyOpen"
      title="提交转正申请"
      ok-text="提交申请"
      cancel-text="取消"
      :confirm-loading="saving"
      width="640px"
      centered
      destroy-on-close
      wrap-class-name="regularize-modal-wrap"
      :body-style="{ maxHeight: 'calc(100vh - 260px)', overflowY: 'auto' }"
      @ok="submitApply"
    >
      <a-alert
        type="warning"
        show-icon
        class="mb12"
        message="转正需要审批，提交后不会立即生效"
        description="流程：本部门负责人审批 → 人事主管审批；两级都通过后档案才转为正式在职。"
      />
      <a-form layout="vertical">
        <div class="target-bar">
          <span class="tb-name">{{ profile?.name }}</span>
          <span class="tb-meta">{{ profile?.empNo }} · {{ profile?.orgPathName }}</span>
        </div>
        <a-form-item label="申请转正日期">
          <a-date-picker v-model:value="form.regularizeDate" value-format="YYYY-MM-DD" style="width: 100%" />
          <div class="probation-hint" v-if="profile?.expectedRegularizeDate">
            预计转正时间：{{ profile.expectedRegularizeDate }}（入职日期 + 试用期时长）
          </div>
        </a-form-item>
        <a-form-item label="试用期工作自评">
          <a-textarea
            v-model:value="form.selfReview"
            :maxlength="500"
            :rows="2"
            show-count
            placeholder="试用期内承担了哪些工作、熟悉程度如何"
          />
        </a-form-item>
        <a-form-item label="试用期工作业绩与成果">
          <a-textarea
            v-model:value="form.workSummary"
            :maxlength="1000"
            :rows="3"
            show-count
            placeholder="完成的主要任务、达成的指标、可量化的成果"
          />
        </a-form-item>
        <a-form-item label="转正申请理由">
          <a-textarea
            v-model:value="form.reason"
            :maxlength="500"
            :rows="2"
            show-count
            placeholder="为什么认为自己已经具备转正条件"
          />
        </a-form-item>
        <a-form-item label="转正后的工作目标与计划（可选）">
          <a-textarea
            v-model:value="form.nextPlan"
            :maxlength="1000"
            :rows="2"
            show-count
            placeholder="转正后想承担什么、下一阶段的目标"
          />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 详情 -->
    <a-modal v-model:open="detailOpen" title="转正申请详情" :footer="null" width="620px" centered>
      <template v-if="detail">
        <a-descriptions :column="1" size="small" bordered class="mb12">
          <a-descriptions-item label="申请人">
            {{ detail.employeeName }}
            <span class="muted"> {{ detail.empNo }} · {{ detail.orgName || '—' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="申请转正日期">{{ detail.regularizeDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="试用期工作自评">{{ detail.selfReview || '—' }}</a-descriptions-item>
          <a-descriptions-item label="试用期工作业绩与成果">{{ detail.workSummary || '—' }}</a-descriptions-item>
          <a-descriptions-item label="转正申请理由">{{ detail.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item label="后续目标与计划">{{ detail.nextPlan || '—' }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-tag :color="statusColor(detail.status)">{{ detail.statusName }}</a-tag>
            <a
              v-if="runningBriefForRow(detail)"
              style="margin-left: 8px"
              @click="openApprovalDetail(runningBriefForRow(detail)!.id)"
            >查看审批流程</a>
            <a
              v-else-if="rejectedBriefForRow(detail)"
              style="margin-left: 8px"
              @click="openApprovalDetail(rejectedBriefForRow(detail)!.id)"
            >查看审批信息</a>
            <span v-else-if="detail.status === 0" class="muted" style="margin-left: 8px">
              审批中心流转中
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="提交时间">{{ detail.createdAt || '—' }}</a-descriptions-item>
        </a-descriptions>
      </template>
    </a-modal>

    <!-- 审批中心实例：流程进度 / 审批人 / 意见 -->
    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="reload"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  cancelRegularizeApply,
  getRegularizeApply,
  myEmployee,
  pageRegularizeApplies,
  regularizeApply,
  type EmployeeItem,
  type RegularizeApplyItem
} from '@/api/ehr'
import { statusColor as empStatusColor, statusLabel as empStatusLabel } from '@/constants/employeeStatus'
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
const canApply = computed(() => store.can('regularize:apply'))

/* ---------- 在途审批详情：审批动作统一在审批中心完成 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

/* ---------- 我的档案 ---------- */
const profile = ref<EmployeeItem | null>(null)
const profileLoading = ref(false)

async function loadProfile() {
  profileLoading.value = true
  try {
    profile.value = (await myEmployee()) || null
  } catch {
    profile.value = null
  } finally {
    profileLoading.value = false
  }
}

/* ---------- 我的申请 ---------- */
const rows = ref<RegularizeApplyItem[]>([])
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(10)

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const columns = computed(() => {
  const cols: any[] = [
    { title: '申请编号', dataIndex: 'applyNo', key: 'applyNo', width: 170 },
    { title: '申请转正日期', key: 'regularizeDate', width: 170 },
    { title: '被办理人', key: 'subject', width: 160 },
    { title: '申请理由', key: 'summary', ellipsis: true },
    { title: '审批状态', key: 'status', width: 220 },
    // 操作列要容下「详情 / 审批详情 / 撤销」三个按钮，窄了会被挤成竖排
    { title: '操作', key: 'action', width: 220 }
  ]
  return cols
})

/** 当前页每张申请的最新审批单；转正申请的 bizId 就是申请单 ID */
const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadApprovalBriefs(list: RegularizeApplyItem[]) {
  const refs = buildBizRefs(list.map((r) => r.id), ['ehr.regularize'])
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

type ApprovalRowLike = {
  id?: string
  approvalInstanceId?: string | null
  approvalBizType?: string | null
}

/** 只有审批中心里确实在途的单才算「审批中」；业务行残留的已完成实例号不算 */
function runningBriefForRow(r: ApprovalRowLike | null | undefined) {
  if (!r?.id) return null
  return runningBriefOf(
    briefsForRow(approvalBriefs.value, r.id),
    r.approvalInstanceId,
    r.approvalBizType
  )
}

/** 审批完成后不再给详情入口，只有被驳回时需要查看驳回意见 */
function rejectedBriefForRow(r: ApprovalRowLike | null | undefined) {
  if (!r?.id) return null
  return rejectedBriefOf(briefsForRow(approvalBriefs.value, r.id))
}

async function loadRows() {
  loading.value = true
  try {
    const data = await pageRegularizeApplies({ scope: 'mine', page: page.value, size: size.value })
    rows.value = data.list || []
    total.value = data.total || 0
    void loadApprovalBriefs(rows.value)
  } finally {
    loading.value = false
  }
}

function onTableChange(p: any) {
  page.value = p.current || 1
  size.value = p.pageSize || 10
  loadRows()
}

/** 在途中的申请（用于提示与禁用发起按钮） */
const pendingApply = computed(() => rows.value.find((r) => r.status === 0) || null)

/** 发起按钮的禁用原因；为空表示可发起 */
const disabledReason = computed(() => {
  if (!canApply.value) return '当前账号没有「提交转正申请（员工自助）」权限'
  if (!profile.value) return '当前账号未关联员工档案，请联系 HR 建档并绑定账号'
  if (profile.value.status !== 30) {
    return '只有「试用期」员工可以提交转正申请'
  }
  if (pendingApply.value) return '已有一张待审批的转正申请，请先处理完'
  return ''
})

const stepIndex = computed(() => {
  if (pendingApply.value) return 1
  return 0
})

/* ---------- 提交 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const form = reactive<{
  regularizeDate: string
  selfReview: string
  workSummary: string
  reason: string
  nextPlan: string
}>({
  regularizeDate: '',
  selfReview: '',
  workSummary: '',
  reason: '',
  nextPlan: ''
})

function openApply() {
  if (disabledReason.value) return
  form.regularizeDate = profile.value?.expectedRegularizeDate || new Date().toISOString().slice(0, 10)
  form.selfReview = ''
  form.workSummary = ''
  form.reason = ''
  form.nextPlan = ''
  applyOpen.value = true
}

async function submitApply() {
  if (!profile.value) return
  saving.value = true
  try {
    await regularizeApply(profile.value.id, {
      regularizeDate: form.regularizeDate || undefined,
      selfReview: form.selfReview || undefined,
      workSummary: form.workSummary || undefined,
      reason: form.reason || undefined,
      nextPlan: form.nextPlan || undefined
    })
    message.success('转正申请已提交审批中心，等待审批')
    applyOpen.value = false
    await reload()
  } catch (e: any) {
    message.error(e?.message || '提交转正申请失败')
  } finally {
    saving.value = false
  }
}

/* ---------- 撤销 ---------- */
async function doCancel(row: RegularizeApplyItem) {
  try {
    await cancelRegularizeApply(row.id)
    message.success('已撤销转正申请')
    await reload()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

/* ---------- 详情 ---------- */
const detailOpen = ref(false)
const detail = ref<RegularizeApplyItem | null>(null)

async function openDetail(row: RegularizeApplyItem) {
  try {
    detail.value = await getRegularizeApply(row.id)
    detailOpen.value = true
  } catch (e: any) {
    message.error(e?.message || '加载详情失败')
  }
}

/* ---------- 状态色 ---------- */
function statusColor(status?: number) {
  if (status === 1) return 'green'
  if (status === 2) return 'red'
  if (status === 3) return 'default'
  return 'orange'
}

/* ---------- 加载 ---------- */
async function reload() {
  await loadProfile()
  await loadRows()
}

onMounted(reload)
</script>

<style scoped>
/* 横向滚动由 .panel-body/.ft-scroll 承担，操作列由 .ft-table 固定 */
.page-root {
  --ft-min-width: 1100px;
}

.profile-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #7c5cff 0%, #3fb6a8 100%);
}

.profile-main {
  min-width: 0;
}

.p-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.p-name :deep(.ant-tag) {
  margin-inline-end: 0;
  transform: scale(0.86);
  transform-origin: left center;
}

.p-meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.steps {
  padding: 4px 0 0;
}

.tip {
  margin-top: 2px;
}

.table-body {
  padding: 0;
}

/* 操作列：按钮一律横排、文字不换行，避免被挤成「详 / 情」竖排 */
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

/* 弹窗顶部的办理对象条 */
.target-bar {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  margin-bottom: 12px;
  border-radius: 6px;
  background: var(--code-bg);
  border: 1px solid var(--border-subtle);
}

.target-bar .tb-name {
  font-weight: 600;
  font-size: 14px;
}

.target-bar .tb-meta {
  font-size: 12px;
  color: var(--muted);
}

.probation-hint {
  display: inline-block;
  padding-top: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--muted);
}

.cell-sub {
  font-size: 12px;
  margin-top: 2px;
}

/* 理由列最多两行，超出省略 */
.ellipsis-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.6;
}
</style>

<!-- 转正申请弹窗的样式必须放在非 scoped 块里：Modal 通过 Teleport 渲染到 body，
     scoped 的 :deep() 依赖祖先携带 scope id，Teleport 出去后祖先关系不可靠。 -->
<style>
/* 字段多、默认高度容易顶出屏幕。
   压缩纵向间距把首屏内容尽量塞下，剩余部分由 body 的 maxHeight 滚动兜底。 */
.regularize-modal-wrap .ant-modal-body {
  padding-top: 12px;
  padding-bottom: 12px;
}

.regularize-modal-wrap .ant-form-item {
  margin-bottom: 12px;
}

.regularize-modal-wrap .ant-form-item:last-child {
  margin-bottom: 0;
}

/* 纵向表单的 label 在上，压缩 label 与控件之间的留白 */
.regularize-modal-wrap .ant-form-item-label {
  padding-bottom: 2px;
}

/* 字数统计条紧贴输入框，避免每项多占一行 */
.regularize-modal-wrap .ant-input-textarea-show-count::after {
  margin-top: 2px;
}

.regularize-modal-wrap .target-bar {
  padding: 6px 10px;
  margin-bottom: 10px;
}
</style>
