import { computed, ref } from 'vue'
import { fetchMe, fetchUnreadCount, logoutSso, type MeInfo } from '@/api/forum'

const pendingLoginRedirect = ref('/')
export const currentUser = ref<MeInfo | null>(null)
export const authReady = ref(false)
export const isLoggedIn = computed(() => Boolean(currentUser.value))
export const unreadCount = ref(0)
export const canManageForum = computed(() => Boolean(currentUser.value?.superAdmin
  || currentUser.value?.permissions?.some(permission => ['forum:admin', 'forum:content', 'forum:sensitive', 'forum:exchange', 'forum:badge'].includes(permission))))

export function getAccessToken() {
  return localStorage.getItem('forum_access_token') || ''
}

export function setTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem('forum_access_token', accessToken)
  if (refreshToken) localStorage.setItem('forum_refresh_token', refreshToken)
}

export function clearAuth() {
  localStorage.removeItem('forum_access_token')
  localStorage.removeItem('forum_refresh_token')
  currentUser.value = null
  unreadCount.value = 0
}

export async function refreshUnreadCount() {
  if (!getAccessToken()) {
    unreadCount.value = 0
    return
  }
  try {
    const result = await fetchUnreadCount()
    unreadCount.value = result.count
  } catch {
    unreadCount.value = 0
  }
}

/**
 * 未登录时直接跳统一账号中心，不再弹登录引导弹窗。
 * SSO 侧若也没有登录态，会由它自己的路由守卫落到统一登录页（带 redirect 回跳）。
 * 返回 true 表示已登录，调用方可以继续执行；false 表示已发起跳转。
 * 首参保留给调用点表达业务语义（日志/排查用），当前不再展示在弹窗里。
 */
export function requireLogin(_action: string, redirect = window.location.pathname + window.location.search + window.location.hash) {
  if (getAccessToken()) return true
  pendingLoginRedirect.value = redirect
  redirectToSsoLogin()
  return false
}

export async function refreshCurrentUser() {
  if (!getAccessToken()) {
    currentUser.value = null
    authReady.value = true
    return null
  }
  try {
    currentUser.value = await fetchMe()
    return currentUser.value
  } catch {
    currentUser.value = null
    return null
  } finally {
    authReady.value = true
  }
}

export async function logout() {
  const refreshToken = localStorage.getItem('forum_refresh_token') || undefined
  try { await logoutSso(refreshToken) } catch { /* 本地令牌无论中心登出是否成功都清除 */ }
  clearAuth()
}

function ssoOrigin() {
  return (import.meta.env.VITE_SSO_ORIGIN as string) || 'http://localhost:5173'
}

export function forumAdminOrigin() {
  return ((import.meta.env.VITE_FORUM_ADMIN_ORIGIN as string) || 'http://localhost:5183').replace(/\/$/, '')
}

export function callbackUrl() {
  return `${window.location.origin}/auth/callback`
}

function authorizeUrl() {
  const state = crypto.randomUUID().replace(/-/g, '')
  sessionStorage.setItem('forum_sso_oauth_state', state)
  sessionStorage.setItem('forum_sso_redirect', pendingLoginRedirect.value)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: (import.meta.env.VITE_FORUM_CLIENT_ID as string) || 'forum',
    redirect_uri: callbackUrl(),
    scope: 'api',
    state
  })
  return `${ssoOrigin()}/authorize?${params.toString()}`
}

export function redirectToSsoLogin(redirect?: string) {
  if (redirect) pendingLoginRedirect.value = redirect
  window.location.assign(authorizeUrl())
}

export function consumeOauthState() {
  const state = sessionStorage.getItem('forum_sso_oauth_state')
  sessionStorage.removeItem('forum_sso_oauth_state')
  return state
}

export function takePostLoginRedirect() {
  const redirect = sessionStorage.getItem('forum_sso_redirect') || '/'
  sessionStorage.removeItem('forum_sso_redirect')
  return redirect.startsWith('/') && !redirect.startsWith('/auth/callback') ? redirect : '/'
}
