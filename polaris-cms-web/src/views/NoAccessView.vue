<template>
  <a-card>
    <a-result status="403" title="没有权限" sub-title="你没有访问该页面的按钮权限，请联系管理员在统一账号中心授权。">
      <template #extra>
        <a-button type="primary" @click="$router.push('/dashboard')">返回概览</a-button>
      </template>
    </a-result>
  </a-card>
</template>
