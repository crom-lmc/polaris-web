import request from './request'
import type { PermissionVO, RoleVO } from '@/types'

/**
 * RBAC 接口层：角色 + 权限点。
 *
 * 层次关系（三层，缺一不可）：
 *   账户 --N:N--> 角色 --N:N--> 权限点
 * 权限点是唯一契约：后端 @Permit("account:create") 与前端 store.can('account:create')
 * 认的是同一个字符串，所以新增功能时先建档权限点，再挂到角色上。
 */

export interface RolePayload {
  code?: string
  /** 归属应用；sso 为平台，业务应用填其 code（如 ehr） */
  appCode?: string
  name?: string
  remark?: string
  permissionIds?: string[]
}

export interface PermissionPayload {
  /** 所属应用；缺省 sso。业务应用接入时填该应用的 code */
  appCode?: string
  code?: string
  name?: string
  /** 1=菜单 2=按钮 */
  type?: number
  parentId?: string
  /** 导入时用：上级权限码（同应用内），替代 parentId */
  parentCode?: string
  sort?: number
  remark?: string
}

/** 权限点批量导入的单条（接入新应用时提交的按钮码清单） */
export interface PermissionImportItem {
  code: string
  name: string
  type?: number
  parentCode?: string
  sort?: number
  remark?: string
}

// ---------------- 角色 ----------------

/** 全量角色（下拉、授权用），每条带 permissionIds / accountCount；传 app 只取该应用的角色 */
export function fetchRoles(appCode?: string) {
  return request.get<never, { data: RoleVO[] }>('/api/roles/all', {
    params: appCode ? { appCode } : undefined
  })
}

/** 分页角色列表；appCode 为空表示全部应用 */
export function fetchRolePage(params: {
  page?: number
  size?: number
  keyword?: string
  appCode?: string
}) {
  return request.get<never, { data: { records: RoleVO[]; total: number; page: number; size: number } }>(
    '/api/roles',
    { params }
  )
}

export function createRole(data: RolePayload) {
  return request.post<never, { data: RoleVO }>('/api/roles', data)
}

export function updateRole(id: string, data: RolePayload) {
  return request.put<never, { data: RoleVO }>(`/api/roles/${id}`, data)
}

export function deleteRole(id: string) {
  return request.delete<never, { data: void }>(`/api/roles/${id}`)
}

/** 覆盖式设置角色权限：传空数组即收回该角色全部权限 */
export function assignRolePermissions(id: string, permissionIds: string[]) {
  return request.put<never, { data: void }>(`/api/roles/${id}/permissions`, permissionIds)
}

// ---------------- 权限 ----------------

/**
 * 权限树（菜单 -> 按钮），用于角色授权抽屉与权限管理页。
 * @param app 应用编码；不传为全部应用（各应用自成树）
 */
export function fetchPermissionTree(app?: string) {
  return request.get<never, { data: PermissionVO[] }>('/api/permissions/tree', {
    params: app ? { app } : undefined
  })
}

/** 扁平权限列表；app 为空表示全部应用 */
export function fetchPermissions(app?: string) {
  return request.get<never, { data: PermissionVO[] }>('/api/permissions/all', {
    params: app ? { app } : undefined
  })
}

/** 某应用已注册的权限点清单（接入核对用） */
export function fetchAppPermissions(appCode: string) {
  return request.get<never, { data: PermissionVO[] }>(
    `/api/applications/${encodeURIComponent(appCode)}/permissions`
  )
}

/**
 * 批量导入某应用的权限点（幂等 upsert）。
 *
 * 这是「接入新应用」的主入口：把应用自己的按钮码清单一提交，权限树就出来了，
 * 之后在角色管理里勾选即可授权，不需要改 SSO 的 Java 代码。
 */
export function importAppPermissions(appCode: string, items: PermissionImportItem[]) {
  return request.post<never, { data: { appCode: string; received: number; created: number; updated: number } }>(
    `/api/applications/${encodeURIComponent(appCode)}/permissions/import`,
    items
  )
}

export function createPermission(data: PermissionPayload) {
  return request.post<never, { data: PermissionVO }>('/api/permissions', data)
}

export function updatePermission(id: string, data: PermissionPayload) {
  return request.put<never, { data: PermissionVO }>(`/api/permissions/${id}`, data)
}

export function deletePermission(id: string) {
  return request.delete<never, { data: void }>(`/api/permissions/${id}`)
}
