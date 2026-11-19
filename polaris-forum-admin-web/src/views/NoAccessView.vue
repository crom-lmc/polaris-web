<script setup lang="ts">
import { computed } from 'vue'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const target = computed(() => {
  const pages = [
    { path: '/threads', perm: 'forum:content' },
    { path: '/comments', perm: 'forum:comment' },
    { path: '/sensitive-words', perm: 'forum:sensitive' },
    { path: '/exchanges', perm: 'forum:exchange' },
    { path: '/badges', perm: 'forum:badge' }
  ]
  return pages.find((page) => store.can(page.perm))?.path || ''
})
</script>

<template>
  <a-card>
    <a-result status="403" title="没有权限" sub-title="你没有访问该页面的权限，请联系管理员在统一账号中心授权。">
      <template v-if="target" #extra>
        <a-button type="primary" @click="$router.replace(target)">返回可访问页面</a-button>
      </template>
    </a-result>
  </a-card>
</template>
