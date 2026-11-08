/**
 * 后端时间戳是 LocalDateTime 序列化出来的 ISO 串（2026-11-03T23:15:24），
 * 直接展示会带 T 很难读；这里只做呈现层转换，不做时区换算。
 * 空/非法输入原样返回，避免把 null 渲染成 "Invalid Date"。
 */
export function fmtTime(v?: string | null): string {
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return v.replace('T', ' ').slice(0, 19)
  return v
}
