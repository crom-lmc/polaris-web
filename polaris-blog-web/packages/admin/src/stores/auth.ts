import { defineStore } from 'pinia'
import { fetchMe, ssoLogout, type SsoUser } from '@/api/sso'
import { clearToken, getToken, setToken } from '@/api/http'

/**
 * 登录态。
 * <p>
 * 和改造前最大的差别：这里<b>没有账号密码</b>，也没有「admin / author」两种角色。
 * 身份来自统一账号中心签发的博客作用域令牌，能做什么由令牌里的权限码逐项决定。
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: getToken(),
    user: null as SsoUser | null,
    /** bootstrap 是否已执行过，避免守卫重复请求 */
    ready: false
  }),

  getters: {
    isLogin: (s) => !!s.token && !!s.user,
    isSuperAdmin: (s) => !!s.user?.superAdmin,
    permissions: (s) => s.user?.permissions || [],
    nickname: (s) => s.user?.nickname || s.user?.username || '未登录'
  },

  actions: {
    /**
     * 按钮级判断：超管直接放行，口径与后端 @Permit 切面一致。
     * 前端隐藏按钮只是体验，真正的拦截在服务端。
     */
    can(code: string): boolean {
      if (!this.user) return false
      return this.user.superAdmin || (this.user.permissions || []).includes(code)
    },

    /** 校验本地令牌并刷新身份；返回是否已登录 */
    async bootstrap(): Promise<boolean> {
      if (this.ready && this.user) return true
      const token = getToken()
      if (!token) {
        this.ready = true
        return false
      }
      try {
        this.user = await fetchMe(token)
        this.token = token
        this.ready = true
        return true
      } catch {
        // 令牌过期/被吊销：清掉，交给路由守卫送去统一登录
        clearToken()
        this.token = ''
        this.user = null
        this.ready = true
        return false
      }
    },

    /** ticket 换来的令牌落库 */
    applyToken(accessToken: string) {
      setToken(accessToken)
      this.token = accessToken
      this.ready = false
    },

    async logout() {
      await ssoLogout()
      clearToken()
      this.token = ''
      this.user = null
      this.ready = false
    }
  }
})
