import { computed, ref } from 'vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'forum_theme'
const THEME_COOKIE = 'polaris_theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function readCookieMode(): ThemeMode | null {
  try {
    const hit = document.cookie.split('; ').find(item => item.startsWith(`${THEME_COOKIE}=`))
    const value = hit ? hit.slice(THEME_COOKIE.length + 1) : ''
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function writeCookieMode(mode: ThemeMode) {
  try {
    const host = window.location.hostname
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    const parts = host.split('.')
    const domain = !isIpv4 && parts.length >= 3 ? `; domain=.${parts.slice(-2).join('.')}` : ''
    document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}`
  } catch {
    /* Cookie 不可用时仍保留本应用主题。 */
  }
}

function resolveInitial(): ThemeMode {
  const shared = readCookieMode()
  if (shared) return shared
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* 回退浅色。 */
  }
  return 'light'
}

function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
  writeCookieMode(mode)
  try { localStorage.setItem(STORAGE_KEY, mode) } catch { /* 忽略存储失败 */ }
}

export const themeMode = ref<ThemeMode>(resolveInitial())
export const isDark = computed(() => themeMode.value === 'dark')

export function initTheme() {
  applyTheme(themeMode.value)
  window.addEventListener('focus', () => {
    const shared = readCookieMode()
    if (shared && shared !== themeMode.value) {
      themeMode.value = shared
      applyTheme(shared)
    }
  })
}

export function toggleTheme() {
  themeMode.value = isDark.value ? 'light' : 'dark'
  applyTheme(themeMode.value)
}
