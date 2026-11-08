import axios from 'axios'

/**
 * 账号中心（sso-auth）的接口封装。
 * <p>
 * 与业务请求分开：业务走 `/api/blog/**`（需 Bearer），这里走 `/api/auth/**`，
 * 其中若干接口靠 HttpOnly 的中心会话 cookie 识别身份，因此必须 `withCredentials`。
 * 两者用不同的 axios 实例，避免 baseURL 互相污染。
 */
const ssoHttp = axios.create({
  timeout: 15000,
  withCredentials: true
})

/** 统一响应体外壳 */
interface R<T> {
  code: number
  message: string
  data: T
}

ssoHttp.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 在登录流程里是「正常结果」（还没登录），不在这里弹提示
    return Promise.reject(err)
  }
)

function unwrap<T>(res: { data: R<T> }): T {
  const body = res.data
  if (body && typeof body.code === 'number' && body.code !== 0) {
    const e = new Error(body.message || '请求失败') as Error & { code?: number }
    e.code = body.code
    throw e
  }
  return body.data
}

export interface SsoUser {
  accountId: string
  username: string
  nickname?: string
  superAdmin: boolean
  /** 按钮级权限码（blog 应用域内） */
  permissions: string[]
  /** 可访问的应用编码 */
  apps: string[]
}

export interface TokenPair {
  accessToken: string
  refreshToken?: string
  tokenType?: string
  expiresIn?: number
  user?: SsoUser
}

/** 当前身份（需要 Bearer） */
export async function fetchMe(token: string): Promise<SsoUser> {
  const res = await ssoHttp.get<R<SsoUser>>('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return unwrap(res)
}

/** 中心会话是否存在（靠 cookie；401 属正常探测，调用方自行 catch） */
export async function probeSession(): Promise<boolean> {
  try {
    const res = await ssoHttp.get<R<unknown>>('/api/auth/session')
    return res.status === 200 && res.data?.code === 0
  } catch {
    return false
  }
}

/** 申请一次性票据：已登录中心会话才发得出来 */
export async function issueTicket(appCode: string, redirect: string): Promise<string> {
  const res = await ssoHttp.post<R<{ ticket: string; redirectTo: string }>>('/api/auth/ticket', {
    appCode,
    redirect
  })
  const data = unwrap(res)
  // 优先用后端算好的跳转地址（它已经做过同 origin 校验）
  if (data.redirectTo) {
    window.location.replace(data.redirectTo)
    return data.ticket
  }
  return data.ticket
}

/** 用 ticket 换博客作用域令牌（应用密钥在后端，前端不经手）。旧流程，保留兼容 */
export async function exchangeTicket(ticket: string): Promise<TokenPair> {
  const res = await ssoHttp.post<R<TokenPair>>('/api/blog/sso/exchange', { ticket })
  return unwrap(res)
}

/** OAuth2 授权码换博客作用域令牌（A 档）：appSecret 在后端，前端只经手一次性 code */
export async function exchangeCode(code: string, redirectUri: string): Promise<TokenPair> {
  const res = await ssoHttp.post<R<TokenPair>>('/api/blog/sso/oauth/exchange', { code, redirectUri })
  return unwrap(res)
}

/** 退出：作废中心会话（失败不阻塞本地清理） */
export async function ssoLogout(): Promise<void> {
  try {
    await ssoHttp.post('/api/auth/logout')
  } catch {
    /* 已过期等情况忽略 */
  }
}

/** 账号中心地址（本地 5173 / 线上 sso.laimengchao.site） */
export function ssoOrigin(): string {
  return (import.meta.env.VITE_SSO_ORIGIN as string) || 'http://localhost:5173'
}

/** 应用编码：与 sso_application.code 一致 */
export const APP_CODE = 'blog'

/** 本应用接收 ticket/code 的回跳地址（必须与应用的 baseUrl 同 origin） */
export function callbackUrl(): string {
  return `${window.location.origin}${window.location.pathname}#/sso/callback`
}

const STATE_KEY = 'sso_oauth_state'

/** 生成并记住 state（CSRF 防护：回调时必须与发起时一致） */
function nextState(): string {
  const s = crypto.randomUUID().replace(/-/g, '')
  try {
    sessionStorage.setItem(STATE_KEY, s)
  } catch {
    /* 隐私模式等场景允许失败，回调侧降级为跳过校验 */
  }
  return s
}

/**
 * OAuth2 标准授权码入口（A 档）：
 * 跳账号中心 /authorize（client_id=blog），已登录则静默签码回跳，
 * 未登录由账号中心转到登录页、登录后继续授权。
 */
export function buildAuthorizeUrl(): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: APP_CODE,
    redirect_uri: callbackUrl(),
    scope: 'api',
    state: nextState()
  })
  return `${ssoOrigin()}/authorize?${params.toString()}`
}

/** 拼统一登录页地址；redirect 指向 /authorize（登录后继续授权流程），gl=1 同旧语义 */
export function buildLoginUrl(opts?: { globalLogout?: boolean }): string {
  let url = `${ssoOrigin()}/login?redirect=${encodeURIComponent(buildAuthorizeUrl())}`
  if (opts?.globalLogout) url += '&gl=1'
  return url
}

/** 回调页校验 state；发起侧记录丢失时降级放行（新开标签等场景），对得上才严格通过 */
export function checkOAuthState(state: string | null): boolean {
  let expected: string | null = null
  try {
    expected = sessionStorage.getItem(STATE_KEY)
  } catch {
    return true
  }
  if (!expected) {
    return true
  }
  return !!state && state === expected
}

/** 跳统一登录页（用于 401 等「需要重新拿令牌」场景，不强制清 IDP 会话） */
export function redirectToSsoLogin() {
  window.location.replace(buildLoginUrl())
}

/** 主动退出：强制账号中心也登出本地会话，落地后必须重新输密码 */
export function redirectToSsoLogout() {
  window.location.replace(buildLoginUrl({ globalLogout: true }))
}
