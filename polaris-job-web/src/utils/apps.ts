/** 应用编码 → 展示名（与后端 appCode 对齐） */
const APP_LABELS: Record<string, string> = {
  ehr: 'EHR',
  settings: '配置中心',
  gateway: 'SSO 网关',
  cms: 'CMS',
  blog: '博客'
}

export const APP_CODES = ['ehr', 'settings', 'cms', 'blog', 'gateway']

export function appLabel(code?: string | null): string {
  if (!code) return '—'
  return APP_LABELS[code] || code
}
