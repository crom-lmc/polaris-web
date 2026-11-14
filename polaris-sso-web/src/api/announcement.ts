import request from './request'

/**
 * 通知中心：数据在 EHR 服务（人力中心发布的内部通知），网关按 /api/ehr/** 转发。
 * 身份由网关注入的令牌决定，接口不接收账号 / 部门参数；后端按员工档案的部门祖先链过滤可见范围。
 */
export interface NoticeItem {
  id: string
  title: string
  summary?: string
  /** HOLIDAY / COMMENDATION / DEPARTMENT / POLICY / OTHER */
  category: string
  categoryName?: string
  /** 富文本 HTML；列表接口为空 */
  content?: string
  targetType: number
  targetOrgNames?: string
  /** 1 置顶 */
  pinned: number
  /** 0 编辑中 / 1 已发布 / 2 已下架（通知中心只会出现已发布） */
  status: number
  publishAt?: string
  publisherName?: string
  readCount?: number
  /** 当前登录人是否已读 */
  read?: boolean
}

export interface NoticePage {
  list: NoticeItem[]
  total: number
}

/** 风格与 apps.ts 保持一致：TS 泛型声明 { data: X }，运行时拦截器解包后 .data 即数据本体 */
export function pageNotices(params: { page?: number; size?: number; category?: string; keyword?: string; unreadOnly?: boolean }) {
  return request.get<never, { data: NoticePage }>('/api/ehr/announcements', { params })
}

/** 打开详情即记读（后端按 (通知, 账号) 幂等） */
export function fetchNoticeDetail(id: string) {
  return request.get<never, { data: NoticeItem }>(`/api/ehr/announcements/${id}`)
}

export function fetchNoticeUnreadCount() {
  return request.get<never, { data: number }>('/api/ehr/announcements/unread-count')
}

export interface DictOption {
  value: string
  label: string
}

/** 下拉字典（配置中心），通知类型用 ehr.announcement_category */
export function dictOptions(typeCode: string) {
  return request.get<never, { data: DictOption[] }>(`/api/settings/public/dicts/${typeCode}`)
}
