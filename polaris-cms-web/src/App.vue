<script setup lang="ts">
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()
const themeConfig = computed(() => {
  const base = themeStore.antTheme
  return {
    ...base,
    algorithm: themeStore.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
  }
})
</script>

<template>
  <a-config-provider :theme="themeConfig" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<style>
/* md-editor-v3 深色适配跟随 data-theme：
   MdEditor 传 theme="dark" 会挂 .md-editor-dark，但其内置底色是纯黑（#000），
   这里把变量覆盖成系统深色面板色，避免深色页面里嵌一块纯黑编辑器。 */
:root[data-theme='dark'] .md-editor {
  --md-color: rgba(255, 255, 255, 0.85);
  --md-hover-color: #ffffff;
  --md-bk-color: #161a22;
  --md-bk-color-outstand: #1b1e26;
  --md-bk-hover-color: #1f242e;
  --md-border-color: rgba(255, 255, 255, 0.12);
}

/* 右侧预览区的背景/边框变量直接定义在 .md-editor-preview 上，需单独覆盖 */
:root[data-theme='dark'] .md-editor .md-editor-preview {
  --md-theme-bg-color: #161a22;
  --md-theme-bg-color-inset: #1b1e26;
  --md-theme-border-color: rgba(255, 255, 255, 0.12);
  --md-theme-border-color-inset: rgba(255, 255, 255, 0.18);
}
</style>
