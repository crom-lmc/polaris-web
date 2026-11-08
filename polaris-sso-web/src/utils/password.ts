/**
 * 密码强度策略（前端校验口径）。
 * 与后端 com.laimengchao.sso.account.security.PasswordPolicy 保持一致：
 *   - 长度 ≥ 8
 *   - 禁止危险特殊字符（shell / HTML / SQL 元字符与空白）
 *   - 大写字母、小写字母、数字、特殊字符四类，至少满足三类
 */

export const PASSWORD_MIN_LEN = 8

/** 危险特殊字符：与后端 DANGEROUS 完全一致。 */
export const DANGEROUS_CHARS = '<>"\'\\`|;&$(){}[]%~ \t'

export type PwdCheckKey = 'len' | 'upper' | 'lower' | 'digit' | 'special'

export interface PwdCheck {
  key: PwdCheckKey
  label: string
  ok: boolean
}

export interface PwdResult {
  ok: boolean
  error: string
  types: number
  checks: PwdCheck[]
}

function isUpper(c: string): boolean {
  return c >= 'A' && c <= 'Z'
}
function isLower(c: string): boolean {
  return c >= 'a' && c <= 'z'
}
function isDigit(c: string): boolean {
  return c >= '0' && c <= '9'
}
function isAllowedSpecial(c: string): boolean {
  return !isUpper(c) && !isLower(c) && !isDigit(c) && !DANGEROUS_CHARS.includes(c)
}

/** 校验密码，返回是否通过、首个失败原因，以及逐项清单（用于实时渲染要求列表）。 */
export function checkPassword(pwd: string): PwdResult {
  const chars = [...pwd]
  const checks: PwdCheck[] = [
    { key: 'len', label: `至少 ${PASSWORD_MIN_LEN} 位`, ok: pwd.length >= PASSWORD_MIN_LEN },
    { key: 'upper', label: '包含大写字母', ok: chars.some(isUpper) },
    { key: 'lower', label: '包含小写字母', ok: chars.some(isLower) },
    { key: 'digit', label: '包含数字', ok: chars.some(isDigit) },
    { key: 'special', label: '包含特殊字符', ok: chars.some(isAllowedSpecial) }
  ]

  if (!pwd) {
    return { ok: false, error: '请输入新密码', types: 0, checks }
  }
  if (pwd.length < PASSWORD_MIN_LEN) {
    return { ok: false, error: `密码至少 ${PASSWORD_MIN_LEN} 位`, types: 0, checks }
  }
  const danger = chars.find((c) => DANGEROUS_CHARS.includes(c))
  if (danger) {
    const name = danger === ' ' ? '空格' : danger === '\t' ? '制表符' : danger
    return { ok: false, error: `密码包含不允许的危险字符：${name}`, types: 0, checks }
  }
  const types = checks.filter((c) => c.key !== 'len' && c.ok).length
  if (types < 3) {
    return {
      ok: false,
      error: '密码需包含大写字母、小写字母、数字、特殊字符中至少 3 类',
      types,
      checks
    }
  }
  return { ok: true, error: '', types, checks }
}

/** 强度等级 0-4（0=未通过或不合规，1=弱，2=中，3=强，4=极强）。 */
export function passwordStrength(pwd: string): number {
  if (!pwd) return 0
  const r = checkPassword(pwd)
  if (!r.ok) return 0
  let s = 1
  if (pwd.length >= 12) s++
  if (r.types >= 4) s++
  if (pwd.length >= 16) s++
  return Math.min(4, s)
}

export const STRENGTH_META: { text: string; color: string }[] = [
  { text: '', color: '' },
  { text: '弱', color: '#f5222d' },
  { text: '中', color: '#fa8c16' },
  { text: '强', color: '#2f54eb' },
  { text: '极强', color: '#52c41a' }
]
