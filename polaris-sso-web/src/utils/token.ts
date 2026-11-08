/**
 * 令牌存取。
 * <p>
 * accessToken 放 localStorage 是权衡后的选择：SSO 管理台是内部工具，需要跨标签页保持登录、
 * 且要能刷页面不丢；真正的长期凭据是 HttpOnly 的中心会话 cookie（跨应用单点用），
 * 这里只存 2 小时就过期的 access token，泄露窗口有限。
 */
const ACCESS_KEY = 'sso_access_token'
const REFRESH_KEY = 'sso_refresh_token'

export function getAccessToken(): string {
  return localStorage.getItem(ACCESS_KEY) || ''
}

export function getRefreshToken(): string {
  return localStorage.getItem(REFRESH_KEY) || ''
}

export function setTokens(accessToken?: string, refreshToken?: string) {
  if (accessToken) {
    localStorage.setItem(ACCESS_KEY, accessToken)
  }
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken)
  }
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
}
