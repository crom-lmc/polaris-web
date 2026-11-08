import request from './request'

/**
 * 内容列表反查审批结果用的审批中心接口。
 * 审批单存在 settings 库，统一账号中心 /api/accounts/approvals/** 做代理；
 * cms-web 的 request 拦截器已把 Result 壳解包成 data 本体。
 */

/** 0 进行中 / 1 已通过 / 2 已驳回 / 3 已撤回 / 4 已终止 */
export type ApprovalStatus = 0 | 1 | 2 | 3 | 4

export interface BizRef {
  bizType: string
  bizId: string
}

/** 精简审批单：只够列表判断状态与打开详情 */
export interface ApprovalBrief {
  /** 雪花 ID，后端按字符串返回，前端不要转 Number */
  id: string
  bizType: string
  bizId: string
  status: ApprovalStatus
  statusName?: string
  title?: string
  finishedAt?: string | null
}

export interface ApprovalTask {
  id: string
  stepSeq: number
  stepName?: string
  nodeName?: string
  approverName?: string
  approverId?: string
  status: number
  statusName?: string
  opinion?: string
  actedAt?: string
  createdAt?: string
}

export interface ApprovalStep {
  seq: number
  name: string
  state?: string
}

export interface ApprovalInstance {
  id: string
  bizType: string
  bizId: string
  title: string
  applicantName?: string
  status: ApprovalStatus
  statusName?: string
  createdAt?: string
  finishedAt?: string
  steps?: ApprovalStep[]
  tasks?: ApprovalTask[]
}

export function fetchLatestApprovals(refs: BizRef[]) {
  return request.post<never, ApprovalBrief[]>('/api/accounts/approvals/latest-batch', refs)
}

export function fetchApprovalDetail(id: string) {
  return request.get<never, ApprovalInstance>(`/api/accounts/approvals/${id}`)
}

/** 一行 × 该页可能出现的业务类型，拼成批量查询入参（一次请求，别逐行发） */
export function buildBizRefs(ids: (string | number)[], bizTypes: string[]): BizRef[] {
  const out: BizRef[] = []
  for (const id of ids) {
    for (const bizType of bizTypes) {
      out.push({ bizType, bizId: String(id) })
    }
  }
  return out
}

export function briefsForRow(briefs: ApprovalBrief[], id: string | number): ApprovalBrief[] {
  const key = String(id)
  return (briefs || []).filter((b) => b && b.bizId === key)
}

/** 一行有多张终态单时取最近终审的一张 */
export function pickFinalBrief(briefs: ApprovalBrief[]): ApprovalBrief | null {
  const finals = (briefs || []).filter((b) => b && b.status !== 0)
  if (!finals.length) return null
  return finals.reduce((a, b) => ((b.finishedAt || '') > (a.finishedAt || '') ? b : a))
}

/**
 * 该行真正处于「在途」的审批单。业务行上的 approvalInstanceId 不能直接信任
 * （终审回调可能没清掉），以审批中心返回的真实 status 为准；
 * 审批中心完全没返回数据时才回退到业务行实例号。
 */
export function runningBriefOf(
  briefs: ApprovalBrief[],
  fallbackInstanceId?: string | number | null,
  fallbackBizType?: string | null
): ApprovalBrief | null {
  const list = briefs || []
  const inFlight = list.find((b) => b && b.status === 0)
  if (inFlight) return inFlight
  if (!list.length && fallbackInstanceId != null && fallbackInstanceId !== '') {
    return { id: String(fallbackInstanceId), bizId: '', bizType: fallbackBizType || '', status: 0 }
  }
  return null
}

/** 只认最近一张被驳回的单；通过 / 撤回 / 终止不再展示任何提示 */
export function rejectedBriefOf(briefs: ApprovalBrief[]): ApprovalBrief | null {
  const b = pickFinalBrief(briefs)
  return b && b.status === 2 ? b : null
}

const BIZ_NAMES: Record<string, string> = {
  'cms.article_publish': '内容发布'
}

export function approvalRunningLabel(bizType?: string | null): string {
  return `${BIZ_NAMES[bizType || ''] || '内容'}审批中`
}

export function approvalRejectedLabel(bizType?: string | null): string {
  return `${BIZ_NAMES[bizType || ''] || '内容'}审批被驳回`
}

export const INSTANCE_STATUS_NAME: Record<number, string> = {
  0: '审批中', 1: '已通过', 2: '已驳回', 3: '已撤回', 4: '已终止'
}

export const TASK_STATUS_NAME: Record<number, string> = {
  0: '待审批', 1: '已通过', 2: '已驳回', 3: '已跳过', 4: '已取消', 9: '已转办'
}
