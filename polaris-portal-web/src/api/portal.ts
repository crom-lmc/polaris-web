import request from './request'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/**
 * 是否为「后台布局预览」模式（CMS 门户设置里用 iframe 内嵌本站首页）。
 * 预览模式下：不接受路由跳转、不恢复登录态，布局由后台 postMessage 下发。
 */
export const IS_PREVIEW =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('preview') === '1'

/** 后台预览下发的布局消息类型 */
export const PREVIEW_MSG_TYPE = 'portal:preview-layout'

/** 门户回调地址（必须与统一账号中心里 portal 应用 baseUrl 同 origin） */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/** 跳转统一账号中心签授权码 */
export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('portal_oauth_state', state)
    sessionStorage.setItem('portal_oauth_redirect', redirect)
  } catch { /* ignore */ }
  const url =
    `${SSO_AUTHORIZE_URL}/authorize?response_type=code` +
    `&client_id=portal&redirect_uri=${encodeURIComponent(callbackUrl())}` +
    `&state=${encodeURIComponent(state)}`
  window.location.href = url
}

export function consumeState(): string | null {
  try {
    const s = sessionStorage.getItem('portal_oauth_state')
    sessionStorage.removeItem('portal_oauth_state')
    return s
  } catch {
    return null
  }
}

export function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('portal_oauth_redirect') || '/'
    sessionStorage.removeItem('portal_oauth_redirect')
    return r
  } catch {
    return '/'
  }
}

/** OAuth2 授权码换 portal 令牌（appSecret 在 portal 后端） */
export function exchangeCode(code: string, redirectUri: string) {
  return request.post('/api/portal/sso/oauth/exchange', { code, redirectUri })
}

export interface MeInfo {
  accountId: number | string
  username: string
  superAdmin: boolean
  appCode: string
  permissions: string[]
}

export function fetchMe() {
  return request.get<never, MeInfo>('/api/portal/me')
}

/* ---------------- 登录后的统一待办（审批中心聚合） ---------------- */

export interface TodoCategory {
  name: string
  count: number
}

export interface TodoItem {
  id: string
  taskId?: string
  category: string
  bizType?: string
  bizName?: string
  title?: string
  applicantName?: string
  orgPath?: string
  createdAt?: string
}

export interface TodoSummary {
  total: number
  categories: TodoCategory[]
  items: TodoItem[]
}

export function fetchTodos() {
  return request.get<never, TodoSummary>('/api/portal/todos')
}

// ---------------- 门户内容（公开接口，经网关读 CMS） ----------------

export interface LayoutModule {
  id: number
  moduleKey: string
  moduleName: string
  enabled: number
  sort: number
  config?: string
}

export function fetchLayout() {
  return request.get<never, LayoutModule[]>('/api/cms/public/layout')
}

export interface BannerItem {
  id: number
  title: string
  imageUrl: string
  linkUrl?: string
  sort?: number
}

export function fetchBanners() {
  return request.get<never, BannerItem[]>('/api/cms/public/banners')
}

export interface ArticleItem {
  id: number
  title: string
  summary?: string
  content?: string
  categoryId?: number | null
  categoryName?: string
  cover?: string
  pinned?: number
  recommended?: number
  publishedAt?: string | null
  authorName?: string
  /** 主标签ID（可按 tagId 筛选） */
  tagId?: number | null
  /** 标签名快照，多个用逗号分隔（历史多标签） */
  tag?: string
}

export interface PageData<T> {
  list: T[]
  total: number
}

export interface ArticleQuery {
  keyword?: string
  categoryId?: number
  tagId?: number
  page?: number
  size?: number
}

export function pageArticles(params: ArticleQuery) {
  return request.get<never, PageData<ArticleItem>>('/api/cms/public/articles', { params })
}

export function articleDetail(id: string | number) {
  return request.get<never, ArticleItem>(`/api/cms/public/articles/${id}`)
}

export function searchArticles(keyword: string, limit = 20) {
  return request.get<never, ArticleItem[]>('/api/cms/public/search', { params: { keyword, limit } })
}

export interface TaxonomyItem {
  id: number
  name: string
  articleCount?: number
}

export function fetchCategories() {
  return request.get<never, TaxonomyItem[]>('/api/cms/public/categories')
}

export function fetchTags() {
  return request.get<never, TaxonomyItem[]>('/api/cms/public/tags')
}

export interface FriendLinkItem {
  id: number
  name: string
  url?: string
  logo?: string
  description?: string
  sort?: number
}

export function fetchLinks() {
  return request.get<never, FriendLinkItem[]>('/api/cms/public/links')
}

/** 从模块 config JSON 里取 limit，默认 fallback */
export function moduleLimit(config: string | undefined, fallback: number): number {
  if (!config) return fallback
  try {
    const obj = JSON.parse(config)
    return typeof obj.limit === 'number' ? obj.limit : fallback
  } catch {
    return fallback
  }
}
