/**
 * 审批中心实例类型（与统一账号中心 /api/accounts/approvals/** 对齐）。
 *
 * 雪花 ID 后端统一序列化成字符串，前端一律按 string 处理，不要转 Number。
 */

/** 审批单状态：0 进行中 / 1 已通过 / 2 已驳回 / 3 已撤回 / 4 已终止 */
export type ApprovalStatus = 0 | 1 | 2 | 3 | 4

/** 审批任务状态：0 待办 / 1 已通过 / 2 已驳回 / 3 跳过 / 4 取消 / 9 已转办 */
export type ApprovalTaskStatus = 0 | 1 | 2 | 3 | 4 | 9

/** 流程步骤（步骤条用；未开始的步骤没有任务也要画出来） */
export interface ApprovalStep {
  seq: number
  name: string
  state: 'DONE' | 'CURRENT' | 'TODO' | 'SKIPPED'
  conditionDesc?: string
  /** v5：路径键 / 深度 / 所属分支，前端据此画流程设计图 */
  branchPath?: string
  depth?: number
  parentNodeId?: string | null
  branchName?: string
  isGateway?: boolean
  /** 该分支已跑完，正在等其它分支汇合 */
  waitingJoin?: boolean
}

/** 审批任务：一个分支下的一个人 */
export interface ApprovalTask {
  id: string
  instanceId: string
  stepSeq: number
  stepName: string
  nodeSeq?: number
  nodeName?: string
  /** v5：任务所属分支与深度，流转信息据此分组 */
  parentNodeId?: string | null
  branchPath?: string
  depth?: number
  branchName?: string
  approverId: string
  approverName: string
  approverSource?: string
  delegateOwnerName?: string
  taskKind?: string
  status: ApprovalTaskStatus
  statusName?: string
  approveMode?: string
  seqInNode?: number
  opinion?: string
  actedAt?: string
  createdAt?: string
}

/** 审批单 */
export interface ApprovalInstance {
  id: string
  bizType: string
  bizName?: string
  bizId: string
  bizNo?: string
  title: string
  applicantId?: number | string
  applicantName?: string
  orgPath?: string
  templateCode?: string
  templateVersion?: number
  status: ApprovalStatus
  statusName?: string
  currentStep?: number
  totalStep?: number
  callbackStatus?: number
  createdAt?: string
  finishedAt?: string
  formData?: Record<string, unknown>
  steps?: ApprovalStep[]
  tasks?: ApprovalTask[]
  /** 当前登录人在本单的待办任务，无则 null */
  myTaskId?: string | null
  /** 当前登录人在本单已完成的审批结果（「已审批」视图用，没审过则为空） */
  myApprovalStatus?: number
  myApprovalStatusName?: string
  myApprovalStepName?: string
  myApprovalOpinion?: string
  myApprovalAt?: string
}

/** 页面配置里的一个字段 */
export interface ApprovalPageField {
  key: string
  label: string
  source?: string
  /**
   * table = 表格控件：values[key] 是行数组（List<Map>），由 ApprovalDetailDrawer 渲染成 a-table。
   * key 是场景表绑定里的子表名（非主表，按外键反查出多行）。
   */
  format?: 'text' | 'date' | 'datetime' | 'money' | 'enum' | 'tag' | 'tags' | 'progress' | 'duration' | 'link' | 'richText' | 'json' | 'table'
  /**
   * format='table' 时用户在配置器里逐列选入的列（会写进页面配置）。
   * key=物理列名（取 row[key]）、label=表头；为空则退回按真实数据行推导全部列。
   */
  tableColumns?: { key: string; label: string; code?: string }[]
  path?: string
  span?: number
}

/** 页面配置的一组（卡片） */
export interface ApprovalPageSection {
  key: string
  title?: string
  columns?: number
  emphasis?: boolean
  fields: ApprovalPageField[]
}

/** 审批弹窗的版式配置 */
export interface ApprovalPageConfig {
  renderMode?: string
  width?: string
  titleTpl?: string
  sections?: ApprovalPageSection[]
  actions?: string[]
  htmlTpl?: string
  componentKey?: string
  /** renderMode=ROUTE 的自定义页面地址：信息区整段换成 iframe 嵌入 */
  routePath?: string
}

/** 审批弹窗渲染上下文：版式 + 已算好的值 + 我的待办 */
export interface ApprovalContext {
  instanceId: string
  bizType: string
  bizName?: string
  title?: string
  applicantName?: string
  status: ApprovalStatus
  statusName?: string
  values: Record<string, unknown>
  /**
   * 表名 → 定位模式（MAIN_ROW / BIZ_ROW / FK_LIST）。
   * 前端据此决定「表名.列名」缺值时能否降级取 values[表名] 首行；
   * 只有 FK_LIST 允许，BIZ_ROW/MAIN_ROW 用服务端铺好的扁平键。老单无该字段。
   */
  tableModes?: Record<string, string>
  page?: ApprovalPageConfig | null
  renderMode?: string
  actions?: string[]
  myTaskId?: string | null
}

/**
 * 业务场景 → 列表提示里用的业务名。新增场景时只改这一处：
 * 「XX审批中」与「XX审批被驳回」都由它拼出来，避免两套文案走偏。
 */
const BIZ_NAMES: Record<string, string> = {
  'ehr.onboard': '入职',
  'ehr.regularize': '转正',
  'ehr.emp_update': '信息变更',
  'ehr.resign': '离职',
  'ehr.reduce': '减员',
  'ehr.rehire': '复职',
  'ehr.leave': '请假',
  // 设置/更换负责人统一走 ehr.dept_leader（ehr.org_leader 已停用，仅历史单据）。
  // 列表提示按动作叫「负责人变更」，不要再显示成「设置负责人」——截图里点的是「更换负责人」。
  'ehr.dept_leader': '负责人变更',
  'ehr.org_leader': '负责人变更'
}

function bizName(bizType?: string | null): string {
  return BIZ_NAMES[bizType || ''] || ''
}

/** 在途提示，例如「入职审批中」 */
export function approvalRunningLabel(bizType?: string | null): string {
  return `${bizName(bizType)}审批中`
}

/** 驳回提示，例如「入职审批被驳回」 */
export function approvalRejectedLabel(bizType?: string | null): string {
  return `${bizName(bizType)}审批被驳回`
}

