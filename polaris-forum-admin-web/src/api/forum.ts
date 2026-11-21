import request from './request'

/** 统一账号中心 /authorize 入口：本地各应用分端口需回退本地 sso-web，线上用正式域名，不回退 localhost */
export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN ||
  (import.meta.env.DEV ? 'http://localhost:5173' : 'https://polaris-sso.laimengchao.site')
/** 论坛前台地址：与管理端同站不同路径（前台挂在独立域根路径 /），线上不回退 localhost */
export const FORUM_ORIGIN = import.meta.env.VITE_FORUM_ORIGIN ||
  (import.meta.env.DEV ? 'http://localhost:5182' : 'https://polaris-forum.laimengchao.site')

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
  parentKey: string
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
  parentKey: string
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

/** 功能开关（抽奖/兑换），来自配置中心埋点 */
export interface FeatureFlags {
  lotteryEnabled: boolean
  exchangeEnabled: boolean
}

export interface Banner {
  id: string
  title: string
  imageUrl: string | null
  linkUrl: string
  sortNo: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface BannerInput {
  title?: string
  imageAttachmentId?: string
  linkUrl?: string
  sortNo?: number
  enabled?: boolean
}

export interface UploadedImage {
  id: string
  originalName: string
  mimeType: string
  size: number
  usageType: string
  url: string
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
  likes?: number
  views?: number
  replies?: number
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

export interface SensitiveWordPage {
  records: SensitiveWord[]
  total: number
  page: number
  size: number
}

export interface ExchangeRecord {
  id: string
  accountId: string
  username?: string
  giftName: string
  points: number
  /** EXCHANGE 积分兑换、LOTTERY 抽奖中奖 */
  source?: 'EXCHANGE' | 'LOTTERY'
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

export type LevelInput = {
  levelNo: number
  name: string
  minExperience: number
  color: string
  icon: string
  description: string
  privileges: string
  sortNo: number
  enabled: boolean
}

export interface Level extends LevelInput {
  id: string
  /** 系统内置等级，不可删除 */
  builtin?: boolean
}

export function fetchAdminLevels() {
  return request.get<never, Level[]>('/api/forum/admin/levels')
}

export function createAdminLevel(data: LevelInput) {
  return request.post<never, Level>('/api/forum/admin/levels', data)
}

export function updateAdminLevel(id: string, data: LevelInput) {
  return request.patch<never, Level>(`/api/forum/admin/levels/${id}`, data)
}

export function deleteAdminLevel(id: string) {
  return request.delete<never, void>(`/api/forum/admin/levels/${id}`)
}

/* 经验获取规则 */
export type ExperienceRuleInput = {
  ruleKey: string
  name: string
  experience: number
  sortNo: number
  enabled: boolean
}

export interface ExperienceRule extends ExperienceRuleInput {
  id: string
}

export function fetchAdminExperienceRules() {
  return request.get<never, ExperienceRule[]>('/api/forum/admin/experience-rules')
}

export function createAdminExperienceRule(data: ExperienceRuleInput) {
  return request.post<never, ExperienceRule>('/api/forum/admin/experience-rules', data)
}

export function updateAdminExperienceRule(id: string, data: ExperienceRuleInput) {
  return request.patch<never, ExperienceRule>(`/api/forum/admin/experience-rules/${id}`, data)
}

export function deleteAdminExperienceRule(id: string) {
  return request.delete<never, void>(`/api/forum/admin/experience-rules/${id}`)
}

export type LotteryMode = 'SQUARE' | 'WHEEL'

export type LotteryPrizeType = 'POINTS' | 'GIFT'

/* 礼品管理 */
export interface Gift {
  id: string
  name: string
  category: string
  description: string
  points: number
  stock: number
  icon: string
  imageUrl?: string
  minLevel?: number
  status?: number
}

export interface GiftInput {
  name: string
  category: string
  description: string
  points: number
  stock: number
  icon: string
  imageUrl?: string
  minLevel?: number
  status?: number
}

export function fetchAdminGifts() {
  return request.get<never, Gift[]>('/api/forum/admin/gifts')
}

export function createAdminGift(data: GiftInput) {
  return request.post<never, Gift>('/api/forum/admin/gifts', data)
}

export function updateAdminGift(id: string, data: Partial<GiftInput>) {
  return request.patch<never, Gift>(`/api/forum/admin/gifts/${id}`, data)
}

export interface LotteryGift {
  id: string
  name: string
  category: string
  points: number
  stock: number
  icon?: string
  imageUrl?: string
  status?: number
}

export interface LotteryPrize {
  id: string
  key: string
  prizeType: LotteryPrizeType
  giftId?: string
  giftName?: string
  giftImageUrl?: string
  giftPoints?: number
  giftStock?: number
  name: string
  points: number
  color: string
  weight: number
  sortNo: number
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface LotteryConfig {
  mode: LotteryMode
  lotteryCost: number
  dailyLimit: number
  maxPrizes: number
  weightTotal: number
  prizes: LotteryPrize[]
  /** 上架礼品，供奖项选择 */
  gifts: LotteryGift[]
}

export interface LotteryPrizeInput {
  key: string
  name: string
  points: number
  color: string
  weight: number
  sortNo: number
  enabled: boolean
  prizeType?: LotteryPrizeType
  giftId?: string
}

export function fetchBoards() {
  return request.get<never, Board[]>('/api/forum/public/boards')
}

export function publicThreadUrl(id: string) {
  return `${FORUM_ORIGIN}/threads/${id}`
}

export interface AdminThreadPage {
  records: Thread[]
  total: number
  page: number
  size: number
}

export function fetchAdminThreads(params: { kind?: string; board?: string; keyword?: string; deleted?: string } = {}) {
  return request.get<never, Thread[]>('/api/forum/admin/threads', { params })
}

/** 内容分页查询，size 上限 50；管理端列表用此接口替代全量 threads。 */
export function fetchAdminThreadsPage(params: { kind?: string; board?: string; keyword?: string; deleted?: string; page?: number; size?: number } = {}) {
  return request.get<never, AdminThreadPage>('/api/forum/admin/threads/page', { params })
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

/** 论坛功能开关（抽奖/兑换），来自配置中心埋点，供各配置页判断是否置灰 */
export function fetchFeatureFlags() {
  return request.get<never, FeatureFlags>('/api/forum/public/features')
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

export function fetchAdminBanners() {
  return request.get<never, Banner[]>('/api/forum/admin/banners')
}

export function createAdminBanner(data: BannerInput) {
  return request.post<never, Banner>('/api/forum/admin/banners', data)
}

export function updateAdminBanner(id: string, data: BannerInput) {
  return request.patch<never, Banner>(`/api/forum/admin/banners/${id}`, data)
}

/** 上传轮播图片（走论坛附件，COVER 用途仅允许图片、上限 10MB） */
export function uploadBannerImage(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<never, UploadedImage>('/api/forum/admin/banner-images', form)
}

export interface AdminCommentPage {
  records: ForumComment[]
  total: number
  page: number
  size: number
}

export function fetchAdminComments(params: { keyword?: string; deleted?: string } = {}) {
  return request.get<never, ForumComment[]>('/api/forum/admin/comments', { params })
}

/** 评论分页查询，size 上限 50；管理端列表用此接口替代全量 comments。 */
export function fetchAdminCommentsPage(params: { keyword?: string; deleted?: string; page?: number; size?: number } = {}) {
  return request.get<never, AdminCommentPage>('/api/forum/admin/comments/page', { params })
}

export function updateAdminComment(id: string, deleted: boolean) {
  return request.patch<never, ForumComment>(`/api/forum/admin/comments/${id}`, { deleted })
}

export function fetchSensitiveWords() {
  return request.get<never, SensitiveWord[]>('/api/forum/admin/sensitive-words')
}

/** 敏感词分页查询，size 上限 50；管理端列表用此接口替代全量 sensitive-words。 */
export function fetchSensitiveWordsPage(params: { page?: number; size?: number } = {}) {
  return request.get<never, SensitiveWordPage>('/api/forum/admin/sensitive-words/page', { params })
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

export function fetchLotteryConfig() {
  return request.get<never, LotteryConfig>('/api/forum/admin/lottery')
}

export function updateLotteryConfig(data: { mode?: LotteryMode; lotteryCost?: number; dailyLimit?: number }) {
  return request.patch<never, LotteryConfig>('/api/forum/admin/lottery/config', data)
}

export function createLotteryPrize(data: LotteryPrizeInput) {
  return request.post<never, LotteryPrize>('/api/forum/admin/lottery/prizes', data)
}

export function updateLotteryPrize(id: string, data: Partial<LotteryPrizeInput>) {
  return request.patch<never, LotteryPrize>(`/api/forum/admin/lottery/prizes/${id}`, data)
}

export function deleteLotteryPrize(id: string) {
  return request.delete<never, void>(`/api/forum/admin/lottery/prizes/${id}`)
}

export function normalizeLotteryWeights() {
  return request.post<never, LotteryConfig>('/api/forum/admin/lottery/prizes/normalize')
}

/** 字典下拉项（配置中心 public 只读字典） */
export interface DictOption {
  value: string
  label: string
}

/** 拉取礼品分类字典（forum.gift_category）；失败回退空数组，由页面提示 */
export function fetchGiftCategories(): Promise<DictOption[]> {
  return request.get<never, DictOption[]>('/api/settings/public/dicts/forum.gift_category')
}

/** 按应用编码查询 SSO 登记的应用名（公开只读，供浏览器标签与布局标题用；取不到返回空串） */
export async function fetchAppName(appCode: string): Promise<string> {
  try {
    const info = await request.get<never, { code: string; name: string }>(
      `/api/applications/public/${encodeURIComponent(appCode)}`
    )
    return info?.name || ''
  } catch {
    return ''
  }
}

/* ---------------- 北极星核·论坛概览 ---------------- */

/** 概览分布项（板块/等级）：名称 + 数量 */
export interface OverviewDistribution {
  name: string
  value: number
}

/** 概览趋势项：按日期的新增帖子/评论 */
export interface OverviewTrend {
  date: string
  threads: number
  comments: number
}

/** 论坛概览聚合数据：规模数字 + 图表数据 */
export interface ForumOverview {
  threadCount: number
  commentCount: number
  memberCount: number
  likeCount: number
  viewCount: number
  pendingReportCount: number
  boardCount: number
  tagCount: number
  todayThreadCount: number
  monthThreadCount: number
  sensitiveWordCount: number
  badgeAwardCount: number
  contentTrend: OverviewTrend[]
  boardDistribution: OverviewDistribution[]
  levelDistribution: OverviewDistribution[]
}

/** 拉取论坛管理端概览统计（登录即可看，无需权限码） */
export function fetchForumOverview() {
  return request.get<never, ForumOverview>('/api/forum/admin/overview')
}
