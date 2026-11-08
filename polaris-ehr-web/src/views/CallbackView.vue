<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { consumeState, exchangeCode, callbackUrl, takeRedirect, gotoAuthorize } from '@/api/ehr'
import { setTokens } from '@/utils/token'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()
const error = ref('')

/** 换票失败后不要只给「返回首页」——用户回首页还是会被踢回来，直接重走授权 */
function retry() {
  gotoAuthorize(takeRedirect())
}

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
    error.value = 'state 校验失败，请重新登录'
    return
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
    <a-card v-if="error" style="max-width: 460px" title="登录失败">
      <a-alert type="error" show-icon :message="error" style="margin-bottom: 16px" />
      <a-space>
        <a-button type="primary" @click="retry">重新登录</a-button>
        <a-button @click="() => router.replace('/')">返回首页</a-button>
      </a-space>
    </a-card>
    <a-spin v-else size="large" tip="正在登录人力中心…" />
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
