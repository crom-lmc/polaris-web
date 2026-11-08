import request from './request'
import type { AccountVO, ApplicationVO, LoginLog, PageResult } from '@/types'

/** 账户管理接口（/api/accounts），每个写操作对应一个按钮级权限码 */

/**
 * @param params.orgId 组织树筛选：该组织及所有下级组织下的账号；不传为全部账号。
 *                     账号不存组织归属，由账号中心借 EHR 员工档案反查。
 */
export function fetchAccounts(params: {
  page: number
  size: number
  keyword?: string
  orgId?: string
}) {
  return request.get<never, { data: PageResult<AccountVO> }>('/api/accounts', { params })
}

export interface CreateAccountPayload {
  username: string
  nickname?: string
  email?: string
  phone?: string
  password: string
  roleIds?: string[]
}

export interface UpdateAccountPayload {
  nickname?: string
  email?: string
  phone?: string
  roleIds?: string[]
}

export function createAccount(data: CreateAccountPayload) {
  return request.post<never, { data: AccountVO }>('/api/accounts', data)
}

export function updateAccount(id: string, data: UpdateAccountPayload) {
  return request.put<never, { data: AccountVO }>(`/api/accounts/${id}`, data)
}

export function deleteAccount(id: string) {
  return request.delete<never, { data: void }>(`/api/accounts/${id}`)
}

export function enableAccount(id: string) {
  return request.post<never, { data: void }>(`/api/accounts/${id}/enable`)
}

export function disableAccount(id: string) {
  return request.post<never, { data: void }>(`/api/accounts/${id}/disable`)
}

export function unlockAccount(id: string) {
  return request.post<never, { data: void }>(`/api/accounts/${id}/unlock`)
}

export function resetAccountPassword(id: string, newPassword: string, forceChange = true) {
  return request.post<never, { data: void }>(`/api/accounts/${id}/password`,
    { newPassword, forceChange })
}

/** 当前登录者修改自己的密码（校验原密码） */
export function changeMyPassword(oldPassword: string, newPassword: string) {
  return request.post<never, { data: void }>('/api/accounts/me/password',
    { oldPassword, newPassword })
}

/** 登录审计日志 */
export function fetchLoginLogs(params: {
  page: number
  size: number
  keyword?: string
  loginType?: string
}) {
  return request.get<never, { data: PageResult<LoginLog> }>('/api/accounts/login-logs', { params })
}

// ---------------- 账号的应用授权 ----------------

/** 该账号已授权的应用 ID（含停用应用，用于勾选回显） */
export function fetchAccountAppIds(id: string) {
  return request.get<never, { data: string[] }>(`/api/accounts/${id}/apps`)
}

/** 该账号可访问的应用详情（仅启用） */
export function fetchAccountApps(id: string) {
  return request.get<never, { data: ApplicationVO[] }>(`/api/accounts/${id}/apps/detail`)
}

/** 覆盖式设置：传空数组即收回全部应用 */
export function grantAccountApps(id: string, appIds: string[]) {
  return request.put<never, { data: void }>(`/api/accounts/${id}/apps`, { appIds })
}
