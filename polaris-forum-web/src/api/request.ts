interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.status = status
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('forum_access_token')
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  let response: Response
  try {
    response = await fetch(path, { ...options, headers, credentials: 'include' })
  } catch {
    throw new ApiError('无法连接论坛服务，请稍后重试')
  }
  const body = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || !body || body.code !== 0) {
    const message = body?.message || `请求失败（${response.status}）`
    if (response.status === 401) {
      localStorage.removeItem('forum_access_token')
      localStorage.removeItem('forum_refresh_token')
      window.dispatchEvent(new Event('forum:unauthorized'))
    }
    throw new ApiError(message, response.status || body?.code || 0)
  }
  return body.data
}

export function get<T>(path: string) {
  return request<T>(path)
}

export function post<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) })
}

export function put<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PUT', body: data === undefined ? undefined : JSON.stringify(data) })
}

export function patch<T>(path: string, data?: unknown) {
  return request<T>(path, { method: 'PATCH', body: data === undefined ? undefined : JSON.stringify(data) })
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}

export function upload<T>(path: string, file: File, usageType: 'ATTACHMENT' | 'COVER' | 'AVATAR' | 'PROFILE_COVER') {
  const data = new FormData()
  data.append('file', file)
  data.append('usageType', usageType)
  return request<T>(path, { method: 'POST', body: data })
}

export async function download(path: string) {
  const token = localStorage.getItem('forum_access_token')
  const headers = new Headers()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(path, { headers, credentials: 'include' })
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ApiEnvelope<unknown> | null
    throw new ApiError(body?.message || `下载失败（${response.status}）`, response.status)
  }
  return response.blob()
}
