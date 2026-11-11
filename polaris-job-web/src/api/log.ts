import request from './request'
import type { PageResult } from './job'

export interface JobLogVO {
  /** 雪花 ID：由 request 层按字符串解析，避免精度丢失 */
  id: string
  jobId: string
  jobName?: string
  appCode?: string
  handler?: string
  triggerType: string
  plannedAt?: string
  startedAt?: string
  finishedAt?: string
  status: 0 | 1 | 2 | 3 | 4
  durationMs?: number
  retryIndex: number
  executorAddress?: string
  errorMsg?: string
  output?: string
}

export function listLogs(params: {
  page?: number
  size?: number
  jobId?: string | number
  appCode?: string
  status?: number
  startTime?: string
  endTime?: string
}) {
  return request.get<never, PageResult<JobLogVO>>('/api/jobs/logs', { params })
}

export function getLog(id: string | number) {
  return request.get<never, JobLogVO>(`/api/jobs/logs/${id}`)
}
