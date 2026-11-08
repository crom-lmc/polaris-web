<template>
  <div class="sso-callback">
    <div class="box">
      <template v-if="error">
        <el-result icon="error" title="登录失败" :sub-title="error">
          <template #extra>
            <el-button type="primary" @click="retry">重新登录</el-button>
          </template>
        </el-result>
      </template>
      <template v-else>
        <el-icon class="spin" :size="28"><Loading /></el-icon>
        <p>正在完成登录…</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loading } from '@element-plus/icons-vue'
import { callbackUrl, checkOAuthState, exchangeCode, exchangeTicket, redirectToSsoLogin } from '@/api/sso'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const error = ref('')

/**
 * 单点的最后一跳（双协议兼容）：
 * - 新流程（OAuth2 A 档）：账号中心带 ?code&state 回来，这里校验 state 后
 *   用 code 换博客作用域令牌（appSecret 在后端）；
 * - 旧流程：?ticket=... 直接换。授权码/ticket 都是一次性短时效，必须用 replace
 *   而不是 push——不让用户按返回键把已用掉的凭据再提交一次。
 */
onMounted(async () => {
  const code = (route.query.code as string) || ''
  const ticket = (route.query.ticket as string) || ''
  try {
    let pair: { accessToken: string }
    if (code) {
      if (!checkOAuthState((route.query.state as string) || null)) {
        error.value = '登录状态校验失败（state 不匹配），请重新登录'
        return
      }
      pair = await exchangeCode(code, callbackUrl())
    } else if (ticket) {
      pair = await exchangeTicket(ticket)
    } else {
      error.value = '缺少登录凭证（code/ticket），请重新登录'
      return
    }
    auth.applyToken(pair.accessToken)
    const ok = await auth.bootstrap()
    if (!ok) {
      error.value = '无法获取账户信息，请重新登录'
      return
    }
    await router.replace({ path: '/' })
  } catch (e: any) {
    error.value = e?.message || '登录凭证无效或已过期'
  }
})

function retry() {
  redirectToSsoLogin()
}
</script>

<style scoped>
.sso-callback {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
}

.box {
  padding: 32px 48px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgb(20 25 40 / 8%);
  text-align: center;
  min-width: 320px;
}

.spin {
  color: var(--el-color-primary);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

p {
  margin: 12px 0 0;
  color: #6b7280;
  font-size: 14px;
}
</style>
