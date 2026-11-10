import request from './request'

/** 埋点配置：key → JSON 值，其他应用通过 settings-client 的 Feign 读取 */
export interface EmbedPoint {
  id: string
  code: string
  /** 所属应用编码，空=通用 */
  appCode: string
  /** 模块（左侧树分组） */
  module: string
  /** 描述 */
  name: string
  /** 埋点值（JSON 文本） */
  value: string
  /** 1 内置（种子数据，不可新增/删除） */
  builtIn: number
  sort: number
  updatedAt?: string
}

/** 编辑入参：key 不可改，只提交描述与 JSON 值 */
export interface EmbedPointPatch {
  name?: string
  value?: string
  appCode?: string
  module?: string
  sort?: number
}

/** 历史快照 */
export interface EmbedPointHistory {
  id: string
  pointId: string
  code: string
  value: string
  operatedBy?: string
  operatedName?: string
  createdAt: string
}

export function listEmbedPoints(keyword?: string) {
  return request.get<never, EmbedPoint[]>('/api/settings/embed-points', { params: { keyword } })
}

export function updateEmbedPoint(id: string, payload: EmbedPointPatch) {
  return request.patch<never, EmbedPoint>(`/api/settings/embed-points/${id}`, payload)
}

export function fetchEmbedPointHistories(id: string) {
  return request.get<never, EmbedPointHistory[]>(`/api/settings/embed-points/${id}/histories`)
}

/** 组织节点（扁平），收件人「按部门」多选用（转自 EHR） */
export interface EmbedReceiverOrg {
  id: string
  parentId: string | null
  name: string
  type?: string
}

export function fetchEmbedReceiverOrgs() {
  return request.get<never, EmbedReceiverOrg[]>('/api/settings/embed-points/receivers/orgs')
}

/** 已开户在职员工，收件人「按人」多选用（id=账号 ID） */
export interface EmbedReceiverEmployee {
  id: string
  name: string
  empNo?: string
  orgId?: string | null
}

export function fetchEmbedReceiverEmployees() {
  return request.get<never, EmbedReceiverEmployee[]>('/api/settings/embed-points/receivers/employees')
}
