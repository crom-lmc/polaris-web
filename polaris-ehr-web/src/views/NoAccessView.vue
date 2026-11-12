<template>
  <a-card>
    <a-result
      status="403"
      title="没有权限"
      sub-title="当前账号没有该页面的权限码，请联系管理员在统一账号中心为你的角色授权（EHR 基本功能 / 请假审批）。"
    >
      <template #extra>
        <a-button type="primary" @click="$router.push('/dashboard')">返回概览</a-button>
      </template>
    </a-result>
  </a-card>
</template>
