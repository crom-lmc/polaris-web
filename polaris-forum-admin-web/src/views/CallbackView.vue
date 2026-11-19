<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { callbackUrl, consumeState, exchangeCode, gotoAuthorize, takeRedirect } from '@/api/forum'
import { useUserStore } from '@/stores/user'
import { setTokens } from '@/utils/token'

const router = useRouter()
const store = useUserStore()
const error = ref('')

onMounted(async () => {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = consumeState()

  if (!code) {
    if (url.searchParams.get('expired') === '1') {
      const redirect = url.searchParams.get('redirect')
      gotoAuthorize(redirect?.startsWith('/') ? redirect : takeRedirect())
      return
    }
    error.value = url.searchParams.get('error_description') || '授权失败：未返回授权码'
    return
  }
  if (expected && expected !== state) {
    error.value = '授权状态校验失败，请重新登录'
    return
  }
  try {
    const result = await exchangeCode(code, callbackUrl())
    setTokens(result.accessToken, result.refreshToken)
    if (!(await store.bootstrap())) throw new Error('获取论坛管理员身份失败')
    await router.replace(takeRedirect())
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '换取令牌失败'
  }
})
</script>

<template>
  <div class="callback">
    <a-card v-if="error" class="callback-card" title="登录失败">
      <p>{{ error }}</p>
      <a-button type="primary" @click="gotoAuthorize(takeRedirect())">重新登录</a-button>
    </a-card>
    <a-spin v-else size="large" tip="正在登录论坛管理端…" />
  </div>
</template>

<style scoped>
.callback { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-page); }
.callback-card { width: min(420px, calc(100vw - 32px)); }
</style>
