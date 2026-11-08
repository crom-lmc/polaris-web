import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { R } from '@blog/shared'
import { redirectToSsoLogin } from './sso'

const TOKEN_KEY = 'blog.admin.token'

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 业务请求。
 * <p>
 * baseURL 是 `/api/blog`，所以各 api 文件里写的 `/admin/xxx`、`/public/xxx`
 * 分别对应后端的 `/api/blog/admin/**` 与 `/api/blog/public/**`。
 * 令牌是账号中心签发的「博客作用域」JWT，网关照例验签后再注入身份头。
 */
const http = axios.create({
  baseURL: '/api/blog',
  timeout: 20000,
  withCredentials: true
})

/** 后端 PageResult 使用 records 字段，前端统一归一化为 list */
function normalize<T>(data: T): T {
  if (data && typeof data === 'object' && Array.isArray((data as any).records)) {
    ;(data as any).list = (data as any).records
  }
  return data
}

http.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** 已被拦截器提示过的错误：页面 catch 中据此避免重复弹窗 */
export interface HttpError extends Error {
  notified?: boolean
}

/** 判断错误是否已经由拦截器弹过提示 */
export function isNotified(e: unknown): boolean {
  return !!(e as HttpError | null | undefined)?.notified
}

/**
 * 统一在此处提示，并打上 notified 标记。
 * 注意：消息只在这里弹一次，页面 catch 里不要再弹相同内容。
 */
function rejectWith(message: string): Promise<never> {
  ElMessage.error(message)
  const error = new Error(message) as HttpError
  error.notified = true
  return Promise.reject(error)
}

/** 令牌失效：清本地令牌，送去统一登录页（带去程地址，登录后原路返回） */
function toLogin() {
  clearToken()
  redirectToSsoLogin()
}

/** 统一错误提示 + 401 跳统一登录 */
http.interceptors.response.use(
  (res) => {
    const body = res.data as R
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) return normalize(body.data)
      if (body.code === 401) {
        toLogin()
        return Promise.reject(new Error(body.message || '登录状态已失效'))
      }
      return rejectWith(body.message || '请求失败')
    }
    return body
  },
  (err) => {
    const status = err?.response?.status
    const msg = err?.response?.data?.message || err.message || '网络异常'
    if (status === 401) {
      // 未登录/令牌过期：直接去账号中心，不再本地渲染登录表单
      toLogin()
      return Promise.reject(new Error(msg))
    }
    return rejectWith(msg)
  }
)

export default http
