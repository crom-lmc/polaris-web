import axios, { type AxiosInstance } from 'axios'
import { getAccessToken, clearTokens } from '@/utils/token'

/**
 * 统一请求封装（对接微服务网关 9080）。
 * 认证走 Bearer；withCredentials 保留中心会话 cookie（静默续登用）。
 */
const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true
})

request.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (typeof body.code === 'number' && body.code !== 0) {
        const err = new Error(body.message || '请求失败') as Error & { code?: number }
        err.code = body.code
        return Promise.reject(err)
      }
      // Result 壳统一解包：调用方拿到的就是 data 本体（与 api/cms.ts 的 get<never, T> 声明一致）
      return body.data as typeof response
    }
    return response
  },
  (error) => {
    const status = error?.response?.status
    const body = error?.response?.data
    const message = body?.message || error.message || '网络异常'
    if (status === 401) {
      if (!error.config?.skipAuthRedirect) {
        clearTokens()
        if (!window.location.pathname.startsWith('/callback')) {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.replace(`/callback?redirect=${redirect}&expired=1`)
        }
      }
      return Promise.reject(new Error(body?.message || '登录状态已失效，请重新登录'))
    }
    const err = new Error(message) as Error & { code?: number; status?: number }
    err.code = status
    err.status = status
    return Promise.reject(err)
  }
)

export default request
