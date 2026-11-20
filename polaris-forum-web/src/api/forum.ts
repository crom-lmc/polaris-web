import { del, get, patch, post, put, upload } from './request'
import type { Badge, Banner, Board, ContentKind, ExchangeRecord, ExperienceRule, FeatureFlags, ForumAttachment, ForumComment, ForumDraft, ForumLevel, ForumNotification, ForumTag, Gift, LevelRoute, Member, MemberRelation, NotificationType, PointLog, PollInput, Prize, ReportInput, SiteConfig, Thread } from '@/types'

export interface TokenResult {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
}

export interface MeInfo {
  accountId: string
  username: string
  superAdmin: boolean
  appCode: string
  permissions: string[]
  member: Member
}

export interface RewardConfig {
  mode: 'SQUARE' | 'WHEEL'
  prizes: Prize[]
  gifts: Gift[]
  lotteryCost: number
  dailyLotteryLimit: number
}

export interface PointsSummary {
  member: Member
  logs: PointLog[]
  checkedIn: boolean
  checkinDays: number
  lotteryRemaining: number
}

export interface DrawResult {
  index: number
  prize: Prize
  balance: number
  remaining: number
}

export function exchangeCode(code: string, redirectUri: string) {
  return post<TokenResult>('/api/forum/sso/oauth/exchange', { code, redirectUri })
}

export function fetchMe() {
  return get<MeInfo>('/api/forum/me')
}

/** 按应用编码查询 SSO 登记的应用名（公开只读，供浏览器标签标题用；取不到返回空串） */
export async function fetchAppName(appCode: string): Promise<string> {
  try {
    const info = await get<{ code: string; name: string }>(
      `/api/applications/public/${encodeURIComponent(appCode)}`
    )
    return info?.name || ''
  } catch {
    return ''
  }
}

export function fetchBoards() {
  return get<Board[]>('/api/forum/public/boards')
}

export function fetchTags(board: string) {
  return get<ForumTag[]>(`/api/forum/public/tags?board=${encodeURIComponent(board)}`)
}

export function fetchSite() {
  return get<SiteConfig>('/api/forum/public/site')
}

/** 功能开关（抽奖/兑换），来自配置中心埋点 */
export function fetchFeatureFlags() {
  return get<FeatureFlags>('/api/forum/public/features')
}

export function fetchBanners() {
  return get<Banner[]>('/api/forum/public/banners')
}

export function fetchThreads(params: { kind?: string; board?: string; q?: string; sort?: string } = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value) })
  return get<Thread[]>(`/api/forum/public/threads${query.size ? `?${query}` : ''}`)
}

export interface ThreadPage {
  records: Thread[]
  total: number
  page: number
  size: number
}

/** 服务端分页列表：每页只取当前页摘要（不含正文），避免全量请求拖慢渲染。 */
export function fetchThreadsPage(params: { kind?: string; board?: string; q?: string; sort?: string; page?: number; size?: number } = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') query.set(key, String(value)) })
  return get<ThreadPage>(`/api/forum/public/threads/page${query.size ? `?${query}` : ''}`)
}

export function fetchThread(id: string) {
  return get<Thread>(`/api/forum/public/threads/${id}`)
}

export function fetchComments(id: string) {
  return get<ForumComment[]>(`/api/forum/public/threads/${id}/comments`)
}

export interface ThreadInput {
  kind: string
  board: string
  title: string
  content: string
  tags: string[]
  reward: number
  attachmentIds: string[]
  coverAttachmentId?: string
  poll?: PollInput
}

export function createThread(data: ThreadInput) {
  return post<Thread>('/api/forum/threads', data)
}

export function createComment(threadId: string, content: string, parentCommentId?: string) {
  return post<ForumComment>(`/api/forum/threads/${threadId}/comments`, { content, parentCommentId })
}

export function toggleLike(targetType: 'thread' | 'comment', targetId: string) {
  return post<{ liked: boolean; likes: number }>('/api/forum/likes/toggle', { targetType, targetId })
}

export function fetchPointsSummary() {
  return get<PointsSummary>('/api/forum/points/summary')
}

export function checkin() {
  return post<PointsSummary>('/api/forum/points/checkin')
}

export function fetchRewardConfig() {
  return get<RewardConfig>('/api/forum/public/rewards')
}

export function drawLottery() {
  return post<DrawResult>('/api/forum/lottery/draw')
}

export function exchangeGift(id: string) {
  return post<{ exchangeId: string; balance: number; giftName: string }>(`/api/forum/gifts/${id}/exchange`)
}

export function uploadAttachment(file: File, usageType: 'ATTACHMENT' | 'COVER' | 'AVATAR' | 'PROFILE_COVER' = 'ATTACHMENT') {
  return upload<ForumAttachment>('/api/forum/attachments', file, usageType)
}

export function fetchDrafts() {
  return get<ForumDraft[]>('/api/forum/drafts')
}

export function fetchDraft(id: string) {
  return get<ForumDraft>(`/api/forum/drafts/${id}`)
}

export function createDraft(data: ThreadInput) {
  return post<ForumDraft>('/api/forum/drafts', data)
}

export function updateDraft(id: string, data: ThreadInput) {
  return put<ForumDraft>(`/api/forum/drafts/${id}`, data)
}

export function deleteDraft(id: string) {
  return del<void>(`/api/forum/drafts/${id}`)
}

export function publishDraft(id: string) {
  return post<Thread>(`/api/forum/drafts/${id}/publish`)
}

export function vote(threadId: string, optionIds: string[]) {
  return post<Thread>(`/api/forum/threads/${threadId}/votes`, { optionIds })
}

export function fetchMyExchanges() {
  return get<ExchangeRecord[]>('/api/forum/exchanges')
}

export function fetchMember(accountId: string) {
  return get<Member>(`/api/forum/public/members/${accountId}`)
}

export function fetchMemberThreads(accountId: string, kind: ContentKind | '' = '') {
  return get<Thread[]>(`/api/forum/public/members/${accountId}/threads${kind ? `?kind=${kind}` : ''}`)
}

export function fetchMemberRelations(accountId: string, type: 'followers' | 'following') {
  return get<MemberRelation[]>(`/api/forum/public/members/${accountId}/relations?type=${type}`)
}

export function followMember(accountId: string) {
  return post<{ following: boolean }>(`/api/forum/members/${accountId}/follow`)
}

export function unfollowMember(accountId: string) {
  return del<{ following: boolean }>(`/api/forum/members/${accountId}/follow`)
}

export function createReport(data: ReportInput) {
  return post<Record<string, unknown>>('/api/forum/reports', data)
}

export function fetchPointsRanking(limit = 10) {
  return get<Member[]>(`/api/forum/public/ranking/points?limit=${limit}`)
}

/** 等级排行：按累计经验降序（经验决定等级） */
export function fetchLevelRanking(limit = 10) {
  return get<Member[]>(`/api/forum/public/ranking/level?limit=${limit}`)
}

export function fetchPublicBadges() {
  return get<Badge[]>('/api/forum/public/badges')
}

/** 社区等级晋升路线（含登录用户当前进度） */
export function fetchLevelRoute() {
  return get<LevelRoute>('/api/forum/public/levels')
}

/** 社区等级定义列表 */
export function fetchLevels() {
  return get<ForumLevel[]>('/api/forum/public/levels/definitions')
}

/** 经验获取规则（发帖/回复各加多少经验） */
export function fetchExperienceRules() {
  return get<ExperienceRule[]>('/api/forum/public/experience-rules')
}

export function fetchProfile() {
  return get<Member>('/api/forum/profile')
}

export interface ProfileInput {
  nickname: string
  bio: string
  location: string
  website: string
  avatarAttachmentId?: string | null
  coverAttachmentId?: string | null
}

export function updateProfile(data: ProfileInput) {
  return put<Member>('/api/forum/profile', data)
}

export function favoriteThread(id: string) {
  return post<void>(`/api/forum/threads/${id}/favorite`)
}

export function unfavoriteThread(id: string) {
  return del<void>(`/api/forum/threads/${id}/favorite`)
}

export function fetchFavorites() {
  return get<Thread[]>('/api/forum/favorites')
}

export function fetchMyBadges() {
  return get<Badge[]>('/api/forum/badges')
}

export function fetchNotifications(params: { type?: NotificationType | ''; unread?: boolean } = {}) {
  const query = new URLSearchParams()
  if (params.type) query.set('type', params.type)
  if (params.unread) query.set('unread', 'true')
  return get<ForumNotification[]>(`/api/forum/notifications${query.size ? `?${query}` : ''}`)
}

export function fetchUnreadCount() {
  return get<{ count: number }>('/api/forum/notifications/unread-count')
}

/** 按类型分组的未读消息数（key 为通知类型，ALL 为合计），供分类角标展示。 */
export function fetchUnreadCounts() {
  return get<Record<string, number>>('/api/forum/notifications/unread-counts')
}

export function markNotificationRead(id: string) {
  return patch<void>(`/api/forum/notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return post<void>('/api/forum/notifications/read-all')
}

export function logoutSso(refreshToken?: string) {
  return post<void>('/api/auth/logout', { refreshToken })
}
