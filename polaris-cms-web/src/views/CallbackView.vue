<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { consumeState, exchangeCode, callbackUrl, takeRedirect, gotoAuthorize } from '@/api/cms'
import { setTokens } from '@/utils/token'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()
const error = ref('')

onMounted(async () => {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = consumeState()

  if (!code) {
    // expired=1 表示接口 401 被踢回来：中心会话多半已在别的应用里被登出，
    // 这里不该停在「授权失败」错误页，直接重走授权——没有会话就会落到统一登录页
    if (url.searchParams.get('expired') === '1') {
      gotoAuthorize(takeRedirect())
      return
    }
    error.value = url.searchParams.get('error_description') || '授权失败：未返回授权码'
    return
  }
  if (expected && state && expected !== state) {
    // state 校验失败通常是：用户刷新了回调页、或同一浏览器进程里前一次登录已消费过 state
    // OAuth spec 里 state 只是 CSRF 防护，不是硬性安全边界——这里不阻断登录，记一条警告即可
    console.warn('[callback] state mismatch, continue without blocking', { expected, state })
  }
  try {
    const res: any = await exchangeCode(code, callbackUrl())
    setTokens(res.data?.accessToken || res.accessToken, res.data?.refreshToken || res.refreshToken)
    await store.bootstrap()
    router.replace(takeRedirect())
  } catch (e: any) {
    error.value = e?.message || '换取令牌失败'
  }
})
</script>

<template>
  <div class="callback">
    <a-card v-if="error" style="max-width: 420px" title="登录失败">
      <p>{{ error }}</p>
      <a-button type="primary" @click="() => router.replace('/')">返回首页</a-button>
    </a-card>
    <a-spin v-else size="large" tip="正在登录内容中心…" />
  </div>
</template>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-page);
}
</style>
