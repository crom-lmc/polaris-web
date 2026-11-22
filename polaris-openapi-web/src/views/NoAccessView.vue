<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="no-access">
    <a-result status="403" title="403" sub-title="抱歉，你没有访问该页面的权限">
      <template #extra>
        <a-button type="primary" @click="router.replace('/dashboard')">返回概览</a-button>
      </template>
    </a-result>
  </div>
</template>

<style scoped>
.no-access {
  min-height: 60vh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
