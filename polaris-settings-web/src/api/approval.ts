import request from './request'
import { type BizPointType, pointType } from '@/utils/bizpoint'

/* ============================ 类型 ============================ */

/** 审批人规则（保存时的形状）。没有「权限点」类型——按权限码反查持有人会串审批人 */
export interface ApproverRule {
  /** ORG_LEADER 组织负责人 / ORG_LEADER_BY_NAME 指定组织负责人 / ROLE 角色 / USER 指定人 / APPLICANT 发起人 */
  type: string
  /** USER 型：账号 ID。字符串承载——雪花 ID 超出 JS 安全整数，转 Number 会存错人 */
  userId?: number | string | null
  /** 仅编辑态用：选人时带出的姓名，保存时不上送 */
  userName?: string
  /** ROLE 型：角色编码；ORG_LEADER_BY_NAME 型：组织名称 */
  code?: string
  /** ORG_LEADER 型：上溯级数，0=直属负责人 */
  levelOffset?: number
  /**
   * ORG_LEADER 型「取谁的组织」来源：
   * 空 / 缺省 = 申请人组织（原行为，存量模板零影响）；
   * FIELD:<业务点code>:<USER|ORG> = 从审批表单字段取值当组织来源（USER 字段值是工号/账号ID，ORG 字段值是组织ID/名称）。
   */
  source?: string
  /** ORG_LEADER 型：true=从当前节点上溯到集团（根）负责人这一人，忽略 levelOffset */
  toRoot?: boolean
}

/** 组织节点（扁平，前端组树） */
export interface OrgNodeLite {
  id: string
  parentId: string | null
  name: string
  type: string
  status: number
}

/** 组织成员（审批人候选，id=账号 ID） */
export interface OrgUser {
  id: string
  name: string
  empNo?: string
}

/* ---------------- v5：流程树（编辑态） ----------------
 * 编辑器里是树：主干 steps[]，条件网关的每个分支有自己的 chain[]，chain 里还能再放网关（<=3 层）。
 * 保存时按 DFS 前序展平成一维 StepSave[]，用 clientId / parentNodeRef 表达挂载关系，
 * 后端再换成真实雪花 ID、重算 branchPath 与 depth。 */

/** 分支（并行节点 / 网关分支卡 / 并行审批人）——编辑态 */
export interface NodeEdit {
  /** 前端本地 id，保存时作为 clientId 上送 */
  cid: string
  name: string
  conditionExpr: string
  approveMode: 'ANY' | 'ALL' | 'SEQ'
  allowSelf: boolean
  skipSame: boolean
  onEmpty: 'SKIP' | 'BLOCK'
  approvers: ApproverRule[]
}

/** 条件网关的一条分支：审批卡 + 只属于它的子链 */
export interface FlowBranch {
  cid: string
  /** 分支审批卡对应的 node clientId，子步骤用它做 parentNodeRef */
  nodeCid: string
  name: string
  /** 分支生效条件（SpEL），兜底分支为空 */
  conditionExpr: string
  isFallback: boolean
  card: NodeEdit
  chain: FlowStep[]
}

/** 流程节点：审批人 / 并行会签 / 条件网关 */
export interface FlowStep {
  cid: string
  kind: 'approver' | 'parallel' | 'gateway'
  name: string
  /** 步骤级生效条件，空 = 总执行 */
  conditionExpr: string
  /** approver 为 1 个，parallel 为 N 个；gateway 用 branches */
  nodes: NodeEdit[]
  branches?: FlowBranch[]
  /** 加载详情时回填的真实归属（仅用于展示，不参与保存） */
  parentNodeId?: string | null
  branchPath?: string
  depth?: number
}

/** 分支——详情接口返回的线格式（0/1 数值、approvers 是 JSON 字符串） */
export interface NodeWire {
  /** 真实雪花 ID，字符串返回 */
  id?: string
  seq?: number
  name?: string
  conditionExpr?: string
  conditionDesc?: string
  approveMode?: string
  allowSelf?: number
  skipSame?: number
  onEmpty?: string
  isFallback?: number
  childChain?: number
  /** 详情里是 JSON 字符串 */
  approvers?: string | ApproverRule[]
}

/** 步骤——详情接口返回的线格式 */
export interface StepWire {
  id?: string
  seq?: number
  name?: string
  conditionExpr?: string
  rejectAction?: string
  parentNodeId?: string | null
  branchPath?: string
  depth?: number
  uiKind?: string
  isGateway?: boolean
  nodes?: NodeWire[]
}

/** 分支——保存报文（0/1 数值） */
export interface NodeSave {
  clientId: string
  seq: number
  name: string
  conditionExpr: string
  conditionDesc: string
  isFallback: number
  childChain: number
  approveMode: string
  allowSelf: number
  skipSame: number
  onEmpty: string
  approvers: ApproverRule[]
}

/** 步骤——保存报文，DFS 前序展平 */
export interface StepSave {
  seq: number
  clientKey: string
  /** 父网关里某个分支 node 的 clientId；null = 主干 */
  parentNodeRef: string | null
  branchPath: string
  depth: number
  uiKind: string
  name: string
  conditionExpr: string
  conditionDesc: string
  /** v5 固定 END（整单终止） */
  rejectAction: string
  nodes: NodeSave[]
}

/** 详情线格式 → 流程树 */
export function fromWireSteps(wires: StepWire[]): FlowStep[] {
  const sorted = [...(wires || [])].sort((a, b) => (a.seq || 0) - (b.seq || 0))
  const roots: FlowStep[] = []
  const stepBySeq = new Map<number, FlowStep>()
  /** node 真实 ID -> 所属分支（用于把子步骤挂回去） */
  const branchByNode = new Map<string, FlowBranch>()
  let auto = 0
  const cid = () => `w${++auto}`

  const toNode = (n: NodeWire): NodeEdit => {
    let rules: ApproverRule[] = []
    try {
      rules = typeof n.approvers === 'string' ? JSON.parse(n.approvers || '[]') : n.approvers || []
    } catch { rules = [] }
    return {
      cid: n.id || cid(),
      name: n.name || '',
      conditionExpr: n.conditionExpr || '',
      approveMode: (n.approveMode as NodeEdit['approveMode']) || 'ANY',
      allowSelf: n.allowSelf === 1,
      skipSame: n.skipSame !== 0,
      onEmpty: (n.onEmpty as NodeEdit['onEmpty']) || 'SKIP',
      approvers: rules
    }
  }

  for (const w of sorted) {
    const ws = w.nodes || []
    const gateway = w.isGateway ?? (ws.length > 1 && ws.some((n) => !!n.conditionExpr || n.isFallback === 1))
    const step: FlowStep = {
      cid: w.id || cid(),
      kind: gateway ? 'gateway' : ws.length > 1 ? 'parallel' : 'approver',
      name: w.name || '',
      conditionExpr: w.conditionExpr || '',
      nodes: gateway ? [] : ws.map(toNode),
      parentNodeId: w.parentNodeId || null,
      branchPath: w.branchPath || '',
      depth: w.depth || 0
    }
    if (gateway) {
      step.branches = ws.map((n, i) => {
        const node = toNode(n)
        const b: FlowBranch = {
          cid: `br_${n.id || i}`,
          nodeCid: node.cid,
          name: n.conditionDesc || n.name || `条件${i + 1}`,
          conditionExpr: n.conditionExpr || '',
          isFallback: n.isFallback === 1,
          card: node,
          chain: []
        }
        branchByNode.set(String(n.id || node.cid), b)
        return b
      })
    }
    stepBySeq.set(w.seq || 0, step)
    if (w.parentNodeId) {
      const b = branchByNode.get(String(w.parentNodeId))
      if (b) { b.chain.push(step); continue }
    }
    roots.push(step)
  }
  return roots
}

/** 流程树 → DFS 前序展平的保存报文 */
export function toSaveSteps(steps: FlowStep[]): StepSave[] {
  const out: StepSave[] = []
  const toNodeSave = (
    n: NodeEdit, seq: number, clientId: string,
    isFallback: boolean, conditionExpr: string, conditionDesc: string, hasChild: boolean
  ): NodeSave => ({
    clientId,
    seq,
    name: n.name || '',
    conditionExpr,
    conditionDesc,
    isFallback: isFallback ? 1 : 0,
    childChain: hasChild ? 1 : 0,
    approveMode: n.approveMode,
    allowSelf: n.allowSelf ? 1 : 0,
    skipSame: n.skipSame ? 1 : 0,
    onEmpty: n.onEmpty,
    approvers: (n.approvers || []).map((r) => {
      const o: ApproverRule = { type: r.type }
      if (r.type === 'USER') o.userId = r.userId != null ? String(r.userId) : undefined
      if (r.type === 'ROLE' || r.type === 'ORG_LEADER_BY_NAME') o.code = r.code?.trim() || undefined
      if (r.type === 'ORG_LEADER') {
        o.levelOffset = r.levelOffset ?? 0
        o.source = r.source || undefined
        o.toRoot = !!r.toRoot
      }
      return o
    })
  })

  const walk = (list: FlowStep[], parentNodeRef: string | null, parentPath: string, depth: number) => {
    for (const s of list) {
      // 空并行组不导出，避免产生无 Node 的非法步骤
      if (s.kind === 'parallel' && !(s.nodes || []).length) continue
      if (s.kind === 'gateway' && !(s.branches || []).length) continue
      const branchPath = parentNodeRef
        ? (parentPath ? `${parentPath}/n/${parentNodeRef}` : `n/${parentNodeRef}`)
        : parentPath
      const nodes: NodeSave[] = s.kind === 'gateway'
        ? (s.branches || []).map((b, i) => toNodeSave(
            b.card, i + 1, b.nodeCid, b.isFallback, b.isFallback ? '' : b.conditionExpr,
            b.name, (b.chain || []).length > 0))
        : (s.nodes || []).map((n, i) => toNodeSave(n, i + 1, n.cid, false, n.conditionExpr, '', false))
      out.push({
        seq: out.length + 1,
        clientKey: s.cid,
        parentNodeRef,
        branchPath,
        depth,
        uiKind: s.kind.toUpperCase(),
        name: s.name || '',
        conditionExpr: s.conditionExpr || '',
        conditionDesc: '',
        rejectAction: 'END',
        nodes
      })
      if (s.kind === 'gateway') {
        for (const b of s.branches || []) walk(b.chain || [], b.nodeCid, branchPath, depth + 1)
      }
    }
  }
  walk(steps, null, '', 0)
  return out
}

/** 流程设计器画布的递归动作，统一冒泡给 ApprovalFlowEditor 处理 */
export interface FlowAction {
  type: 'select' | 'add' | 'remove' | 'add-branch' | 'del-branch' | 'add-lane' | 'del-lane'
  cid?: string
  branchCid?: string
  laneCid?: string
  kind?: 'approver' | 'parallel' | 'gateway'
  afterCid?: string
  depth?: number
  scope?: 'main' | 'branch'
}

/** 表单模式用：把树按 DFS 展平成带缩进的可写视图（对象引用不变，编辑直接生效） */
export function flatFlow(steps: FlowStep[]): { step: FlowStep; depth: number; branchName: string }[] {
  const out: { step: FlowStep; depth: number; branchName: string }[] = []
  const walk = (list: FlowStep[], depth: number, branchName: string) => {
    for (const s of list) {
      out.push({ step: s, depth, branchName })
      if (s.kind === 'gateway') {
        for (const b of s.branches || []) walk(b.chain || [], depth + 1, b.name)
      }
    }
  }
  walk(steps, 0, '')
  return out
}

/** 页面配置 */
export interface PageEdit {
  view: string
  renderMode: string
  config: string
  /** renderMode=ROUTE 的自定义页面地址（应用内路由或完整 URL） */
  routePath: string
}

export interface ApprovalTemplate {
  id: string
  code: string
  name: string
  appCode?: string
  bizType: string
  bizName?: string
  enabled: number
  version: number
  remark?: string
  stepCount?: number
  nodeCount?: number
  runningCount?: number
  steps?: unknown[]
  page?: unknown
}

export interface ApprovalTemplateDetail extends ApprovalTemplate {
  steps: StepWire[]
  page?: {
    view: string
    renderMode: string
    config: string
    routePath: string
    version?: number
  } | null
}

export interface BizScene {
  id?: string
  bizType: string
  bizName?: string
  appCode?: string
  /** 业务点（条件变量池）：BusinessPoint[] 的 JSON 字符串 */
  formSchema?: string
  /** 页面字段池：与 formSchema 同源镜像（业务点本身就是可展示字段） */
  fieldSchema?: string
  /** 数据表绑定（审批页面「与表真绑定」）：SceneTableBindings 的 JSON 字符串，场景本身可无 */
  tableBindings?: string
  /** 主体键：formData 里业务主体 ID 的键名（employeeId / orgId / articleId） */
  subjectField?: string
  /** 新单 bizId 语义：SUBJECT = 主体 ID / DOC = 本次申请单 ID */
  bizIdKind?: 'SUBJECT' | 'DOC'
  /** 发起权限提示文案（编辑场景时原样带回，避免被 registerScene 覆盖成空） */
  permHint?: string
  /**
   * 以下字段由服务端按 bizType 关联模板表算出，场景表本身不存：
   * 绑定关系只存在 cfg_approval_template.biz_type 一处，避免双写不一致。
   */
  templateCode?: string
  templateName?: string
  templateVersion?: number
  /** 绑定的模板是否启用 */
  templateEnabled?: boolean
  /** 场景可用性：null = 未绑定模板（≠ 停用） */
  enabled?: boolean | null
  /** REGISTER 业务注册 / MANUAL 手工维护 */
  source?: string
}

/** 业务点：条件变量 / 页面字段的统一定义（与 cfg_biz_scene.form_schema 同构）。
 *  字段：编码(code) / 名称(name) / 数据类型(dataType) / 备注(remark)。
 *  数据类型决定分支条件能选哪些判断符，见 utils/bizpoint.ts。 */
export interface BusinessPoint {
  /** SpEL 变量名（英文字母/下划线开头），同业务类型内唯一 */
  code: string
  /** 展示名，如「请假天数」 */
  name: string
  /** 数据类型：NUMBER 数字 / STRING 字符串 / DATE 日期 / USER 人员 / ORG 组织 / DICT 字典 */
  dataType?: BizPointType | string
  /** 升级前的老字段（number|text|date|enum），只读兼容，不再写入 */
  type?: string
  remark?: string
  /** 样例值（老数据里有，保留不覆盖） */
  sample?: unknown
}

/**
 * ORG_LEADER 规则「取谁的组织」下拉选项：
 * 第一项固定为「申请人本人组织」（= source 空，原行为）；
 * 其余是当前业务场景里 dataType 为 USER / ORG 的业务点，value = FIELD:<code>:<USER|ORG>。
 * 选了业务点，运行时就从审批表单（冻结快照）取该字段值当组织来源。
 */
export function orgLeaderSources(points: BusinessPoint[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: '', label: '申请人本人组织（默认）' }]
  for (const p of points || []) {
    const t = pointType(p)
    if (t === 'USER' || t === 'ORG') {
      out.push({ value: `FIELD:${p.code}:${t}`, label: `${p.name || p.code}（${t === 'USER' ? '人员' : '组织'}）` })
    }
  }
  return out
}

/** 把 ORG_LEADER 的 source 解析回 { key, type }；非 FIELD 返回 null（即申请人组织） */
export function parseOrgLeaderSource(source?: string): { key: string; ftype: 'USER' | 'ORG' } | null {
  if (!source || !source.startsWith('FIELD:')) return null
  const rest = source.slice('FIELD:'.length)
  const i = rest.lastIndexOf(':')
  if (i <= 0) return null
  return { key: rest.slice(0, i), ftype: rest.slice(i + 1).toUpperCase() === 'USER' ? 'USER' : 'ORG' }
}

/* ============================ 接口 ============================ */

export function listTemplates() {
  return request.get<never, ApprovalTemplate[]>('/api/settings/approval/templates')
}

export function getTemplate(id: string) {
  return request.get<never, ApprovalTemplateDetail>(`/api/settings/approval/templates/${id}`)
}

export interface TemplateSaveBody {
  id?: string
  code: string
  name: string
  appCode: string
  bizType: string
  bizName: string
  enabled: number
  remark: string
  steps: StepSave[]
  page?: PageEdit
}

export function createTemplate(body: TemplateSaveBody) {
  return request.post<never, ApprovalTemplateDetail>('/api/settings/approval/templates', body)
}

export function updateTemplate(id: string, body: TemplateSaveBody) {
  return request.put<never, ApprovalTemplateDetail>(`/api/settings/approval/templates/${id}`, body)
}

export function toggleTemplate(id: string, enabled: number) {
  return request.patch<never, void>(`/api/settings/approval/templates/${id}/status?enabled=${enabled}`)
}

export function deleteTemplate(id: string) {
  return request.delete<never, void>(`/api/settings/approval/templates/${id}`)
}

export function savePage(id: string, body: PageEdit) {
  return request.put<never, unknown>(`/api/settings/approval/templates/${id}/page`, body)
}

export function listScenes() {
  return request.get<never, BizScene[]>('/api/settings/approval/scenes')
}

export function registerScene(body: BizScene) {
  return request.post<never, BizScene>('/api/settings/approval/scenes/register', body)
}

/**
 * 业务点引用表：key = `${bizType}::${code}`，value = 引用位置说明列表。
 * 只返回「已被引用、不能删除」的业务点；没被引用的不出现在结果里。
 * 置灰删除按钮只是界面提示，真正的拦截在后端 /scenes/register。
 */
export function fetchBizPointRefs() {
  return request.get<never, Record<string, string[]>>('/api/settings/approval/biz-points/references')
}

/** 条件校验 + 试算；返回 { ok, error, result } */
export function validateCondition(expr: string, vars?: Record<string, unknown>) {
  return request.post<never, { ok: boolean; error?: string; result?: unknown }>(
    '/api/settings/approval/conditions/validate',
    { expr, vars: vars || {} }
  )
}

/** 组织树（扁平列表）——「指定账号」选人 / 「指定组织负责人」弹窗按树选择共用 */
export function fetchOrgTree() {
  return request.get<never, OrgNodeLite[]>('/api/settings/approval/orgs/tree')
}

/** 某组织的直属成员（已开户、未离职） */
export function fetchOrgUsers(orgId: string) {
  return request.get<never, OrgUser[]>(`/api/settings/approval/orgs/${orgId}/employees`)
}

/** 应用精简信息（启用中的应用） */
export interface AppBrief {
  id: string
  code: string
  name: string
}

/** 启用中的应用清单，「所属应用」下拉用 */
export function fetchApps() {
  return request.get<never, AppBrief[]>('/api/settings/approval/apps')
}

/** 角色精简信息（全量、不按应用过滤） */
export interface RoleBrief {
  id: string
  code: string
  name: string
  appCode?: string
}

/** 全量角色清单，「角色」审批人规则下拉用 */
export function fetchRoles() {
  return request.get<never, RoleBrief[]>('/api/settings/approval/roles')
}

/* ============================ 数据表真绑定 ============================ */

/** 业务库表元数据（绑定数据表下拉用） */
export interface EntityTableMeta {
  table: string
  comment?: string | null
}

/** 表列元数据（字段池「数据表字段」分组数据源） */
export interface EntityColumnMeta {
  name: string
  type: string
  comment?: string | null
  nullable?: boolean
  primaryKey?: boolean
}

/** 业务库表清单：按 appCode 路由到对应业务方（ehr / cms / blog / sso-center / settings） */
export function fetchEntityTables(appCode: string) {
  // 元数据接口带时间戳破缓存：建表/改表注释后必须立刻看到最新清单，
  // 否则浏览器会复用旧响应（曾出现同一张表渲染两遍的现象）。
  return request.get<never, EntityTableMeta[]>('/api/settings/approval/entity/tables', {
    params: { appCode, _t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  })
}

/** 已开通数据绑定的应用（appCode → 对内基址）：没开通的应用绑不了表 */
export function fetchEntityApps() {
  return request.get<never, Record<string, string>>('/api/settings/approval/entity/apps', {
    params: { _t: Date.now() },
    headers: { 'Cache-Control': 'no-cache' }
  })
}

/** 某张表的列元数据 */
export function fetchEntityColumns(appCode: string, table: string) {
  return request.get<never, EntityColumnMeta[]>(
    `/api/settings/approval/entity/tables/${encodeURIComponent(table)}/columns`,
    { params: { appCode, _t: Date.now() }, headers: { 'Cache-Control': 'no-cache' } }
  )
}

/** 实体列类型 → 页面字段默认格式（给个尽量合理的渲染格式） */
export function columnFormat(type?: string | null): string {
  const t = (type || '').toLowerCase()
  if (t.includes('datetime') || t.includes('timestamp')) return 'datetime'
  if (t.startsWith('date') || t.includes('date')) return 'date'
  if (t.includes('decimal') || t.includes('double') || t.includes('float') || t.includes('money') || t.includes('bigint')) {
    return 'money'
  }
  return 'text'
}

/**
 * 每张表的定位模式（与后端 SceneTableBindingsDto.BoundTable.mode 同构）：
 * - MAIN_ROW：主体表，按 subjectId 取一行，列扁平化成「表名.列名」
 * - BIZ_ROW ：本次单据表，按 id = biz_id 只取这一张，绝不再按主体外键捞历史全部
 * - FK_LIST ：档案子表，按 fk 外键取多行，整表作为 values[表名] 供表格控件渲染
 */
export type TableBindingMode = 'MAIN_ROW' | 'BIZ_ROW' | 'FK_LIST'

/** 数据表绑定请求体（与后端 SceneTableBindingsDto 同构） */
export interface TableBinding {
  /** 绑定所属应用：决定去哪个库取数；后端以场景的 appCode 为准 */
  appCode?: string
  /** 运行期从 formData 取主体 ID 的键名；留空按应用默认 */
  subjectKey?: string
  /** 场景级：latest-batch 按主体反查单据时用的 formData 键名 */
  subjectField?: string
  /** 场景级：SUBJECT = bizId 就是主体 ID / DOC = bizId 是申请单 ID */
  bizIdKind?: 'SUBJECT' | 'DOC'
  tables: {
    table: string
    fk?: string | null
    label?: string | null
    /** 旧字段，由 mode 同步（MAIN_ROW 才为 true）；保留以兼容旧配置 */
    main: boolean
    /** 定位模式；缺省时后端按 main / fk 推断并补写 */
    mode?: TableBindingMode
  }[]
}

/** 保存场景的数据表绑定（审批页面「与表真绑定」） */
export function saveTableBindings(bizType: string, dto: TableBinding) {
  return request.put<never, BizScene>(
    `/api/settings/approval/scenes/${encodeURIComponent(bizType)}/table-bindings`,
    dto
  )
}
