import { onBeforeUnmount, onMounted } from 'vue'
import request from '@/api/request'

/**
 * 会话心跳：让本页能自己发现「用户已经在别的应用里退出了」。
 * <p>
 * 为什么探的是 /api/auth/me 而不是 /api/auth/session：
 * 中心会话靠 HttpOnly cookie 承载，而 cookie 按 host 隔离（端口不隔离）。
 * 本地各应用现已统一到 localhost（见 tools/unify-localhost.sql），但只要用户
 * 从 127.0.0.1 打开任一页面，那颗 cookie 就还是另一个域的；令牌里带了中心
 * 会话标识（sid），网关按 sid 校验是否已被登出，用本应用自己的 token 问 /me
 * 不依赖 cookie，结论最可信。
 * <p>
 * 顺带解决另一个问题：access token 过期时这里会 401，拦截器跳回调页后
 * 凭中心会话静默换新令牌，用户几乎无感。
 */
const INTERVAL_MS = 20000

export function useSessionGuard() {
  let timer: number | undefined

  async function probe() {
    try {
      await request.get<never, unknown>('/api/auth/me')
    } catch {
      /* 401 已由响应拦截器清 token 并跳转，其余网络错误静默（不打扰用户） */
    }
  }

  /** 切回标签页立刻校验一次，不必等下一个心跳周期 */
  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      probe()
    }
  }

  onMounted(() => {
    timer = window.setInterval(probe, INTERVAL_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    if (timer) {
      window.clearInterval(timer)
    }
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
