<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()

onMounted(() => {
  const pages = [
    { path: '/threads', perm: 'forum:content' },
    { path: '/comments', perm: 'forum:comment' },
    { path: '/reports', perm: 'forum:report' },
    { path: '/taxonomy', perm: 'forum:taxonomy' },
    { path: '/site', perm: 'forum:site' },
    { path: '/sensitive-words', perm: 'forum:sensitive' },
    { path: '/exchanges', perm: 'forum:exchange' },
    { path: '/badges', perm: 'forum:badge' }
  ]
  const target = pages.find((page) => store.can(page.perm))?.path || '/no-access'
  void router.replace(target)
})
</script>

<template>
  <div class="redirecting"><a-spin tip="正在进入管理页面…" /></div>
</template>

<style scoped>
.redirecting { min-height: 240px; display: grid; place-items: center; }
</style>
