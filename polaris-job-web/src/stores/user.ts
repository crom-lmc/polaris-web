import { defineStore } from 'pinia'
import request from '@/api/request'
import {
  clearTokens,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
  getAccountId,
  setAccountId,
  getAccountName,
  setAccountName,
  getAccountSuper,
  setAccountSuper,
  getAccountPerms,
  setAccountPerms
} from '@/utils/token'

/** 统一账号中心 sso-web 的 /authorize 页（授权码签发入口） */
export const SSO_ORIGIN = import.meta.env.VITE_SSO_ORIGIN || 'http://localhost:5173'

/** 当前 job-web 的回调地址，必须与统一账号中心里 job 应用的 baseUrl 同 origin */
export function callbackUrl(): string {
  return window.location.origin + '/callback'
}

/**
 * 登录后要回跳的地址。回调页自身不能作为目标——否则换到令牌后又落回
 * /callback（无 code、带 expired=1），再次触发授权，形成无限跳转。
 */
function safeRedirect(target?: string): string {
  const t = (target || window.location.pathname + window.location.search).trim()
  if (!t || t === '/' || t.startsWith('/callback')) return '/dashboard'
  return t
}

const OAUTH_STATES_KEY = 'job_oauth_states'
const OAUTH_REDIRECT_KEY = 'job_oauth_redirect'
const OAUTH_AT_KEY = 'job_oauth_at'

interface MeInfo {
  accountId: number | string
  username: string
  superAdmin: boolean
  appCode: string
  permissions: string[]
}

export const useUserStore = defineStore('user', {
  state: () => ({
    accountId: getAccountId(),
    accountName: getAccountName(),
    superAdmin: getAccountSuper(),
    perms: getAccountPerms()
  }),
  getters: {
    loggedIn: () => !!getAccessToken(),
    hasPerm: (s) => (code: string) => s.superAdmin || s.perms.includes(code),
    hasAny: (s) => (codes: string[]) => s.superAdmin || codes.some((c) => s.perms.includes(c))
  },
  actions: {
    /** 跳统一账号中心签授权码（浏览器整页跳转，不是接口调用） */
    gotoAuthorize(redirect?: string) {
      const target = safeRedirect(redirect)
      const state = Math.random().toString(36).slice(2) + Date.now().toString(36)
      try {
        // 首屏并发几个接口同时 401 时会连续触发本方法：
        // 只让第一次真正跳转，否则浏览器按先发起的 state 跳走，回调时必然校验失败
        const now = Date.now()
        if (now - Number(sessionStorage.getItem(OAUTH_AT_KEY) || 0) < 1500) return
        sessionStorage.setItem(OAUTH_AT_KEY, String(now))
        // 保留最近几个 state：并发或手快重复授权时，回调带回来的可能是较早那个
        const prev: string[] = JSON.parse(sessionStorage.getItem(OAUTH_STATES_KEY) || '[]')
        sessionStorage.setItem(OAUTH_STATES_KEY, JSON.stringify([...prev, state].slice(-5)))
        sessionStorage.setItem(OAUTH_REDIRECT_KEY, target)
      } catch {
        /* 隐私模式下 sessionStorage 可能不可用 */
      }
      const url =
        `${SSO_ORIGIN}/authorize?response_type=code` +
        `&client_id=job&redirect_uri=${encodeURIComponent(callbackUrl())}` +
        `&state=${encodeURIComponent(state)}`
      window.location.replace(url)
    },
    async ensureLogin() {
      if (this.loggedIn) return
      this.gotoAuthorize()
    },
    async exchangeToken(code: string, redirectUri: string = callbackUrl()) {
      // 只传 code 与 redirectUri，appSecret 由后端 AdminAuthController 代持
      const data = await request.post<never, { accessToken: string; refreshToken?: string }>(
        '/api/jobs/auth/exchange',
        { code, redirectUri }
      )
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      await this.fetchMe()
    },
    /** 令牌对应的身份与全量权限（网关验签后注入可信头，本服务直接取） */
    async fetchMe() {
      const me = await request.get<never, MeInfo>('/api/jobs/auth/me')
      const id = String(me.accountId)
      const perms = me.permissions || []
      setAccountId(id)
      setAccountName(me.username)
      setAccountSuper(me.superAdmin)
      setAccountPerms(perms)
      this.accountId = id
      this.accountName = me.username
      this.superAdmin = me.superAdmin
      this.perms = perms
    },
    logout() {
      clearTokens()
      this.accountId = ''
      this.accountName = ''
      this.superAdmin = false
      this.perms = []
      // 本地清空后重走授权：中心会话还在时静默重登，已登出则落到统一登录页
      this.gotoAuthorize()
    }
  }
})
