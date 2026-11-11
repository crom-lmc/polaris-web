import axios, { type AxiosInstance } from 'axios'
import { getAccessToken, clearTokens } from '@/utils/token'

declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
  interface InternalAxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

/**
 * 雪花 ID 为 19 位，超出 JS Number 的精度，直接 JSON.parse 会被四舍五入。
 * 解析前给 16 位以上的整数字面量加引号，保证 ID 原样返回。
 */
function quoteLongIntegers(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      out += ch
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      out += ch
      continue
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i
      let j = ch === '-' ? i + 1 : i
      const digitStart = j
      while (j < text.length && text[j] >= '0' && text[j] <= '9') j++
      const isInteger = j === text.length || !['.', 'e', 'E'].includes(text[j])
      if (isInteger && j - digitStart >= 16) {
        out += `"${text.slice(start, j)}"`
        i = j - 1
        continue
      }
      out += text.slice(start, j)
      i = j - 1
      continue
    }
    out += ch
  }
  return out
}

/**
 * 统一请求封装（对接微服务网关 9080）。
 * 认证走 Bearer；withCredentials 保留中心会话 cookie（静默续登用）。
 */
const request: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  withCredentials: true,
  transformResponse: [
    (data: unknown, headers) => {
      if (typeof data !== 'string' || !data) return data
      const contentType = String((headers as Record<string, unknown>)?.['content-type'] ?? '')
      if (contentType && !contentType.includes('json')) return data
      try {
        return JSON.parse(quoteLongIntegers(data))
      } catch {
        return data
      }
    }
  ]
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
