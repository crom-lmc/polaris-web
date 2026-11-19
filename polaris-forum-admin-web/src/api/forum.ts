import request from './request'

export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'
export const FORUM_ORIGIN = import.meta.env.VITE_FORUM_ORIGIN || 'http://localhost:5182'

export function callbackUrl(): string {
  return `${window.location.origin}/admin/callback`
}

export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('forum_admin_oauth_state', state)
    sessionStorage.setItem('forum_admin_oauth_redirect', redirect)
  } catch {
    // 会话存储不可用时仍可由统一登录页完成授权
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: 'forum-admin',
    redirect_uri: callbackUrl(),
    scope: 'api',
    state
  })
  window.location.replace(`${SSO_AUTHORIZE_URL}/authorize?${params}`)
}

export function consumeState(): string | null {
  try {
    const state = sessionStorage.getItem('forum_admin_oauth_state')
    sessionStorage.removeItem('forum_admin_oauth_state')
    return state
  } catch {
    return null
  }
}

export function takeRedirect(): string {
  try {
    const redirect = sessionStorage.getItem('forum_admin_oauth_redirect') || '/'
    sessionStorage.removeItem('forum_admin_oauth_redirect')
    return redirect.startsWith('/') && !redirect.startsWith('/callback') ? redirect : '/'
  } catch {
    return '/'
  }
}

export interface TokenResult {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
}

export function exchangeCode(code: string, redirectUri: string) {
  return request.post<never, TokenResult>('/api/forum/sso/oauth/admin-exchange', { code, redirectUri })
}

export interface MeInfo {
  accountId: string
  username: string
  superAdmin: boolean
  appCode: string
  permissions: string[]
}

export function fetchMe() {
  return request.get<never, MeInfo>('/api/forum/me')
}

export function logoutSso(refreshToken?: string) {
  return request.post<never, void>('/api/auth/logout', { refreshToken })
}

export interface Board {
  key: string
  name: string
}

export interface AdminBoard extends Board {
  description: string
  color: string
  sortNo: number
  enabled: boolean
  count?: number
  tags?: AdminTag[]
  createdAt?: string
  updatedAt?: string
}

export interface AdminBoardInput {
  name: string
  description: string
  color: string
  sortNo: number
  enabled: boolean
}

export interface AdminTag {
  id: string
  boardKey: string
  name: string
  sortNo: number
  enabled: boolean
  count?: number
}

export interface AdminTagInput {
  board: string
  name: string
  sortNo: number
  enabled: boolean
}

export type ReportStatus = 'PENDING' | 'RESOLVED' | 'REJECTED'
export type ReportTargetType = 'thread' | 'comment'

export interface ForumReport {
  id: string
  reporterAccountId: string
  reporterName?: string
  targetType: ReportTargetType
  targetId: string
  threadId: string
  threadTitle?: string
  targetContent?: string
  reason: string
  detail?: string
  status: ReportStatus
  handlerAccountId?: string | null
  handlerName?: string
  handleResult?: string
  handledAt?: string | null
  createdAt: string
}

export interface SiteConfig {
  aboutContent: string
  footerText: string
}

export interface FriendLink {
  id: string
  name: string
  url: string
  sortNo: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface FriendLinkInput {
  name: string
  url: string
  sortNo: number
  enabled: boolean
}

export interface Author {
  name: string
}

export type ContentKind = 'feed' | 'topic' | 'question' | 'article'

export interface Thread {
  id: string
  board: string
  kind: ContentKind
  title: string
  excerpt: string
  author: Author
  createdAt: string
  pinned?: boolean
  solved?: boolean
  recommended?: boolean
  recommendedAt?: string | null
  deleted?: boolean
}

export interface ForumComment {
  id: string
  threadId: string
  author: Author
  content: string
  time: string
  deleted?: boolean
  createdAt?: string
}

export interface SensitiveWord {
  id: string
  word: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ExchangeRecord {
  id: string
  accountId: string
  username?: string
  giftName: string
  points: number
  status: 'PENDING_ISSUE' | 'SHIPPING' | 'ISSUED'
  trackingNo?: string
  createdAt: string
  issuedByName?: string
  issuedAt?: string
  issueRemark?: string
}

export type BadgeRuleType = 'TOTAL_POINTS' | 'THREAD_COUNT' | 'COMMENT_COUNT' | 'CHECKIN_DAYS' | 'LIKES_RECEIVED'
export type BadgeStatus = 'DRAFT' | 'PUBLISHED' | 'OFFLINE'

export interface Badge {
  id: string
  name: string
  description?: string
  icon?: string
  color: string
  sortNo: number
  ruleType: BadgeRuleType
  threshold: number
  status: BadgeStatus
  awardedCount?: number
  publishedAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface BadgeInput {
  name: string
  description: string
  icon: string
  color: string
  sortNo: number
  ruleType: BadgeRuleType
  threshold: number
}

export function fetchBoards() {
  return request.get<never, Board[]>('/api/forum/public/boards')
}

export function publicThreadUrl(id: string) {
  return `${FORUM_ORIGIN}/threads/${id}`
}

export function fetchAdminThreads(params: { kind?: string; board?: string; keyword?: string; deleted?: string } = {}) {
  return request.get<never, Thread[]>('/api/forum/admin/threads', { params })
}

export function updateAdminThread(id: string, data: { deleted?: boolean; pinned?: boolean; solved?: boolean; recommended?: boolean }) {
  return request.patch<never, Thread>(`/api/forum/admin/threads/${id}`, data)
}

export function fetchAdminReports(params: { status?: string; targetType?: string } = {}) {
  return request.get<never, ForumReport[]>('/api/forum/admin/reports', { params })
}

export function processAdminReport(id: string, data: { status: 'RESOLVED' | 'REJECTED'; remark: string }) {
  return request.post<never, ForumReport>(`/api/forum/admin/reports/${id}/process`, data)
}

export function fetchAdminBoards() {
  return request.get<never, AdminBoard[]>('/api/forum/admin/boards')
}

export function createAdminBoard(data: AdminBoardInput & { key: string }) {
  return request.post<never, AdminBoard>('/api/forum/admin/boards', data)
}

export function updateAdminBoard(key: string, data: Partial<AdminBoardInput>) {
  return request.patch<never, AdminBoard>(`/api/forum/admin/boards/${key}`, data)
}

export function fetchAdminTags(board?: string) {
  return request.get<never, AdminTag[]>('/api/forum/admin/tags', { params: { board: board || undefined } })
}

export function createAdminTag(data: AdminTagInput) {
  return request.post<never, AdminTag>('/api/forum/admin/tags', data)
}

export function updateAdminTag(id: string, data: { sortNo?: number; enabled?: boolean }) {
  return request.patch<never, AdminTag>(`/api/forum/admin/tags/${id}`, data)
}

export function fetchAdminSite() {
  return request.get<never, SiteConfig>('/api/forum/admin/site')
}

export function updateAdminSite(data: SiteConfig) {
  return request.patch<never, SiteConfig>('/api/forum/admin/site', data)
}

export function fetchAdminFriendLinks() {
  return request.get<never, FriendLink[]>('/api/forum/admin/friend-links')
}

export function createAdminFriendLink(data: FriendLinkInput) {
  return request.post<never, FriendLink>('/api/forum/admin/friend-links', data)
}

export function updateAdminFriendLink(id: string, data: Partial<FriendLinkInput>) {
  return request.patch<never, FriendLink>(`/api/forum/admin/friend-links/${id}`, data)
}

export function fetchAdminComments(params: { keyword?: string; deleted?: string } = {}) {
  return request.get<never, ForumComment[]>('/api/forum/admin/comments', { params })
}

export function updateAdminComment(id: string, deleted: boolean) {
  return request.patch<never, ForumComment>(`/api/forum/admin/comments/${id}`, { deleted })
}

export function fetchSensitiveWords() {
  return request.get<never, SensitiveWord[]>('/api/forum/admin/sensitive-words')
}

export function createSensitiveWord(word: string) {
  return request.post<never, SensitiveWord>('/api/forum/admin/sensitive-words', { word })
}

export function updateSensitiveWord(id: string, enabled: boolean) {
  return request.patch<never, void>(`/api/forum/admin/sensitive-words/${id}`, { enabled })
}

export function deleteSensitiveWord(id: string) {
  return request.delete<never, void>(`/api/forum/admin/sensitive-words/${id}`)
}

export function fetchAdminExchanges(status = '') {
  return request.get<never, ExchangeRecord[]>('/api/forum/admin/exchanges', { params: { status: status || undefined } })
}

export function shipExchange(id: string, trackingNo: string, remark: string) {
  return request.post<never, ExchangeRecord>(`/api/forum/admin/exchanges/${id}/ship`, { trackingNo, remark })
}

export function issueExchange(id: string, remark: string) {
  return request.post<never, ExchangeRecord>(`/api/forum/admin/exchanges/${id}/issue`, { remark })
}

export function fetchBadges(status = '') {
  return request.get<never, Badge[]>('/api/forum/admin/badges', { params: { status: status || undefined } })
}

export function createBadge(data: BadgeInput) {
  return request.post<never, Badge>('/api/forum/admin/badges', data)
}

export function updateBadge(id: string, data: BadgeInput) {
  return request.patch<never, Badge>(`/api/forum/admin/badges/${id}`, data)
}

export function publishBadge(id: string) {
  return request.post<never, Badge>(`/api/forum/admin/badges/${id}/publish`)
}

export function offlineBadge(id: string) {
  return request.post<never, Badge>(`/api/forum/admin/badges/${id}/offline`)
}

/** 当前账号可访问应用里指定编码的应用名（供布局标题用；取不到返回空串由调用方回退） */
export async function fetchAppName(appCode: string): Promise<string> {
  try {
    const apps = await request.get<never, Array<{ code: string; name: string }>>('/api/accounts/me/apps')
    return apps.find((a) => a.code === appCode)?.name || ''
  } catch {
    return ''
  }
}
