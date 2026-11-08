<template>
  <div class="flow-editor">
    <!-- 状态条：跟画布一起看，一眼知道有几条分支、最深几层 -->
    <div class="flow-top">
      <span class="ft-title">审批流程</span>
      <span class="ft-hint">点卡片配置 · 点 + 加节点（分支内的只影响该分支）</span>
      <span class="ft-stat">
        主干 {{ steps.length }} 个节点 · 条件网关 ×{{ stats.gw }} · 分支 ×{{ stats.br }} · 最深 {{ stats.maxDepth }}/3 层
      </span>
    </div>

    <div class="flow-main">
    <div class="canvas">
      <div class="canvas-inner">
        <div class="node-wrap">
          <div class="card start">
            <div class="card-head h-start">发起人</div>
            <div class="card-body"><span class="nm">所有人</span><span class="ar">›</span></div>
          </div>
        </div>
        <div class="conn">
          <a-dropdown :trigger="['click']">
            <button class="plus" title="在最上方添加节点">+</button>
            <template #overlay>
              <a-menu @click="(e: MenuInfo) => onAddAt('main', '', e.key as AddKind, 0)">
                <a-menu-item key="approver">审批人节点</a-menu-item>
                <a-menu-item key="parallel">并行会签</a-menu-item>
                <a-menu-item key="gateway">条件分流</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>

        <FlowNode :items="steps" :depth="0" scope="main" :selected="sel" @action="onAction" />

        <div class="node-wrap">
          <div class="card end"><div class="card-body center"><span class="nm">流程结束</span></div></div>
        </div>
        <div class="canvas-tip">条件分流最多嵌套 3 层；分支铺开后画布可左右滚动</div>
      </div>
    </div>

    <!-- ==================== 属性面板 ==================== -->
    <aside v-if="current" class="props">
      <div class="props-head">
        <span>{{ propsTitle }}</span>
        <a class="x" @click="sel = ''">×</a>
      </div>
      <div class="props-body">
        <!-- 名称 / 步骤级条件 -->
        <section class="sec">
          <div class="sec-title">基本信息</div>
          <div class="fld"><label>名称</label><a-input v-model:value="nameProxy" size="small" placeholder="节点名称" /></div>
          <div v-if="current.kind === 'step'" class="fld">
            <label>步骤生效条件（SpEL，空 = 总执行）</label>
            <div class="expr-row">
              <a-input v-model:value="stepConditionProxy" size="small" placeholder="如 days > 0" />
              <a-button size="small" :loading="checking" @click="checkExpr(stepConditionProxy)">校验</a-button>
            </div>
            <div v-if="exprTip" class="expr-tip" :class="{ err: !exprTip.ok }">{{ exprTip.text }}</div>
          </div>
          <div v-if="current.kind === 'step'" class="note">驳回动作全单统一为「整单 END」：任意节点驳回即作废所有待办、终止整单。</div>
        </section>

        <!-- 分支条件 -->
        <section v-if="current.kind === 'branch'" class="sec">
          <div class="sec-title">分支信息</div>
          <div class="fld">
            <label class="switch-line">
              <a-checkbox :checked="branchProxy.isFallback" @change="(e: any) => onFallbackChange(e)" />
              兜底分支（其它条件都不命中时进入）
            </label>
          </div>
          <FlowConditionBuilder v-if="!branchProxy.isFallback"
                                :model-value="branchProxy.conditionExpr"
                                :points="points"
                                :biz-label="props.bizLabel"
                                @update:model-value="onBranchExpr" />
          <div v-else class="note">兜底分支无需条件，运行时由「命中数为 0」触发。</div>
          <div class="note">本分支专属子链 {{ branchProxy.chain.length }} 个节点；点分支卡片下方的 + 继续追加。</div>
          <a-button size="small" danger block @click="delBranch">删除此分支</a-button>
        </section>

        <!-- 审批人 / 并行节点配置 -->
        <template v-if="nodeProxy">
          <section class="sec">
            <div class="sec-title">审批人规则（多条取并集，满足任一即派单）</div>
            <div v-for="(r, ri) in nodeProxy.approvers" :key="ri" class="rule-row">
              <a-select v-model:value="r.type" size="small" style="width: 124px" @change="onRuleType(r)">
                <a-select-option value="ORG_LEADER">组织负责人</a-select-option>
                <a-select-option value="ORG_LEADER_BY_NAME">指定组织负责人</a-select-option>
                <a-select-option value="ROLE">角色</a-select-option>
                <a-select-option value="USER">指定账号</a-select-option>
                <a-select-option value="APPLICANT">发起人本人</a-select-option>
              </a-select>
              <template v-if="r.type === 'ORG_LEADER'">
                <a-select v-model:value="r.source" size="small" style="width: 158px"
                          :options="orgLeaderSourceOptions" placeholder="取谁的组织" />
                <a-checkbox v-model:checked="r.toRoot" :disabled="!r.source">审批到集团</a-checkbox>
                <a-input-number v-if="!r.toRoot" v-model:value="r.levelOffset" :min="0" :max="10"
                                size="small" style="width: 96px" />
                <span class="small muted">{{ sourceHint(r) }}</span>
              </template>
              <template v-if="r.type === 'ORG_LEADER_BY_NAME'">
                <a-button size="small" @click="openOrgPicker(r)">{{ r.code ? '更换组织' : '选择组织' }}</a-button>
                <span class="small org-val" :class="{ muted: !r.code }" :title="r.code || ''">{{ r.code || '未选择' }}</span>
                <a v-if="r.code" class="danger small" @click="r.code = ''">清除</a>
              </template>
              <a-select v-if="r.type === 'ROLE'" v-model:value="r.code" size="small" style="width: 160px"
                        show-search option-filter-prop="label" :options="roleOptions" placeholder="选择角色" />
              <template v-if="r.type === 'USER'">
                <a-button size="small" @click="emit('pick-user', r)">{{ r.userId ? '更换人员' : '选择人员' }}</a-button>
                <span class="small" :class="{ muted: !r.userName }">{{ r.userName || (r.userId ? `账号 ${r.userId}` : '未选择') }}</span>
              </template>
              <span v-if="r.type === 'APPLICANT'" class="muted small">发起人自己确认</span>
              <a class="danger small" @click="removeRule(ri)">移除</a>
            </div>
            <div v-if="!nodeProxy.approvers.length" class="note warn">还没有审批人规则，这条流程保存时会校验不通过，请先添加。</div>
            <a-button size="small" type="dashed" block @click="addRule">+ 添加审批人规则</a-button>
          </section>
          <section class="sec">
            <div class="sec-title">审批与聚合</div>
            <div class="fld">
              <label>多人聚合</label>
              <a-select v-model:value="nodeProxy.approveMode" size="small" style="width: 100%">
                <a-select-option value="ANY">或签（一人通过即过）</a-select-option>
                <a-select-option value="ALL">会签（全员通过才过）</a-select-option>
                <a-select-option value="SEQ">依次（按序审批）</a-select-option>
              </a-select>
            </div>
            <div class="opt-row">
              <a-checkbox v-model:checked="nodeProxy.allowSelf">允许自审</a-checkbox>
              <a-checkbox v-model:checked="nodeProxy.skipSame">同人只审一次</a-checkbox>
            </div>
            <div class="fld">
              <label>解析不到审批人时</label>
              <a-select v-model:value="nodeProxy.onEmpty" size="small" style="width: 100%">
                <a-select-option value="SKIP">跳过该节点</a-select-option>
                <a-select-option value="BLOCK">阻塞整单</a-select-option>
              </a-select>
            </div>
          </section>
        </template>

        <!-- 网关 / 并行组操作 -->
        <section v-if="current.kind === 'step' && current.o.kind === 'gateway'" class="sec">
          <div class="sec-title">条件网关</div>
          <div class="note">{{ current.o.branches?.length || 0 }} 个分支；所有命中分支完成后汇合到下一个主干步骤。</div>
          <a-button size="small" block @click="addBranch">+ 添加条件分支</a-button>
          <a-button size="small" danger block class="mt6" @click="removeStep">删除整个网关</a-button>
        </section>
        <section v-else-if="current.kind === 'step' && current.o.kind === 'parallel'" class="sec">
          <div class="sec-title">并行会签</div>
          <div class="note">{{ current.o.nodes.length }} 张审批卡同时派单，全部通过才继续。</div>
          <a-button size="small" block @click="addLane">+ 添加并行审批人</a-button>
          <a-button size="small" danger block class="mt6" @click="removeStep">删除此节点</a-button>
        </section>
        <section v-else-if="current.kind === 'step' || current.kind === 'node'" class="sec">
          <a-button size="small" danger block @click="removeStep">删除此节点</a-button>
        </section>
      </div>
    </aside>
    </div>
    <!-- 未选中时不占宽：画布优先铺满，避免分支被挤压 -->

    <OrgPickerModal v-model:open="orgPickOpen" :current="orgPickCurrent" @confirm="confirmOrg" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Key } from 'ant-design-vue/es/_util/type'
import { message } from 'ant-design-vue'
import FlowNode from './FlowNode.vue'
import FlowConditionBuilder from './FlowConditionBuilder.vue'
import OrgPickerModal from './OrgPickerModal.vue'
import {
  type ApproverRule, type BusinessPoint, type FlowAction, type FlowBranch, type FlowStep, type NodeEdit,
  type RoleBrief, fetchRoles, orgLeaderSources, parseOrgLeaderSource, validateCondition
} from '@/api/approval'

interface MenuInfo { key: Key }
type AddKind = 'approver' | 'parallel' | 'gateway'

const props = defineProps<{ steps: FlowStep[]; points?: BusinessPoint[]; bizLabel?: string }>()
const emit = defineEmits<{ (e: 'pick-user', r: ApproverRule): void }>()

/** 顶部状态条统计：网关数、分支数、最深嵌套层数 */
const stats = computed(() => {
  let gw = 0
  let br = 0
  let maxDepth = 0
  const walk = (list: FlowStep[], d: number) => {
    for (const s of list) {
      if (s.kind !== 'gateway') continue
      gw += 1
      br += (s.branches || []).length
      maxDepth = Math.max(maxDepth, d + 1)
      for (const b of s.branches || []) walk(b.chain, d + 1)
    }
  }
  walk(props.steps, 0)
  return { gw, br, maxDepth }
})

/* ---------------- 本地 id ---------------- */
let cidSeq = 0
function newCid() { return `f${Date.now().toString(36)}${(++cidSeq).toString(36)}` }
function newNode(name = ''): NodeEdit {
  return {
    cid: newCid(), name, conditionExpr: '', approveMode: 'ANY',
    allowSelf: false, skipSame: true, onEmpty: 'SKIP',
    approvers: [{ type: 'ORG_LEADER', levelOffset: 0 }]
  }
}
function newBranch(i: number): FlowBranch {
  return {
    cid: newCid(), nodeCid: newCid(), name: `条件${i}`, conditionExpr: '', isFallback: false,
    card: newNode(), chain: []
  }
}
function newStep(kind: AddKind): FlowStep {
  if (kind === 'gateway') {
    // 默认不预填条件：业务点随业务场景不同，写死 days > 3 会引用到别的场景的变量
    const b1 = newBranch(1)
    const b2 = newBranch(2); b2.name = '其他条件'; b2.isFallback = true
    return { cid: newCid(), kind: 'gateway', name: '条件分流', conditionExpr: '', nodes: [], branches: [b1, b2] }
  }
  if (kind === 'parallel') {
    return { cid: newCid(), kind: 'parallel', name: '并行会签', conditionExpr: '', nodes: [newNode('审批人1'), newNode('审批人2')] }
  }
  return { cid: newCid(), kind: 'approver', name: '新审批节点', conditionExpr: '', nodes: [newNode()] }
}

/* ---------------- 索引 ---------------- */
type Ctx =
  | { kind: 'step'; o: FlowStep; parent: FlowStep[] }
  | { kind: 'node'; o: NodeEdit; parent: FlowStep }
  | { kind: 'lane'; o: NodeEdit; parent: FlowStep }
  | { kind: 'branch'; o: FlowBranch; parent: FlowStep }
  | { kind: 'branchCard'; o: NodeEdit; parent: FlowBranch }

function buildIndex() {
  const map = new Map<string, Ctx>()
  const walk = (list: FlowStep[]) => {
    for (const s of list) {
      map.set(s.cid, { kind: 'step', o: s, parent: list })
      if (s.kind === 'gateway') {
        for (const b of s.branches || []) {
          map.set(b.cid, { kind: 'branch', o: b, parent: s })
          map.set(b.card.cid, { kind: 'branchCard', o: b.card, parent: b })
          walk(b.chain || [])
        }
      } else if (s.kind === 'parallel') {
        for (const l of s.nodes) map.set(l.cid, { kind: 'lane', o: l, parent: s })
      } else if (s.nodes[0]) {
        map.set(s.nodes[0].cid, { kind: 'node', o: s.nodes[0], parent: s })
      }
    }
  }
  walk(props.steps || [])
  return map
}

const sel = ref('')
const index = computed(buildIndex)
const current = computed<Ctx | undefined>(() => index.value.get(sel.value))
const points = computed(() => props.points || [])

const propsTitle = computed(() => {
  const c = current.value
  if (!c) return '属性面板'
  if (c.kind === 'step') return c.o.kind === 'approver' ? '审批人节点' : '节点配置'
  return ({ node: '审批人', lane: '并行审批人', branch: '条件分支配置', branchCard: '分支审批人' } as Record<string, string>)[c.kind] || '属性面板'
})

/** 名称双向写：把不同选中类型统一成一个可写代理 */
const nameProxy = computed({
  get: () => {
    const c = current.value
    if (!c) return ''
    return c.kind === 'step' ? c.o.name : c.o.name
  },
  set: (v: string) => { const c = current.value; if (c) c.o.name = v }
})
const stepConditionProxy = computed({
  get: () => current.value?.kind === 'step' ? current.value.o.conditionExpr : '',
  set: (v: string) => { const c = current.value; if (c?.kind === 'step') c.o.conditionExpr = v }
})
const nodeProxy = computed<NodeEdit | undefined>(() => {
  const c = current.value
  if (!c) return undefined
  if (c.kind === 'node' || c.kind === 'lane' || c.kind === 'branchCard') return c.o
  if (c.kind === 'branch') return c.o.card
  // 主干 / 分支子链里的「审批人」卡片：数据上是 step，编辑的其实是它唯一的 node
  if (c.kind === 'step' && c.o.kind === 'approver') {
    const first = c.o.nodes[0]
    if (first) return first
    const created = newNode()
    c.o.nodes.push(created)
    return created
  }
  return undefined
})

/** ORG_LEADER「取谁的组织」下拉：申请人本人 + 当前业务场景的 USER/ORG 业务点 */
const orgLeaderSourceOptions = computed(() => orgLeaderSources(points.value))

/** ORG_LEADER 来源提示文案 */
function sourceHint(r: ApproverRule): string {
  if (!r.source) return '申请人本人组织'
  const p = parseOrgLeaderSource(r.source)
  const key = p?.key || ''
  if (r.toRoot) return `→ 审批到集团(${key})`
  return `${key}${r.levelOffset ? ` 上溯${r.levelOffset}级` : ' 直属'}`
}
const branchProxy = computed<FlowBranch>(() => {
  const c = current.value
  if (c?.kind === 'branch') return c.o
  if (c?.kind === 'branchCard') return c.parent
  return { cid: '', nodeCid: '', name: '', conditionExpr: '', isFallback: false, card: newNode(), chain: [] }
})

/* ---------------- 动作分发 ---------------- */
function onAction(a: FlowAction) {
  switch (a.type) {
    case 'select': sel.value = a.cid || ''; return
    case 'add': onAddAt(a.scope === 'branch' ? 'branch' : 'main', a.afterCid || '',
        a.kind || 'approver', a.depth || 0, a.branchCid || ''); return
    case 'remove': removeByCid(a.cid || ''); return
    case 'add-branch': addBranch(a.cid); return
    case 'del-branch': delBranch(a.cid, a.branchCid); return
    case 'add-lane': addLane(a.cid); return
    case 'del-lane': delLane(a.cid, a.laneCid); return
  }
}

/** 找分支链：按 cid 递归查 */
function findChain(branchCid: string): FlowStep[] | null {
  const walk = (list: FlowStep[]): FlowStep[] | null => {
    for (const s of list) {
      if (s.kind === 'gateway') {
        for (const b of s.branches || []) {
          if (b.cid === branchCid) return b.chain
          const r = walk(b.chain || [])
          if (r) return r
        }
      }
    }
    return null
  }
  return walk(props.steps || [])
}

function onAddAt(scope: 'main' | 'branch', afterCid: string, kind: AddKind, depth: number, branchCid = '') {
  if (kind === 'gateway' && depth >= 3) {
    message.warning('条件分支最多嵌套 3 层；请把分流放回上层主干')
    return
  }
  const list = scope === 'branch' ? findChain(branchCid) : props.steps
  if (!list) return
  const at = afterCid ? list.findIndex((s) => s.cid === afterCid) + 1 : 0
  list.splice(at <= 0 ? 0 : at, 0, newStep(kind))
}

function removeByCid(cid: string) {
  const c = index.value.get(cid)
  if (!c) return
  if (c.kind === 'step') {
    if (props.steps.length === 1 && c.parent === props.steps) { message.warning('至少保留一个主干节点'); return }
    const i = c.parent.findIndex((s) => s.cid === cid)
    if (i >= 0) c.parent.splice(i, 1)
  }
  sel.value = ''
}

function addBranch(gwCid?: string) {
  const c = gwCid ? index.value.get(gwCid) : current.value
  const gw = c?.kind === 'step' ? c.o : undefined
  if (!gw || gw.kind !== 'gateway') return
  gw.branches = gw.branches || []
  gw.branches.push(newBranch(gw.branches.length + 1))
}
function delBranch(gwCid?: string, branchCid?: string) {
  const c = current.value
  let gw: FlowStep | undefined
  let target = branchCid || ''
  if (gwCid) {
    const e = index.value.get(gwCid)
    if (e?.kind === 'step') gw = e.o
  } else if (c?.kind === 'branch') {
    gw = c.parent
    target = target || c.o.cid
  } else if (c?.kind === 'branchCard') {
    const be = index.value.get(c.parent.cid)
    if (be?.kind === 'branch') gw = be.parent
    target = target || c.parent.cid
  }
  if (!gw || gw.kind !== 'gateway' || !target) return
  if ((gw.branches || []).length <= 1) { message.warning('至少保留 1 个分支'); return }
  gw.branches = (gw.branches || []).filter((b) => b.cid !== target)
  sel.value = ''
}
function addLane(stepCid?: string) {
  const c = stepCid ? index.value.get(stepCid) : current.value
  const st = c?.kind === 'step' ? c.o : undefined
  if (!st || st.kind !== 'parallel') return
  st.nodes.push(newNode(`审批人${st.nodes.length + 1}`))
}
function delLane(stepCid?: string, laneCid?: string) {
  const c = stepCid ? index.value.get(stepCid) : undefined
  const st = c?.kind === 'step' ? c.o : undefined
  if (!st || st.kind !== 'parallel' || !laneCid) return
  st.nodes = st.nodes.filter((n) => n.cid !== laneCid)
  // docs 10.1：删光最后一个审批人 → 整组一起移除，不留空壳
  if (!st.nodes.length) {
    const ent = index.value.get(st.cid)
    if (ent?.kind === 'step') {
      const i = ent.parent.findIndex((s) => s.cid === st.cid)
      if (i >= 0) ent.parent.splice(i, 1)
    }
    message.info('并行组内已无审批人，已移除该节点')
  }
  sel.value = ''
}

function removeStep() {
  const c = current.value
  if (!c) return
  if (c.kind === 'step') { removeByCid(c.o.cid); return }
  if (c.kind === 'branch' || c.kind === 'branchCard') { delBranch(undefined, c.kind === 'branch' ? c.o.cid : c.parent.cid); return }
  if (c.kind === 'lane') { delLane(c.parent.cid, c.o.cid); return }
  // 审批人卡不可单独删（它是分支/步骤的派单入口），删除即删掉整个步骤
  if (c.kind === 'node') {
    const ent = index.value.get(c.parent.cid)
    if (ent?.kind === 'step') {
      const i = ent.parent.findIndex((s) => s.cid === c.parent.cid)
      if (i >= 0) ent.parent.splice(i, 1)
    }
    sel.value = ''
  }
}

/* ---------------- 分支条件 ---------------- */
function onBranchExpr(v: string) {
  const c = current.value
  if (c?.kind === 'branch') c.o.conditionExpr = v
  else if (c?.kind === 'branchCard') c.parent.conditionExpr = v
}
function onFallbackChange(e: { target: { checked: boolean } }) {
  const c = current.value
  const b = c?.kind === 'branch' ? c.o : c?.kind === 'branchCard' ? c.parent : null
  if (!b) return
  b.isFallback = e.target.checked
  if (b.isFallback) {
    b.conditionExpr = ''
    // 同一网关最多 1 个兜底
    const ent = index.value.get(b.cid)
    if (ent?.kind === 'branch') {
      for (const x of (ent.parent as FlowStep).branches || []) {
        if (x.cid !== b.cid) x.isFallback = false
      }
    }
  }
}

/* ---------------- 审批人规则 ---------------- */
const roles = ref<RoleBrief[]>([])
const roleOptions = computed(() => roles.value.map((r) => ({
  value: r.code, label: r.appCode ? `${r.name}（${r.code} · ${r.appCode}）` : `${r.name}（${r.code}）`
})))
onMounted(async () => {
  try { roles.value = (await fetchRoles()) || [] } catch { /* 静默降级 */ }
})

function addRule() {
  const n = nodeProxy.value
  if (n) n.approvers.push({ type: 'ORG_LEADER', levelOffset: 0 })
}
function removeRule(i: number) {
  const n = nodeProxy.value
  if (!n) return
  n.approvers.splice(i, 1)
  // 并行审批人删光规则：整张卡一起消失，组空了也移除
  const c = current.value
  if (c?.kind === 'lane' && !n.approvers.length) delLane(c.parent.cid, c.o.cid)
}
function onRuleType(r: ApproverRule) {
  delete r.userId
  delete r.userName
  delete r.code
  if (r.type === 'ORG_LEADER') {
    r.levelOffset = r.levelOffset ?? 0
    if (r.source === undefined) r.source = ''
    if (r.toRoot === undefined) r.toRoot = false
  } else {
    delete r.source
    delete r.toRoot
  }
}

const orgPickOpen = ref(false)
const orgPickTarget = ref<ApproverRule | null>(null)
const orgPickCurrent = computed(() => orgPickTarget.value?.code || '')
function openOrgPicker(r: ApproverRule) { orgPickTarget.value = r; orgPickOpen.value = true }
function confirmOrg(name: string) { if (orgPickTarget.value) orgPickTarget.value.code = name }

/* ---------------- 条件校验 ---------------- */
const checking = ref(false)
const exprTip = ref<{ ok: boolean; text: string } | null>(null)
async function checkExpr(expr: string) {
  checking.value = true
  try {
    const r = await validateCondition(expr || '')
    exprTip.value = r.ok
      ? { ok: true, text: `合法${r.result !== undefined && r.result !== null ? `，样例试算 = ${r.result}` : ''}` }
      : { ok: false, text: r.error || '不合法' }
  } catch (e) {
    exprTip.value = { ok: false, text: (e as Error).message }
  } finally { checking.value = false }
}
</script>

<style scoped>
.flow-editor { display: flex; flex-direction: column; gap: 10px; min-height: 420px; }
/* 顶部状态条 */
.flow-top { display: flex; align-items: center; gap: 10px; padding: 0 2px; }
.ft-title { font-size: 13px; font-weight: 600; color: var(--text-secondary, #475569); }
.ft-hint { font-size: 12px; color: #94a3b8; }
.ft-stat {
  margin-left: auto; font-size: 12px; color: #475569; background: #eef2f7;
  border: 1px solid #e3e8ef; border-radius: 999px; padding: 2px 10px; white-space: nowrap;
}
.flow-main { display: flex; gap: 12px; align-items: stretch; flex: 1 1 auto; min-height: 0; }
.canvas {
  flex: 1 1 0%; min-width: 0; height: calc(100vh - 330px); min-height: 460px; overflow: auto;
  background: #f7f8fa; border: 1px solid var(--panel-border, #e3e8ef); border-radius: 10px;
  --card-w: 220px; --line: #a9bad0; --line-strong: #8da3be;
}
.canvas-inner { display: flex; flex-direction: column; align-items: center; padding: 18px 16px 24px; min-width: min-content; }
.canvas-tip { margin-top: 16px; font-size: 12px; color: #94a3b8; }
.node-wrap { display: flex; flex-direction: column; align-items: center; }
.card {
  width: var(--card-w); background: #fff; border: 1px solid var(--panel-border, #e3e8ef);
  border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, .06);
}
.card.start, .card.end { width: 168px; }
.card-head {
  display: flex; align-items: center; justify-content: center; background: #f8fafc;
  padding: 5px 10px; font-size: 12px; font-weight: 600; color: #475569;
  border-left: 3px solid #7c8aa5;
}
.card-body { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px; font-size: 13px; gap: 8px; }
.card-body.center { justify-content: center; color: #94a3b8; }
.card-body .nm { flex: 1 1 0%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-body .ar { color: #94a3b8; flex: none; }
.conn {
  width: 2px; height: 30px; min-height: 30px; background: var(--line, #a9bad0);
  display: flex; align-items: center; justify-content: center; position: relative; flex: none;
}
.plus {
  width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #a1b4cd; background: #fff;
  color: #1677ff; font-size: 12px; line-height: 1; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
}
.plus:hover { background: #1677ff; color: #fff; border-color: #1677ff; }

/* ---------- 属性面板 ---------- */
.props {
  width: 368px; flex: none; border: 1px solid var(--panel-border, #e3e8ef); border-radius: 10px;
  background: var(--panel-bg, #fff); display: flex; flex-direction: column; overflow: hidden;
}
.props-empty { padding: 16px; }
.props-head {
  display: flex; align-items: center; justify-content: space-between; padding: 10px 14px;
  border-bottom: 1px solid var(--panel-border, #e3e8ef); font-size: 13px; font-weight: 600;
}
.props-head .x { color: #94a3b8; font-size: 16px; cursor: pointer; }
.props-body { padding: 14px; overflow-y: scroll; overflow-x: hidden; flex: 1 1 0%; min-height: 0; }
.sec { margin-bottom: 18px; }
.sec-title { font-size: 12px; font-weight: 600; color: var(--text-secondary, #475569); margin-bottom: 10px; }
.fld { margin-bottom: 10px; }
.fld label { display: block; font-size: 12px; color: var(--muted, #94a3b8); margin-bottom: 4px; }
.switch-line { display: flex; align-items: center; gap: 6px; }
.expr-row { display: flex; gap: 6px; }
.expr-tip { font-size: 12px; color: #52c41a; margin-top: 4px; }
.expr-tip.err { color: #ff4d4f; }
.note { font-size: 12px; color: var(--muted, #94a3b8); line-height: 1.6; margin: 6px 0; }
.note.warn { color: #d46b08; }
.opt-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
.rule-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.org-val { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.small { font-size: 12px; }
.muted { color: var(--muted, #94a3b8); }
.danger { color: #ff4d4f; }
.mt6 { margin-top: 6px; }
</style>
