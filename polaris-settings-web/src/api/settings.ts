import request from './request'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_AUTHORIZE_URL = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/** 当前 settings-web 的回调地址（必须与统一账号中心里 settings 应用的 baseUrl 同 origin） */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/** 跳转统一账号中心签授权码 */
export function gotoAuthorize(redirect: string) {
  const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
  try {
    sessionStorage.setItem('settings_oauth_state', state)
    sessionStorage.setItem('settings_oauth_redirect', redirect)
  } catch {
    /* ignore */
  }
  const url =
    `${SSO_AUTHORIZE_URL}/authorize?response_type=code` +
    `&client_id=settings&redirect_uri=${encodeURIComponent(callbackUrl())}` +
    `&state=${encodeURIComponent(state)}`
  window.location.replace(url)
}

export function consumeState(): string | null {
  try {
    const s = sessionStorage.getItem('settings_oauth_state')
    sessionStorage.removeItem('settings_oauth_state')
    return s
  } catch {
    return null
  }
}

export function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('settings_oauth_redirect') || '/'
    sessionStorage.removeItem('settings_oauth_redirect')
    return r
  } catch {
    return '/'
  }
}

/** OAuth2 授权码换 settings 令牌（appSecret 在 settings 后端） */
export function exchangeCode(code: string, redirectUri: string) {
  return request.post('/api/settings/sso/oauth/exchange', { code, redirectUri })
}

/**
 * 全局登出：作废中心会话，连带该会话下其它应用（ehr/cms/portal…）的令牌一起失效。
 * <p>
 * 只清本地 localStorage 是不够的——HttpOnly cookie 还在，下一次 gotoAuthorize 会静默
 * 重登回来，用户会觉得「点了退出却没退」。
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
  return request.get<never, MeInfo>('/api/settings/me')
}

// ---------------- 字典管理 ----------------

export interface DictType {
  id: string
  code: string
  name: string
  appCode?: string | null
  remark?: string
  builtIn: number
  status: number
  itemCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface DictItem {
  id: string
  typeCode: string
  value: string
  label: string
  sort: number
  status: number
  remark?: string
  builtIn: number
  createdAt?: string
  updatedAt?: string
}

export interface DictTypeSaveBody {
  code?: string
  name: string
  appCode?: string | null
  remark?: string
  status?: number
}

export interface DictItemSaveBody {
  typeCode?: string
  value?: string
  label: string
  sort?: number
  status?: number
  remark?: string
}

export function listTypes(keyword?: string) {
  return request.get<never, DictType[]>('/api/settings/dicts/types', { params: { keyword } })
}

export function createType(body: DictTypeSaveBody) {
  return request.post<never, DictType>('/api/settings/dicts/types', body)
}

export function updateType(id: string, body: DictTypeSaveBody) {
  return request.patch<never, DictType>(`/api/settings/dicts/types/${id}`, body)
}

export function deleteType(id: string) {
  return request.delete(`/api/settings/dicts/types/${id}`)
}

export function listItems(typeCode: string, includeDisabled?: boolean) {
  return request.get<never, DictItem[]>('/api/settings/dicts/items', {
    params: { typeCode, includeDisabled: includeDisabled ? 'true' : undefined }
  })
}

export function createItem(body: DictItemSaveBody) {
  return request.post<never, DictItem>('/api/settings/dicts/items', body)
}

export function updateItem(id: string, body: DictItemSaveBody) {
  return request.patch<never, DictItem>(`/api/settings/dicts/items/${id}`, body)
}

export function deleteItem(id: string) {
  return request.delete(`/api/settings/dicts/items/${id}`)
}

// ---------------- 应用清单（归属应用下拉，读统一登录中心） ----------------

export interface AppOption {
  id: string
  code: string
  name: string
}

export function listApps() {
  return request.get<never, AppOption[]>('/api/settings/apps')
}

// ---------------- 业务主数据（银行/学历/职位等，独立真表） ----------------

/** 主数据类别（固定六类，后端注册表决定） */
export interface BizCategory {
  type: string
  name: string
  remark?: string
  itemCount?: number
}

export interface BizItem {
  id: string
  type: string
  code: string
  name: string
  sort: number
  status: number
  remark?: string
  builtIn: number
  /** 职位类别（管理类 / 技术类），仅 position 类型有值，其余为 undefined */
  category?: string
  /** 职务族编码（DEV / TEST / ACC / MGMT …），同族 = 一条晋升通道 */
  jobFamily?: string
  /** 职务族展示名（开发工程师 / 会计 / 招聘专员 …） */
  jobFamilyName?: string
  /** M 管理序列 / P 专业序列 */
  series?: string
  /** 等级序号：P 1 助理 2 初级 3 中级 4 高级 5 资深；M 1 经理 2 总监 3 高管 */
  levelNo?: number
  /** 等级展示名 */
  levelName?: string
}

export interface BizItemSaveBody {
  code?: string
  name: string
  sort?: number
  status?: number
  remark?: string
  /** 职位类别（管理类 / 技术类），仅 position 类型使用，其余类型忽略 */
  category?: string
}

export function listBizCategories() {
  return request.get<never, BizCategory[]>('/api/settings/biz/categories')
}

export function listBizItems(type: string, includeDisabled?: boolean) {
  return request.get<never, BizItem[]>(`/api/settings/biz/${type}/items`, {
    params: { includeDisabled: includeDisabled ? 'true' : undefined }
  })
}

export function createBizItem(type: string, body: BizItemSaveBody) {
  return request.post<never, BizItem>(`/api/settings/biz/${type}/items`, body)
}

export function updateBizItem(type: string, id: string, body: BizItemSaveBody) {
  return request.patch<never, BizItem>(`/api/settings/biz/${type}/items/${id}`, body)
}

export function deleteBizItem(type: string, id: string) {
  return request.delete(`/api/settings/biz/${type}/items/${id}`)
}
