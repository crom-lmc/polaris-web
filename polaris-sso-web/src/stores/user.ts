import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { ApplicationVO, AuthUser, SessionInfo, TokenResponse } from '@/types'
import { fetchSession, me, sessionToken } from '@/api/auth'
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from '@/utils/token'

/**
 * 登录态。
 *
 * 三条来源，按优先级：
 * 1. 本地 access token（正常使用中）；
 * 2. 中心会话 cookie（从其他应用单点跳过来，静默换 token，免再登录）；
 * 3. 都没有 → 需要走登录页。
 */
export const useUserStore = defineStore('user', () => {
  const user = ref<AuthUser | null>(null)
  /** 可访问应用的详情（含名称/地址），用于渲染「我的应用」 */
  const appList = ref<ApplicationVO[]>([])
  /** bootstrap 是否已执行过，避免路由守卫重复初始化 */
  const ready = ref(false)

  const permissions = computed(() => user.value?.permissions || [])
  const apps = computed(() => user.value?.apps || [])
  const isSuperAdmin = computed(() => !!user.value?.superAdmin)

  /** 按钮级权限判断：超管直接放行，与后端 @Permit 的口径一致 */
  function can(code: string): boolean {
    if (!user.value) return false
    return user.value.superAdmin || permissions.value.includes(code)
  }

  /** 应用级授权判断 */
  function hasApp(code: string): boolean {
    return apps.value.includes(code)
  }

  function applyTokens(tokens: TokenResponse) {
    setTokens(tokens.accessToken, tokens.refreshToken)
    if (tokens.user) {
      user.value = tokens.user
    }
  }

  function applySession(s: SessionInfo) {
    user.value = {
      accountId: s.accountId,
      username: s.username,
      nickname: s.nickname,
      superAdmin: s.superAdmin,
      permissions: s.permissions || [],
      apps: s.apps || []
    }
    appList.value = s.appList || []
  }

  /**
   * 初始化登录态。返回是否已登录。
   * 不抛异常——守卫拿到 false 就跳登录页，避免未登录时控制台一片红。
   */
  async function bootstrap(): Promise<boolean> {
    if (ready.value && user.value) return true

    // 1) 本地有 token：校验并刷新身份（权限/应用可能在别处被改过）
    if (getAccessToken()) {
      try {
        const res = await me()
        user.value = res.data
        await loadAppList()
        ready.value = true
        return true
      } catch {
        clearTokens()
      }
    }

    // 2) 没有可用 token：试中心会话（单点过来的用户走这里）
    try {
      // 没有会话 cookie 时必 401，属正常探测，不能触发「登录失效」的登出跳转
      const res = await sessionToken(true)
      applyTokens(res.data)
      await loadAppList()
      ready.value = true
      return true
    } catch {
      user.value = null
      appList.value = []
      ready.value = false
      return false
    }
  }

  /** 拉取「我的应用」详情；失败不影响主流程（只是少个磁贴） */
  async function loadAppList() {
    try {
      // 这里靠中心会话 cookie 取应用详情。只有 access token、没有会话时必 401，
      // 必须标记为 silent，否则会被拦截器判成「登录失效」直接踢回登录页。
      const res = await fetchSession(true)
      appList.value = res.data.appList || []
    } catch {
      appList.value = []
    }
  }

  function clear() {
    clearTokens()
    user.value = null
    appList.value = []
    ready.value = false
  }

  return {
    user,
    appList,
    ready,
    permissions,
    apps,
    isSuperAdmin,
    can,
    hasApp,
    applyTokens,
    applySession,
    bootstrap,
    loadAppList,
    clear,
    getRefreshToken
  }
})
