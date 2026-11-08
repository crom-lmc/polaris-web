import axios, { type AxiosInstance } from 'axios'
import type { ApiResponse } from '@/types'
import { getAccessToken, clearTokens } from '@/utils/token'

/**
 * 给 axios 配置加一个自有开关：探测型接口（如 /api/auth/session）401 是正常结果，
 * 不该清掉本地令牌、也不该把用户踢回登录页。
 */
declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

/**
 * 统一请求封装（对接微服务网关 9080）。
 *
 * 两个关键点：
 * 1. 认证走 Authorization: Bearer —— 网关验签后把身份写进可信头，下游服务不再各自验签；
 * 2. withCredentials 必须开 —— 登录接口会下发 HttpOnly 的 SSO_SID cookie，
 *    中心会话（跨应用单点）就靠它，不带则「已登录状态」传不回来。
 */
const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 20000,
  withCredentials: true
})

request.interceptors.request.use((config) => {
  const token = getAccessToken()
  // 登录/换票等接口不需要（也不该）带旧令牌
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * 响应拦截器：
 * - 业务失败（code != 0）转成 reject，并保留 code 便于调用方区分 401/403；
 * - 成功则脱掉 {code,message,data} 外壳，调用方拿到的 res.data 直接是数据本体。
 */
request.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    if (body && typeof body === 'object' && 'code' in body) {
      if (typeof body.code === 'number' && body.code !== 0) {
        const err = new Error(body.message || '请求失败') as Error & { code?: number }
        err.code = body.code
        return Promise.reject(err)
      }
      return { ...response, data: body.data } as typeof response
    }
    return response
  },
  (error) => {
    const status = error?.response?.status
    const body = error?.response?.data as ApiResponse<unknown> | undefined
    const message = body?.message || error.message || '网络异常'

    if (status === 401) {
      // 探测型接口（判断有没有中心会话）401 属于正常分支：交给调用方自己决定，
      // 否则「令牌有效但没有会话 cookie」时会被反复踢回登录页，表现为页面打不开。
      if (!error.config?.skipAuthRedirect) {
        // 令牌过期/被吊销：清掉本地令牌，把人送回登录页并记住原地址
        clearTokens()
        if (!window.location.pathname.startsWith('/login')) {
          const redirect = encodeURIComponent(window.location.pathname + window.location.search)
          window.location.replace(`/login?redirect=${redirect}`)
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
