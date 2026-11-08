import request from './request'
import type { ApprovalContext, ApprovalInstance } from '@/types'

/**
 * 审批中心接口。全部走统一账号中心 `/api/accounts/approvals/**`——
 * 审批单存在 settings 库，但「谁在审批」必须由账号中心定，所以由它代理，
 * 前端不直连 settings（直连会被 settings 的应用边界拦掉，那道墙不该为这个功能破口）。
 */

/** 五视图：待我审批 / 已审批 / 我发起的 / 抄送我 / 我委托的 */
export type ApprovalScope = 'pending' | 'approved' | 'mine' | 'cc' | 'delegated'

export function fetchApprovals(scope: ApprovalScope) {
  return request.get<never, { data: ApprovalInstance[] }>('/api/accounts/approvals', {
    params: { scope }
  })
}

export function fetchApprovalDetail(id: string) {
  return request.get<never, { data: ApprovalInstance }>(`/api/accounts/approvals/${id}`)
}

/**
 * 审批弹窗上下文：版式 + 已算好的字段值 + 我的待办。
 * 前端只负责画，取值口径与权限判断都在服务端。
 */
export function fetchApprovalContext(id: string, view = 'APPROVAL') {
  return request.get<never, { data: ApprovalContext }>(`/api/accounts/approvals/${id}/context`, {
    params: { view }
  })
}

export function approveTask(taskId: string, pass: boolean, note?: string) {
  return request.post<never, { data: ApprovalInstance }>(
    `/api/accounts/approvals/tasks/${taskId}/approve`,
    { pass, note }
  )
}

/** 转办：把待办交给别人（一次性，原任务终结） */
export function transferTask(taskId: string, targetId: string, note?: string) {
  return request.post<never, { data: void }>(
    `/api/accounts/approvals/tasks/${taskId}/transfer`,
    { targetId, note }
  )
}

/** 加签：临时把人插进当前节点（会把节点切成会签，或签节点上加签才有意义） */
export function addSignTask(taskId: string, targetId: string, position = 'AFTER', note?: string) {
  return request.post<never, { data: void }>(
    `/api/accounts/approvals/tasks/${taskId}/add-sign`,
    { targetId, position, note }
  )
}

/** 撤回：仅发起人且流程未结束 */
export function withdrawApproval(id: string, note?: string) {
  return request.post<never, { data: ApprovalInstance }>(
    `/api/accounts/approvals/${id}/withdraw`,
    { note }
  )
}

/* ---------------- 转办 / 加签的按组织选人 ---------------- */

/** 组织节点（扁平列表，前端组树）；id/parentId 均为字符串，防雪花精度丢失 */
export interface ApprovalOrgNode {
  id: string
  parentId: string | null
  name: string
  /** EHR 下发的是组织类型编码字符串（GROUP/COMPANY/DEPARTMENT/PROJECT/SUB_PROJECT） */
  type: string
  /** 组织类型中文名（集团/子公司/部门/项目/子项目），由 EHR 下发，用于树的彩色标签 */
  typeName?: string
  status: number
  /** 直属在职人数（试用 30 + 在职 40，不含下级），与 EHR 组织架构页树一致 */
  employeeCount?: number
}

/** 组织直属成员（已开户、未离职），id 为账号 ID（字符串） */
export interface ApprovalOrgUser {
  id: string
  name: string
  empNo: string
}

export function fetchApprovalOrgTree() {
  return request.get<never, { data: ApprovalOrgNode[] }>('/api/accounts/approvals/orgs/tree')
}

export function fetchApprovalOrgUsers(orgId: string) {
  return request.get<never, { data: ApprovalOrgUser[] }>(
    `/api/accounts/approvals/orgs/${orgId}/employees`
  )
}

/** 终止：管理员强制结束在途单 */
export function terminateApproval(id: string, note?: string) {
  return request.post<never, { data: ApprovalInstance }>(
    `/api/accounts/approvals/${id}/terminate`,
    { note }
  )
}
