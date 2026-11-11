<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useRoute } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'

const user = useUserStore()
const route = useRoute()
const themeStore = useThemeStore()

const themeConfig = computed(() => ({
  ...themeStore.antTheme,
  algorithm: themeStore.mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm
}))

onMounted(async () => {
  if (route.path.startsWith('/callback')) return
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
