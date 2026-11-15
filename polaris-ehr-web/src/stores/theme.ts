import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'

export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'ehr_theme'

/** 解析初始主题：localStorage 优先，其次跟随系统偏好 */
function resolveInitial(): ThemeMode {
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

/** 把主题同步到 <html data-theme> 与 localStorage —— 自定义 CSS 变量靠它驱动 */
function applyDom(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode)
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
