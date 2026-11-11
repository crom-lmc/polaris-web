/** 后端 LocalDateTime 序列化为 2026-11-12T02:30:00，展示统一成空格分隔 */
export function formatDateTime(v?: string | null): string {
  if (!v) return '—'
  return v.replace('T', ' ').slice(0, 19)
}

export function formatDuration(ms?: number | null): string {
  if (ms == null) return '—'
  const s = ms / 1000
  return `${s >= 10 ? s.toFixed(0) : s.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}s`
}

/** 雪花 ID 是十进制字符串，按长度 + 字典序倒序比较，避免 Number 精度问题 */
export function compareIdDesc(a: string, b: string): number {
  if (a.length !== b.length) return b.length - a.length
  return b.localeCompare(a)
}
