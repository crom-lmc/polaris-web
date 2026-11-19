import { onBeforeUnmount, onMounted } from 'vue'
import request from '@/api/request'

const INTERVAL_MS = 20000

export function useSessionGuard() {
  let timer: number | undefined

  async function probe() {
    try {
      await request.get<never, unknown>('/api/auth/me')
    } catch {
      // 401 由响应拦截器处理，其他网络异常不打断当前操作
    }
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') void probe()
  }

  onMounted(() => {
    timer = window.setInterval(probe, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
