<template>
  <div class="no-access">
    <el-result icon="warning" title="没有可访问的页面" sub-title="当前账号在该系统里没有被授予任何权限，请联系管理员分配角色。">
      <template #extra>
        <el-button @click="recheck">重新检查</el-button>
        <el-button type="primary" @click="signOut">退出登录</el-button>
      </template>
    </el-result>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { redirectToSsoLogin, redirectToSsoLogout } from '@/api/sso'

const auth = useAuthStore()
const router = useRouter()

/** 管理员刚授完权：重新拉一次身份，能进就直接进 */
async function recheck() {
  auth.ready = false
  auth.user = null
  const ok = await auth.bootstrap()
  if (!ok) {
    redirectToSsoLogin()
    return
  }
  router.replace('/')
}

async function signOut() {
  await auth.logout()
  redirectToSsoLogout()
}
</script>

<style scoped>
.no-access {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
</style>
