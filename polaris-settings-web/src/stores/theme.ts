import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'settings_theme'
/*
 * 跨应用主题同步：各应用端口 / 子域不同，localStorage 天然不互通，
 * 因此统一用同域名下的 cookie 作为共享偏好（同主机不同端口、同顶级域的子域都能读到）。
 */
const THEME_COOKIE = 'polaris_theme'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** 读共享主题 cookie；没有或值非法返回 null */
function readCookieMode(): ThemeMode | null {
  try {
    const hit = document.cookie.split('; ').find((item) => item.startsWith(`${THEME_COOKIE}=`))
    const value = hit ? hit.slice(THEME_COOKIE.length + 1) : ''
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

/** 写共享主题 cookie；settings.xckj.com 这类多级域名写到顶级域，子应用才能共享 */
function writeCookieMode(mode: ThemeMode) {
  try {
    const host = window.location.hostname
    const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    const parts = host.split('.')
    const domain = !isIpv4 && parts.length >= 3 ? `; domain=.${parts.slice(-2).join('.')}` : ''
    document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${domain}`
  } catch {
    /* cookie 不可用（如部分隐私模式）时忽略，仍用 localStorage 兜底 */
  }
}

/** 解析初始主题：共享 cookie 优先，其次本应用 localStorage，最后跟随系统偏好 */
function resolveInitial(): ThemeMode {
  const shared = readCookieMode()
  if (shared) return shared
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch {
    /* localStorage / matchMedia 不可用（如隐私模式）时回退默认 */
  }
  return 'light'
}

/** 把主题同步到 <html data-theme>、共享 cookie 与 localStorage —— 自定义 CSS 变量靠它驱动 */
function applyDom(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
  writeCookieMode(mode)
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* 忽略写入失败 */
  }
}

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>(resolveInitial())

  // 兜底同步：index.html 内联脚本已在首屏前设过 data-theme，这里确保 store 与 DOM 一致
  applyDom(mode.value)

  // 从其它应用切回本页时，若共享 cookie 已变化则同步主题，保证各应用一致
  window.addEventListener('focus', () => {
    const shared = readCookieMode()
    if (shared && shared !== mode.value) mode.value = shared
  })

  /** 交给 a-config-provider 的 Ant 主题：算法切换 + 统一主色 + 深色协调修正 */
  const antTheme = computed(() => {
    const isDark = mode.value === 'dark'
    return {
      algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: '#2f54eb',
        borderRadius: 6
      },
      components: {
        // 注：antd-vue 4.2.6 的 Layout 深色 siderBg/headerBg/bodyBg token 实测不生效，
        // 顶栏/侧栏/内容区底色改由 global.css 的 --header-bg/--sider-bg/--bg-page 驱动
        // 软化菜单选中态：用半透明品牌蓝而非 antd 默认的实心亮蓝块
        Menu: {
          itemSelectedBg: isDark ? 'rgba(47, 84, 235, 0.20)' : '#e6ebff',
          itemSelectedColor: isDark ? 'rgba(255, 255, 255, 0.95)' : '#2f54eb',
          itemHoverBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
          itemColor: isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.88)'
        },
        // 卡片底色比页面略亮，形成统一的"唯一浮起面"，深浅一致
        Card: {
          colorBgContainer: isDark ? '#161a22' : '#ffffff'
        },
        // 左侧导航树与人员管理组织树保持一致：选中不铺底、悬浮中性灰
        Tree: {
          nodeSelectedBg: 'transparent',
          nodeHoverBg: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)'
        }
      }
    }
  })

  function setMode(m: ThemeMode) {
    mode.value = m
  }

  function toggle() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  watch(mode, (m) => applyDom(m))

  return { mode, antTheme, setMode, toggle }
})
