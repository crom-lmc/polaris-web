import request from './request'

/**
 * 员工快捷查询：接口在 EHR 服务，网关按 /api/ehr/** 转发。
 * 后端只返回非隐私字段，控制台不额外拼装敏感信息。
 */
export interface EmployeeLookupItem {
  /** 后端 Long 以字符串下发，避免 JS 精度丢失 */
  employeeId: string
  name: string
  position?: string
  email?: string
}

export interface EmployeeLookupDetail {
  name?: string
  empNo?: string
  account?: string
  gender?: string
  position?: string
  department?: string
  email?: string
}

export function searchEmployees(keyword: string) {
  return request.get<never, { data: EmployeeLookupItem[] }>('/api/ehr/employees/lookup', {
    params: { keyword }
  })
}

export function fetchEmployeeLookupDetail(employeeId: string) {
  return request.get<never, { data: EmployeeLookupDetail }>(
    `/api/ehr/employees/lookup/${employeeId}`
  )
}
