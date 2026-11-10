import request from './request'

export interface JobPostItem {
  id: string
  jobNo: string
  title: string
  orgPath?: string
  jobType?: string
  workCity?: string
  headcount?: number
  salaryRange?: string
  educationReq?: string
  experienceReq?: string
  description?: string
  requirement?: string
  tags?: string
  closeAt?: string
  applyCount?: number
}

export interface JobPage {
  list: JobPostItem[]
  total: number
}

export interface ApplyRound {
  roundNo: number
  label: string
  time?: string
  /** ONSITE/VIDEO/PHONE */
  method?: string
  methodLabel?: string
  /** 面试地址或会议链接 */
  location?: string
  /** PENDING 待面试 / PASS 已通过 / FAIL 未通过 */
  status: string
  statusLabel: string
}

export interface ApplyResult {
  trackCode: string
  candidateName: string
  jobTitle: string
  stage: string
  stageLabel: string
  appliedAt?: string
  lastStageAt?: string
  timeline: Array<{ stage: string; label: string; time?: string; done?: boolean }>
  rounds?: ApplyRound[]
}

export const fetchJobs = (params: { keyword?: string; jobType?: string; page?: number; size?: number }) =>
  request.get<never, JobPage>('/api/ehr/public/recruit/jobs', { params })

export const fetchJob = (id: string) =>
  request.get<never, JobPostItem>(`/api/ehr/public/recruit/jobs/${id}`)

export function applyJob(id: string, form: FormData) {
  return request.post<never, ApplyResult>(`/api/ehr/public/recruit/jobs/${id}/apply`, form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const fetchProgress = (trackCode: string, mobile: string) =>
  request.get<never, ApplyResult>('/api/ehr/public/recruit/progress', {
    params: { trackCode, mobile }
  })

export const jobTypeText = (t?: string) =>
  t === 'INTERN' ? '实习' : t === 'PART_TIME' ? '兼职' : '全职'
