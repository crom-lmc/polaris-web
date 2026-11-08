import request from './request'
import type { ApprovalContext, ApprovalInstance, ApprovalStatus } from '@/types/approval'

/**
 * 审批中心接口。全部走统一账号中心 `/api/accounts/approvals/**`：
 * 审批单在 settings 库，但「谁在审批」由账号中心定，前端不直连 settings。
 *
 * 注意：ehr-web 的 request 拦截器会把 Result 壳解包成 data 本体，
 * 所以这里声明的返回类型是本体（不像 sso-web 那样带 { data: ... } 壳）。
 */

/** 五视图：待我审批 / 已审批 / 我发起的 / 抄送我 / 我委托的 */
export type ApprovalScope = 'pending' | 'approved' | 'mine' | 'cc' | 'delegated'

export function fetchApprovals(scope: ApprovalScope) {
  return request.get<never, ApprovalInstance[]>('/api/accounts/approvals', { params: { scope } })
}

export function fetchApprovalDetail(id: string) {
  return request.get<never, ApprovalInstance>(`/api/accounts/approvals/${id}`)
}

/** 审批弹窗上下文：版式 + 已算好的字段值 + 我的待办（服务端算值，前端只画） */
export function fetchApprovalContext(id: string, view = 'APPROVAL') {
  return request.get<never, ApprovalContext>(`/api/accounts/approvals/${id}/context`, {
    params: { view }
  })
}

export function approveTask(taskId: string, pass: boolean, note?: string) {
  return request.post<never, ApprovalInstance>(
    `/api/accounts/approvals/tasks/${taskId}/approve`,
    { pass, note }
  )
}

/** 转办：把待办交给别人（一次性，原任务终结） */
export function transferTask(taskId: string, targetId: string, note?: string) {
  return request.post<never, void>(
    `/api/accounts/approvals/tasks/${taskId}/transfer`,
    { targetId, note }
  )
}

/** 加签：临时把人插进当前节点 */
export function addSignTask(taskId: string, targetId: string, position = 'AFTER', note?: string) {
  return request.post<never, void>(
    `/api/accounts/approvals/tasks/${taskId}/add-sign`,
    { targetId, position, note }
  )
}

/** 撤回：仅发起人且流程未结束 */
export function withdrawApproval(id: string, note?: string) {
  return request.post<never, ApprovalInstance>(
    `/api/accounts/approvals/${id}/withdraw`,
    { note }
  )
}

/** 终止：管理员强制结束在途单 */
export function terminateApproval(id: string, note?: string) {
  return request.post<never, ApprovalInstance>(
    `/api/accounts/approvals/${id}/terminate`,
    { note }
  )
}

/* ---------------- 业务列表反查审批结果（驳回提示） ---------------- */

/**
 * 业务回调在终态会清掉业务表上的 approvalInstanceId，所以列表要显示
 * 「XX审批被驳回」只能按 (bizType, bizId) 回到审批中心查最近一张单。
 * 下面这组是一次批量查询，别在每一行里单独发请求。
 */
export interface BizRef {
  bizType: string
  bizId: string
  /**
   * '1' = bizId 是「业务主体 ID」（员工 / 组织 / 文章），请按审批单的
   * subject_id（存量单回落 form_data 的 cfg_biz_scene.subject_field）反查。
   * 主体与单据是一对多时（转正/请假/离职/负责人变更），列表行只有主体 ID，
   * 必须走这种关联；新增业务类型不再需要改后端白名单。
   * 用字符串而不是 boolean：账号中心代理层的入参是 Map<String,String>。
   */
  bySubject?: '1'
  /** 兼容旧后端：按员工 ID 反查；新代码统一用 bySubject */
  byEmployee?: '1'
  /** 兼容旧后端：按组织 ID 反查；新代码统一用 bySubject */
  byOrg?: '1'
}

/** 精简审批单：只够列表判断状态与打开详情用，不含 steps/tasks */
export interface ApprovalBrief {
  /** 雪花 ID，后端按字符串返回，前端不要转 Number */
  id: string
  bizType: string
  /** 精确匹配时=业务单 ID；按主体反查时后端改写成主体 ID，列表按行归类用 */
  bizId: string
  /** 业务主体 ID（员工 / 组织），与 bizId 解耦 */
  subjectId?: string | null
  /** SUBJECT = bizId 就是主体；DOC = bizId 是本次申请单 */
  bizIdKind?: 'SUBJECT' | 'DOC' | string | null
  status: ApprovalStatus
  statusName?: string
  title?: string
  finishedAt?: string | null
}

export function fetchLatestApprovals(refs: BizRef[]) {
  return request.post<never, ApprovalBrief[]>('/api/accounts/approvals/latest-batch', refs)
}

/** 一行 × 该页可能出现的业务类型，拼成批量查询入参 */
export function buildBizRefs(ids: (string | number)[], bizTypes: string[]): BizRef[] {
  const out: BizRef[] = []
  for (const id of ids) {
    for (const bizType of bizTypes) {
      out.push({ bizType, bizId: String(id) })
    }
  }
  return out
}

/**
 * 主体列表专用：这些业务对同一个主体会发多张单（bizId 是申请单 ID），
 * 只能按 subject_id / 场景配置的主体键关联到列表行。员工、组织、文章通用。
 */
export function buildSubjectBizRefs(
  ids: (string | number)[],
  bizTypes: string[],
  legacy: 'employee' | 'org' | 'none' = 'employee'
): BizRef[] {
  const out: BizRef[] = []
  for (const id of ids) {
    for (const bizType of bizTypes) {
      const ref: BizRef = { bizType, bizId: String(id), bySubject: '1' }
      // 过渡期兼容：后端 9007 尚未重启时只认 byEmployee（且限三个业务类型）。
      // 同时带上旧标记，重启前后都不会让原本能显示的提示凭空消失。
      if (legacy === 'employee') ref.byEmployee = '1'
      if (legacy === 'org') ref.byOrg = '1'
      out.push(ref)
    }
  }
  return out
}

/** @deprecated 旧名，保留给存量调用；等价于 buildSubjectBizRefs（主体维度不再只限员工） */
export const buildEmployeeBizRefs = buildSubjectBizRefs

/** 从批量结果里挑出某一行的单据（同一行可能有入职/转正/信息变更等多个业务） */
export function briefsForRow(briefs: ApprovalBrief[], id: string | number): ApprovalBrief[] {
  const key = String(id)
  return (briefs || []).filter((b) => b && b.bizId === key)
}

/** 一行有多张终态单时取最近终审的一张；在途单不参与，交给列表的「审批中」分支 */
export function pickFinalBrief(briefs: ApprovalBrief[]): ApprovalBrief | null {
  const finals = (briefs || []).filter((b) => b && b.status !== 0)
  if (!finals.length) return null
  return finals.reduce((a, b) => ((b.finishedAt || '') > (a.finishedAt || '') ? b : a))
}

/**
 * 该行真正处于「在途」的审批单。
 *
 * 业务行上的 approvalInstanceId 不能直接信任：终审回调里「状态已推进 / 重复投递」等
 * 分支会提前 return 而没清掉它，已完成的单也可能残留在业务行上（此时列表会误显示
 * 「审批中 / 审批详情」）。一律以审批中心返回的真实 status 为准。
 * 仅当审批中心完全没返回数据（接口不可用、该业务从未发起）时才回退到业务行实例号，
 * 保证审批中心短暂不可用时仍能点开在途详情。
 */
export function runningBriefOf(
  briefs: ApprovalBrief[],
  fallbackInstanceId?: string | number | null,
  fallbackBizType?: string | null
): ApprovalBrief | null {
  const list = briefs || []
  const inFlight = list.find((b) => b && b.status === 0)
  if (inFlight) return inFlight
  if (!list.length && fallbackInstanceId != null && fallbackInstanceId !== '') {
    return {
      id: String(fallbackInstanceId),
      bizId: '',
      bizType: fallbackBizType || '',
      status: 0
    }
  }
  return null
}

/**
 * 该行最近一张「被驳回」的审批单。
 * 审批完成（通过 1 / 撤回 3 / 终止 4）后不再需要任何提示或详情入口，故只认驳回。
 */
export function rejectedBriefOf(briefs: ApprovalBrief[]): ApprovalBrief | null {
  const b = pickFinalBrief(briefs)
  return b && b.status === 2 ? b : null
}

/* ---------------- 转办 / 加签的按组织选人 ---------------- */

/** 组织节点（扁平列表，前端组树）；id/parentId 均为字符串 */
export interface ApprovalOrgNode {
  id: string
  parentId: string | null
  name: string
  type: number
  status: number
}

/** 组织直属成员（已开户、未离职），id 为账号 ID（字符串） */
export interface ApprovalOrgUser {
  id: string
  name: string
  empNo: string
}

export function fetchApprovalOrgTree() {
  return request.get<never, ApprovalOrgNode[]>('/api/accounts/approvals/orgs/tree')
}

export function fetchApprovalOrgUsers(orgId: string) {
  return request.get<never, ApprovalOrgUser[]>(
    `/api/accounts/approvals/orgs/${orgId}/employees`
  )
}
