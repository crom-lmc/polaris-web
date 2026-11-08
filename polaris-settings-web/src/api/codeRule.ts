import request from './request'

/** 业务单号规则：以「数据库表名」为业务标识，业务方生成数据前调内部接口取号 */
export interface CodeRule {
  /** 雪花 ID 由后端序列化成字符串 */
  id: string
  /** 归属应用编码，仅用于分组展示 */
  appCode: string
  /** 业务库表名，如 appr_instance */
  tableName: string
  prefix: string
  /** 各段之间的分隔符，如 - */
  separatorChar: string
  seqLength: number
  /** 1 不足位数补 0 / 0 不补 */
  padZero: number
  /** 1 按月重置流水号 / 0 不重置 */
  resetMonthly: number
  startNo: number
  dateFormat: string
  /** 表达式格式，后端按前缀/分隔符固定拼出，前端只读展示 */
  exprFormat: string
  /** 最近一次生成的流水号，0=尚未生成 */
  lastNo?: number
  /** 最近生成周期 yyyyMM */
  lastPeriod?: string
  createdAt?: string
}

/** 保存报文：表达式与流水号由后端维护，不上送 */
export type CodeRulePayload = Omit<
  CodeRule,
  'id' | 'exprFormat' | 'lastNo' | 'lastPeriod' | 'createdAt'
>

export function listCodeRules(keyword?: string) {
  return request.get<never, CodeRule[]>('/api/settings/code-rules', { params: { keyword } })
}

export function createCodeRule(payload: CodeRulePayload) {
  return request.post<never, CodeRule>('/api/settings/code-rules', payload)
}

export function updateCodeRule(id: string, payload: CodeRulePayload) {
  return request.patch<never, CodeRule>(`/api/settings/code-rules/${id}`, payload)
}

/** 调整「下一个」流水号，只能往后调 */
export function adjustNextNo(id: string, nextNo: number) {
  return request.patch<never, CodeRule>(`/api/settings/code-rules/${id}/next-no`, null, {
    params: { nextNo }
  })
}
