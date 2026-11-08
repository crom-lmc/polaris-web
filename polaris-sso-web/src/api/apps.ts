import request from './request'
import type { ApplicationVO } from '@/types'

/** 应用注册（SSO 保护的下游系统） */

export interface ApplicationPayload {
  code?: string
  name?: string
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

/** 平台启用的全部应用（登录即可见、不做账号授权过滤），待办「应用」筛选用 */
export function fetchAllEnabledApplications() {
  return request.get<never, { data: Array<{ code: string; name: string }> }>('/api/auth/apps')
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
