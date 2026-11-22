import request from './request'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/** 本应用回调地址（须与统一账号中心 openapi 应用的 baseUrl 同 origin） */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/** 跳转统一账号中心签授权码（client_id=openapi） */
export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('openapi_oauth_state', state)
    sessionStorage.setItem('openapi_oauth_redirect', redirect)
  } catch { /* ignore */ }
  const url =
    `${SSO_AUTHORIZE_URL}/authorize?response_type=code` +
    `&client_id=openapi&redirect_uri=${encodeURIComponent(callbackUrl())}` +
    `&state=${encodeURIComponent(state)}`
  window.location.replace(url)
}

export function consumeState(): string | null {
  try {
    const s = sessionStorage.getItem('openapi_oauth_state')
    sessionStorage.removeItem('openapi_oauth_state')
    return s
  } catch { return null }
}

export function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('openapi_oauth_redirect') || '/'
    sessionStorage.removeItem('openapi_oauth_redirect')
    return r
  } catch { return '/' }
}

/** OAuth2 授权码换 openapi 用户令牌（appSecret 在 openapi 后端） */
export function exchangeCode(code: string, redirectUri: string) {
  return request.post('/api/open/sso/oauth/exchange', { code, redirectUri })
}

/** 全局登出 */
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
  return request.get<never, MeInfo>('/api/open/admin/me')
}

// ---------------- API 管理（endpoint） ----------------
export interface ApiEndpoint {
  id?: string
  apiCode: string
  apiName: string
  direction: number
  operationType?: string
  appCode: string
  method: string
  path: string
  targetUrl?: string
  authType: string
  requiredPerm: string
  rateLimitPerMin: number
  timeoutMs: number
  retryMax: number
  idempotent?: number
  maskRules?: string
  remark?: string
  status: number
}
export const listEndpoints = () => request.get<never, ApiEndpoint[]>('/api/open/admin/endpoint/list')
export const saveEndpoint = (data: ApiEndpoint) => request.post<never, void>('/api/open/admin/endpoint/save', data)
export const toggleEndpoint = (apiCode: string, status: number) =>
  request.post<never, void>(`/api/open/admin/endpoint/${encodeURIComponent(apiCode)}/toggle`, null, { params: { status } })
export const deleteEndpoint = (apiCode: string) =>
  request.delete<never, void>(`/api/open/admin/endpoint/${encodeURIComponent(apiCode)}`)

// ---------------- 对接应用（app） ----------------
export interface AppInfo { code: string; name: string; status?: number; remark?: string }
export const listApps = () => request.get<never, AppInfo[]>('/api/open/admin/app/list')

/** 第三方应用被授权调用的接口清单项 */
export interface AppEndpoint {
  apiCode: string
  apiName: string
  direction: number
  directionLabel: string
  directionFlow: string
  operationType?: string
  method: string
  path: string
  appCode: string
  requiredPerm: string
  status: number
}
export const listAppEndpoints = (appCode: string) =>
  request.get<never, AppEndpoint[]>(`/api/open/admin/app/${encodeURIComponent(appCode)}/endpoints`)

// ---------------- 出站渠道（channel） ----------------
export interface Channel {
  channelCode: string
  channelName: string
  baseUrl?: string
  authType: string
  authConfig?: string
  timeoutMs: number
  retryMax: number
  allowedApps?: string
  status: number
  remark?: string
  credentialConfigured?: boolean
}
export const listChannels = () => request.get<never, Channel[]>('/api/open/admin/channel/list')
export const saveChannel = (data: Channel) => request.post<never, void>('/api/open/admin/channel/save', data)
export const saveCredential = (channelCode: string, credential: Record<string, string>) =>
  request.post<never, void>(`/api/open/admin/channel/${channelCode}/credential`, { credential })
export const toggleChannel = (channelCode: string, status: number) =>
  request.post<never, void>(`/api/open/admin/channel/${channelCode}/toggle`, null, { params: { status } })
export const deleteChannel = (channelCode: string) =>
  request.delete<never, void>(`/api/open/admin/channel/${channelCode}`)
export const credentialFields = (channelCode: string) =>
  request.get<never, Record<string, string>>(`/api/open/admin/channel/${channelCode}/credential-fields`)

// ---------------- 调用日志（log） ----------------
export interface LogQuery {
  direction?: string
  appCode?: string
  apiCode?: string
  channel?: string
  from?: string
  to?: string
  onlyFailed?: boolean
  page?: number
  size?: number
}
export interface CallLog {
  id: string
  traceId: string
  direction: string
  appCode: string
  apiCode: string
  channel: string
  httpMethod: string
  requestPath: string
  reqMasked?: string
  respMasked?: string
  httpStatus: number
  bizCode: string
  costMs: number
  clientIp: string
  errorMsg?: string
  createdAt: string
}
export const listLogs = (params: LogQuery) =>
  request.get<never, { records: CallLog[]; total: number; current: number; size: number }>('/api/open/admin/log/list', { params })
export const logDetail = (id: string) => request.get<never, CallLog>('/api/open/admin/log/detail', { params: { id } })
export function exportLogs(params: LogQuery) {
  return request.get('/api/open/admin/log/export', { params, responseType: 'blob' })
}

// ---------------- 统计（stat） ----------------
export interface StatQuery { direction?: string; appCode?: string; apiCode?: string; from?: string; to?: string }
export interface RecentError {
  traceId: string; direction: string; appCode: string; apiCode: string
  channel: string; httpStatus: number; bizCode: string; costMs: number
  errorMsg?: string; createdAt: string
}
export interface RankRow {
  appCode?: string; apiCode?: string; total: number; success: number
  failed: number; avgCost: number
}
export interface CostDistribution {
  lt100: number; b100_500: number; b500_1000: number; b1000_3000: number; gte3000: number
}
export const getOverview = (params: StatQuery) =>
  request.get<never, {
    total: number; success: number; failed: number; successRate: number
    avgCostMs: number; p95CostMs: number; appCount: number
    topFailed: { apiCode: string; failed: number }[]
    trend: { day: string; total: number; failed: number }[]
    recentErrors: RecentError[]
    topApps: RankRow[]
    topApis: RankRow[]
    costDistribution: CostDistribution
  }>('/api/open/admin/stat/overview', { params })

// ---------------- 平台设置（setting） ----------------
export interface Setting { id?: string; settingKey: string; settingValue?: string; remark?: string }
export const listSettings = () => request.get<never, Setting[]>('/api/open/admin/setting/list')
export const saveSetting = (key: string, value: string, remark?: string) =>
  request.post<never, void>('/api/open/admin/setting/save', { key, value, remark })
