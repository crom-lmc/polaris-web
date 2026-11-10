import request from './request'

/** 待办/消息推送配置 */
export interface NoticeRule {
  id: string
  code: string
  /** 归属应用编码，空=通用 */
  appCode: string
  module: string
  name: string
  titleTpl: string
  contentTpl: string
  /** 1 待办 / 2 消息，二者互斥 */
  channel: number
  /** 1 同时发邮件 */
  email: number
  enabled: number
  builtIn: number
  sort: number
  /** 指定接收账号 ID（逗号分隔）；与 receiverOrgIds 可混合，都为空=由业务方决定 */
  receiverAccountIds?: string
  /** 指定接收部门（EHR 组织节点 ID，逗号分隔，含下级） */
  receiverOrgIds?: string
  createdAt?: string
}

export interface NoticeRulePayload {
  code?: string
  appCode?: string
  module?: string
  name?: string
  titleTpl?: string
  contentTpl?: string
  channel?: number
  email?: number
  enabled?: number
  sort?: number
  receiverAccountIds?: string
  receiverOrgIds?: string
}

export function listNoticeRules(keyword?: string) {
  return request.get<never, NoticeRule[]>('/api/settings/notices/rules', { params: { keyword } })
}

export function createNoticeRule(payload: NoticeRulePayload) {
  return request.post<never, NoticeRule>('/api/settings/notices/rules', payload)
}

export function updateNoticeRule(id: string, payload: NoticeRulePayload) {
  return request.patch<never, NoticeRule>(`/api/settings/notices/rules/${id}`, payload)
}

export function deleteNoticeRule(id: string) {
  return request.delete<never, void>(`/api/settings/notices/rules/${id}`)
}

/** 组织节点（扁平），规则「指定接收部门」多选用（转自 EHR） */
export interface ReceiverOrgNode {
  id: string
  parentId: string | null
  name: string
  type?: string
}

export function fetchReceiverOrgs() {
  return request.get<never, ReceiverOrgNode[]>('/api/settings/notices/receivers/orgs')
}

/** 已开户在职员工，规则「指定接收人」多选用（id=账号 ID） */
export interface ReceiverEmployee {
  id: string
  name: string
  empNo?: string
  orgId?: string | null
}

export function fetchReceiverEmployees() {
  return request.get<never, ReceiverEmployee[]>('/api/settings/notices/receivers/employees')
}
