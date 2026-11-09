<template>
  <div class="login-shell">
    <a-button
      type="text"
      class="theme-toggle"
      :title="theme.mode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
      @click="theme.toggle()"
    >
      <ThemeToggleIcon :mode="theme.mode" />
    </a-button>
    <div class="login-card">
      <div class="brand">
        <div class="logo">SSO</div>
        <div>
          <h1>统一账号中心</h1>
          <p v-if="appName">正在登录「{{ appName }}」</p>
          <p v-else>一个账号，通行所有应用</p>
        </div>
      </div>

      <!-- 先判断登录态再渲染表单：否则从其他应用单点过来时会闪一下登录框 -->
      <div v-if="checking" class="checking">
        <a-spin />
        <span>正在检查登录状态…</span>
      </div>

      <template v-else>
        <a-alert
          v-if="message"
          :message="message"
          type="error"
          show-icon
          style="margin-bottom: 16px"
        />

        <a-tabs v-model:active-key="tab">
          <a-tab-pane key="password" tab="账号密码">
            <a-form :model="pwdForm" layout="vertical" @finish="handlePasswordLogin">
              <a-form-item
                label="登录名 / 邮箱"
                name="username"
                :rules="[{ required: true, message: '请输入登录名或邮箱' }]"
              >
                <a-input
                  v-model:value="pwdForm.username"
                  size="large"
                  placeholder="登录名或邮箱"
                  autocomplete="username"
                />
              </a-form-item>

              <a-form-item
                label="密码"
                name="password"
                :rules="[{ required: true, message: '请输入密码' }]"
              >
                <a-input-password
                  v-model:value="pwdForm.password"
                  size="large"
                  placeholder="密码"
                  autocomplete="current-password"
                />
              </a-form-item>

              <a-button type="primary" size="large" block html-type="submit" :loading="submitting">
                登录
              </a-button>
              <div class="forgot-row">
                <a @click="openForgot">忘记密码？</a>
              </div>
            </a-form>
          </a-tab-pane>

          <a-tab-pane key="email" tab="邮箱验证码">
            <a-form :model="emailForm" layout="vertical" @finish="handleEmailLogin">
              <a-form-item
                label="邮箱"
                name="email"
                :rules="[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '邮箱格式不正确' }
                ]"
              >
                <a-input v-model:value="emailForm.email" size="large" placeholder="you@example.com" />
              </a-form-item>

              <a-form-item
                label="验证码"
                name="code"
                :rules="[{ required: true, message: '请输入验证码' }]"
              >
                <div class="code-row">
                  <a-input
                    v-model:value="emailForm.code"
                    size="large"
                    placeholder="6 位验证码"
                    :maxlength="6"
                  />
                  <a-button size="large" :disabled="countdown > 0" :loading="sending" @click="handleSendCode">
                    {{ countdown > 0 ? `${countdown}s` : '发送验证码' }}
                  </a-button>
                </div>
              </a-form-item>

              <a-button type="primary" size="large" block html-type="submit" :loading="submitting">
                登录
              </a-button>
            </a-form>
          </a-tab-pane>
        </a-tabs>

        <p class="hint">
          {{ appName ? '登录后自动返回应用，无需再次输入密码' : '登录后可在「概览」看到你有权访问的应用' }}
        </p>
      </template>
    </div>

    <!-- 忘记密码：邮箱验证码校验后直接设置新密码 -->
    <a-modal
      v-model:open="forgotOpen"
      title="重置密码"
      ok-text="重置密码"
      cancel-text="取消"
      :confirm-loading="forgotSubmitting"
      width="420px"
      centered
      @ok="handleForgotSubmit"
    >
      <a-alert
        v-if="forgotError"
        :message="forgotError"
        type="error"
        show-icon
        style="margin-bottom: 12px"
      />
      <a-form layout="vertical">
        <a-form-item label="邮箱" required>
          <a-input v-model:value="forgotForm.email" placeholder="接收验证码的邮箱" />
        </a-form-item>
        <a-form-item label="验证码" required>
          <div class="code-row">
            <a-input v-model:value="forgotForm.code" placeholder="6 位验证码" :maxlength="6" />
            <a-button :disabled="forgotCountdown > 0" :loading="forgotSending" @click="handleForgotSend">
              {{ forgotCountdown > 0 ? `${forgotCountdown}s` : '发送验证码' }}
            </a-button>
          </div>
        </a-form-item>
        <a-form-item label="新密码" required>
          <a-input-password v-model:value="forgotForm.newPassword" placeholder="至少 8 位" />
        </a-form-item>
        <a-form-item label="确认新密码" required>
          <a-input-password v-model:value="forgotForm.confirmPassword" placeholder="再次输入新密码" />
        </a-form-item>
      </a-form>
      <p class="hint">重置成功后请使用新密码重新登录。</p>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { applyTicket, login, loginByEmail, resetPasswordByCode, sendEmailCode, sendResetPasswordCode } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import ThemeToggleIcon from '@/components/ThemeToggleIcon.vue'
import { message as toast } from 'ant-design-vue'
import type { TokenResponse } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useUserStore()
const theme = useThemeStore()

/** 单点参数：?app=<应用编码>&redirect=<应用侧接收地址> */
const appCode = computed(() => (route.query.app as string) || '')
const redirectRaw = computed(() => (route.query.redirect as string) || '')

/**
 * 只接受站内相对路径做回跳。
 * 不做这层校验的话，?redirect=//evil.com 会把刚登录的用户直接送去钓鱼站。
 */
const safeInternalPath = computed(() => {
  const raw = redirectRaw.value
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return ''
})

const tab = ref<'password' | 'email'>('password')
const checking = ref(true)
const submitting = ref(false)
const sending = ref(false)
const countdown = ref(0)
const message = ref('')
const appName = ref('')
let timer: number | undefined

const pwdForm = reactive({ username: '', password: '' })
const emailForm = reactive({ email: '', code: '' })

/* 忘记密码 */
const forgotOpen = ref(false)
const forgotError = ref('')
const forgotSending = ref(false)
const forgotSubmitting = ref(false)
const forgotCountdown = ref(0)
const forgotForm = reactive({ email: '', code: '', newPassword: '', confirmPassword: '' })
let forgotTimer: number | undefined

onMounted(async () => {
  // 全局退出：应用侧主动 logout 会带 gl=1 跳回来。
  // 必须把账号中心自己的本地令牌一起清掉，否则下面 bootstrap 凭本地 token
  // 静默重登（silent SSO），违背「退出后需要重新登录统一账号中心」的承诺。
  if (route.query.gl === '1') {
    store.clear()
    // 去掉 gl 参数，避免刷新后反复清空；保留 app/redirect 以便登录后原路返回
    router
      .replace({ path: route.path, query: { app: appCode.value, redirect: redirectRaw.value } })
      .catch(() => {})
    checking.value = false
    return
  }

  // 已有登录态（本地 token 或中心会话 cookie）→ 直接放行，不再让用户输密码
  const loggedIn = await store.bootstrap()
  if (!loggedIn) {
    checking.value = false
    return
  }
  if (appCode.value) {
    await goToApp()
  } else {
    router.replace(safeInternalPath.value || '/dashboard')
  }
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
  if (forgotTimer) window.clearInterval(forgotTimer)
})

/** 申请票据并跳回应用（单点的最后一步） */
async function goToApp() {
  try {
    const res = await applyTicket({
      appCode: appCode.value,
      redirect: redirectRaw.value || undefined
    })
    appName.value = res.data.appName
    message.value = ''
    // 用 replace 而不是 href：票据是一次性的，不允许用户按返回键回来重放
    window.location.replace(res.data.redirectTo)
  } catch (e: any) {
    checking.value = false
    message.value = e?.message || '无法跳转到该应用，请联系管理员确认授权'
  }
}

async function afterLogin(tokens: TokenResponse) {
  store.applyTokens(tokens)
  if (appCode.value) {
    await goToApp()
  } else {
    router.replace(safeInternalPath.value || '/dashboard')
  }
}

async function handlePasswordLogin() {
  message.value = ''
  submitting.value = true
  try {
    const res = await login({ username: pwdForm.username, password: pwdForm.password })
    await afterLogin(res.data)
  } catch (e: any) {
    message.value = e?.message || '登录失败'
  } finally {
    submitting.value = false
  }
}

async function handleEmailLogin() {
  message.value = ''
  submitting.value = true
  try {
    const res = await loginByEmail({ email: emailForm.email, code: emailForm.code })
    await afterLogin(res.data)
  } catch (e: any) {
    message.value = e?.message || '登录失败'
  } finally {
    submitting.value = false
  }
}

function openForgot() {
  forgotError.value = ''
  forgotForm.email = pwdForm.username.includes('@') ? pwdForm.username : ''
  forgotOpen.value = true
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function handleForgotSend() {
  forgotError.value = ''
  if (!validEmail(forgotForm.email)) {
    forgotError.value = '请输入正确的邮箱'
    return
  }
  forgotSending.value = true
  try {
    await sendResetPasswordCode({ email: forgotForm.email })
    forgotCountdown.value = 60
    forgotTimer = window.setInterval(() => {
      forgotCountdown.value -= 1
      if (forgotCountdown.value <= 0 && forgotTimer) {
        window.clearInterval(forgotTimer)
        forgotTimer = undefined
      }
    }, 1000)
  } catch (e: any) {
    forgotError.value = e?.message || '验证码发送失败'
  } finally {
    forgotSending.value = false
  }
}

async function handleForgotSubmit() {
  forgotError.value = ''
  if (!validEmail(forgotForm.email)) {
    forgotError.value = '请输入正确的邮箱'
    return
  }
  if (!forgotForm.code) {
    forgotError.value = '请输入验证码'
    return
  }
  if (forgotForm.newPassword.length < 8) {
    forgotError.value = '新密码至少 8 位'
    return
  }
  if (forgotForm.newPassword !== forgotForm.confirmPassword) {
    forgotError.value = '两次输入的新密码不一致'
    return
  }
  forgotSubmitting.value = true
  try {
    await resetPasswordByCode({
      email: forgotForm.email,
      code: forgotForm.code,
      newPassword: forgotForm.newPassword
    })
    forgotOpen.value = false
    pwdForm.username = forgotForm.email
    pwdForm.password = ''
    forgotForm.code = ''
    forgotForm.newPassword = ''
    forgotForm.confirmPassword = ''
    message.value = ''
    toast.success('密码已重置，请使用新密码登录')
  } catch (e: any) {
    forgotError.value = e?.message || '重置失败'
  } finally {
    forgotSubmitting.value = false
  }
}

async function handleSendCode() {
  if (!emailForm.email) {
    message.value = '请先填写邮箱'
    return
  }
  sending.value = true
  try {
    await sendEmailCode({ email: emailForm.email })
    message.value = ''
    countdown.value = 60
    timer = window.setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0 && timer) {
        window.clearInterval(timer)
        timer = undefined
      }
    }, 1000)
  } catch (e: any) {
    message.value = e?.message || '验证码发送失败'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--login-shell-bg);
}

.theme-toggle {
  position: absolute;
  top: 20px;
  right: 20px;
}

.login-card {
  width: 420px;
  padding: 32px;
  background: var(--login-card-bg);
  border-radius: 12px;
  box-shadow: var(--login-card-shadow);
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: #2f54eb;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 15px;
}

.brand h1 {
  margin: 0;
  font-size: 18px;
}

.brand p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.checking {
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
  font-size: 13px;
}

.code-row {
  display: flex;
  gap: 8px;
}

.hint {
  margin-top: 16px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}

.forgot-row {
  margin-top: 12px;
  text-align: right;
  font-size: 13px;
}
</style>
