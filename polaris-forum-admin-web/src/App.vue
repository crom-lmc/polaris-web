<script setup lang="ts">
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useThemeStore } from '@/stores/theme'

const theme = useThemeStore()
</script>

<template>
  <a-config-provider :theme="theme.antTheme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>
