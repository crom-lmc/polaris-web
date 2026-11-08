<template>
  <div class="oauth-page">
    <div class="box">
      <template v-if="error">
        <div class="icon error">!</div>
        <h2>授权失败</h2>
        <p class="desc">{{ error }}</p>
        <button class="btn" @click="retry">重新授权</button>
      </template>
      <template v-else>
        <div class="icon spin">↻</div>
        <h2>正在跳转到应用…</h2>
        <p class="desc">即将携带授权凭证返回 {{ appName || '请求的应用' }}，请稍候</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { oauthAuthorize } from '@/api/oauth'

/**
 * OAuth2 /authorize 的前端落点（A 档）。
 * <p>
 * 路由守卫已保证到这里时要么有本地令牌、要么有中心会话 cookie；
 * 本页只做一件事：把 authorize 请求发给 SSO，拿 redirectTo 原地 replace 过去。
 * 对自有应用一律静默签码（不弹同意页），授权码一次性、5 分钟有效。
 */
const route = useRoute()
const error = ref('')
const appName = ref('')

function q(name: string): string {
  return (route.query[name] as string) || ''
}

onMounted(async () => {
  const responseType = q('response_type')
  const clientId = q('client_id')
  const redirectUri = q('redirect_uri')
  if (!clientId || !redirectUri) {
    error.value = '缺少 client_id 或 redirect_uri 参数'
    return
  }
  if (responseType && responseType !== 'code') {
    error.value = '仅支持 response_type=code'
    return
  }
  try {
    const res = await oauthAuthorize({
      responseType: 'code',
      clientId,
      redirectUri,
      scope: q('scope') || undefined,
      state: q('state') || undefined,
      codeChallenge: q('code_challenge') || undefined,
      codeChallengeMethod: q('code_challenge_method') || undefined
    })
    // replace：授权码一次性，不允许用户按返回键重放
    window.location.replace(res.data.redirectTo)
  } catch (e: any) {
    error.value = e?.message || '授权请求失败'
  }
})

function retry() {
  window.location.reload()
}
</script>

<style scoped>
/* 与登录页同一套主题变量：深浅色自动适配 */
.oauth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
  color: var(--text-base);
}

.box {
  width: 360px;
  padding: 40px 32px;
  text-align: center;
  border-radius: 12px;
  background: var(--login-card-bg);
  box-shadow: var(--login-card-shadow);
}

.icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 22px;
  font-weight: 700;
  background: rgba(47, 84, 235, 0.12);
  color: #2f54eb;
}

.icon.error {
  background: rgba(207, 19, 34, 0.12);
  color: #cf1322;
}

.icon.spin {
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h2 {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--muted);
  word-break: break-all;
}

.btn {
  padding: 8px 24px;
  border: none;
  border-radius: 6px;
  background: #2f54eb;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.btn:hover {
  background: #1d39c4;
}
</style>
