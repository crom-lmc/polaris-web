<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { callbackUrl, consumeState, exchangeCode, takeRedirect } from '@/api/portal'
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
    error.value = url.searchParams.get('error_description') || '授权失败：未返回授权码'
    return
  }
  if (expected && state && expected !== state) {
    error.value = 'state 校验失败，请重新登录'
    return
  }
  try {
    const res: any = await exchangeCode(code, callbackUrl())
    setTokens(res?.accessToken || res?.data?.accessToken, res?.refreshToken || res?.data?.refreshToken)
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
    <a-spin v-else size="large" tip="正在登录内容门户…" />
  </div>
</template>

<style scoped>
.callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
</style>
