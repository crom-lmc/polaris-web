import axios, { type AxiosInstance } from 'axios'
import { clearTokens, getAccessToken } from '@/utils/token'

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
        const error = new Error(body.message || '请求失败') as Error & { code?: number }
        error.code = body.code
        return Promise.reject(error)
      }
      return body.data as typeof response
    }
    return response
  },
  (error) => {
    const status = error?.response?.status
    const body = error?.response?.data
    const message = body?.message || error.message || '网络异常'
    if (status === 401) {
      clearTokens()
      // 管理端 Vite base 为 /admin/：回调页与登录失效跳转都必须带此前缀，
      // 否则会跳到 /callback 被 Vite 的 base 校验拦截（"public base URL of /admin/"）。
      const base = '/admin'
      const callbackPath = `${base}/callback`
      const pathname = window.location.pathname
      if (!pathname.startsWith(callbackPath)) {
        // router 的 base 已是 /admin/，回跳目标要存不含 base 的相对路径，避免二次拼接
        const relative = pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
        const redirect = encodeURIComponent(relative + window.location.search)
        window.location.replace(`${callbackPath}?redirect=${redirect}&expired=1`)
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
