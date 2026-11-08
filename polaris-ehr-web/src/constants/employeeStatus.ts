/**
 * 员工生命周期状态：与后端 EmployeeStatus 一一对应。
 * 10 待入职 → 20 入职审批中 → 25 入职审批通过 → 30 试用期 → 40 在职 → 50 离职中 → 55 待关闭账号 → 60 已离职
 */
export interface EmpStatusMeta {
  code: number
  label: string
  color: string
}

export const EMP_STATUS_LIST: EmpStatusMeta[] = [
  { code: 10, label: '待入职', color: 'default' },
  { code: 20, label: '入职审批中', color: 'processing' },
  { code: 25, label: '入职审批通过', color: 'cyan' },
  { code: 30, label: '试用期', color: 'gold' },
  { code: 40, label: '在职', color: 'green' },
  { code: 50, label: '离职中', color: 'orange' },
  { code: 55, label: '待关闭账号', color: 'red' },
  { code: 60, label: '已离职', color: 'default' }
]

const MAP = new Map(EMP_STATUS_LIST.map((s) => [s.code, s]))

export function statusMeta(code?: number | null): EmpStatusMeta {
  return (code != null && MAP.get(code)) || { code: code ?? 0, label: '未知', color: 'default' }
}

export function statusLabel(code?: number | null, fallback?: string): string {
  if (code != null && MAP.has(code)) return MAP.get(code)!.label
  return fallback || '未知'
}

export function statusColor(code?: number | null): string {
  return statusMeta(code).color
}

/** 正式用工（试用期 + 在职）：计编制、可请假、可被减员 */
export const WORKING_STATUS = [30, 40]

export function isWorking(code?: number | null): boolean {
  return code != null && WORKING_STATUS.includes(code)
}

/** 状态筛选下拉选项 */
export const STATUS_OPTIONS = EMP_STATUS_LIST.map((s) => ({ value: s.code, label: s.label }))

/** 审批记录（入职/转正共用）：后端存 JSON 字符串 */
export interface ApprovalRecordItem {
  role?: string
  roleName?: string
  pass?: boolean
  note?: string
  approverName?: string
  time?: string
}

export function parseApprovals(raw?: string | null): ApprovalRecordItem[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function regularizeStepText(st?: number | null): string {
  if (st == null || st < 0) return '未申请'
  if (st === 1) return '待部门主管审批'
  if (st === 2) return '待人事主管审批'
  return '已转正'
}
