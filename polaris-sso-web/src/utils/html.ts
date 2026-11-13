import DOMPurify from 'dompurify'

/** 所有通知富文本在注入 v-html 前统一清洗。 */
export function sanitizeHtml(html?: string | null): string {
  return DOMPurify.sanitize(html || '')
}
