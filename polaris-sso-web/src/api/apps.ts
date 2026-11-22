import request from './request'
import type { ApplicationVO } from '@/types'

/** 应用注册（SSO 保护的下游系统） */

/** 字典加载完成前或异常时使用，页面始终展示中文类型。 */
export const APPLICATION_TYPE_FALLBACK = [
  { value: 'SYSTEM', label: '平台系统' },
  { value: 'MANAGEMENT', label: '管理应用' },
  { value: 'PORTAL', label: '门户应用' },
  { value: 'COMMUNITY', label: '社区应用' },
  { value: 'OTHER', label: '其他应用' },
  { value: 'OPENAPI_CLIENT', label: '第三方对接应用' }
]

export interface ApplicationPayload {
  code?: string
  name?: string
  appType?: string
  baseUrl?: string
  icon?: string
  remark?: string
  status?: number
  sort?: number
}

export function fetchApplications(params?: { keyword?: string; status?: number }) {
  return request.get<never, { data: ApplicationVO[] }>('/api/applications', { params })
}

/** 启用中的应用，给「分配应用」下拉用 */
export function fetchEnabledApplications() {
  return request.get<never, { data: ApplicationVO[] }>('/api/applications/enabled')
}

export function createApplication(data: ApplicationPayload) {
  return request.post<never, { data: ApplicationVO }>('/api/applications', data)
}

export function updateApplication(id: string, data: ApplicationPayload) {
  return request.put<never, { data: ApplicationVO }>(`/api/applications/${id}`, data)
}

export function deleteApplication(id: string) {
  return request.delete<never, { data: void }>(`/api/applications/${id}`)
}

/** 重置应用密钥：返回新明文，旧密钥立即失效 */
export function resetApplicationSecret(id: string) {
  return request.post<never, { data: string }>(`/api/applications/${id}/secret`)
}

// ---------------- 角色 / 权限 ----------------
// 已迁到 api/rbac.ts（角色与权限的 CRUD、授权都在那里）。
// 这里保留转出，避免已有页面的 import 路径一起改。
export { fetchRoles, fetchPermissions } from './rbac'
