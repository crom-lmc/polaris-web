<template>
  <div class="container callback-page">
    <section class="panel callback-card">
      <div class="login-symbol"><safety-certificate-outlined /></div>
      <span class="eyebrow">SSO CALLBACK</span>
      <h1>{{ error ? '统一登录失败' : '正在登录社区论坛' }}</h1>
      <p>{{ error || '正在使用一次性授权码换取论坛登录状态，请稍候。' }}</p>
      <div class="callback-actions">
        <button v-if="error" class="primary-button" @click="redirectToSsoLogin()">重新登录</button>
        <RouterLink to="/" class="secondary-button">返回社区首页</RouterLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SafetyCertificateOutlined } from '@ant-design/icons-vue'
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
    router.replace(takePostLoginRedirect())
  } catch (e) {
    error.value = e instanceof Error ? e.message : '换取令牌失败'
  }
})
</script>
