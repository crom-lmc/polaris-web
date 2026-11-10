import request from './request'

/**
 * 面试待办：数据在 EHR 服务（/api/ehr/recruits/interviews）。
 * 接口按登录账号返回本人的面试，不接收账号ID。
 */
export interface MyInterview {
  id: string
  candidateId: string
  candidateName: string
  position: string
  roundNo: number
  scheduledAt?: string
  method?: string
  location?: string
  status: string
  score?: number
  feedback?: string
  result?: 'PASS' | 'FAIL'
  interviewNo?: string
  feedbackAt?: string
}

export function fetchMyInterviews() {
  return request.get<never, { data: MyInterview[] }>('/api/ehr/recruits/interviews/my')
}

export function submitInterviewFeedback(
  id: string,
  body: { score?: number; feedback: string; result: 'PASS' | 'FAIL' }
) {
  return request.post<never, { data: unknown }>(`/api/ehr/recruits/interviews/${id}/feedback`, body)
}
