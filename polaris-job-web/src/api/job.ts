import request from './request'

export interface JobInfo {
  /** 雪花 ID：由 request 层按字符串解析，避免精度丢失 */
  id: string
  appCode: string
  name: string
  handler: string
  description: string
  triggerType: 'CRON' | 'FIXED_RATE' | 'FIXED_DELAY'
  cronExpr?: string
  intervalSec?: number
  timeoutSec: number
  retryTimes: number
  retryIntervalSec: number
  routeStrategy: string
  blockStrategy: string
  params: Record<string, string>
  status: 0 | 1
  nextFireTime?: string
  ownerAccountId?: number
  lockVersion: number
  handlerVerified?: boolean
}

export interface JobSaveRequest {
  appCode: string
  name: string
  handler: string
  description?: string
  triggerType: string
  cronExpr?: string
  intervalSec?: number
  timeoutSec?: number
  retryTimes?: number
  retryIntervalSec?: number
  routeStrategy?: string
  blockStrategy?: string
  params?: Record<string, string>
  status?: number
  ownerAccountId?: number
}

export interface PageResult<T> {
  records: T[]
  total: number
  pageNo: number
  pageSize: number
}

export function listJobs(params: {
  page?: number
  size?: number
  keyword?: string
  appCode?: string
  status?: number
  triggerType?: string
}) {
  return request.get<never, PageResult<JobInfo>>('/api/jobs', { params })
}

export function getJob(id: string | number) {
  return request.get<never, JobInfo>(`/api/jobs/${id}`)
}

export function createJob(req: JobSaveRequest) {
  return request.post<never, JobInfo>('/api/jobs', req)
}

export function updateJob(id: string | number, req: JobSaveRequest) {
  return request.put<never, JobInfo>(`/api/jobs/${id}`, req)
}

export function deleteJob(id: string | number) {
  return request.delete<never, void>(`/api/jobs/${id}`)
}

export function toggleJobStatus(id: string | number, status: 0 | 1) {
  return request.patch<never, JobInfo>(`/api/jobs/${id}/status`, { status })
}

export function runJob(id: string | number) {
  return request.post<never, string>(`/api/jobs/${id}/run`)
}

export function previewCron(cron: string) {
  return request.post<never, string[]>('/api/jobs/cron/preview', { cron })
}
