import request from './request'

export interface ExecutorVO {
  /** 雪花 ID：由 request 层按字符串解析，避免精度丢失 */
  id: string
  appCode: string
  address: string
  handlers: Array<{ name: string; description?: string }>
  version?: string
  jobCount: number
  online: boolean
  lastHeartbeat?: string
}

export interface AppSummary {
  appCode: string
  online: boolean
  handlers: string[]
}

export function listExecutors() {
  return request.get<never, ExecutorVO[]>('/api/jobs/executors')
}

export function listApps() {
  return request.get<never, AppSummary[]>('/api/jobs/apps')
}
