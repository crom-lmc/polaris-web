import axios, { type AxiosInstance } from 'axios'
import { getAccessToken } from '@/utils/token'

/**
 * 统一请求封装（对接微服务网关 9080）。
 * 认证走 Bearer；withCredentials 保留中心会话 cookie。
 * 门户大多接口是公开的，401 只做静默失败，不强制跳登录。
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
      // Result 壳统一解包：调用方拿到的就是 data 本体
      return body.data as typeof response
    }
    return response
  },
  (error) => {
    const status = error?.response?.status
    const body = error?.response?.data
    const message = body?.message || error.message || '网络异常'
    const err = new Error(message) as Error & { code?: number; status?: number }
    err.code = status
    err.status = status
    return Promise.reject(err)
  }
)

export default request
