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
