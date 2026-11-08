import request from './request'

/** 安全配置（后端单行配置，布尔字段以 1/0 存库、接口返回 true/false） */
export interface SecurityConfig {
  id?: number
  /** RANDOM 随机 / FIXED 固定 */
  initialPasswordMode: 'RANDOM' | 'FIXED'
  defaultPassword: string
  /** 逗号分隔：DIGIT/UPPER/LOWER/SPECIAL */
  passwordRules: string
  passwordMinLength: number
  passwordMaxLength: number
  /** ACCOUNT 账号密码锁 / EMAIL 邮箱验证锁 */
  passwordLockMode: 'ACCOUNT' | 'EMAIL'
  loginFailLimit: number
  loginFailLockMinutes: number
  loginFailDetectCount: number
  forceChangePassword: boolean
  sessionTimeoutMinutes: number
  maxLoginErrorCount: number
  userLockMinutes: number
  emailCodeDigits: number
  verifyCodeExpireMinutes: number
  updatedBy?: string
  createdAt?: string
  updatedAt?: string
}

/** 保存入参：密码规则由前端多选数组提交，后端拼成逗号串 */
export type SecurityConfigBody = Omit<
  SecurityConfig,
  'id' | 'passwordRules' | 'updatedBy' | 'createdAt' | 'updatedAt'
> & { passwordRules: string[] }

export function fetchSecurityConfig() {
  return request.get<never, SecurityConfig>('/api/settings/security')
}

export function saveSecurityConfig(body: SecurityConfigBody) {
  return request.put<never, SecurityConfig>('/api/settings/security', body)
}
