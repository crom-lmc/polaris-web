<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'

const user = useUserStore()
const themeStore = useThemeStore()

const themeConfig = computed(() => ({
  ...themeStore.antTheme,
  algorithm: themeStore.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
}))

onMounted(async () => {
  // 首次导航是异步的，挂载时 route.path 可能仍是初始值 "/"；
  // 这里直接用浏览器地址判断，避免回调页误触发授权跳转打断 code 交换。
  if (window.location.pathname.startsWith('/callback')) return
  try {
    await user.ensureLogin()
  } catch {
    // ensureLogin 内部已跳 SSO
  }
})
</script>

<template>
  <a-config-provider :theme="themeConfig" :locale="zhCN">
    <RouterView />
  </a-config-provider>
</template>
