import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchMe, type MeInfo } from '@/api/forum'
import { clearTokens, getAccessToken } from '@/utils/token'

export const useUserStore = defineStore('user', () => {
  const me = ref<MeInfo | null>(null)
  const ready = ref(false)
  const permissions = computed(() => me.value?.permissions || [])
  const username = computed(() => me.value?.username || '')

  function can(code: string): boolean {
    if (!me.value) return false
    return me.value.superAdmin || permissions.value.includes(code)
  }

  function applyMe(info: MeInfo) {
    me.value = info
    ready.value = true
  }

  async function bootstrap(): Promise<boolean> {
    if (ready.value && me.value) return true
    if (!getAccessToken()) return false
    try {
      applyMe(await fetchMe())
      return true
    } catch {
      clearTokens()
      me.value = null
      return false
    } finally {
      ready.value = true
    }
  }

  function logout() {
    clearTokens()
    me.value = null
    ready.value = false
  }

  return { me, ready, permissions, username, can, applyMe, bootstrap, logout }
})
