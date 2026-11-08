<template>
  <div class="emp-change-page">
    <div v-if="loading" class="state">加载中…</div>
    <div v-else-if="error" class="state error">{{ error }}</div>
    <template v-else-if="payload">
      <!-- 页头：谁发起的 + 单据状态（原型定稿样式） -->
      <div class="page-head">
        {{ headTitle }}
        <span class="tag-status" :class="statusCls">{{ statusName || '—' }}</span>
      </div>

      <!-- 变更概览 -->
      <div class="summary">
        <span class="lead">变更概览</span>
        <span v-if="payload.stats.baseChanges > 0" class="chip">
          基本信息 <b>{{ payload.stats.baseChanges }}</b> 项
        </span>
        <span v-for="c in listChips" :key="c.type" class="chip">
          {{ c.label }}
          <span v-if="c.add" class="plus">+{{ c.add }}</span>
          <template v-if="c.mod">{{ c.add ? ' / ' : '' }}改 <b>{{ c.mod }}</b></template>
          <template v-if="c.del">{{ c.add || c.mod ? ' / ' : '' }}<span class="minus">-{{ c.del }}</span></template>
        </span>
      </div>

      <!-- tab：与变更表单一一对应 -->
      <div class="tabs">
        <div class="tab" :class="{ active: pane === 'basic' }" @click="pane = 'basic'">
          基本信息<span v-if="payload.stats.baseChanges > 0" class="badge">{{ payload.stats.baseChanges }}</span>
        </div>
        <div
          v-for="t in listTabs"
          :key="t.type"
          class="tab"
          :class="{ active: pane === t.type }"
          @click="pane = t.type"
        >
          {{ t.label }} ({{ listOf(t.type)?.rows.length ?? 0
          }})<span v-if="changeCount(t.type) > 0" class="badge">{{ changeCount(t.type) }}</span>
        </div>
      </div>

      <!-- ========== 基本信息：字段与顺序和变更表单一致；旧值删除线在上、新值红色在下 ========== -->
      <div class="pane" :class="{ active: pane === 'basic' }">
        <div class="group-title">
          基本信息<span v-if="payload.emp.statusName" class="tag-onjob">{{ payload.emp.statusName }}</span>
        </div>
        <table class="desc">
          <tr v-for="(rowKeys, ri) in baseLayout" :key="ri">
            <template v-for="key in rowKeys" :key="key">
              <td v-show="showBaseCell(key)" class="k">{{ cellOf(key)?.label }}</td>
              <td
                v-show="showBaseCell(key)"
                class="v"
                :class="{ changed: !!cellOf(key)?.changed }"
                :colspan="spanOf(key)"
              >
                <template v-if="key === 'account'">
                  <span v-if="cellOf(key)?.tag" class="tag-open">{{ cellOf(key)?.tag }}</span>
                  {{ showText(cellOf(key)?.value) }}
                </template>
                <template v-else-if="cellOf(key)?.changed">
                  <span class="old">{{ showText(cellOf(key)?.value) }}</span>
                  <span class="new">{{ showText(cellOf(key)?.newValue) }}</span>
                </template>
                <template v-else>
                  {{ showText(cellOf(key)?.value)
                  }}<span v-if="cellOf(key)?.suffix" class="muted">（{{ cellOf(key)?.suffix }}）</span>
                </template>
              </td>
            </template>
          </tr>
        </table>
      </div>

      <!-- ========== 银行卡 ========== -->
      <div class="pane" :class="{ active: pane === 'BANK' }">
        <div class="group-title">银行卡<span class="group-hint">「工资卡」用于发薪，每人至多一张</span></div>
        <table class="tbl">
          <tr>
            <th style="width: 16%">银行</th>
            <th style="width: 26%">卡号</th>
            <th style="width: 14%">持卡人</th>
            <th>开户行</th>
            <th style="width: 12%">工资卡</th>
          </tr>
          <tr v-for="(r, i) in visibleRows('BANK')" :key="i" :class="rowClass(r)">
            <td>
              <diff-text :r="r" k="bank" list="BANK" main />
              <span v-if="r.op !== 'NONE'" class="row-tag" :class="tagClass(r.op)">{{ tagText(r.op) }}</span>
            </td>
            <td><diff-text :r="r" k="accountNo" list="BANK" /></td>
            <td><diff-text :r="r" k="holderName" list="BANK" /></td>
            <td><diff-text :r="r" k="branch" list="BANK" /></td>
            <td>
              <template v-if="isChanged(r, 'isPrimary')">
                <span class="old">{{ primaryText(r.row) }}</span>
                <span class="new">{{ primaryText(r.newRow) }}</span>
              </template>
              <template v-else>
                <span v-if="isPrimary(r.row)" class="tag-salary">工资卡</span>
                <template v-else>—</template>
              </template>
            </td>
          </tr>
        </table>
        <div v-if="visibleRows('BANK').length === 0" class="empty">（无记录）</div>
      </div>

      <!-- ========== 教育背景 ========== -->
      <div class="pane" :class="{ active: pane === 'EDUCATION' }">
        <div class="group-title">教育背景<span class="group-hint">从高中/中专起可逐段录入</span></div>
        <table class="tbl">
          <tr>
            <th style="width: 30%">学校 / 专业</th>
            <th style="width: 12%">学历</th>
            <th style="width: 26%">起止时间</th>
            <th>备注</th>
          </tr>
          <tr v-for="(r, i) in visibleRows('EDUCATION')" :key="i" :class="rowClass(r)">
            <td>
              <div class="cell-main">
                <diff-text :r="r" k="school" list="EDUCATION" plain />
                <span v-if="r.op !== 'NONE'" class="row-tag" :class="tagClass(r.op)">{{ tagText(r.op) }}</span>
              </div>
              <div class="cell-sub">
                <diff-text :r="r" k="major" list="EDUCATION" plain dash />
              </div>
            </td>
            <td><diff-text :r="r" k="degree" list="EDUCATION" dash /></td>
            <td><diff-text :r="r" k="range" list="EDUCATION" dash /></td>
            <td><diff-text :r="r" k="remark" list="EDUCATION" dash /></td>
          </tr>
        </table>
        <div v-if="visibleRows('EDUCATION').length === 0" class="empty">（无记录）</div>
      </div>

      <!-- ========== 工作经历 ========== -->
      <div class="pane" :class="{ active: pane === 'WORK' }">
        <div class="group-title">工作经历<span class="group-hint">入职本公司前的工作记录</span></div>
        <table class="tbl">
          <tr>
            <th style="width: 30%">单位 / 职位</th>
            <th style="width: 26%">起止时间</th>
            <th>离职原因</th>
          </tr>
          <tr v-for="(r, i) in visibleRows('WORK')" :key="i" :class="rowClass(r)">
            <td>
              <div class="cell-main">
                <diff-text :r="r" k="company" list="WORK" plain />
                <span v-if="r.op !== 'NONE'" class="row-tag" :class="tagClass(r.op)">{{ tagText(r.op) }}</span>
              </div>
              <div class="cell-sub">
                <diff-text :r="r" k="position" list="WORK" plain dash />
              </div>
            </td>
            <td><diff-text :r="r" k="range" list="WORK" dash /></td>
            <td><diff-text :r="r" k="leaveReason" list="WORK" dash /></td>
          </tr>
        </table>
        <div v-if="visibleRows('WORK').length === 0" class="empty">（无记录）</div>
      </div>

      <!-- ========== 家庭成员 ========== -->
      <div class="pane" :class="{ active: pane === 'FAMILY' }">
        <div class="group-title">家庭成员<span class="group-hint">用于紧急联系与福利场景</span></div>
        <table class="tbl">
          <tr>
            <th style="width: 12%">关系</th>
            <th style="width: 16%">姓名</th>
            <th>工作单位</th>
            <th style="width: 22%">电话</th>
          </tr>
          <tr v-for="(r, i) in visibleRows('FAMILY')" :key="i" :class="rowClass(r)">
            <td>
              <diff-text :r="r" k="relation" list="FAMILY" main />
              <span v-if="r.op !== 'NONE'" class="row-tag" :class="tagClass(r.op)">{{ tagText(r.op) }}</span>
            </td>
            <td><diff-text :r="r" k="name" list="FAMILY" dash /></td>
            <td><diff-text :r="r" k="company" list="FAMILY" dash /></td>
            <td><diff-text :r="r" k="phone" list="FAMILY" dash /></td>
          </tr>
        </table>
        <div v-if="visibleRows('FAMILY').length === 0" class="empty">（无记录）</div>
      </div>

      <!-- 图例 -->
      <div class="legend">
        <span><i class="l-old">原数据</i>变更前（删除线）</span>
        <span><i class="l-new">新数据</i>变更后（红色）</span>
        <span><i class="l-add">整行绿色</i>新增的行</span>
        <span><i class="l-old">整行删除线</i>删除的行</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchApprovalContext } from '@/api/approvals'

/**
 * 人员信息变更 · 审批对比页（ehr.emp_update 的 ROUTE 自定义页面）。
 * 嵌在审批抽屉信息区（iframe）：抽屉按 page.routePath 拼 ?instanceId= 嵌进来，
 * 页面按 instanceId 拉审批上下文，只读快照里冻结的变更对比载荷（values.change），不查业务库。
 *
 * 渲染规则（与原型 prototypes/emp-change-approval.html 一致）：
 *   基本信息：栅格与顺序和变更表单一致；变化的格「上旧值删除线 / 下新值红色」，格底淡黄。
 *   子表行：ADD 整行绿色、DEL 整行删除线、MOD 行首「改」标 + 仅变化单元格标新旧。
 */

/** 基本信息单元格（后端快照：value 原值；changed 时带 newValue） */
interface ChangeCell {
  label: string
  value: string
  changed: boolean
  newValue?: string
  suffix?: string
  tag?: string
}

/** 子表行：op=NONE 未变 / ADD 新增 / DEL 删除 / MOD 修改；row 旧值（ADD 为新行），newRow 仅 MOD 有 */
interface ChangeRow {
  op: 'NONE' | 'ADD' | 'DEL' | 'MOD'
  row: Record<string, any>
  newRow?: Record<string, any>
  changedKeys?: string[]
}

interface ChangeList {
  type: 'BANK' | 'EDUCATION' | 'WORK' | 'FAMILY'
  label: string
  rows: ChangeRow[]
}

interface ChangePayload {
  emp: {
    empNo: string
    name: string
    orgName: string
    statusName: string
    accountUsername: string
    hasAccount: boolean
  }
  base: Record<string, ChangeCell>
  lists: ChangeList[]
  stats: { baseChanges: number; addCount: number; modCount: number; delCount: number }
}

const route = useRoute()
const loading = ref(true)
const error = ref('')
const headTitle = ref('人员信息变更审批')
const status = ref(0)
const statusName = ref('')
const payload = ref<ChangePayload | null>(null)
const pane = ref('basic')

onMounted(async () => {
  const instanceId = String(route.query.instanceId || '')
  if (!instanceId) {
    error.value = '缺少 instanceId 参数（本页从审批详情里打开）'
    loading.value = false
    return
  }
  try {
    const ctx = await fetchApprovalContext(instanceId)
    status.value = ctx.status
    statusName.value = ctx.statusName || ''
    const change = ctx.values?.change as ChangePayload | undefined
    if (!change || !change.base) {
      error.value = '这张审批单没有变更对比数据（可能是改造前的老单据）'
      return
    }
    payload.value = change
    // 标题：谁发起的 + 变更的是谁，如「王浩然发起的测试的信息变更审批」
    const empName = (change.emp?.name || '').trim()
    headTitle.value = ctx.applicantName
      ? `${ctx.applicantName}发起的${empName ? `${empName}的` : ''}信息变更审批`
      : ctx.title || '人员信息变更审批'
  } catch (e: any) {
    error.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
})

/* 基本信息栅格：与变更表单的字段顺序一致；probation/remark 是宽格（值格跨列） */
const baseLayout = [
  ['empNo', 'name', 'gender'],
  ['birthday', 'nation', 'nativePlace'],
  ['idCard', 'maritalStatus', 'politicalStatus'],
  ['education', 'position', 'hireDate'],
  ['probation', 'orgName'],
  ['currentAddress', 'mobile', 'email'],
  ['emergencyContact', 'emergencyPhone', 'account'],
  ['remark']
]
const WIDE_SPANS: Record<string, number> = { probation: 3, remark: 5 }

const listTabs = [
  { type: 'BANK', label: '银行卡' },
  { type: 'EDUCATION', label: '教育背景' },
  { type: 'WORK', label: '工作经历' },
  { type: 'FAMILY', label: '家庭成员' }
] as const

const statusCls = computed(() => {
  // 0 进行中 / 1 已通过 / 2 已驳回 / 3 已撤回 / 4 已终止
  if (status.value === 1) return 'passed'
  if (status.value === 2) return 'rejected'
  if (status.value === 3 || status.value === 4) return 'closed'
  return ''
})

function cellOf(key: string): ChangeCell | undefined {
  return payload.value?.base[key]
}

function spanOf(key: string): number {
  return WIDE_SPANS[key] ?? 1
}

/** 基本信息：字段有数据才显示该格（标签格与值格一起藏） */
function showBaseCell(key: string): boolean {
  return !!cellOf(key)
}

function showText(v?: string): string {
  return v && v.trim() ? v : '—'
}

function listOf(type: string): ChangeList | undefined {
  return payload.value?.lists.find((l) => l.type === type)
}

/** 子表行全量展示（本页不提供「只看变更」过滤） */
function visibleRows(type: string): ChangeRow[] {
  return listOf(type)?.rows ?? []
}

function changeCount(type: string): number {
  return (listOf(type)?.rows ?? []).filter((r) => r.op !== 'NONE').length
}

interface ListChip {
  type: string
  label: string
  add: number
  mod: number
  del: number
}

const listChips = computed<ListChip[]>(() => {
  const out: ListChip[] = []
  for (const t of listTabs) {
    const rows = listOf(t.type)?.rows ?? []
    const chip = {
      type: t.type,
      label: t.label,
      add: rows.filter((r) => r.op === 'ADD').length,
      mod: rows.filter((r) => r.op === 'MOD').length,
      del: rows.filter((r) => r.op === 'DEL').length
    }
    if (chip.add || chip.mod || chip.del) out.push(chip)
  }
  return out
})

function rowClass(r: ChangeRow): string {
  if (r.op === 'ADD') return 'add'
  if (r.op === 'DEL') return 'del'
  if (r.op === 'MOD') return 'changed'
  return ''
}

function tagClass(op: ChangeRow['op']): string {
  if (op === 'ADD') return 'add'
  if (op === 'DEL') return 'del'
  return 'changed'
}

function tagText(op: ChangeRow['op']): string {
  if (op === 'ADD') return '新增'
  if (op === 'DEL') return '删除'
  return '改'
}

/** MOD 行的某个字段是否被改（range 由 startDate/endDate 任一变化触发） */
function isChanged(r: ChangeRow, ...keys: string[]): boolean {
  if (r.op !== 'MOD' || !r.changedKeys) return false
  return keys.some((k) => {
    if (k === 'range') return r.changedKeys!.includes('startDate') || r.changedKeys!.includes('endDate')
    return r.changedKeys!.includes(k)
  })
}

/**
 * 单元格展示值：字典字段优先用快照里解析好的展示名，没有才回退原码；
 * range 由起止日期拼；空值给「—」。
 */
function cellText(map: Record<string, any> | undefined, key: string): string {
  if (!map) return ''
  if (key === 'range') {
    const s = String(map.startDate || '')
    const e = String(map.endDate || '至今')
    return s ? `${s} ~ ${e}` : ''
  }
  if (key === 'bank') return String(map.bankName || map.bank || '')
  if (key === 'degree') return String(map.degreeName || map.degree || '')
  if (key === 'relation') return String(map.relationName || map.relation || '')
  const v = map[key]
  return v == null ? '' : String(v)
}

function isPrimary(map?: Record<string, any>): boolean {
  return Number(map?.isPrimary) === 1
}

/** 工资卡字段发生 MOD 时的文本（旧/新值对比用，空态说「普通卡」） */
function primaryText(map?: Record<string, any>): string {
  return isPrimary(map) ? '工资卡' : '普通卡'
}

/**
 * 单元格渲染小组件：MOD 且该字段被改 → 上旧（删除线）下新（红）；否则按当前行展示。
 * main=true 加粗（行首主字段）；plain=true 不带包裹样式（嵌在 cell-main/cell-sub 里用）。
 */
const DiffText = (props: {
  r: ChangeRow
  k: string
  list: string
  main?: boolean
  plain?: boolean
  dash?: boolean
}) => {
  const { r, k, main, plain, dash } = props
  const dashOr = (s: string) => (s ? s : dash ? '—' : '')
  if (isChanged(r, k)) {
    return h('span', { class: plain ? undefined : main ? 'cell-main' : undefined }, [
      h('span', { class: 'old' }, dashOr(cellText(r.row, k)) || '（空）'),
      h('span', { class: 'new' }, dashOr(cellText(r.newRow, k)) || '（空）')
    ])
  }
  const text = dashOr(cellText(r.row, k))
  if (plain) return h('span', text)
  if (main) return h('span', { class: 'cell-main' }, text)
  return h('span', text || '—')
}
DiffText.props = ['r', 'k', 'list', 'main', 'plain', 'dash']
</script>

<style scoped>
/* —— 样式与原型 prototypes/emp-change-approval.html 一致；背景透明以融入审批抽屉信息区 —— */
.emp-change-page {
  color: var(--text-base);
  font-size: 13px;
  line-height: 1.5;
  padding: 0 16px 12px;
}
.state {
  padding: 40px 0;
  text-align: center;
  color: var(--muted);
}
.state.error {
  color: #f5222d;
}

.page-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0 14px;
  font-size: 15px;
  font-weight: 600;
}
.tag-status {
  font-size: 12px;
  font-weight: 400;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.12);
  border-radius: 4px;
  padding: 1px 8px;
}
.tag-status.passed {
  color: #389e0d;
  background: #f6ffed;
}
.tag-status.rejected {
  color: #f5222d;
  background: #fff1f0;
}
.tag-status.closed {
  color: #8a8f99;
  background: #f2f3f5;
}

/* ---------- 变更概览 ---------- */
.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: var(--code-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
}
.summary .lead {
  font-weight: 600;
  margin-right: 4px;
}
.chip {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--login-card-bg);
  border: 1px solid var(--border-subtle);
  color: var(--text-base);
}
.chip b {
  color: #f5222d;
  font-weight: 600;
}
.chip .plus {
  color: #52c41a;
  font-weight: 600;
}
.chip .minus {
  color: #999;
  font-weight: 600;
  text-decoration: line-through;
}

/* ---------- tab ---------- */
.tabs {
  display: flex;
  gap: 26px;
  border-bottom: 1px solid var(--border-subtle);
  margin-bottom: 12px;
}
.tab {
  position: relative;
  padding: 8px 2px 12px;
  cursor: pointer;
  color: var(--muted);
  font-size: 14px;
  user-select: none;
}
.tab.active {
  color: #2f54eb;
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: #2f54eb;
}
.tab .badge {
  display: inline-block;
  min-width: 16px;
  text-align: center;
  font-size: 11px;
  line-height: 16px;
  border-radius: 8px;
  background: #f5222d;
  color: #fff;
  padding: 0 5px;
  margin-left: 4px;
  vertical-align: 1px;
}
.pane {
  display: none;
}
/* 与抽屉内平台区块同款卡片：白底 + 浅边框 + 10px 圆角 + 14/16 内边距 */
.pane.active {
  display: block;
  background: var(--login-card-bg);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px 16px;
}

/* ---------- 基本信息：描述表 ---------- */
.group-title {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px;
  color: var(--text-base);
}
.group-hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  margin-left: 8px;
}
.desc {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.desc td {
  border: 1px solid var(--border-subtle);
  padding: 10px 12px;
  vertical-align: top;
  word-break: break-all;
}
.desc td.k {
  width: 96px;
  background: var(--code-bg);
  color: var(--muted);
}
.desc td.v {
  color: var(--text-base);
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.tag-onjob {
  display: inline-block;
  font-size: 11px;
  line-height: 18px;
  border-radius: 4px;
  padding: 0 6px;
  margin-left: 8px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
  vertical-align: 2px;
}
.tag-open {
  display: inline-block;
  font-size: 11px;
  line-height: 16px;
  border-radius: 4px;
  padding: 0 5px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #389e0d;
}

/* diff：新旧值上下排布——上行旧值删除线，下行新值红色 */
:deep(.old) {
  display: block;
  color: var(--muted);
  text-decoration: line-through;
  margin-bottom: 2px;
}
:deep(.new) {
  display: block;
  color: #f5222d;
  font-weight: 600;
}

/* ---------- 列表：表格 ---------- */
.tbl {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.tbl th {
  text-align: left;
  font-weight: 600;
  color: var(--text-base);
  background: var(--code-bg);
  border: 1px solid var(--border-subtle);
  padding: 8px 12px;
}
.tbl td {
  border: 1px solid var(--border-subtle);
  padding: 9px 12px;
  vertical-align: top;
  word-break: break-all;
}
.cell-main {
  font-weight: 600;
}
.cell-sub {
  color: var(--muted);
  font-size: 12px;
  margin-top: 2px;
}

tr.del td {
  background: var(--code-bg);
}
tr.del td .cell-main,
tr.del td .cell-sub,
tr.del td span {
  color: var(--muted);
  text-decoration: line-through;
  font-weight: 400;
}
tr.add td {
  background: #f6ffed;
}
tr.add td .cell-main,
tr.add td {
  color: #389e0d;
}
tr.add td .cell-sub {
  color: #95d5b2;
}

.row-tag {
  display: inline-block;
  font-size: 11px;
  line-height: 18px;
  border-radius: 4px;
  padding: 0 6px;
  margin-left: 8px;
  vertical-align: 1px;
}
.row-tag.del {
  background: #fff1f0;
  color: #f5222d;
  text-decoration: none !important;
}
.row-tag.add {
  background: #d9f7be;
  color: #389e0d;
}
.row-tag.changed {
  background: var(--code-bg);
  color: var(--muted);
}
.tag-salary {
  display: inline-block;
  font-size: 11px;
  line-height: 18px;
  border-radius: 4px;
  padding: 0 6px;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  color: #1890ff;
}

.empty {
  padding: 18px 0;
  text-align: center;
  color: var(--muted);
}

/* 图例 */
.legend {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-subtle);
  color: var(--muted);
  font-size: 12px;
}
.legend i {
  font-style: normal;
  margin-right: 4px;
}
.legend .l-old {
  color: var(--muted);
  text-decoration: line-through;
}
.legend .l-new {
  color: #f5222d;
  font-weight: 600;
}
.legend .l-add {
  color: #389e0d;
  font-weight: 600;
}
/* 深色模式：浅色语义底整体压暗，避免白底块在深色抽屉里刺眼 */
html[data-theme='dark'] tr.add td {
  background: rgba(82, 196, 26, 0.16);
}
html[data-theme='dark'] tr.add td .cell-sub {
  color: #7cb887;
}
html[data-theme='dark'] tr.changed td {
  background: rgba(250, 173, 20, 0.12);
}
html[data-theme='dark'] :deep(.new) {
  color: #ff7875;
}
html[data-theme='dark'] .row-tag.add {
  background: rgba(82, 196, 26, 0.18);
  color: #95de64;
}
html[data-theme='dark'] .row-tag.changed {
  background: rgba(250, 173, 20, 0.18);
  color: #ffd666;
}
html[data-theme='dark'] .row-tag.del {
  background: rgba(255, 77, 79, 0.16);
  color: #ff7875;
}
html[data-theme='dark'] .tag-salary {
  background: rgba(250, 173, 20, 0.14);
  border-color: rgba(250, 173, 20, 0.4);
  color: #ffd666;
}
html[data-theme='dark'] .tag-status.passed {
  background: rgba(82, 196, 26, 0.16);
  color: #95de64;
}
html[data-theme='dark'] .tag-status.rejected {
  background: rgba(255, 77, 79, 0.16);
  color: #ff7875;
}
html[data-theme='dark'] .tag-status.closed {
  background: var(--code-bg);
  color: var(--muted);
}
</style>
