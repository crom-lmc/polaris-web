<template>
  <div class="page-root">
    <!-- 我的档案 + 发起入口 -->
    <section class="panel">
      <div class="panel-head">
        <span>员工自助 · 离职申请</span>
        <a-space size="small">
          <a-button size="small" :loading="profileLoading" @click="reload">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
          <a-tooltip :title="disabledReason || ''">
            <a-button type="primary" danger :disabled="!!disabledReason" @click="openApply">
              <template #icon><export-outlined /></template>
              发起离职申请
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
          description="离职申请需要落到档案上。请先联系 HR 在「人员管理」里为你建档并绑定这个登录账号，之后再回来提交。"
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
                <span v-if="profile.accountUsername"> · 统一账号 {{ profile.accountUsername }}</span>
              </div>
            </div>
          </div>

          <a-steps :current="stepIndex" size="small" class="steps">
            <a-step title="提交申请" description="填离职日期与交接项" />
            <a-step title="交接人确认" description="逐项确认交接完成" />
            <a-step title="负责人审批" description="部门/上级负责人" />
            <a-step title="HR中心审批" description="集团人力资源中心终审" />
            <a-step title="生效" description="置离职并停用账号" />
          </a-steps>

          <a-alert
            v-if="pendingApply"
            type="warning"
            show-icon
            class="tip"
            :message="pendingApply.source === 'HR' ? 'HR 已为你提交减员申请，正在走流程' : '已有一张待审批的离职申请'"
            :description="`拟离职日期 ${pendingApply.resignDate || '—'}，${pendingApply.handoverStatus === 0
              ? '等待交接人「' + (pendingApply.handoverName || '—') + '」确认交接'
              : '等待负责人审批'}。${pendingApply.mine
              ? '需要改内容请先在下方撤销后重新提交。'
              : '这张单由 HR 提交，如需调整请联系 HR。'}`"
          />
          <a-alert
            v-else
            type="info"
            show-icon
            class="tip"
            message="提交后不会立即离职"
            description="先由你指定的交接人逐项确认工作交接，再由部门负责人审批；通过后才把档案置为离职并停用统一账号。审批前你可以随时撤销。"
          />
        </template>
      </div>
    </section>

    <!-- 我的申请记录 -->
    <section class="panel ft-grow">
      <div class="panel-head">
        <span>我的离职申请</span>
        <span class="muted">共 {{ total }} 条</span>
      </div>
      <div class="panel-body table-body ft-scroll ft-bottom">
        <a-table class="ft-table resign-table"
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
            <div class="tbl-empty"><a-empty v-if="!loading" description="还没有提交过离职申请" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'subject'">
              <b>{{ record.employeeName }}</b>
              <div class="muted cell-sub">{{ record.orgName || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'resignDate'">
              <div>{{ record.resignDate || '—' }}</div>
              <div class="muted cell-sub">{{ record.createdAt }} 提交</div>
            </template>
            <template v-else-if="column.key === 'handover'">
              <a-tag :color="record.status !== 0 ? 'default' : record.handoverCompleted ? 'green' : 'orange'">
                {{ record.handoverStatusName || '—' }}
              </a-tag>
              <div v-if="record.handoverName" class="muted cell-sub">
                {{ record.handoverName }}
                <span v-if="record.handoverTotal"> · {{ record.handoverProgress }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="!record.approvalInstanceId && record.status === 0 && record.handoverStatus === 0" class="muted cell-sub">
                待 {{ record.handoverName || '交接人' }} 确认交接
              </div>
              <div v-else-if="!record.approvalInstanceId && record.status === 0" class="muted cell-sub">审批中心流转中</div>
              <div v-else-if="(record.status === 1 || record.status === 2) && (record.approverName || record.approveNote)" class="muted cell-sub">
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
                  v-if="record.status === 0 && record.mine"
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
      title="提交离职申请"
      ok-text="提交申请"
      cancel-text="取消"
      :confirm-loading="saving"
      width="640px"
      centered
      destroy-on-close
      @ok="submitApply"
    >
      <a-alert
        type="warning"
        show-icon
        class="mb12"
        message="离职需要审批，提交后不会立即生效"
        description="先由交接人逐项确认交接完成，再由部门负责人审批；通过后档案才置为离职并停用统一账号。"
      />
      <a-form layout="vertical">
        <div class="target-bar">
          <span class="tb-name">{{ profile?.name }}</span>
          <span class="tb-meta">{{ profile?.empNo }} · {{ profile?.orgPathName }}</span>
        </div>
        <a-form-item label="拟离职日期" required>
          <a-date-picker
            v-model:value="form.resignDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled-date="disabledDate"
          />
        </a-form-item>
        <a-form-item label="离职原因" required>
          <a-select
            v-model:value="form.reason"
            :options="resignReasonOptions"
            placeholder="选择离职原因"
            show-search
            option-filter-prop="label"
            allow-clear
          />
        </a-form-item>
        <a-form-item label="交接说明（可选）">
          <a-input v-model:value="form.handover" :maxlength="255" placeholder="整体交代，例如交接周期、注意事项" />
        </a-form-item>
        <handover-editor
          v-model:confirmer="form.handoverEmployeeId"
          v-model:items="form.items"
          v-model:no-handover="form.noHandover"
          :employees="candidates"
          :exclude-id="profile?.id"
        />
      </a-form>
    </a-modal>

    <!-- 详情 -->
    <a-modal v-model:open="detailOpen" title="离职申请详情" :footer="null" width="620px" centered>
      <template v-if="detail">
        <a-descriptions :column="1" size="small" bordered class="mb12">
          <a-descriptions-item label="申请人">
            {{ detail.employeeName }}
            <span class="muted"> {{ detail.empNo }} · {{ detail.orgName || '—' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="拟离职日期">{{ detail.resignDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="离职原因">{{ detail.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item v-if="detail.handover" label="交接说明">{{ detail.handover }}</a-descriptions-item>
          <a-descriptions-item label="交接人">
            {{ detail.handoverName || '无需交接' }}
            <span class="muted" v-if="detail.handoverTotal"> · {{ detail.handoverProgress }}</span>
          </a-descriptions-item>
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
              待交接全部确认后自动发起审批
            </span>
            <span v-else-if="detail.approverName" class="muted" style="margin-left: 8px">
              {{ detail.approverName }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item v-if="detail.approveNote" label="审批意见">{{ detail.approveNote }}</a-descriptions-item>
          <a-descriptions-item v-if="detail.hrApproveNote || detail.hrApproverName" label="HR中心意见">
            {{ detail.hrApproverName || '—' }}<template v-if="detail.hrApproveNote">：{{ detail.hrApproveNote }}</template>
          </a-descriptions-item>
          <a-descriptions-item label="提交时间">{{ detail.createdAt || '—' }}</a-descriptions-item>
        </a-descriptions>

        <div class="block-title">工作交接</div>
        <handover-list :items="detail.handoverItems || []" mode="view" />
      </template>
    </a-modal>

    <!-- 审批中心实例：流程进度 / 审批人 / 意见 / 我的处理 -->
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
import dayjs from 'dayjs'
import HandoverEditor from '@/components/HandoverEditor.vue'
import HandoverList from '@/components/HandoverList.vue'
import {
  bizOptions,
  cancelResignApply,
  fetchHandoverCandidates,
  getResignApply,
  myEmployee,
  pageResignApplies,
  submitResignApply,
  type DictOption,
  type EmployeeItem,
  type HandoverCandidate,
  type ResignApplyItem
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
const canApply = computed(() => store.can('resign:apply'))

/* ---------- 在途审批详情：审批动作统一在审批中心完成 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

/* ---------- 离职原因（后端主数据 biz_resign_reason） ---------- */
const resignReasons = ref<DictOption[]>([])

const resignReasonOptions = computed(() => resignReasons.value.map((o) => ({ value: o.label, label: o.label })))

async function loadResignReasons() {
  if (resignReasons.value.length) return
  try {
    resignReasons.value = await bizOptions('resign_reason')
  } catch {
    resignReasons.value = []
  }
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
const rows = ref<ResignApplyItem[]>([])

/** 当前页每张申请的最新审批单：SELF=离职 / HR=减员，bizId 都是申请单 ID */
const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadApprovalBriefs(list: ResignApplyItem[]) {
  const refs = buildBizRefs(list.map((r) => r.id), ['ehr.resign', 'ehr.reduce'])
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

/** 列表行与详情弹窗共用；detail 可能为 null，参数刻意放宽 */
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
const total = ref(0)
const loading = ref(false)
const page = ref(1)
const size = ref(10)
const pendingApply = ref<ResignApplyItem | null>(null)

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

/**
 * 「我的」列表的口径是「关于我的」：自己提交的 + HR 代我提交的。
 * HR/超管自己也是员工时，列表里会混进「他帮别人提」的单，光看日期分不清是谁的，
 * 所以只要本页出现不是我的单，就补一列「被办理人」；全是自己的单时不显示（每行都一样，没信息量）。
 */
const showSubject = computed(() =>
  rows.value.some((r) => String(r.employeeId) !== String(profile.value?.id || ''))
)

const columns = computed(() => {
  // table-layout:fixed 下列宽才是硬约束；「离职原因」不设 width，吸收剩余空间并省略长文本，
  // 避免 auto 布局把它撑宽后反过来把操作列压到只剩几十像素（按钮会被挤成竖排）。
  const cols: any[] = [
    { title: '申请编号', dataIndex: 'applyNo', key: 'applyNo', width: 170 },
    { title: '拟离职日期', key: 'resignDate', width: 160 }
  ]
  if (showSubject.value) {
    cols.push({ title: '被办理人', key: 'subject', width: 150 })
  }
  cols.push(
    { title: '离职原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    { title: '工作交接', key: 'handover', width: 200 },
    { title: '审批状态', key: 'status', width: 180 },
    { title: '操作', key: 'action', width: 220 }
  )
  return cols
})

async function load() {
  loading.value = true
  try {
    const data = await pageResignApplies({ scope: 'mine', page: page.value, size: size.value })
    rows.value = data.list || []
    total.value = data.total || 0
    void loadApprovalBriefs(rows.value)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 待审批那单单独查一次：列表分页时不能靠当前页判断「是否已有一张在途申请」 */
async function loadPending() {
  try {
    const data = await pageResignApplies({ scope: 'mine', status: 0, page: 1, size: 1 })
    pendingApply.value = (data.list || [])[0] || null
  } catch {
    pendingApply.value = null
  }
}

function reload() {
  page.value = 1
  loadProfile()
  load()
  loadPending()
}

function onTableChange(p: any) {
  page.value = p.current
  size.value = p.pageSize
  load()
}

function statusColor(status: number) {
  return status === 0 || status === 4 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

/* ---------- 发起按钮的可用性 ---------- */
const disabledReason = computed(() => {
  if (!canApply.value) return '当前账号没有「提交离职申请」权限，请联系 HR'
  if (!profile.value) return '账号未关联员工档案，无法提交'
  if (profile.value.status === 2) return '你已是离职状态，无需再次申请'
  if (pendingApply.value) {
    return pendingApply.value.source === 'HR'
      ? 'HR 已为你提交减员申请，正在走审批流程'
      : '已有一张待审批的申请，撤销后才能重新提交'
  }
  return ''
})

/** 流程进度：没有申请时停在第一步，有申请时按交接/审批推进（部门 → 交接 → HR中心 → 生效） */
const stepIndex = computed(() => {
  const a = pendingApply.value
  if (!a) return 0
  if (a.status === 1) return 4
  if (a.status === 0) return a.handoverStatus === 0 ? 1 : 2
  if (a.status === 4) return 3
  return 0
})

/* ---------- 提交 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const candidates = ref<HandoverCandidate[]>([])

const form = reactive<{
  resignDate: string | undefined
  reason: string
  handover: string
  handoverEmployeeId: string | undefined
  items: string[]
  noHandover: boolean
}>({
  resignDate: undefined,
  reason: '',
  handover: '',
  handoverEmployeeId: undefined,
  items: [''],
  noHandover: false
})

function disabledDate(current: any) {
  return current && current < dayjs().startOf('day')
}

async function loadCandidates() {
  if (candidates.value.length) return
  try {
    candidates.value = (await fetchHandoverCandidates()) || []
  } catch {
    candidates.value = []
  }
}

function openApply() {
  form.resignDate = dayjs().add(30, 'day').format('YYYY-MM-DD')
  form.reason = ''
  form.handover = ''
  form.handoverEmployeeId = undefined
  form.items = ['']
  form.noHandover = false
  applyOpen.value = true
  loadCandidates()
}

async function submitApply() {
  if (!form.resignDate) {
    message.warning('请选择拟离职日期')
    return
  }
  if (!form.reason.trim()) {
    message.warning('请填写离职原因')
    return
  }
  const items = form.items.map((s) => (s || '').trim()).filter(Boolean)
  if (!form.noHandover) {
    if (!form.handoverEmployeeId) {
      message.warning('请选择交接人')
      return
    }
    if (items.length === 0) {
      message.warning('请至少填写一项交接内容，确实没有在办事项请勾选「无需交接」')
      return
    }
  }
  saving.value = true
  try {
    await submitResignApply({
      resignDate: form.resignDate,
      reason: form.reason.trim(),
      handover: form.handover.trim(),
      handoverEmployeeId: form.noHandover ? undefined : form.handoverEmployeeId,
      items: form.noHandover ? [] : items,
      noHandover: form.noHandover
    })
    message.success(
      form.noHandover
        ? '已提交，等待部门负责人审批'
        : '已提交，待交接人确认交接后由部门负责人审批'
    )
    applyOpen.value = false
    reload()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    saving.value = false
  }
}

/* ---------- 详情 / 撤销 ---------- */
const detailOpen = ref(false)
const detail = ref<ResignApplyItem | null>(null)

async function openDetail(row: ResignApplyItem) {
  detailOpen.value = true
  detail.value = row
  try {
    detail.value = await getResignApply(row.id)
  } catch {
    /* 列表里已有基础信息，取详情失败就先用它 */
  }
}

async function doCancel(row: ResignApplyItem) {
  try {
    await cancelResignApply(row.id)
    message.success('已撤销')
    if (detailOpen.value) detailOpen.value = false
    reload()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

onMounted(() => {
  reload()
  loadResignReasons()
})
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

/* 操作列：按钮一律横排、文字不换行。auto 布局 + a-space 的 flex 收缩会把
   「详情 / 审批信息」挤成「详 / 情」「审批信 / 息」竖排，这里从根上禁掉。 */
.resign-table :deep(.ant-table-tbody > tr > td:last-child) {
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
/* 统一的轻按钮：固定高度 + hover 底色，点击区域比裸链接更规整 */
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

.block-title {
  font-size: 13px;
  font-weight: 600;
  margin: 4px 0 8px;
}

.danger {
  color: #ff4d4f;
}

/* 弹窗顶部的办理对象条：不用表单标签，姓名加重即可 */
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

</style>
