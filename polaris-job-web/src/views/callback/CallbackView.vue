<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Result, Spin } from 'ant-design-vue'
import { useUserStore, callbackUrl } from '@/stores/user'

const router = useRouter()
const user = useUserStore()

const loading = ref(true)
const error = ref('')

function takeStates(): string[] {
  try {
    const raw = sessionStorage.getItem('job_oauth_states') || sessionStorage.getItem('job_oauth_state')
    sessionStorage.removeItem('job_oauth_states')
    sessionStorage.removeItem('job_oauth_state')
    sessionStorage.removeItem('job_oauth_at')
    if (!raw) return []
    return raw.trim().startsWith('[') ? JSON.parse(raw) : [raw]
  } catch {
    return []
  }
}

function takeRedirect(): string {
  try {
    const r = sessionStorage.getItem('job_oauth_redirect') || '/dashboard'
    sessionStorage.removeItem('job_oauth_redirect')
    // 历史版本可能把 /callback 自身存成回跳目标，落回去会立刻再次触发授权
    return !r || r === '/' || r.startsWith('/callback') ? '/dashboard' : r
  } catch {
    return '/dashboard'
  }
}

onMounted(async () => {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const expected = takeStates()

  if (!code) {
    // expired=1 表示接口 401 被踢回来：中心会话多半已失效，直接重走授权
    if (url.searchParams.get('expired') === '1') {
      user.gotoAuthorize('/dashboard')
      return
    }
    error.value = url.searchParams.get('error_description') || '授权失败：未返回授权码'
    loading.value = false
    return
  }
  // expected 是本标签页发起过的 state 列表（可能导致多轮授权），命中任意一个即可
  if (expected.length && state && !expected.includes(state)) {
    error.value = 'state 校验失败，请重新登录'
    loading.value = false
    return
  }
  try {
    await user.exchangeToken(code, callbackUrl())
    await router.replace(takeRedirect())
  } catch (e: unknown) {
    error.value = (e as Error).message || '换取令牌失败'
    loading.value = false
  }
})
</script>

<template>
  <div style="height:100vh; display:flex; align-items:center; justify-content:center">
    <Spin v-if="loading" size="large" tip="登录中..." />
    <Result v-else-if="error" status="error" title="登录失败" :sub-title="error" />
  </div>
</template>
