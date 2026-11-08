<template>
  <a-drawer
    :open="open"
    :width="860"
    :body-style="{ padding: '0' }"
    :mask-closable="true"
    @close="close"
  >
    <template #title>
      <div class="dt-title">
        <span class="tt">{{ title }}</span>
        <a-tag v-if="props.mode === 'view'" color="default">只读查看</a-tag>
        <a-tag v-if="detail" :color="statusColor(detail.status)">{{ detail.statusName || statusText(detail.status) }}</a-tag>
      </div>
    </template>

    <a-spin :spinning="loading">
      <div v-if="detail" class="dt-body">
        <!-- 自定义页面路由：信息区整段换成 iframe（自动带 instanceId），流程与操作区保持平台渲染 -->
        <section v-if="routeSrc" class="card form-card">
          <iframe :src="routeSrc" class="route-frame" title="自定义审批页面" />
        </section>
        <!-- 基本信息：按模板配置的分组渲染；没配就退回默认版式 -->
        <template v-else>
        <section v-for="sec in sections" :key="sec.key" class="card form-card" :class="{ emphasis: sec.emphasis }">
          <div v-if="sec.title" class="card-title">{{ sec.title }}</div>
          <a-descriptions v-if="descFields(sec).length" :column="sec.columns || 3" size="small" :colon="false" bordered class="desc">
            <a-descriptions-item v-for="f in descFields(sec)" :key="f.key" :label="f.label" :span="f.span || 1">
              <span :class="{ muted: isEmpty(valueOf(f)) }">{{ display(f) }}</span>
            </a-descriptions-item>
          </a-descriptions>
          <template v-for="f in tableFields(sec)" :key="f.key">
            <div class="sub-table-title">{{ f.label }}</div>
            <a-table
              size="small"
              bordered
              table-layout="fixed"
              row-key="__rk"
              :pagination="false"
              :locale="{ emptyText: '暂无数据' }"
              :columns="tableColumnsOf(f, asRows(values[f.key]))"
              :data-source="asRows(values[f.key]).map((r, i) => ({ ...r, __rk: i }))"
              class="sub-table"
            >
              <template #bodyCell="{ column, record }">
                <span
                  class="cell-val"
                  :class="{ 'cell-empty': cellOf(column, record).empty }"
                  :title="cellOf(column, record).text"
                >{{ cellOf(column, record).text }}</span>
              </template>
            </a-table>
          </template>
        </section>
        </template>

        <!-- 提交人 / 提交时间 / 审批方案 -->
        <section class="card">
          <div class="card-title">提交信息 · 审批方案</div>
          <a-descriptions :column="3" size="small" :colon="false" bordered class="desc">
            <a-descriptions-item label="提交人">{{ detail.applicantName || '—' }}</a-descriptions-item>
            <a-descriptions-item label="提交时间">{{ fmtTime(detail.createdAt) || '—' }}</a-descriptions-item>
            <a-descriptions-item label="业务类型">{{ detail.bizName || detail.bizType || '—' }}</a-descriptions-item>
            <a-descriptions-item label="单据编号">{{ detail.bizNo || '—' }}</a-descriptions-item>
            <a-descriptions-item label="审批方案">
              {{ detail.templateCode || '默认方案' }} · v{{ detail.templateVersion ?? 1 }}
            </a-descriptions-item>
            <a-descriptions-item label="流程规模">
              {{ detail.totalStep || 0 }} 步 · {{ branchCount }} 条分支路径
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <!-- 流转信息：主干步骤条 -->
        <section class="card">
          <div class="card-title">流转信息 · 主干</div>
          <a-steps :current="currentStepIndex" size="small" label-placement="vertical" class="steps">
            <a-step
              v-for="s in flowMainSteps"
              :key="s.key"
              :title="s.name"
              :status="stepStatus(s.state)"
              :description="s.description"
            />
          </a-steps>
        </section>

        <!-- 每个步骤的审批人 -->
        <section v-for="grp in taskGroups" :key="grp.key" class="card"
                 :class="{ 'branch-card': grp.depth > 0 }"
                 :style="{ marginLeft: (grp.depth || 0) * 16 + 'px' }">
          <div class="card-title">
            <template v-if="grp.key === '__applicant__'">
              <span>发起申请</span>
              <a-tag color="green" class="mini-tag">发起人</a-tag>
            </template>
            <span v-else>{{ grp.seq }}. {{ grp.name }}</span>
            <a-tag v-if="grp.branchName" class="branch-tag">分支 · {{ grp.branchName }}</a-tag>
            <a-tag v-if="grp.mode" class="mode-tag">{{ modeText(grp.mode) }}</a-tag>
            <a-tag v-if="grp.waitingJoin" color="orange" class="mode-tag">已通过 · 等待汇合</a-tag>
          </div>
          <div class="task-list">
            <div v-for="t in grp.tasks" :key="t.id" class="task">
              <div class="who">
                <a-avatar :size="26" class="av">{{ (t.approverName || '?').slice(0, 1) }}</a-avatar>
                <div class="who-main">
                  <div class="name">
                    {{ t.approverName }}
                    <a-tag v-if="t.approverSource === 'DELEGATE'" class="mini-tag" color="purple">
                      代 {{ t.delegateOwnerName }}
                    </a-tag>
                  </div>
                  <div class="meta">
                    <a-tag :color="taskColor(t.status)" class="mini-tag">{{ t.statusName || taskText(t.status) }}</a-tag>
                    <span v-if="t.actedAt" class="muted">{{ fmtTime(t.actedAt) }}</span>
                  </div>
                </div>
              </div>
              <div v-if="t.opinion" class="opinion">{{ t.opinion }}</div>
            </div>
          </div>
        </section>

        <!-- 操作区：只有「审批」模式且当前登录人在本单有待办才出现；点「查看」时整块隐藏 -->
        <section v-if="props.mode === 'approve' && myTaskId" class="card action-card">
          <div class="card-title">我的处理</div>
          <a-textarea
            v-model:value="note"
            :rows="3"
            placeholder="填写审批意见（驳回时建议说明原因）"
            :maxlength="500"
            show-count
          />
          <div class="actions">
            <a-button v-if="store.can('approval:approve')" type="primary" :loading="submitting" @click="submit(true)">通过</a-button>
            <a-button v-if="store.can('approval:approve')" danger :loading="submitting" @click="submit(false)">驳回</a-button>
            <a-dropdown v-if="store.can('approval:approve')">
              <a-button>更多 <down-outlined /></a-button>
              <template #overlay>
                <a-menu @click="onMore">
                  <a-menu-item key="transfer">转办给他人</a-menu-item>
                  <a-menu-item key="addSign">加签（临时插人）</a-menu-item>
                </a-menu>
              </template>
            </a-dropdown>
          </div>
        </section>

        <!-- 发起人可撤回：单子还没结束时才有意义 -->
        <section v-else-if="canWithdraw" class="card action-card">
          <div class="card-title">发起人操作</div>
          <a-button danger :loading="submitting" @click="withdraw">撤回申请</a-button>
        </section>
      </div>
      <a-empty v-else-if="!loading" description="审批单不存在或无权查看" />
    </a-spin>

    <!-- 转办 / 加签：按组织树选人 -->
    <a-modal
      v-model:open="moveOpen"
      :title="moveType === 'transfer' ? '转办给他人' : '加签'"
      :confirm-loading="submitting"
      centered
      @ok="doMove"
    >
      <a-form layout="vertical">
        <a-form-item :label="moveType === 'transfer' ? '接手人' : '被加签人'" required>
          <div class="picked-row" :class="{ placeholder: !pickedUser }" @click="pickerOpen = true">
            <template v-if="pickedUser">
              <a-avatar :size="24" class="av">{{ pickedUser.name.slice(0, 1) }}</a-avatar>
              <span class="picked-name">{{ pickedUser.name }}</span>
              <a-button type="link" size="small" @click.stop="pickerOpen = true">更换</a-button>
            </template>
            <template v-else><span>按组织选择人员</span></template>
          </div>
          <div class="field-tip">
            {{ moveType === 'transfer'
              ? '转办后这条待办永久归属对方，原任务终结（同一单最多转 5 次）'
              : '加签会把当前节点切成会签，被加签人与原审批人都要通过' }}
          </div>
        </a-form-item>
        <a-form-item v-if="moveType === 'addSign'" label="加签位置">
          <a-radio-group v-model:value="movePosition">
            <a-radio value="AFTER">后加签（我之后审）</a-radio>
            <a-radio value="BEFORE">前加签（我之前审）</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <ApprovalUserPicker
      v-model:open="pickerOpen"
      :title="moveType === 'transfer' ? '选择接手人' : '选择被加签人'"
      @confirm="onPickUser"
    />
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DownOutlined } from '@ant-design/icons-vue'
import {
  addSignTask,
  approveTask,
  fetchApprovalContext,
  fetchApprovalDetail,
  transferTask,
  withdrawApproval
} from '@/api/approvals'
import { useUserStore } from '@/stores/user'
import ApprovalUserPicker from './ApprovalUserPicker.vue'
import type {
  ApprovalContext,
  ApprovalInstance,
  ApprovalPageSection,
  ApprovalPageField,
  ApprovalStep,
  ApprovalTask
} from '@/types/approval'

/**
 * 审批详情抽屉（人员 / 部门 / 请假 / 离职列表点「审批中」时打开）。
 * 信息区、流程进度、审批人、意见、我的处理、转办/加签/撤回全部来自审批中心实例，
 * 前端只画，不参与取值与权限判断。
 */
/**
 * mode：view=只读查看（列表点「查看」），不渲染通过/驳回/转办/加签；
 * approve=可处理（列表点「审批」）。默认 approve，兼容业务列表直接打开的旧调用。
 */
const props = withDefaults(
  defineProps<{ open: boolean; instanceId: string | null; mode?: 'view' | 'approve' }>(),
  { mode: 'approve' }
)
const emit = defineEmits<{ (e: 'update:open', v: boolean): void; (e: 'done'): void }>()

const store = useUserStore()
const loading = ref(false)
const submitting = ref(false)
const note = ref('')
const detail = ref<ApprovalInstance | null>(null)
const ctx = ref<ApprovalContext | null>(null)

const moveOpen = ref(false)
const moveType = ref<'transfer' | 'addSign'>('transfer')
const pickedUser = ref<{ id: string; name: string } | null>(null)
const pickerOpen = ref(false)
const movePosition = ref<'BEFORE' | 'AFTER'>('AFTER')

/** 上下文里的「我的待办」最权威：审批权限由任务分派决定，不看权限点 */
const myTaskId = computed(() => ctx.value?.myTaskId || detail.value?.myTaskId || null)
const values = computed<Record<string, unknown>>(() => ctx.value?.values || detail.value?.formData || {})
/** 表名 → 定位模式；服务端按实例冻结的绑定算出，老单没有该字段 */
const tableModes = computed<Record<string, string>>(() => ctx.value?.tableModes || {})

/** 发起人姓名：实例字段优先，老单子没写时退回表单快照里的 submitter */
const applicantLabel = computed(() => {
  const fromSnapshot = values.value.submitter
  return (
    detail.value?.applicantName ||
    (typeof fromSnapshot === 'string' ? fromSnapshot : '') ||
    '—'
  )
})

const title = computed(() => {
  const tpl = ctx.value?.page?.titleTpl
  const inst = detail.value
  if (!inst) return '审批详情'
  if (tpl) {
    return tpl
      .replace('{bizName}', inst.bizName || '')
      .replace('{applicantName}', inst.applicantName || '')
      .replace('{bizNo}', inst.bizNo || '')
      .replace('{title}', inst.title || '')
  }
  // 默认标题：「张三发起的请假审批」；业务侧自定义了 title 且已含「发起」则原样用
  if (inst.title?.includes('发起')) return inst.title
  return `${inst.applicantName || '发起人'}发起的${inst.bizName || inst.title || '审批'}审批`
})

const DEFAULT_LABELS: Record<string, string> = {
  orgPath: '所属组织',
  orgName: '所属组织',
  position: '职位',
  hireDate: '入职日期',
  probationText: '试用期',
  profileStats: '档案完整度',
  submitter: '提交人',
  applicantName: '提交人',
  name: '姓名',
  employeeName: '姓名',
  empNo: '工号',
  days: '天数',
  leaveType: '请假类型',
  leaveTypeName: '请假类型',
  startDate: '开始日期',
  endDate: '结束日期',
  reason: '事由',
  resignDate: '离职日期',
  lastWorkDate: '最后工作日',
  sourceName: '来源',
  handoverName: '交接人',
  handoverProgress: '交接进度',
  oldLeader: '原负责人',
  newLeader: '新负责人'
}

const sections = computed<ApprovalPageSection[]>(() => {
  const configured = ctx.value?.page?.sections
  if (configured && configured.length) return configured
  const vals = values.value || {}
  const keys = Object.keys(vals).filter(
    (k) => !['employeeId', 'empId', 'orgId', 'exemptProbation', 'probationMonths', 'newLeaderEmployeeId'].includes(k)
  )
  if (!keys.length) return []
  return [{
    key: 'default',
    title: '',
    columns: 3,
    fields: keys.map<ApprovalPageField>((k) => ({ key: k, label: DEFAULT_LABELS[k] || k, format: 'text' }))
  }]
})

/**
 * 自定义页面路由：renderMode=ROUTE 时信息区整段换成 iframe，地址自动拼 instanceId。
 * 返回空串表示不启用（未配 ROUTE 或没填地址），退回分组版式。
 */
const routeSrc = computed(() => {
  if (ctx.value?.renderMode !== 'ROUTE') return ''
  const p = ctx.value?.page?.routePath || ''
  if (!p) return ''
  const sep = p.includes('?') ? '&' : '?'
  return `${p}${sep}instanceId=${props.instanceId || ''}`
})

const steps = computed(() => detail.value?.steps || [])
/** 主干步骤条只画 depth=0 的步骤；分支子链在下方审批人卡片里按 depth 缩进展示 */
const mainSteps = computed(() => steps.value.filter((s) => !s.depth))
/** 主干流转条从「发起申请」开始：后端 steps 只含审批节点，发起人节点由前端补 */
const flowMainSteps = computed(() => [
  { key: '__applicant__', seq: 0, name: '发起申请', state: 'DONE' as const, description: '' },
  ...mainSteps.value.map((s) => ({
    ...s,
    key: String(s.seq),
    description: s.state === 'SKIPPED' ? '条件不满足，已跳过' : ''
  }))
])
const branchCount = computed(() =>
  new Set(steps.value.map((s) => s.branchPath || '').filter((p) => !!p)).size
)
/** 前置了发起人节点，索引整体右移一位；发起人恒为已完成 */
const currentStepIndex = computed(() => {
  const idx = flowMainSteps.value.findIndex((s) => s.state === 'CURRENT')
  if (idx >= 0) return idx
  return detail.value?.status === 1 ? flowMainSteps.value.length : 1
})

interface TaskGroup {
  key: string
  seq: number
  name: string
  mode?: string
  tasks: ApprovalTask[]
  branchName: string
  depth: number
  waitingJoin: boolean
}

/** 按「步骤 + 分支路径」分组：同一分支的多人放一起，才能看出是或签还是会签 */
const taskGroups = computed<TaskGroup[]>(() => {
  const tasks = detail.value?.tasks || []
  const stepMap = new Map<number, ApprovalStep>()
  for (const s of steps.value) stepMap.set(s.seq, s)
  const map = new Map<string, TaskGroup>()
  for (const t of tasks) {
    const path = t.branchPath || ''
    const key = `${t.stepSeq}::${path}`
    const step = stepMap.get(t.stepSeq)
    const g = map.get(key) || {
      key, seq: t.stepSeq, name: t.stepName, mode: t.approveMode, tasks: [],
      branchName: t.branchName || (path ? step?.branchName || '' : ''),
      depth: t.depth ?? step?.depth ?? 0,
      waitingJoin: !!step?.waitingJoin
    }
    g.tasks.push(t)
    if (t.approveMode) g.mode = t.approveMode
    map.set(key, g)
  }
  const groups = [...map.values()].sort((a, b) => a.seq - b.seq || a.depth - b.depth)

  /**
   * 后端 tasks 只含审批任务，发起人不是任务；这里补一张虚拟卡片放在最前，
   * 与上方主干步骤条前置的「发起申请」节点一一对应。提交时间复用实例 createdAt。
   */
  const applicantGroup: TaskGroup = {
    key: '__applicant__',
    seq: 0,
    name: '发起申请',
    tasks: [{
      id: '__applicant__',
      instanceId: detail.value?.id || '',
      stepSeq: 0,
      stepName: '发起申请',
      approverId: String(detail.value?.applicantId || ''),
      approverName: applicantLabel.value,
      status: 1,
      statusName: '已提交',
      actedAt: detail.value?.createdAt || ''
    }],
    branchName: '',
    depth: 0,
    waitingJoin: false
  }
  return [applicantGroup, ...groups]
})

const canWithdraw = computed(() => {
  const inst = detail.value
  if (!inst || inst.status !== 0) return false
  return String(inst.applicantId || '') === String(store.me?.accountId || '')
})

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === ''
}

/** 子表单元格：空值统一占位「—」，对象/数组转文本，避免留白或 [object Object] */
function cellText(v: unknown): string {
  if (isEmpty(v)) return '—'
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

/** bodyCell 插槽统一取列值；列定义里 key 与 dataIndex 一致 */
function cellOf(column: { key?: unknown; dataIndex?: unknown }, record: Record<string, unknown>) {
  const k = String(column.dataIndex ?? column.key ?? '')
  const v = record[k]
  return { text: cellText(v), empty: isEmpty(v) }
}

/** 普通字段（非数据表块）：走描述列表渲染 */
function descFields(sec: ApprovalPageSection): ApprovalPageField[] {
  return (sec.fields || []).filter((f) => f.format !== 'table')
}
/** 数据表块字段（source=TABLE、format=table）：整张子表作为小表格渲染 */
function tableFields(sec: ApprovalPageSection): ApprovalPageField[] {
  return (sec.fields || []).filter((f) => f.format === 'table')
}
/** 把任意值规整为行数组（子表在 values 里是 list of map） */
function asRows(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? (v as Record<string, unknown>[]) : []
}
/** 由首行键推导子表列（取所有行键的并集，避免漏列）——旧配置没选列时的兜底 */
function subColumns(rows: Record<string, unknown>[]): { title: string; dataIndex: string; key: string }[] {
  const keys = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k)
  return [...keys].map((k) => ({ title: k, dataIndex: k, key: k }))
}

/** 表格列：优先用配置里用户选的列（label 作表头、物理列名作取值）；没选列才退回按真实数据推导 */
function tableColumnsOf(
  f: ApprovalPageField,
  rows: Record<string, unknown>[]
): { title: string; dataIndex: string; key: string }[] {
  const cfg = f.tableColumns || []
  if (cfg.length) {
    return cfg.map((c) => ({ title: c.label || c.key, dataIndex: c.key, key: c.key }))
  }
  return subColumns(rows)
}

/**
 * 字段取值：常规按 key 直接取。
 *
 * 只有 FK_LIST（档案子表）在后端只给 values[表名] 一个行数组、没有扁平键，
 * 才降级取首行的物理列值；MAIN_ROW / BIZ_ROW 的服务端已铺好「表名.列名」扁平键，
 * 缺值就是缺值，绝不能取 values[表名] 的首行——一对多场景那样会把历史单/别的单
 * 当成「本次单据」显示。存量单没有 tableModes 时保持原来的兼容降级行为。
 */
function valueOf(f: { key: string }): unknown {
  const direct = values.value[f.key]
  if (!isEmpty(direct)) return direct
  const dot = f.key.lastIndexOf('.')
  if (dot < 0) return direct
  const tableName = f.key.slice(0, dot)
  const column = f.key.slice(dot + 1)
  const mode = tableModes.value[tableName]
  if (mode === 'MAIN_ROW' || mode === 'BIZ_ROW') return direct
  const rows = asRows(values.value[tableName])
  return rows.length ? rows[0][column] : direct
}

function display(f: ApprovalPageField | { key: string; label: string; format?: string }) {
  const v = valueOf(f)
  if (isEmpty(v)) return '—'
  if (f.format === 'money') {
    const n = Number(v)
    return Number.isFinite(n) ? n.toFixed(2) : String(v)
  }
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (Array.isArray(v)) return v.join('、')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function fmtTime(s?: string) {
  if (!s) return ''
  return String(s).replace('T', ' ').slice(0, 19)
}

function statusText(s?: number) {
  return ({ 0: '进行中', 1: '已通过', 2: '已驳回', 3: '已撤回', 4: '已终止' } as Record<number, string>)[s ?? -1] || '未知'
}
function statusColor(s?: number) {
  return ({ 0: 'processing', 1: 'green', 2: 'red', 3: 'default', 4: 'default' } as Record<number, string>)[s ?? -1] || 'default'
}
function taskText(s?: number) {
  return ({ 0: '待处理', 1: '已通过', 2: '已驳回', 3: '已跳过', 4: '已取消', 9: '已转办' } as Record<number, string>)[s ?? -1] || '未知'
}
function taskColor(s?: number) {
  return ({ 0: 'processing', 1: 'green', 2: 'red', 3: 'default', 4: 'default', 9: 'blue' } as Record<number, string>)[s ?? -1] || 'default'
}
function stepStatus(state: string) {
  return ({ DONE: 'finish', CURRENT: 'process', TODO: 'wait', SKIPPED: 'wait' } as Record<string, 'finish' | 'process' | 'wait'>)[state] || 'wait'
}
function modeText(mode?: string) {
  return ({ ANY: '或签（一人通过即可）', ALL: '会签（全部通过）', SEQ: '依次审批' } as Record<string, string>)[mode || ''] || ''
}

async function load() {
  if (!props.instanceId) return
  loading.value = true
  note.value = ''
  try {
    // ehr-web 的 request 已解包 Result 壳，拿到的就是实例本体
    const [d, c] = await Promise.all([
      fetchApprovalDetail(props.instanceId),
      fetchApprovalContext(props.instanceId).catch(() => null)
    ])
    detail.value = d || null
    ctx.value = c || null
  } catch (e) {
    detail.value = null
    ctx.value = null
    message.error((e as Error).message)
  } finally {
    loading.value = false
  }
}

async function submit(pass: boolean) {
  if (!myTaskId.value) return
  if (!pass && !note.value.trim()) {
    message.warning('驳回请填写原因，方便发起人修改')
    return
  }
  submitting.value = true
  try {
    await approveTask(myTaskId.value, pass, note.value.trim())
    message.success(pass ? '已通过' : '已驳回')
    emit('done')
    close()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}

function onMore({ key }: { key: string }) {
  if (!myTaskId.value) return
  moveType.value = key === 'transfer' ? 'transfer' : 'addSign'
  pickedUser.value = null
  movePosition.value = 'AFTER'
  moveOpen.value = true
}

function onPickUser(u: { id: string; name: string }) {
  pickedUser.value = u
  pickerOpen.value = false
}

async function doMove() {
  if (!myTaskId.value || !pickedUser.value) {
    message.warning('请先按组织选择人员')
    return
  }
  submitting.value = true
  try {
    if (moveType.value === 'transfer') {
      await transferTask(myTaskId.value, pickedUser.value.id, note.value.trim())
      message.success(`已转办给 ${pickedUser.value.name}`)
    } else {
      await addSignTask(myTaskId.value, pickedUser.value.id, movePosition.value, note.value.trim())
      message.success(`已加签 ${pickedUser.value.name}`)
    }
    moveOpen.value = false
    emit('done')
    close()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    submitting.value = false
  }
}

async function withdraw() {
  if (!detail.value) return
  Modal.confirm({
    title: '撤回这张审批单？',
    content: '撤回后流程立即结束，可以重新发起。',
    okText: '撤回',
    okType: 'danger',
    onOk: async () => {
      submitting.value = true
      try {
        await withdrawApproval(detail.value!.id, note.value.trim())
        message.success('已撤回')
        emit('done')
        close()
      } catch (e) {
        message.error((e as Error).message)
      } finally {
        submitting.value = false
      }
    }
  })
}

function close() {
  emit('update:open', false)
}

watch(() => [props.open, props.instanceId], ([o, id]) => {
  if (o && id) load()
})
</script>

<style scoped>
.dt-title {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 24px;
}
.dt-title .tt {
  font-size: 15px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dt-body {
  padding: 16px;
}
.card {
  background: var(--login-card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.card.emphasis {
  background: linear-gradient(180deg, rgba(99, 102, 241, 0.06), transparent);
  border-color: rgba(99, 102, 241, 0.25);
}
.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-base);
}
.mode-tag {
  font-size: 11px;
  line-height: 18px;
  margin: 0;
  background: rgba(99, 102, 241, 0.12);
  border-color: transparent;
  color: #6366f1;
}
/* 与人员档案页 EmployeeProfileDrawer 对齐：bordered 描述表格（灰底 label 列 + 边框 + 96px 标签列宽） */
.desc :deep(.ant-descriptions-item-label) {
  width: 96px;
  color: var(--muted);
  font-size: 13px;
}
.desc :deep(.ant-descriptions-item-content) {
  color: var(--text-base);
  font-size: 13px;
}
/* 表单区：bordered 表格本身已带边框，外层不再套一层底色/圆角，避免「两重框」和淡紫底 */
.form-card {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
  margin-bottom: 16px;
}
.form-card.emphasis {
  background: transparent;
  border: none;
}
.form-card > .card-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}
/* 自定义页面路由：iframe 占满信息区宽度，给一个可阅读的最小高度 */
.route-frame {
  display: block;
  width: 100%;
  height: 60vh;
  border: none;
}
.steps {
  padding-top: 4px;
}

.branch-tag {
  font-size: 11px; line-height: 18px; margin: 0;
  background: rgba(99, 102, 241, .12); border-color: transparent; color: #6366f1;
}
.branch-card { border-left: 3px solid rgba(99, 102, 241, .35); }
.task-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.task {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--code-bg);
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
}
.av {
  background: rgba(99, 102, 241, 0.16);
  color: #6366f1;
  font-size: 12px;
  flex: none;
}
.who-main {
  min-width: 0;
}
.who-main .name {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.who-main .meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  font-size: 12px;
}
.mini-tag {
  font-size: 11px;
  line-height: 17px;
  margin: 0;
}
.opinion {
  margin-top: 8px;
  margin-left: 36px;
  font-size: 12.5px;
  color: var(--text-base);
  opacity: 0.86;
  white-space: pre-wrap;
  word-break: break-word;
}
.action-card .actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}
.muted {
  color: var(--muted);
}
.sub-table-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-base);
  margin: 14px 0 8px;
}
/* 子表与同页 bordered 描述表统一：外框圆角 + 灰底表头 + 列等分 + 长文本省略 */
.sub-table {
  margin-bottom: 10px;
}
.sub-table :deep(.ant-table) {
  font-size: 13px;
}
.sub-table :deep(.ant-table-container) {
  border-radius: 8px;
  overflow: hidden;
}
/* Ant 的 tableLayout=fixed 会加 .ant-table-layout-fixed；这里再兜一层保证列等分 */
.sub-table :deep(.ant-table table) {
  table-layout: fixed;
}
.sub-table :deep(.ant-table-thead > tr > th) {
  background: var(--code-bg);
  color: var(--text-base);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub-table :deep(.ant-table-tbody > tr > td) {
  font-size: 13px;
}
.sub-table .cell-val {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub-table .cell-empty {
  color: var(--muted);
}
.field-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}
.picked-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 6px 12px;
  min-height: 38px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-base);
}
.picked-row.placeholder {
  color: var(--muted);
}
.picked-row:hover {
  border-color: #6366f1;
}
.picked-row .picked-name {
  font-weight: 600;
}
.picked-row .av {
  background: rgba(99, 102, 241, 0.16);
  color: #6366f1;
  font-size: 12px;
  flex: none;
}
</style>
