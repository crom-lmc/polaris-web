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
          <a-descriptions
            v-if="descFields(sec).length"
            :column="sec.columns || 3"
            size="small"
            :colon="false"
            bordered
            class="desc"
          >
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

        <!-- 流程进度：后端 steps 只含审批节点，最前面补一个「发起申请」，流程才从发起人开始 -->
        <section class="card">
          <div class="card-title">流程进度</div>
          <a-steps
            :current="currentStepIndex"
            size="small"
            label-placement="vertical"
            class="steps"
          >
            <a-step
              v-for="s in flowSteps"
              :key="s.key"
              :title="s.name"
              :status="stepStatus(s.state)"
              :description="s.description"
            />
          </a-steps>
          <div class="applicant-row">
            <a-avatar :size="26" class="av">{{ applicantLabel.slice(0, 1) }}</a-avatar>
            <div class="who-main">
              <div class="name">
                {{ applicantLabel }}
                <a-tag color="green" class="mini-tag">已提交</a-tag>
              </div>
              <div class="meta muted">{{ fmtTime(detail.createdAt) || '—' }}</div>
            </div>
            <span class="applicant-role">发起人</span>
          </div>
        </section>

        <!-- 每个步骤的审批人 -->
        <section v-for="grp in taskGroups" :key="grp.seq" class="card">
          <div class="card-title">
            <span>{{ grp.seq }}. {{ grp.name }}</span>
            <a-tag v-if="grp.mode" class="mode-tag">{{ modeText(grp.mode) }}</a-tag>
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
            <a-button type="primary" :loading="submitting" @click="submit(true)">通过</a-button>
            <a-button danger :loading="submitting" @click="submit(false)">驳回</a-button>
            <a-dropdown>
              <a-button>
                更多
                <down-outlined />
              </a-button>
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

    <!-- 转办 / 加签：按组织树选人，不再手填账号 ID -->
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
            <template v-else>
              <span>按组织选择人员</span>
            </template>
          </div>
          <div class="field-tip">
            {{
              moveType === 'transfer'
                ? '转办后这条待办永久归属对方，原任务终结（同一单最多转 5 次）'
                : '加签会把当前节点切成会签，被加签人与原审批人都要通过'
            }}
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

    <!-- 组织树选人 -->
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
import { fmtTime } from '@/utils/time'
import ApprovalUserPicker from './ApprovalUserPicker.vue'
import type { ApprovalContext, ApprovalInstance, ApprovalPageSection, ApprovalPageField, ApprovalTask } from '@/types'

/**
 * mode：view=只读查看（列表点「查看」），不渲染通过/驳回/转办/加签；
 * approve=可处理（列表点「审批」）。默认 approve，兼容其它直接打开的旧调用。
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

/** 转办 / 加签弹窗 */
const moveOpen = ref(false)
const moveType = ref<'transfer' | 'addSign'>('transfer')
/** 选中的目标人：{id 账号ID(字符串), name}，由组织树选人弹窗产出 */
const pickedUser = ref<{ id: string; name: string } | null>(null)
const pickerOpen = ref(false)
const movePosition = ref<'BEFORE' | 'AFTER'>('AFTER')

/** 上下文里的「我的待办」最权威：审批权限由任务分派决定，不看权限点 */
const myTaskId = computed(() => ctx.value?.myTaskId || detail.value?.myTaskId || null)

const values = computed<Record<string, unknown>>(() => ctx.value?.values || detail.value?.formData || {})
/** 表名 → 定位模式；服务端按实例冻结的绑定算出，老单没有该字段 */
const tableModes = computed<Record<string, string>>(() => ctx.value?.tableModes || {})

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
  return inst.title || inst.bizName || '审批详情'
})

/**
 * 信息区字段来源：优先用模板配置（服务端已经把值算好放在 values 里）；
 * 没配（返回 null）时退回默认版式——把表单快照整体铺开，字段名做兜底翻译。
 */
const DEFAULT_LABELS: Record<string, string> = {
  orgPath: '所属组织',
  position: '职位',
  hireDate: '入职日期',
  probationText: '试用期',
  profileStats: '档案完整度',
  submitter: '提交人',
  name: '姓名',
  empNo: '工号',
  days: '天数',
  leaveType: '类型',
  startDate: '开始日期',
  endDate: '结束日期',
  reason: '事由',
  lastWorkDate: '最后工作日'
}

const sections = computed<ApprovalPageSection[]>(() => {
  const configured = ctx.value?.page?.sections
  if (configured && configured.length) {
    return configured
  }
  const vals = values.value || {}
  const keys = Object.keys(vals).filter(
    (k) => !['employeeId', 'empId', 'orgId', 'exemptProbation', 'probationMonths', 'newLeaderEmployeeId'].includes(k)
  )
  if (!keys.length) {
    return []
  }
  return [{
    key: 'default',
    title: '',
    columns: 3,
    fields: keys.map<ApprovalPageField>((k) => ({
      key: k,
      label: DEFAULT_LABELS[k] || k,
      format: 'text'
    }))
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
  // 带上当前主题：iframe 与主应用不同源（端口不同），无法共享 localStorage，只能靠 URL 传参
  const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  return `${p}${sep}instanceId=${props.instanceId || ''}&theme=${theme}`
})

/** 发起人姓名：实例字段优先，老单子没有时退回表单快照里的 submitter */
const applicantLabel = computed(() => {
  const fromSnapshot = values.value.submitter
  return (
    detail.value?.applicantName ||
    (typeof fromSnapshot === 'string' ? fromSnapshot : '') ||
    '—'
  )
})

interface FlowStep {
  key: string
  name: string
  state: string
  description: string
}

/** 流程条 = 发起申请（发起人提交）+ 后端返回的审批步骤 */
const flowSteps = computed<FlowStep[]>(() => {
  const start: FlowStep = { key: '__applicant__', name: '发起申请', state: 'DONE', description: '' }
  const rest = (detail.value?.steps || []).map((s) => ({
    key: String(s.seq),
    name: s.name,
    state: s.state,
    description: s.state === 'SKIPPED' ? '条件不满足，已跳过' : ''
  }))
  return [start, ...rest]
})

/** 前置了发起人节点，索引整体右移一位；发起人恒为已完成 */
const currentStepIndex = computed(() => {
  const list = flowSteps.value
  const idx = list.findIndex((s) => s.state === 'CURRENT')
  if (idx >= 0) return idx
  return detail.value?.status === 1 ? list.length : 1
})

/** 按步骤把任务分组；同一分支的多人放一起，才能看出是或签还是会签 */
const taskGroups = computed(() => {
  const tasks = detail.value?.tasks || []
  const map = new Map<number, { seq: number; name: string; mode?: string; tasks: ApprovalTask[] }>()
  for (const t of tasks) {
    const g = map.get(t.stepSeq) || { seq: t.stepSeq, name: t.stepName, mode: t.approveMode, tasks: [] }
    g.tasks.push(t)
    if (t.approveMode) g.mode = t.approveMode
    map.set(t.stepSeq, g)
  }
  return [...map.values()].sort((a, b) => a.seq - b.seq)
})

const canWithdraw = computed(() => {
  const inst = detail.value
  if (!inst || inst.status !== 0) return false
  return String(inst.applicantId || '') === String(store.user?.accountId || '')
})

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === ''
}

/** 子表单元格：空值统一占位「—」，对象转文本，避免留白或 [object Object] */
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
/** 数据表块字段（format=table）：整张子表作为小表格渲染 */
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
/** 表格列：优先用页面配置里用户选的列（label 作表头、物理列名作取值）；没选列才退回按真实数据推导 */
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
 * 只有 FK_LIST（档案子表）没有扁平键、需要降级取 values[表名] 首行；
 * MAIN_ROW / BIZ_ROW 用服务端铺好的「表名.列名」扁平键，缺值不降级，
 * 避免一对多场景把历史单的首行当成「本次单据」。存量单无 tableModes 时保持兼容。
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
    const [d, c] = await Promise.all([
      fetchApprovalDetail(props.instanceId),
      fetchApprovalContext(props.instanceId).catch(() => null)
    ])
    detail.value = d.data
    ctx.value = c ? c.data : null
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
/* 与人员档案页一致：bordered 描述表（灰底 label 列 + 96px 标签列宽） */
.desc :deep(.ant-descriptions-item-label) {
  width: 96px;
  color: var(--muted);
  font-size: 13px;
}
.desc :deep(.ant-descriptions-item-content) {
  color: var(--text-base);
  font-size: 13px;
}
/* 表单区：bordered 表格本身已带边框，外层不再套底色/圆角，避免两重框与淡紫底 */
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
/* 步骤条只画一个「发起申请」圆点，发起人是谁 / 什么时候提交放在这条信息带里 */
.applicant-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--code-bg);
}
.applicant-row .who-main {
  flex: 1;
  min-width: 0;
}
.applicant-row .name {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.applicant-row .meta {
  margin-top: 2px;
  font-size: 12px;
}
.applicant-role {
  font-size: 12px;
  color: var(--muted);
}
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
/* 与同页 bordered 描述表统一：外框圆角 + 灰底表头 + 列等分 + 长文本省略 */
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
