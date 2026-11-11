<script setup lang="ts">
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRoute } from 'vue-router'

const user = useUserStore()
const route = useRoute()

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
  <RouterView />
</template>
