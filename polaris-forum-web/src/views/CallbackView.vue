<template>
  <div class="callback-standalone">
    <div v-if="error" class="callback-error-card">
      <h1>登录失败</h1>
      <p>{{ error }}</p>
      <button class="retry-button" @click="redirectToSsoLogin()">重新登录</button>
    </div>
    <div v-else class="callback-loading">正在登录社区论坛…</div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeCode } from '@/api/forum'
import { callbackUrl, consumeOauthState, redirectToSsoLogin, refreshCurrentUser, setTokens, takePostLoginRedirect } from '@/auth'

const route = useRoute()
const router = useRouter()
const error = ref('')

onMounted(async () => {
  const code = String(route.query.code || '')
  const state = String(route.query.state || '')
  const expected = consumeOauthState()
  if (!code) {
    error.value = String(route.query.error_description || '授权失败：未返回授权码')
    return
  }
  if (expected && expected !== state) {
    error.value = '登录状态校验失败，请重新发起统一登录'
    return
  }
  try {
    const tokens = await exchangeCode(code, callbackUrl())
    if (!tokens.accessToken) throw new Error('认证服务未返回访问令牌')
    setTokens(tokens.accessToken, tokens.refreshToken)
    const user = await refreshCurrentUser()
    if (!user) throw new Error('论坛登录状态加载失败，请重新登录')
    await router.replace(takePostLoginRedirect())
  } catch (e) {
    error.value = e instanceof Error ? e.message : '换取令牌失败'
  }
})
</script>

<style scoped>
.callback-standalone { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--soft); padding: 16px; }
.callback-error-card { width: min(420px, 100%); padding: 22px 24px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); box-shadow: 0 6px 24px rgba(0,0,0,.06); }
.callback-error-card h1 { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--text); }
.callback-error-card p { margin: 0 0 16px; font-size: 12px; line-height: 1.7; color: var(--muted); }
.retry-button { padding: 7px 14px; border: 1px solid var(--primary); border-radius: 8px; background: var(--primary); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }
.retry-button:hover { border-color: var(--primary-dark); background: var(--primary-dark); }
.callback-loading { font-size: 14px; color: var(--muted); }
</style>
