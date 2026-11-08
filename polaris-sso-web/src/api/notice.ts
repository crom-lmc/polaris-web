import request from './request'

/**
 * 我的待办 / 消息：数据在 settings 服务，网关按 /api/settings/** 转发。
 * 账号身份由令牌决定，接口不接收账号ID。
 */
export interface NoticeMessage {
  id: string
  module?: string
  /** 1 待办 / 2 消息 */
  kind: number
  title: string
  content: string
  bizType?: string
  bizId?: string
  /** 业务编码：调用方自定义的标识，如审批单号 */
  bizNo?: string
  /** 发起人：待办为申请人，审批结果消息为实际通过/驳回的人 */
  applicantName?: string
  /** 点击后跳转的前端路由 */
  link?: string
  /** 左侧树：业务应用编码 */
  groupApp?: string
  /** 左侧树：业务类型名称 */
  groupName?: string
  readAt?: string
  createdAt?: string
}

// 注意：本项目的 request 拦截器保留 axios 响应结构，数据本体在 .data 上
export function fetchMyNotices(params?: { kind?: number; unreadOnly?: boolean; limit?: number }) {
  return request.get<never, { data: NoticeMessage[] }>('/api/settings/notices/my', { params })
}

/** kind 不传=全部未读；1=待办未读 2=消息未读 */
export function fetchUnreadNoticeCount(kind?: number) {
  return request.get<never, { data: number }>('/api/settings/notices/my/unread-count', {
    params: kind == null ? undefined : { kind }
  })
}

export function markNoticesRead(ids: string[]) {
  return request.post<never, { data: number }>('/api/settings/notices/my/read', { ids })
}

export function markAllNoticesRead() {
  return request.post<never, { data: number }>('/api/settings/notices/my/read-all')
}
