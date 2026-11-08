<template>
  <div class="pf">
    <a-card title="个人信息" :bordered="false" class="card">
      <a-descriptions :column="1" bordered>
        <a-descriptions-item label="登录名">{{ user?.username || '-' }}</a-descriptions-item>
        <a-descriptions-item label="昵称">{{ user?.nickname || '-' }}</a-descriptions-item>
        <a-descriptions-item label="身份">{{ user?.superAdmin ? '超级管理员' : '普通用户' }}</a-descriptions-item>
        <a-descriptions-item label="权限码">{{ user?.permissions?.length || 0 }} 项</a-descriptions-item>
        <a-descriptions-item label="可访问应用">
          <a-tag v-for="app in appList" :key="app.code" color="blue" style="margin: 2px">{{ app.name }}</a-tag>
          <span v-if="!appList.length">-</span>
        </a-descriptions-item>
      </a-descriptions>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const { user, appList } = storeToRefs(store)
</script>

<style scoped>
.pf {
  padding-top: 24px;
}
.card {
  max-width: 640px;
}
</style>
