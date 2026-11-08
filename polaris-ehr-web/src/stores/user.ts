import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fetchMe, type MeInfo } from '@/api/ehr'
import { clearTokens, getAccessToken } from '@/utils/token'

/** 登录态：令牌在 localStorage，身份/权限由 /api/ehr/me 实时刷新 */
export const useUserStore = defineStore('user', () => {
  const me = ref<MeInfo | null>(null)
  const ready = ref(false)

  const permissions = computed(() => me.value?.permissions || [])
  const isSuperAdmin = computed(() => !!me.value?.superAdmin)
  const username = computed(() => me.value?.username || '')

  /** 按钮级权限判断：超管直接放行，与后端 @Permit 口径一致 */
  function can(code: string): boolean {
    if (!me.value) return false
    return me.value.superAdmin || permissions.value.includes(code)
  }

  function applyMe(info: MeInfo) {
    me.value = info
    ready.value = true
  }

  /** 有本地令牌则拉取身份，返回是否已登录 */
  async function bootstrap(): Promise<boolean> {
    if (ready.value && me.value) return true
    if (!getAccessToken()) return false
    try {
      const info = await fetchMe()
      applyMe(info)
      return true
    } catch {
      clearTokens()
      return false
    }
  }

  function logout() {
    clearTokens()
    me.value = null
    ready.value = false
  }

  return { me, ready, permissions, isSuperAdmin, username, can, applyMe, bootstrap, logout }
})
