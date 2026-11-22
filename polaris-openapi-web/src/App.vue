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
/* md-editor-v3 深色适配跟随 data-theme */
</style>
