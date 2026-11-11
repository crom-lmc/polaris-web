const ACCESS_TOKEN = 'job_access_token'
const REFRESH_TOKEN = 'job_refresh_token'
const ACCOUNT_ID = 'job_account_id'
const ACCOUNT_NAME = 'job_account_name'
const ACCOUNT_SUPER = 'job_account_super'
const ACCOUNT_PERMS = 'job_account_perms'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN)
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN, token)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN, token)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN)
  localStorage.removeItem(REFRESH_TOKEN)
  localStorage.removeItem(ACCOUNT_ID)
  localStorage.removeItem(ACCOUNT_NAME)
  localStorage.removeItem(ACCOUNT_SUPER)
  localStorage.removeItem(ACCOUNT_PERMS)
}

export function getAccountId(): string {
  return localStorage.getItem(ACCOUNT_ID) || ''
}
export function setAccountId(v: string) {
  localStorage.setItem(ACCOUNT_ID, v)
}
export function getAccountName(): string {
  return localStorage.getItem(ACCOUNT_NAME) || ''
}
export function setAccountName(v: string) {
  localStorage.setItem(ACCOUNT_NAME, v)
}
export function getAccountSuper(): boolean {
  return localStorage.getItem(ACCOUNT_SUPER) === '1'
}
export function setAccountSuper(v: boolean) {
  localStorage.setItem(ACCOUNT_SUPER, v ? '1' : '0')
}
export function getAccountPerms(): string[] {
  const raw = localStorage.getItem(ACCOUNT_PERMS)
  if (!raw) return []
  try {
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}
export function setAccountPerms(v: string[]) {
  localStorage.setItem(ACCOUNT_PERMS, JSON.stringify(v))
}
