import request from './request'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_AUTHORIZE_URL =
  import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/** 当前 cms-web 的回调地址（必须与统一账号中心里 cms 应用的 baseUrl 同 origin） */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/** 跳转统一账号中心签授权码 */
export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('cms_oauth_state', state)
    sessionStorage.setItem('cms_oauth_redirect', redirect)
  } catch { /* ignore */ }
  const url =
    `${SSO_AUTHORIZE_URL}/authorize?response_type=code` +
    `&client_id=cms&redirect_uri=${encodeURIComponent(callbackUrl())}` +
    `&state=${encodeURIComponent(state)}`
  window.location.replace(url)
}

export function consumeState(): string | null {
  try {
    const s = sessionStorage.getItem('cms_oauth_state')
    sessionStorage.removeItem('cms_oauth_state')
    return s
  } catch {
    return null
  }
}

export function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('cms_oauth_redirect') || '/'
    sessionStorage.removeItem('cms_oauth_redirect')
    return r
  } catch {
    return '/'
  }
}

/** OAuth2 授权码换 cms 令牌（appSecret 在 cms 后端） */
export function exchangeCode(code: string, redirectUri: string) {
  return request.post('/api/cms/sso/oauth/exchange', { code, redirectUri })
}

/**
 * 全局登出：作废中心会话，连带该会话下其它应用（settings/ehr/portal…）的令牌一起失效。
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
  return request.get<never, MeInfo>('/api/cms/me')
}

// ---------------- 内容管理 ----------------

export interface ArticleItem {
  id: number
  title: string
  summary?: string
  content?: string
  categoryId?: number | null
  categoryName?: string
  cover?: string
  status: number
  pinned?: number
  recommended?: number
  seoTitle?: string
  seoKeywords?: string
  seoDescription?: string
  publishAt?: string | null
  publishedAt?: string | null
  authorName?: string
  submitNote?: string
  auditNote?: string
  auditorName?: string
  auditAt?: string
  /** 审批中心实例ID（内容发布审批，status=6 时有值） */
  approvalInstanceId?: string | null
  /** 主标签ID（cms_tag 自增ID） */
  tagId?: number | null
  /** 标签名快照，多个用逗号分隔（历史多标签；新保存只有一个） */
  tag?: string
  versionCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface PageData<T> {
  list: T[]
  total: number
}

export function pageArticles(params: Record<string, unknown>) {
  return request.get<never, PageData<ArticleItem>>('/api/cms/articles', { params })
}

export function articleDetail(id: string | number) {
  return request.get<never, ArticleItem>(`/api/cms/articles/${id}`)
}

export function createArticle(data: Record<string, unknown>) {
  return request.post<never, ArticleItem>('/api/cms/articles', data)
}

export function updateArticle(id: string | number, data: Record<string, unknown>) {
  return request.put<never, ArticleItem>(`/api/cms/articles/${id}`, data)
}

export function submitArticle(id: string | number, note: string) {
  return request.post(`/api/cms/articles/${id}/submit`, { note })
}

/** 撤回审批中的稿件：退回草稿 */
export function withdrawArticle(id: string | number) {
  return request.post(`/api/cms/articles/${id}/withdraw`)
}

export function approveArticle(id: string | number, note: string) {
  return request.post(`/api/cms/articles/${id}/approve`, { note })
}

export function rejectArticle(id: string | number, note: string) {
  return request.post(`/api/cms/articles/${id}/reject`, { note })
}

export function publishArticle(id: string | number) {
  return request.post(`/api/cms/articles/${id}/publish`)
}

export function offlineArticle(id: string | number) {
  return request.post(`/api/cms/articles/${id}/offline`)
}

export function flagArticle(id: string | number, flag: 'pin' | 'recommend', on: boolean) {
  return request.patch(`/api/cms/articles/${id}/flag`, { flag, on })
}

export function recycleArticle(id: string | number) {
  return request.delete(`/api/cms/articles/${id}`)
}

export function restoreArticle(id: string | number) {
  return request.post(`/api/cms/articles/${id}/restore`)
}

export function deleteArticleForever(id: string | number) {
  return request.delete(`/api/cms/articles/${id}/forever`)
}

export interface VersionItem {
  id: number
  articleId: number
  title: string
  summary?: string
  content?: string
  remark: string
  operator?: string
  createdAt?: string
}

export function listVersions(id: string | number) {
  return request.get<never, VersionItem[]>(`/api/cms/articles/${id}/versions`)
}

export function rollbackVersion(id: string | number, versionId: number) {
  return request.post(`/api/cms/articles/${id}/rollback/${versionId}`)
}

// ---------------- 分类 / 标签 ----------------

export interface TaxonomyItem {
  id: number
  name: string
  sort?: number
  articleCount?: number
}

export function listCategories() {
  return request.get<never, TaxonomyItem[]>('/api/cms/categories')
}

export function createCategory(data: { name: string; sort?: number }) {
  return request.post('/api/cms/categories', data)
}

export function updateCategory(id: number, data: { name: string; sort?: number }) {
  return request.put(`/api/cms/categories/${id}`, data)
}

export function deleteCategory(id: number) {
  return request.delete(`/api/cms/categories/${id}`)
}

export function listTags(keyword?: string) {
  return request.get<never, TaxonomyItem[]>('/api/cms/tags', { params: { keyword } })
}

export function createTag(name: string) {
  return request.post('/api/cms/tags', { name })
}

export function renameTag(id: number, name: string) {
  return request.put(`/api/cms/tags/${id}`, { name })
}

export function deleteTag(id: number) {
  return request.delete(`/api/cms/tags/${id}`)
}

// ---------------- 媒体库 ----------------

export interface MediaItem {
  id: number
  originalName: string
  url: string
  contentType?: string
  size: number
  uploadedName?: string
  createdAt?: string
}

export function pageMedia(params: { keyword?: string; page: number; size: number }) {
  return request.get<never, PageData<MediaItem>>('/api/cms/media', { params })
}

export function uploadMedia(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<never, MediaItem>('/api/cms/media/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function deleteMedia(id: number) {
  return request.delete(`/api/cms/media/${id}`)
}

// ---------------- Banner ----------------

export interface BannerItem {
  id?: number
  title: string
  imageUrl: string
  linkUrl?: string
  sort?: number
  status?: number
  remark?: string
}

export function listBanners() {
  return request.get<never, BannerItem[]>('/api/cms/banners')
}

export function createBanner(data: BannerItem) {
  return request.post('/api/cms/banners', data)
}

export function updateBanner(id: number, data: BannerItem) {
  return request.put(`/api/cms/banners/${id}`, data)
}

export function deleteBanner(id: number) {
  return request.delete(`/api/cms/banners/${id}`)
}

// ---------------- 友情链接 ----------------

export interface FriendLinkItem {
  id?: number
  name: string
  url: string
  logo?: string
  description?: string
  sort?: number
  status?: number
}

export function listFriendLinks() {
  return request.get<never, FriendLinkItem[]>('/api/cms/friend-links')
}

export function createFriendLink(data: FriendLinkItem) {
  return request.post<never, FriendLinkItem>('/api/cms/friend-links', data)
}

export function updateFriendLink(id: number, data: FriendLinkItem) {
  return request.put<never, FriendLinkItem>(`/api/cms/friend-links/${id}`, data)
}

export function deleteFriendLink(id: number) {
  return request.delete(`/api/cms/friend-links/${id}`)
}

// ---------------- 门户布局 ----------------

export interface PortalLayoutItem {
  id?: number
  moduleKey: string
  moduleName: string
  enabled: number
  sort: number
  config?: string
}

export function fetchPortalLayout() {
  return request.get<never, PortalLayoutItem[]>('/api/cms/portal-layout')
}

export function savePortalLayout(items: PortalLayoutItem[]) {
  return request.put<never, PortalLayoutItem[]>('/api/cms/portal-layout', items)
}

// ---------------- 仪表盘 ----------------

export interface DashboardStats {
  total: number
  published: number
  pendingAudit: number
  draft: number
  recycled: number
  media: number
  banners: number
}

export function fetchDashboard() {
  return request.get<never, DashboardStats>('/api/cms/dashboard')
}
