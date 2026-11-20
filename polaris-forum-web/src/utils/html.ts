import DOMPurify from 'dompurify'

const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote']
const richTextStart = /^<(?:p|h2|h3|ul|ol|blockquote)(?:\s[^>]*)?>/i

export function isRichText(value: string) {
  return richTextStart.test(value.trim())
}

export function sanitizeRichText(value: string) {
  return DOMPurify.sanitize(value || '', {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [],
    ALLOW_ARIA_ATTR: false,
    ALLOW_DATA_ATTR: false
  }).trim()
}

/** 把历史数据里字面的 \n \r \t 转义串还原为真实字符，避免当成文字显示 */
export function cleanLiteralEscapes(value: string): string {
  if (!value) return ''
  return value.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\t/g, ' ')
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function legacyTextToHtml(value: string) {
  return escapeHtml(cleanLiteralEscapes(value).replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>')
}

export function toEditorHtml(value: string) {
  if (!value) return ''
  return isRichText(value) ? sanitizeRichText(value) : `<p>${legacyTextToHtml(value)}</p>`
}

export function richTextDisplayHtml(value: string) {
  if (!value) return ''
  return isRichText(value) ? sanitizeRichText(value) : legacyTextToHtml(value)
}

export function richTextToPlainText(value: string) {
  if (!value) return ''
  if (!isRichText(value)) return value.replace(/\r\n?/g, '\n').trim()
  const withBreaks = sanitizeRichText(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|h2|h3|li|blockquote|ul|ol)>/gi, '\n')
  const document = new DOMParser().parseFromString(withBreaks, 'text/html')
  return (document.body.textContent || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
