/** 后端统一响应外壳：code=0 成功，其余为业务错误（拦截器会脱壳） */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

/** 分页结果，字段与后端 PageResult 对齐 */
export interface PageResult<T> {
  records: T[]
  total: number
  page: number
  size: number
}

/** 账户身份快照（来自 /api/auth/me 或登录响应） */
export interface AuthUser {
  accountId: number
  username: string
  nickname?: string
  superAdmin: boolean
  /** 按钮级权限码 */
  permissions: string[]
  /** 可访问的应用编码 */
  apps: string[]
}

/** 登录/刷新下发的一对令牌 */
export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: AuthUser
}

/** 账户详情（管理端列表/详情） */
export interface AccountVO {
  /** 雪花ID，后端序列化为字符串（19 位数字超出 JS 安全整数） */
  id: string
  username: string
  nickname?: string
  email?: string
  phone?: string
  status: number
  statusDesc?: string
  source?: string
  pwdResetRequired?: number
  lastLoginAt?: string
  createdAt?: string
  roles?: string[]
}

/** 应用（SSO 保护的下游系统） */
export interface ApplicationVO {
  /** 雪花ID，后端序列化为字符串 */
  id: string
  code: string
  name: string
  baseUrl?: string
  /** OAuth2 回调地址（授权码回跳点），「进入」按钮构造 /authorize 用 */
  redirectUri?: string
  icon?: string
  remark?: string
  status: number
  sort?: number
  createdAt?: string
  /** 平台内置应用（统一账号中心）：默认存在，不允许编辑/停用/删除/重置密钥 */
  builtIn?: boolean
  /** 脱敏密钥（列表用） */
  appSecretMasked?: string
  /** 明文密钥，仅创建/重置时返回一次 */
  appSecret?: string
}

/** 中心会话快照 */
export interface SessionInfo extends AuthUser {
  appList: ApplicationVO[]
}

/** 一次性票据下发结果 */
export interface TicketResponse {
  ticket: string
  appCode: string
  appName: string
  /** 已拼好 ticket 参数，直接跳转即可 */
  redirectTo: string
  expiresIn: number
}

/** 登录日志（审计） */
export interface LoginLog {
  id: number
  accountId?: number
  username: string
  loginType: string
  result: 'success' | 'fail' | string
  failReason?: string
  clientIp?: string
  userAgent?: string
  createdAt?: string
}

/** 1 正常 / 2 已禁用 / 3 已锁定 / 4 未激活（与后端 AccountStatus 枚举一致） */
export type AccountStatusCode = 1 | 2 | 3 | 4

/** 角色 */
export interface RoleVO {
  /** 雪花ID，后端序列化为字符串 */
  id: string
  code: string
  /** 归属应用编码；sso 为平台角色 */
  appCode?: string
  name: string
  remark?: string
  permissionIds?: string[]
  createdAt?: string
  /** 内置角色（SUPER_ADMIN）不可删除 */
  builtin?: boolean
  /** 关联账户数 */
  accountCount?: number
}

/** 权限项（菜单或按钮） */
export interface PermissionVO {
  /** 雪花ID，后端序列化为字符串 */
  id: string
  /** 所属应用编码：sso 是平台自身，其余对应 sso_application.code */
  appCode?: string
  code: string
  name: string
  /** 1=菜单 2=按钮 */
  type: number
  typeDesc?: string
  parentId?: string
  sort?: number
  remark?: string
  /** 内置权限码被后端 @Permit 引用，不可删除、不可改码 */
  builtin?: boolean
  children?: PermissionVO[]
}

/* ============================ 审批中心 ============================ */

/** 审批单状态：0 进行中 / 1 已通过 / 2 已驳回 / 3 已撤回 / 4 已终止 */
export type ApprovalStatus = 0 | 1 | 2 | 3 | 4

/** 审批任务状态：0 待办 / 1 已通过 / 2 已驳回 / 3 跳过 / 4 取消 / 9 已转办 */
export type ApprovalTaskStatus = 0 | 1 | 2 | 3 | 4 | 9

/** 流程步骤（步骤条用；未开始的步骤没有任务，也要画出来） */
export interface ApprovalStep {
  seq: number
  name: string
  /** DONE 已完成 / CURRENT 进行中 / TODO 未开始 / SKIPPED 条件不满足跳过 */
  state: 'DONE' | 'CURRENT' | 'TODO' | 'SKIPPED'
  conditionDesc?: string
}

/** 审批任务：一个分支下的一个人 */
export interface ApprovalTask {
  /** 雪花ID，后端序列化为字符串 */
  id: string
  instanceId: string
  stepSeq: number
  stepName: string
  nodeSeq?: number
  nodeName?: string
  approverId: string
  approverName: string
  /** USER 本人 / DELEGATE 委托人代收 */
  approverSource?: string
  delegateOwnerName?: string
  /** APPROVE 审批 / CC 抄送 */
  taskKind?: string
  status: ApprovalTaskStatus
  statusName?: string
  /** ANY 或签 / ALL 会签 / SEQ 依次 */
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
  /** 业务方自己的业务单号 */
  bizNo?: string
  /** 审批单自身的单号（按单号规则生成） */
  apprNo?: string
  title: string
  applicantId?: number
  applicantName?: string
  orgPath?: string
  templateCode?: string
  templateVersion?: number
  status: ApprovalStatus
  statusName?: string
  currentStep?: number
  totalStep?: number
  /** 终审回调业务方：0 不需要 / 1 待回调 / 2 成功 / 3 失败 */
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
  /** FORM 快照 / ENTITY 实体 / DERIVED 派生 / SYSTEM 系统 */
  source?: string
  /** table = 表格控件：values[key] 是行数组，由审批详情抽屉渲染成 a-table */
  format?: 'text' | 'date' | 'datetime' | 'money' | 'enum' | 'tag' | 'tags' | 'progress' | 'duration' | 'link' | 'richText' | 'json' | 'table'
  /** format='table' 时配置器里逐列选入的列：key=物理列名、label=表头 */
  tableColumns?: { key: string; label: string; code?: string }[]
  path?: string
  /** 占几列（在 section.columns 栅格里），长文本字段给 2 防折行 */
  span?: number
}

/** 页面配置的一组（卡片） */
export interface ApprovalPageSection {
  key: string
  title?: string
  /** 一行几列，默认 3 */
  columns?: number
  emphasis?: boolean
  fields: ApprovalPageField[]
}

/** 审批弹窗的版式配置 */
export interface ApprovalPageConfig {
  renderMode?: string
  width?: string
  /** 标题模板，如「{bizName} · {applicantName}」 */
  titleTpl?: string
  sections?: ApprovalPageSection[]
  actions?: string[]
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
  /** 表名 → 定位模式（MAIN_ROW / BIZ_ROW / FK_LIST）；只有 FK_LIST 允许首行降级，老单无该字段 */
  tableModes?: Record<string, string>
  page?: ApprovalPageConfig | null
  renderMode?: string
  actions?: string[]
  myTaskId?: string | null
}
