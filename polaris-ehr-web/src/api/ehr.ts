import request from './request'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/** 当前 ehr-web 的回调地址（必须与统一账号中心里 ehr 应用的 baseUrl 同 origin） */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/** 跳转统一账号中心签授权码 */
export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('ehr_oauth_state', state)
    sessionStorage.setItem('ehr_oauth_redirect', redirect)
  } catch {
    /* ignore */
  }
  const url =
    `${SSO_AUTHORIZE_URL}/authorize?response_type=code` +
    `&client_id=ehr&redirect_uri=${encodeURIComponent(callbackUrl())}` +
    `&state=${encodeURIComponent(state)}`
  window.location.replace(url)
}

export function consumeState(): string | null {
  try {
    const s = sessionStorage.getItem('ehr_oauth_state')
    sessionStorage.removeItem('ehr_oauth_state')
    return s
  } catch {
    return null
  }
}

export function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('ehr_oauth_redirect') || '/'
    sessionStorage.removeItem('ehr_oauth_redirect')
    return r
  } catch {
    return '/'
  }
}

/** OAuth2 授权码换 ehr 令牌（appSecret 在 ehr 后端） */
export function exchangeCode(code: string, redirectUri: string) {
  return request.post('/api/ehr/sso/oauth/exchange', { code, redirectUri })
}

/**
 * 全局登出：作废中心会话，连带该会话下其它应用（settings/cms/portal…）的令牌一起失效。
 * <p>只清本地 localStorage 不够——HttpOnly cookie 还在，下一次 gotoAuthorize 会静默重登回来。
 */
export function logoutSso(refreshToken?: string) {
  return request.post<never, void>('/api/auth/logout', { refreshToken })
}

export interface MeInfo {
  accountId: number | string
  username: string
  superAdmin: boolean
  appCode: string
  permissions: string[]
}

export function fetchMe() {
  return request.get<never, MeInfo>('/api/ehr/me')
}

// ---------------- 组织架构 ----------------

export interface ChildType {
  code: string
  label: string
}

export interface OrgNode {
  id: string
  parentId?: string | null
  type: string
  typeName: string
  code?: string
  name: string
  /** 组织简称 */
  shortName?: string
  /** 部门公用邮箱 */
  email?: string
  /** 办公地点 */
  address?: string
  /** 编制人数 */
  headcount?: number | null
  /** 成本中心 */
  costCenter?: string
  /** 成立日期 yyyy-MM-dd */
  establishDate?: string | null
  leader?: string
  leaderEmployeeId?: string | null
  leaderEmployeeName?: string
  phone?: string
  sort?: number
  status?: number
  depth?: number
  path?: string
  remark?: string
  employeeCount?: number
  /** 直属未归档员工数（含待入职/离职中，不含已离职）：删除/禁用的校验口径 */
  employeeCountAll?: number
  /** 上级节点名称 */
  parentName?: string
  /** 下级节点数 */
  childCount?: number
  /** 含下级在内的总人数 */
  totalEmployeeCount?: number
  /** 创建时间 */
  createdAt?: string
  /** 负责人在途变更审批单 ID；有值即显示「负责人变更审批中」并可点开详情 */
  approvalInstanceId?: string | null
  approvalBizType?: string | null
  /** 最近一次负责人变更状态：0 审批中 / 1 已生效 / 2 已驳回 / 3 已撤销 */
  leaderChangeStatus?: number | null
  leaderChangeStatusName?: string | null
  /** 最近一次变更的审批单 ID（含已结束的单，可点开看审批意见） */
  leaderChangeInstanceId?: string | null
  leaderChangeAt?: string | null
  leaderChangeReason?: string | null
  allowedChildTypes?: ChildType[]
  children?: OrgNode[]
}

export interface OrgSaveBody {
  parentId?: string | null
  type: string
  code?: string
  name: string
  /** 组织简称 */
  shortName?: string
  /** 部门公用邮箱 */
  email?: string
  /** 办公地点 */
  address?: string
  /** 编制人数 */
  headcount?: number | null
  /** 成本中心 */
  costCenter?: string
  /** 成立日期 yyyy-MM-dd */
  establishDate?: string | null
  leader?: string
  /** 负责人（员工档案ID），审批流据此找人；0 表示清空 */
  leaderEmployeeId?: string | number | null
  phone?: string
  sort?: number
  status?: number
  remark?: string
}

export function orgTree(keyword?: string) {
  return request.get<never, OrgNode[]>('/api/ehr/orgs/tree', { params: { keyword } })
}

export function orgFlatten(keyword?: string) {
  return request.get<never, OrgNode[]>('/api/ehr/orgs/flatten', { params: { keyword } })
}

export function createOrg(body: OrgSaveBody) {
  return request.post<never, OrgNode>('/api/ehr/orgs', body)
}

export function updateOrg(id: string, body: OrgSaveBody) {
  return request.put<never, OrgNode>(`/api/ehr/orgs/${id}`, body)
}

export function deleteOrg(id: string) {
  return request.delete(`/api/ehr/orgs/${id}`)
}

/**
 * 负责人变更记录：每一次「设置 / 更换 / 清除」各一行。
 * 它同时是变更审批的业务单据本体（approvalInstanceId 指向审批单）。
 */
export interface LeaderChange {
  id: string
  orgId: string
  orgName?: string
  orgPath?: string
  orgType?: string
  /** SET 首次设置 / CHANGE 更换 / CLEAR 清除 */
  changeType: string
  changeTypeName?: string
  oldLeaderId?: string | null
  oldLeaderName?: string
  newLeaderId?: string | null
  newLeaderName?: string
  newLeaderEmpNo?: string
  newLeaderPosition?: string
  /** 变更原因（必填） */
  reason?: string
  /** 0 审批中 / 1 已生效 / 2 已驳回 / 3 已撤销 */
  status?: number
  statusName?: string
  applicantName?: string
  /** 审批单 ID：有值即可打开审批详情 */
  approvalInstanceId?: string | null
  appliedAt?: string
  effectiveAt?: string
  remark?: string
}

/**
 * 设置 / 更换负责人：指定新负责人会发起审批（ehr.dept_leader），通过后才生效；
 * 传 0 表示清除（直接生效）。指定人选时 reason（变更原因）必填。
 */
export function setOrgLeader(id: string, leaderEmployeeId: string | number | null, reason?: string) {
  return request.put<never, OrgNode>(`/api/ehr/orgs/${id}/leader`, { leaderEmployeeId, reason })
}

/** 某部门的负责人变更记录（倒序） */
export function orgLeaderChanges(id: string) {
  return request.get<never, LeaderChange[]>(`/api/ehr/orgs/${id}/leader-changes`)
}

/** 启用(1) / 禁用(2)：有下级或有人时后端拒绝 */
export function setOrgStatus(id: string, status: number) {
  return request.put<never, OrgNode>(`/api/ehr/orgs/${id}/status`, null, { params: { status } })
}

// ---------------- 人员 ----------------

export interface AccountBrief {
  username: string
  initialPassword?: string | null
  created: boolean
  apps: string[]
  roles: string[]
}

export interface EmployeeItem {
  id: string
  empNo: string
  name: string
  gender?: number
  mobile?: string
  email?: string
  nativePlace?: string
  nativeProvince?: string
  nativeCity?: string
  nativeDistrict?: string
  nativeDetail?: string
  idCard?: string
  birthday?: string | null
  age?: number | null
  nation?: string
  nationName?: string
  maritalStatus?: string
  maritalStatusName?: string
  politicalStatus?: string
  politicalStatusName?: string
  education?: string
  educationName?: string
  emergencyContact?: string
  emergencyPhone?: string
  currentAddress?: string
  orgId: string
  orgName?: string
  orgPathName?: string
  position?: string
  hireDate?: string | null
  /** 试用期时长（月）：1-12；免试用期为 null */
  probationMonths?: number | null
  /** 是否免试用期 */
  exemptProbation?: boolean | null
  /** 预计转正时间 yyyy-MM-dd；免试用期/缺失为 null */
  expectedRegularizeDate?: string | null
  status?: number
  statusName?: string
  /** 入职审批进度：0 待用人部门 / 1 待人事主管 / 2 已通过 / -1 已驳回 */
  onboardStep?: number | null
  /** 入职审批记录（JSON 字符串） */
  onboardApprovals?: string | null
  /** 转正申请状态：1 待部门主管 / 2 待人事主管 / 3 已转正 / -1 已驳回 */
  regularizeStatus?: number | null
  /** 转正审批记录（JSON 字符串） */
  regularizeApprovals?: string | null
  resignDate?: string | null
  resignReason?: string
  accountId?: string | null
  accountUsername?: string
  remark?: string
  createdAt?: string
  account?: AccountBrief | null
  /** 本次返回的手机号/身份证/紧急联系电话是否为掩码值 */
  sensitiveMasked?: boolean
  /** 离职/复职时账号状态是否已同步 */
  accountDisabled?: boolean
  /** true=本次保存走了审批（信息变更已提交、尚未生效） */
  pendingApproval?: boolean
}

export interface PageData<T> {
  list: T[]
  total: number
}

export interface EmployeeSaveBody {
  /** 已废弃：工号由后端自动生成，传了也被忽略 */
  empNo?: string
  name: string
  gender?: number
  mobile?: string
  email?: string
  nativePlace?: string
  nativeProvince?: string
  nativeCity?: string
  nativeDistrict?: string
  nativeDetail?: string
  idCard?: string
  birthday?: string | null
  nation?: string
  maritalStatus?: string
  politicalStatus?: string
  education?: string
  emergencyContact?: string
  emergencyPhone?: string
  currentAddress?: string
  orgId: string
  position?: string
  hireDate?: string | null
  /** 试用期时长（月）：1-12；免试用期时无需传 */
  probationMonths?: number | null
  /** 是否免试用期：true 时入职审批通过后直接转正式 */
  exemptProbation?: boolean | null
  status?: number
  remark?: string
  openAccount?: boolean
}

/* ---------- 字典 / 业务主数据下拉（直连配置中心跨应用公开只读端点） ---------- */

export interface DictOption {
  value: string
  label: string
  /** 职位类别（管理类 / 技术类），仅职位主数据有值，用于下拉分组 */
  category?: string
  /** 职务族编码（DEV / TEST / ACC / MGMT …），同族 = 一条晋升通道 */
  jobFamily?: string
  /** 职务族展示名（开发工程师 / 会计 / 招聘专员 …），下拉按它分组 */
  jobFamilyName?: string
  /** M 管理序列 / P 专业序列 */
  series?: string
  /** 等级序号：P 1 助理 2 初级 3 中级 4 高级 5 资深；M 1 经理 2 总监 3 高管 */
  levelNo?: number
  /** 等级展示名 */
  levelName?: string
}

/** 纯枚举字典下拉（配置中心 general.nation / ehr.marital_status / ehr.political_status） */
export function dictOptions(typeCode: string) {
  return request.get<never, DictOption[]>(`/api/settings/public/dicts/${typeCode}`)
}

/** 业务主数据下拉（配置中心 biz_* 真表：银行/学历/职位/请假类型/离职原因/家庭成员关系） */
export function bizOptions(type: string) {
  return request.get<never, DictOption[]>(`/api/settings/public/biz/${type}`)
}

/* ---------- 人员子档案：银行卡 / 教育背景 / 工作经历 / 家庭成员 ---------- */

export interface BankItem {
  id: string
  employeeId: string
  bank: string
  bankName?: string
  accountNo: string
  /** 卡号是否已按权限掩码 */
  sensitiveMasked?: boolean
  holderName?: string
  branch?: string
  isPrimary?: number
  remark?: string
}

export interface EducationItem {
  id: string
  employeeId: string
  school: string
  major?: string
  degree: string
  degreeName?: string
  startDate?: string | null
  endDate?: string | null
  remark?: string
}

export interface WorkItem {
  id: string
  employeeId: string
  company: string
  position?: string
  startDate?: string | null
  endDate?: string | null
  leaveReason?: string
  remark?: string
}

export interface FamilyItem {
  id: string
  employeeId: string
  relation: string
  relationName?: string
  name: string
  company?: string
  phone?: string
  remark?: string
}

export interface EmployeeProfile {
  employee: EmployeeItem
  banks: BankItem[]
  educations: EducationItem[]
  works: WorkItem[]
  families: FamilyItem[]
}

export function employeeProfile(id: string) {
  return request.get<never, EmployeeProfile>(`/api/ehr/employees/${id}/profile`)
}

export type BankBody = Omit<BankItem, 'id' | 'employeeId' | 'bankName'>
export type EducationBody = Omit<EducationItem, 'id' | 'employeeId' | 'degreeName'>
export type WorkBody = Omit<WorkItem, 'id' | 'employeeId'>
export type FamilyBody = Omit<FamilyItem, 'id' | 'employeeId' | 'relationName'>

export const addBank = (employeeId: string, body: BankBody) =>
  request.post<never, BankItem>(`/api/ehr/employees/${employeeId}/banks`, body)
export const updateBank = (employeeId: string, id: string, body: BankBody) =>
  request.put<never, BankItem>(`/api/ehr/employees/${employeeId}/banks/${id}`, body)
export const deleteBank = (employeeId: string, id: string) =>
  request.delete(`/api/ehr/employees/${employeeId}/banks/${id}`)

export const addEducation = (employeeId: string, body: EducationBody) =>
  request.post<never, EducationItem>(`/api/ehr/employees/${employeeId}/educations`, body)
export const updateEducation = (employeeId: string, id: string, body: EducationBody) =>
  request.put<never, EducationItem>(`/api/ehr/employees/${employeeId}/educations/${id}`, body)
export const deleteEducation = (employeeId: string, id: string) =>
  request.delete(`/api/ehr/employees/${employeeId}/educations/${id}`)

export const addWork = (employeeId: string, body: WorkBody) =>
  request.post<never, WorkItem>(`/api/ehr/employees/${employeeId}/works`, body)
export const updateWork = (employeeId: string, id: string, body: WorkBody) =>
  request.put<never, WorkItem>(`/api/ehr/employees/${employeeId}/works/${id}`, body)
export const deleteWork = (employeeId: string, id: string) =>
  request.delete(`/api/ehr/employees/${employeeId}/works/${id}`)

export const addFamily = (employeeId: string, body: FamilyBody) =>
  request.post<never, FamilyItem>(`/api/ehr/employees/${employeeId}/families`, body)
export const updateFamily = (employeeId: string, id: string, body: FamilyBody) =>
  request.put<never, FamilyItem>(`/api/ehr/employees/${employeeId}/families/${id}`, body)
export const deleteFamily = (employeeId: string, id: string) =>
  request.delete(`/api/ehr/employees/${employeeId}/families/${id}`)

export function pageEmployees(params: Record<string, unknown>) {
  return request.get<never, PageData<EmployeeItem>>('/api/ehr/employees', { params })
}

/* ---------------- 人力看板 ---------------- */

/** 看板汇总：后端已按当前账号的数据范围过滤，前端不再二次裁剪 */
export interface DashboardSummary {
  overview: {
    active: number
    probation: number
    onboarding: number
    terminating: number
    onboardThisMonth: number
    resignThisMonth: number
    regularizedThisMonth: number
  }
  orgDistribution: Array<{ orgId: string; orgName: string; type: string; employees: number }>
  headcount: Array<{
    orgId: string
    orgName: string
    type: string
    headcount: number
    actual: number
    /** 编制为 0 时为 null，页面显示「—」 */
    utilization: number | null
  }>
  headcountTotal: { headcount: number; actual: number; utilization: number | null }
  leaveTrend: Array<{ month: string; leaveType: string; leaveTypeName: string; days: number }>
}

export function dashboardSummary(params: { orgId?: string; from?: string; to?: string } = {}) {
  return request.get<never, DashboardSummary>('/api/ehr/dashboard/summary', { params })
}

/** 导出人员数据（CSV，后端按数据范围+敏感权限处理并记审计） */
export function exportEmployees(params: Record<string, unknown>) {
  return request.get<never, { data: Blob }>('/api/ehr/employees/export', {
    params,
    responseType: 'blob'
  })
}

/** 查看手机号 / 身份证 / 紧急联系电话明文（需 employee:sensitive:view，留 PLAIN 审计） */
export function sensitiveEmployeeDetail(id: string) {
  return request.get<never, EmployeeItem>(`/api/ehr/employees/${id}/sensitive`)
}

/* ---------- 敏感操作审计 ---------- */

export interface AuditLogItem {
  id: string
  operatorId: string
  operatorName?: string
  /** VIEW / PLAIN / EXPORT */
  action: string
  /** EMPLOYEE 等 */
  targetType: string
  targetId?: string | null
  /** 员工类目标补的姓名 */
  targetName?: string
  /** 涉及的敏感字段 */
  fields?: string
  ip?: string
  ua?: string
  createdAt?: string
}

export function pageAuditLogs(params: Record<string, unknown>) {
  return request.get<never, PageData<AuditLogItem>>('/api/ehr/audit-logs', { params })
}

/* ---------- 我的到期提醒 ---------- */

export interface ReminderItem {
  id: string
  employeeId: string
  receiverId: string
  type: string
  bizId?: string | null
  triggerDate?: string
  title: string
  content?: string
  readFlag?: number
  createdAt?: string
  employeeName?: string
}

export function pageMyReminders(params: Record<string, unknown>) {
  return request.get<never, PageData<ReminderItem>>('/api/ehr/reminders/my', { params })
}

export function myReminderUnreadCount() {
  return request.get<never, number>('/api/ehr/reminders/unread-count')
}

export function readReminder(id: string) {
  return request.post<never, void>(`/api/ehr/reminders/${id}/read`)
}

export function readAllReminders() {
  return request.post<never, void>('/api/ehr/reminders/read-all')
}

export function myEmployee() {
  return request.get<never, EmployeeItem | null>('/api/ehr/employees/me')
}

export function createEmployee(body: EmployeeSaveBody) {
  return request.post<never, EmployeeItem>('/api/ehr/employees', body)
}

export function updateEmployee(id: string, body: EmployeeSaveBody) {
  return request.put<never, EmployeeItem>(`/api/ehr/employees/${id}`, body)
}

/**
 * 人员信息变更提交（试用期/在职员工的「变更」）。
 * 基本信息只带可变 7 项；四类子表传目标态整表：带 id=已有行（内容可能改了）、
 * 不带 id=新增行、库里存在但没提交上来的算删除。服务端比对出差异后进审批，通过才落库。
 */
export interface EmpChangeBody {
  mobile?: string
  maritalStatus?: string
  politicalStatus?: string
  education?: string
  emergencyContact?: string
  emergencyPhone?: string
  currentAddress?: string
  banks?: (BankBody & { id?: string })[]
  educations?: (EducationBody & { id?: string })[]
  works?: (WorkBody & { id?: string })[]
  families?: (FamilyBody & { id?: string })[]
}

export interface EmpChangeResult {
  /** 变更单ID（字符串防精度丢失） */
  changeId: string
  /** 基本信息变更字段数 */
  baseChanges: number
  /** 子表新增行数 */
  addCount: number
  /** 子表修改行数 */
  modCount: number
  /** 子表删除行数 */
  delCount: number
  /** true=审批单已在途 */
  pendingApproval: boolean
  /** 变更摘要 */
  changeSummary: string
}

export function submitEmpChange(id: string, body: EmpChangeBody) {
  return request.post<never, EmpChangeResult>(`/api/ehr/employees/${id}/change-apply`, body)
}

export function deleteEmployee(id: string) {
  return request.delete(`/api/ehr/employees/${id}`)
}

export function openAccount(id: string) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/account`)
}

export interface ResignBody {
  resignDate?: string
  reason?: string
  /** 默认 true：同时停用统一账号 */
  disableAccount?: boolean
}

/** 办理离职：档案置离职并默认停用统一账号 */
export function resignEmployee(id: string, body: ResignBody) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/resign`, body)
}

/** 关闭账号：「待关闭账号」→「已离职」，并停用统一账号（离职/减员审批通过后的最后一步） */
export function closeAccountEmployee(id: string) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/close-account`)
}

/** 复职：恢复在职并默认重新启用统一账号 */
export function reinstateEmployee(id: string, body: { enableAccount?: boolean; remark?: string }) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/reinstate`, body)
}

/* ---------------- 复职申请（走审批中心 ehr.rehire） ---------------- */

export interface RehireApplyBody {
  /** 拟复职日期 yyyy-MM-dd，为空取当天 */
  rehireDate?: string
  reason?: string
  /** 默认 true：复职时一并启用统一账号 */
  enableAccount?: boolean
}

export interface RehireApplyItem {
  id: string
  employeeId: string
  empNo?: string
  employeeName: string
  orgName?: string
  /** 原离职日期 */
  resignDate?: string
  rehireDate?: string
  /** 离职月数 */
  leftMonths?: number
  reason?: string
  enableAccount?: boolean
  accountAction?: string
  status: number
  statusName: string
  applicantName?: string
  createdAt?: string
  approvalInstanceId?: string | null
  approvalBizType?: string | null
  mine: boolean
}

/** 提交复职申请：只落单并发起审批，通过后才真正复职 */
export function submitRehireApply(id: string, body: RehireApplyBody) {
  return request.post<never, RehireApplyItem>(`/api/ehr/employees/${id}/rehire-apply`, body)
}

/** scope=mine 我提交的；scope=all 全部（需审批权限） */
export function pageRehireApplies(params: Record<string, unknown>) {
  return request.get<never, PageData<RehireApplyItem>>('/api/ehr/approvals/rehires', { params })
}

export function cancelRehireApply(id: string) {
  return request.post<never, RehireApplyItem>(`/api/ehr/approvals/rehires/${id}/cancel`)
}

/* ---------------- 入职 / 转正 生命周期 ---------------- */

/** 待入职草稿提交：置「入职审批中」(20) 并向审批中心发起 ehr.onboard 审批；终审通过才开户 */
export function submitDraft(id: string) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/submit-draft`)
}

/** 办理入职：审批通过（25）后由 HR 在列表点「入职」确认到岗；免试用期直转正式，否则进入试用期 */
export function onboardEmployee(id: string) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/onboard`)
}

/** 转正申请填写内容（都是可选的，后端会兜底） */
export interface RegularizeApplyBody {
  /** 申请转正日期 yyyy-MM-dd */
  regularizeDate?: string
  /** 试用期工作自评 */
  selfReview?: string
  /** 试用期工作业绩与成果 */
  workSummary?: string
  /** 转正申请理由 */
  reason?: string
  /** 转正后的工作目标与计划 */
  nextPlan?: string
}

/** 试用期员工提交转正申请：发起审批中心 ehr.regularize 实例，终审通过才转正式 */
export function regularizeApply(id: string, body?: RegularizeApplyBody) {
  return request.post<never, EmployeeItem>(`/api/ehr/employees/${id}/regularize-apply`, body)
}

// ---------------- 转正申请单 ----------------

export interface RegularizeApplyItem {
  id: string
  employeeId: string
  empNo?: string
  /** 申请单号 */
  applyNo?: string
  employeeName?: string
  orgName?: string
  orgPath?: string
  position?: string
  /** 入职日期 */
  hireDate?: string
  /** 试用期月数 */
  probationMonths?: number
  /** 预计转正日期 */
  expectedRegularizeDate?: string
  /** 申请转正日期 */
  regularizeDate?: string
  selfReview?: string
  workSummary?: string
  reason?: string
  nextPlan?: string
  /** 0审批中 1已通过 2已驳回 3已撤销 */
  status: number
  statusName?: string
  applicantName?: string
  createdAt?: string
  approvalInstanceId?: string | null
  approvalBizType?: string
  /** 是否本人提交 */
  mine?: boolean
}

export function pageRegularizeApplies(params: Record<string, unknown>) {
  return request.get<never, PageData<RegularizeApplyItem>>('/api/ehr/approvals/regularizes', { params })
}

export function getRegularizeApply(id: string) {
  return request.get<never, RegularizeApplyItem>(`/api/ehr/approvals/regularizes/${id}`)
}

export function cancelRegularizeApply(id: string) {
  return request.post<never, RegularizeApplyItem>(`/api/ehr/approvals/regularizes/${id}/cancel`)
}

// ---------------- 离职申请 / 减员 / 审批中心 ----------------

// ---------------- 工作交接 ----------------

/** 一条交接内容；status 0 待确认 / 1 已确认 */
export interface HandoverItem {
  id: string
  /** 所属员工ID（被交接的离职/减员员工） */
  employeeId?: string
  /** 所属离职/减员申请ID */
  applyId?: string
  seq: number
  content: string
  status: number
  statusName: string
  note?: string
  confirmedAt?: string
}

export interface ResignApplyItem {
  id: string
  employeeId: string
  empNo?: string
  /** 申请单号 */
  applyNo?: string
  employeeName: string
  orgName?: string
  /** SELF 员工申请 / HR 减员 */
  source: 'SELF' | 'HR'
  sourceName: string
  applicantName: string
  resignDate?: string
  reason?: string
  /** 交接整体备注 */
  handover?: string
  /** 交接人 */
  handoverEmployeeId?: string | null
  handoverAccountId?: string | null
  handoverName?: string
  /** 0 待交接 / 1 交接已完成 / 2 无需交接 */
  handoverStatus?: number
  handoverStatusName?: string
  handoverProgress?: string
  handoverDone?: number
  handoverTotal?: number
  /** 交接全部完成（含无需交接）才允许负责人通过 */
  handoverCompleted?: boolean
  handoverConfirmedAt?: string
  handoverItems?: HandoverItem[]
  /** 当前登录人是否就是本单交接人 */
  handoverMine?: boolean
  status: number
  statusName: string
  applicantAccountId?: string
  approverAccountId?: string | null
  approverName?: string
  /** 审批人所在节点：被办理人本身是负责人时这里是上一级 */
  approverOrgName?: string
  approveNote?: string
  approvedAt?: string
  /** 二级（集团人力资源中心负责人）审批；null=未走到或系统无该节点（有权限者兜底） */
  hrApproverAccountId?: string | null
  hrApproverName?: string
  hrApproveNote?: string
  hrApprovedAt?: string
  createdAt?: string
  mine: boolean
  /** 已废弃：审批动作统一收口到审批中心，恒 false */
  actionable: boolean
  /** 审批中心实例 ID：交接全部确认后发起审批才有值 */
  approvalInstanceId?: string | null
  approvalBizType?: string | null
}

/** 提交离职/减员时的交接入参 */
export interface HandoverPayload {
  handoverEmployeeId?: string
  items?: string[]
  /** 确实没有在办事项时置 true，跳过交接 */
  noHandover?: boolean
}

/** 待我确认的交接（交接人视角）；scope=all 含已确认完的 */
export function fetchMyHandovers(scope: 'pending' | 'all' = 'pending') {
  return request.get<never, ResignApplyItem[]>('/api/ehr/approvals/handovers', { params: { scope } })
}

/**
 * 交接人候选（精简视图：只有选人需要的信息，不带手机号/邮箱）。
 * 走审批模块的专用口子，普通员工也能拿到。
 */
export interface HandoverCandidate {
  id: string
  empNo: string
  name: string
  position?: string
  orgId?: string
  orgName?: string
  orgPathName?: string
  accountId?: string | null
  accountUsername?: string
  status?: number
}

export function fetchHandoverCandidates() {
  return request.get<never, HandoverCandidate[]>('/api/ehr/approvals/handover-candidates')
}

/** 确认交接项：不传 itemIds = 全部确认 */
export function confirmHandover(id: string, body: { itemIds?: string[]; note?: string }) {
  return request.post<never, ResignApplyItem>(`/api/ehr/approvals/resigns/${id}/handover`, body)
}

/** scope=mine 我提交的；scope=all 全部（需审批权限） */
export function pageResignApplies(params: Record<string, unknown>) {
  return request.get<never, PageData<ResignApplyItem>>('/api/ehr/approvals/resigns', { params })
}

export interface ResignApplyBody extends HandoverPayload {
  resignDate?: string
  reason?: string
  /** 交接整体备注 */
  handover?: string
}

/** 员工自助提交离职申请 */
export function submitResignApply(body: ResignApplyBody) {
  return request.post<never, ResignApplyItem>('/api/ehr/approvals/resigns', body)
}

export function cancelResignApply(id: string) {
  return request.post<never, ResignApplyItem>(`/api/ehr/approvals/resigns/${id}/cancel`)
}

/** 单据详情（含交接清单） */
export function getResignApply(id: string) {
  return request.get<never, ResignApplyItem>(`/api/ehr/approvals/resigns/${id}`)
}

/** HR 减员：只提交申请，走审批中心 ehr.resign；交接全部确认后才发起审批 */
export function reduceEmployee(id: string, body: ResignApplyBody) {
  return request.post<never, ResignApplyItem>(`/api/ehr/employees/${id}/reduce`, body)
}

// ---------------- 请假 ----------------

export interface LeaveItem {
  id: string
  employeeId: string
  accountId: string
  applicantName: string
  leaveType: string
  leaveTypeName: string
  startDate: string
  endDate: string
  startPeriod?: string
  endPeriod?: string
  dayMode?: string
  days: number
  reason: string
  returnDate?: string | null
  attachmentId?: string | null
  attachmentName?: string
  status: number
  statusName: string
  /** 提交时按部门负责人快照的审批人账户ID；为空表示由有审批权的人兜底 */
  approverAccountId?: string | null
  approverName?: string
  /** 审批转办人（部门负责人请假时指定）：审批通过后由其在请假期间代审 */
  delegateAccountId?: string | null
  delegateName?: string
  approveNote?: string
  approvedAt?: string
  createdAt?: string
  mine: boolean
  /** 已废弃：审批动作统一收口到审批中心，恒 false */
  actionable: boolean
  /** 审批中心实例 ID；有值即显示「请假审批中」并可点开详情 */
  approvalInstanceId?: string | null
  approvalBizType?: string | null
}

export function pageLeaves(params: Record<string, unknown>) {
  return request.get<never, PageData<LeaveItem>>('/api/ehr/leaves', { params })
}

export function applyLeave(body: {
  leaveType: string
  startDate: string
  endDate: string
  startPeriod?: string
  endPeriod?: string
  dayMode?: string
  reason: string
  attachmentId?: string
  /** 审批转办人账户ID：部门负责人请假必填 */
  delegateAccountId?: string
}) {
  return request.post<never, LeaveItem>('/api/ehr/leaves', body)
}

/** 提前返岗销假：按实际返岗日期重算天数并退回额度 */
export function earlyReturnLeave(id: string, body: { returnDate: string; note?: string }) {
  return request.post<never, LeaveItem>(`/api/ehr/leaves/${id}/early-return`, body)
}

/** 提交前时段冲突（只查本人） */
export function leaveConflicts(startDate: string, endDate: string) {
  return request.get<never, LeaveItem[]>('/api/ehr/leaves/conflicts', { params: { startDate, endDate } })
}

/** 团队请假视图：需 leave:view:team */
export function teamLeaves(params: { orgId?: string; from?: string; to?: string }) {
  return request.get<never, LeaveItem[]>('/api/ehr/leaves/team', { params })
}

// ---------------- 假期额度 / 类型规则 / 附件 ----------------

export interface LeaveQuotaItem {
  id: string
  employeeId: string
  leaveType: string
  leaveTypeName: string
  year: number
  totalDays: number
  usedDays: number
  frozenDays: number
  availableDays: number
}

export interface LeaveTypeRule {
  leaveType: string
  enabled: number
  quotaRequired: number
  defaultQuotaDays: number
  attachmentRequired: number
  minDays: number
  maxDaysPerRequest: number
  minNoticeDays: number
  allowPastDays: number
  needDelegate: number
  sortNo: number
}

export interface QuotaLogItem {
  id: string
  leaveId?: string | null
  action: string
  actionName: string
  days: number
  beforeAvailable: number
  afterAvailable: number
  remark?: string
  createdAt?: string
}

export function myLeaveQuotas(year?: number) {
  return request.get<never, LeaveQuotaItem[]>('/api/ehr/leave-quotas/me', { params: { year } })
}

export function employeeLeaveQuotas(employeeId: string, year?: number) {
  return request.get<never, LeaveQuotaItem[]>('/api/ehr/leave-quotas', { params: { employeeId, year } })
}

export function initEmployeeLeaveQuota(employeeId: string, year?: number) {
  return request.post<never, LeaveQuotaItem[]>('/api/ehr/leave-quotas/init', null, {
    params: { employeeId, year }
  })
}

export function leaveQuotaLogs(quotaId: string) {
  return request.get<never, QuotaLogItem[]>(`/api/ehr/leave-quotas/${quotaId}/logs`)
}

/** 发起额度调整审批：审批通过后才生效 */
export function adjustLeaveQuota(quotaId: string, body: { delta: number; reason: string }) {
  return request.post<never, unknown>(`/api/ehr/leave-quotas/${quotaId}/adjust`, body)
}

export function leaveRules() {
  return request.get<never, LeaveTypeRule[]>('/api/ehr/leave-rules')
}

export function saveLeaveRule(leaveType: string, body: Partial<LeaveTypeRule>) {
  return request.put<never, LeaveTypeRule>(`/api/ehr/leave-rules/${leaveType}`, body)
}

/** 附件上传（请假证明材料），返回附件ID */
export function uploadEhrAttachment(file: File, bizType = 'LEAVE', bizId?: string) {
  const form = new FormData()
  form.append('file', file)
  form.append('bizType', bizType)
  if (bizId) form.append('bizId', bizId)
  return request.post<never, EhrAttachment>('/api/ehr/attachments', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function cancelLeave(id: string) {
  return request.post<never, LeaveItem>(`/api/ehr/leaves/${id}/cancel`)
}

/** 请假类型下拉（配置中心 ehr.leave_type 字典，后端带内置兜底） */
export interface TypeOption {
  value: string
  label: string
}

export function leaveTypeOptions() {
  return request.get<never, TypeOption[]>('/api/ehr/leaves/type-options')
}

/** 审批转办选项：required=true 表示当前登录人是部门负责人，请假必须选转办人 */
export interface LeaveDelegateOption {
  accountId: string
  name: string
  orgName: string
}

export interface LeaveDelegateOptions {
  required: boolean
  options: LeaveDelegateOption[]
}

export function leaveDelegateOptions() {
  return request.get<never, LeaveDelegateOptions>('/api/ehr/leaves/delegate-options')
}

/* ---------------- 通知管理（人力中心发布 → 账号中心通知中心展示） ---------------- */

export interface AnnouncementItem {
  id: string
  /** 业务编号，如 NOTICE-20261108-0001 */
  announcementNo?: string
  title: string
  summary?: string
  /** HOLIDAY / COMMENDATION / DEPARTMENT / POLICY / OTHER */
  category: string
  categoryName?: string
  /** 富文本 HTML；列表接口为空 */
  content?: string
  /** 0 全员（集团） / 1 按部门 */
  targetType: number
  targetOrgIds: string[]
  targetOrgNames?: string
  /** 1 置顶 */
  pinned: number
  /** 0 编辑中 / 1 已发布 / 2 已下架 */
  status: number
  statusName?: string
  publishAt?: string
  offlineAt?: string
  publisherName?: string
  readCount: number
  targetCount: number
  remark?: string
  createdAt?: string
  updatedAt?: string
  read?: boolean
}

export interface AnnouncementSaveBody {
  title: string
  summary?: string
  category?: string
  content: string
  targetType: number
  targetOrgIds?: Array<string | number>
  pinned?: boolean
  remark?: string
}

export function pageAnnouncements(params: Record<string, unknown>) {
  return request.get<never, PageData<AnnouncementItem>>('/api/ehr/announcements/manage', { params })
}

/** 通知目标选择的部门树：挂在 announcement:manage 下，不需要额外的 org:view */
export function announcementOrgTree() {
  return request.get<never, OrgNode[]>('/api/ehr/announcements/manage/org-tree')
}

export function getAnnouncement(id: string) {
  return request.get<never, AnnouncementItem>(`/api/ehr/announcements/manage/${id}`)
}

/* ---------------- 合同与档案附件（P1-1） ---------------- */

export interface ContractItem {
  id: string
  employeeId: string
  employeeName?: string
  contractNo?: string
  /** FIXED / UNFIXED / INTERN / LABOR */
  contractType: string
  contractTypeName?: string
  startDate?: string
  endDate?: string
  signDate?: string
  /** ACTIVE / PENDING / TERMINATING / EXPIRED / RENEWED / TERMINATED */
  status: string
  statusName?: string
  renewFromId?: string
  fileId?: string
  fileName?: string
  remark?: string
  /** 距到期天数；负数=已过期 */
  expireDays?: number
  /** RED 7 天内 / YELLOW 30 天内 */
  expireFlag?: string
  createdAt?: string
}

export interface ContractBody {
  contractNo?: string
  contractType: string
  startDate: string
  endDate?: string
  signDate?: string
  fileId?: string
  remark?: string
}

export interface ContractRenewBody extends ContractBody {
  reason?: string
}

export const listContracts = (employeeId: string) =>
  request.get<never, ContractItem[]>('/api/ehr/contracts', { params: { employeeId } })

export const addContract = (employeeId: string, body: ContractBody) =>
  request.post<never, ContractItem>('/api/ehr/contracts', body, { params: { employeeId } })

export const updateContract = (id: string, body: ContractBody) =>
  request.put<never, ContractItem>(`/api/ehr/contracts/${id}`, body)

export const renewContract = (id: string, body: ContractRenewBody) =>
  request.post<never, ContractItem>(`/api/ehr/contracts/${id}/renew`, body)

export const terminateContract = (id: string, reason: string) =>
  request.post<never, ContractItem>(`/api/ehr/contracts/${id}/terminate`, { reason })

export interface EhrAttachment {
  id: string
  fileName: string
  size: number
  mime?: string
  bizType?: string
  bizId?: string
  uploadedBy?: string
  createdAt?: string
}

export const listEhrAttachments = (bizType: string, bizId: string) =>
  request.get<never, EhrAttachment[]>('/api/ehr/attachments', { params: { bizType, bizId } })

export const deleteEhrAttachment = (id: string) => request.delete(`/api/ehr/attachments/${id}`)

export function downloadEhrAttachment(id: string) {
  return request.get<never, { data: Blob }>(`/api/ehr/attachments/${id}/download`, {
    responseType: 'blob'
  })
}

/* ---------------- 轻量考勤（P1-2） ---------------- */

export interface OvertimeItem {
  id: string
  employeeId: string
  employeeName?: string
  workDate: string
  hours: number
  /** NORMAL / HOLIDAY / RESTDAY */
  type: string
  typeName?: string
  reason?: string
  /** 0 待审批 / 1 已通过 / 2 已驳回 / 3 已撤销 */
  status: number
  statusName?: string
  approveNote?: string
  createdAt?: string
  mine?: boolean
}

export interface OvertimePage {
  list: OvertimeItem[]
  total: number
}

export interface OvertimeBody {
  workDate: string
  hours: number
  type: string
  reason?: string
}

export const listOvertimes = (params: {
  scope?: string
  employeeId?: string
  month?: string
  page?: number
  size?: number
}) => request.get<never, OvertimePage>('/api/ehr/attendance/overtimes', { params })

export const submitOvertime = (body: OvertimeBody) =>
  request.post<never, OvertimeItem>('/api/ehr/attendance/overtimes', body)

export const cancelOvertime = (id: string) =>
  request.post<never, void>(`/api/ehr/attendance/overtimes/${id}/cancel`)

export interface AttendanceMonthItem {
  id: string
  employeeId: string
  employeeName?: string
  month: string
  shouldDays: number
  actualDays: number
  leaveDays: number
  overtimeHours: number
  absentDays: number
  /** 0 未确认 / 1 已确认 */
  confirmed: number
}

export const listAttendanceMonthly = (month: string, employeeId?: string) =>
  request.get<never, AttendanceMonthItem[]>('/api/ehr/attendance/monthly', {
    params: { month, employeeId }
  })

export const confirmAttendanceMonthly = (month: string, employeeId: string) =>
  request.post<never, AttendanceMonthItem>('/api/ehr/attendance/monthly/confirm', null, {
    params: { month, employeeId }
  })

export function createAnnouncement(body: AnnouncementSaveBody) {
  return request.post<never, AnnouncementItem>('/api/ehr/announcements/manage', body)
}

export function updateAnnouncement(id: string, body: AnnouncementSaveBody) {
  return request.put<never, AnnouncementItem>(`/api/ehr/announcements/manage/${id}`, body)
}

export function publishAnnouncement(id: string) {
  return request.post<never, AnnouncementItem>(`/api/ehr/announcements/manage/${id}/publish`)
}

export function offlineAnnouncement(id: string) {
  return request.post<never, AnnouncementItem>(`/api/ehr/announcements/manage/${id}/offline`)
}

export function deleteAnnouncement(id: string) {
  return request.delete<never, void>(`/api/ehr/announcements/manage/${id}`)
}
