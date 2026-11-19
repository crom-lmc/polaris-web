import { computed, onMounted, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { theme as antdTheme } from 'ant-design-vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'forum_admin_theme'
const THEME_COOKIE = 'polaris_theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function readCookieMode(): ThemeMode | null {
  try {
    const hit = document.cookie.split('; ').find((item) => item.startsWith(`${THEME_COOKIE}=`))
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
    // localStorage 仍保留本应用主题
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
    // 使用默认浅色
  }
  return 'light'
}

function applyDom(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
  document.documentElement.style.colorScheme = mode
  writeCookieMode(mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 忽略本机存储失败
  }
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(resolveInitial())
  applyDom(mode.value)
  onMounted(() => applyDom(mode.value))

  window.addEventListener('focus', () => {
    const shared = readCookieMode()
    if (shared && shared !== mode.value) mode.value = shared
  })

  const antTheme = computed(() => {
    const dark = mode.value === 'dark'
    return {
      algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#2f54eb',
        borderRadius: 6
      },
      components: {
        Menu: {
          itemSelectedBg: dark ? 'rgba(47, 84, 235, 0.20)' : '#e6ebff',
          itemSelectedColor: dark ? 'rgba(255, 255, 255, 0.95)' : '#2f54eb',
          itemHoverBg: dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          itemColor: dark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.88)'
        },
        Card: {
          colorBgContainer: dark ? '#161a22' : '#ffffff'
        }
      }
    }
  })

  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  watch(mode, applyDom)
  return { mode, antTheme, toggle }
})
