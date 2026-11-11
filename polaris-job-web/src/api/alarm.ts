import request from './request'

export interface AlarmChannel {
  id: string
  /** SITE 站内消息 / EMAIL 邮件 */
  channel: 'SITE' | 'EMAIL'
  enabled: number
}

export interface AlarmRule {
  id: string
  name: string
  scopeType: 'JOB' | 'APP' | 'ALL'
  scopeValue: string
  triggerCondition: 'FAIL' | 'TIMEOUT' | 'CONSECUTIVE_FAIL'
  threshold: number
  channels: string
  accountIds: string
  silenceMinutes: number
  status: number
  createdAt?: string
}

export interface AlarmRuleSaveRequest {
  name: string
  scopeType: string
  scopeValue?: string
  triggerCondition: string
  threshold?: number
  channels?: string
  accountIds?: string
  silenceMinutes?: number
  status?: number
}

export interface AlarmRecord {
  id: string
  jobId: string
  jobName?: string
  appCode?: string
  event: 'FAIL' | 'RECOVER'
  channel: string
  receivers?: string
  content?: string
  status: number
  sentAt?: string
  createdAt?: string
}

export interface AlarmPage<T> {
  records: T[]
  total: number
  page: number
  size: number
}

export function listAlarmChannels() {
  return request.get<never, AlarmChannel[]>('/api/jobs/alarms/channels')
}

export function saveAlarmChannels(items: Array<{ channel: string; enabled: number }>) {
  return request.put<never, void>('/api/jobs/alarms/channels', items)
}

export function listAlarmRules(params: { page?: number; size?: number }) {
  return request.get<never, AlarmPage<AlarmRule>>('/api/jobs/alarms/rules', { params })
}

export function createAlarmRule(req: AlarmRuleSaveRequest) {
  return request.post<never, AlarmRule>('/api/jobs/alarms/rules', req)
}

export function updateAlarmRule(id: string | number, req: AlarmRuleSaveRequest) {
  return request.put<never, AlarmRule>(`/api/jobs/alarms/rules/${id}`, req)
}

export function deleteAlarmRule(id: string | number) {
  return request.delete<never, void>(`/api/jobs/alarms/rules/${id}`)
}

export function listAlarmRecords(params: { page?: number; size?: number }) {
  return request.get<never, AlarmPage<AlarmRecord>>('/api/jobs/alarms/records', { params })
}
