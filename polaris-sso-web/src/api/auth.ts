import request from './request'
import type { AuthUser, SessionInfo, TicketResponse, TokenResponse } from '@/types'

/**
 * 认证接口。
 *
 * 说明：request 的响应拦截器已把 {code,message,data} 外壳脱掉，
 * 第二个泛型统一写成 { data: T } —— 调用方用 res.data 取到的就是 T 本体。
 */
export function login(data: { username: string; password: string }) {
  return request.post<never, { data: TokenResponse }>('/api/auth/login', data)
}

export function sendEmailCode(data: { email: string }) {
  return request.post<never, { data: void }>('/api/auth/email/code', data)
}

export function loginByEmail(data: { email: string; code: string }) {
  return request.post<never, { data: TokenResponse }>('/api/auth/email/login', data)
}

/** 忘记密码：发送重置验证码（scene=reset，与登录验证码隔离） */
export function sendResetPasswordCode(data: { email: string }) {
  return request.post<never, { data: void }>('/api/auth/password/forgot/code', data)
}

/** 忘记密码：验证码校验通过后设置新密码 */
export function resetPasswordByCode(data: { email: string; code: string; newPassword: string }) {
  return request.post<never, { data: void }>('/api/auth/password/forgot/reset', data)
}

/** 当前令牌对应的身份（含 permissions / apps） */
export function me() {
  return request.get<never, { data: AuthUser }>('/api/auth/me')
}

/**
 * 登出：同时吊销令牌与销毁中心会话 cookie。
 * 不传 refreshToken 也能退（后端幂等），传上则把 refresh 一并拉黑。
 */
export function logout(refreshToken?: string) {
  return request.post<never, { data: void }>('/api/auth/logout',
    refreshToken ? { refreshToken } : {})
}

/**
 * 中心会话：凭 cookie 判断「是否已在别处登录过」（单点的关键一步）。
 * silent=true 时 401 不触发登出/跳转——没有会话是常态，不是登录失效。
 */
export function fetchSession(silent = false) {
  return request.get<never, { data: SessionInfo }>('/api/auth/session', { skipAuthRedirect: silent })
}

/**
 * 凭中心会话静默换一对令牌。
 * 从其他应用单点跳到管理台时，本地没有 token 但带着 SSO_SID cookie，
 * 用它直接换令牌，用户不需要再输一次密码。
 */
export function sessionToken(silent = false) {
  return request.post<never, { data: TokenResponse }>(
    '/api/auth/session/token',
    {},
    { skipAuthRedirect: silent }
  )
}

/** 申请一次性票据，用于跳转到另一个应用并免登录 */
export function applyTicket(data: { appCode: string; redirect?: string }) {
  return request.post<never, { data: TicketResponse }>('/api/auth/ticket', data)
}
