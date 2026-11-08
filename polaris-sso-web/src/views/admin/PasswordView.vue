<template>
  <div class="pw">
    <a-card class="card" :bordered="false">
      <div class="head">
        <span class="head-icon"><LockOutlined /></span>
        <div class="head-text">
          <h2 class="title">修改密码</h2>
          <p class="subtitle">为保障账户安全，请设置高强度密码，修改后需重新登录</p>
        </div>
      </div>

      <a-form :model="form" :rules="rules" layout="vertical" @finish="onSubmit">
        <a-form-item label="原密码" name="oldPassword">
          <a-input-password
            v-model:value="form.oldPassword"
            placeholder="请输入当前密码"
            autocomplete="current-password"
          />
        </a-form-item>

        <a-form-item label="新密码" name="newPassword">
          <a-input-password
            v-model:value="form.newPassword"
            placeholder="请设置新密码"
            autocomplete="new-password"
          />
          <div v-if="form.newPassword" class="strength">
            <div class="bars">
              <span
                v-for="n in 4"
                :key="n"
                class="bar"
                :style="{ background: barColor(n) }"
              ></span>
            </div>
            <span class="strength-label" :style="{ color: meta.color }">{{ meta.text }}</span>
          </div>
          <ul class="checks" :class="{ dim: !form.newPassword }">
            <li v-for="c in result.checks" :key="c.key" :class="{ ok: c.ok }">
              <component :is="c.ok ? CheckCircleFilled : CloseCircleFilled" class="ico" />
              <span>{{ c.label }}</span>
            </li>
          </ul>
        </a-form-item>

        <a-form-item label="确认新密码" name="confirm">
          <a-input-password
            v-model:value="form.confirm"
            placeholder="再次输入新密码"
            autocomplete="new-password"
          />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="loading" block>
            提交并退出登录
          </a-button>
        </a-form-item>
      </a-form>

      <a-alert
        v-if="fromApp"
        type="info"
        show-icon
        style="margin-top: 4px"
        message="修改密码后将退出登录，需使用新密码重新登录后再返回应用。"
      />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { CheckCircleFilled, CloseCircleFilled, LockOutlined } from '@ant-design/icons-vue'
import { changeMyPassword } from '@/api/accounts'
import { logout } from '@/api/auth'
import { getRefreshToken } from '@/utils/token'
import { checkPassword, passwordStrength, STRENGTH_META } from '@/utils/password'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const loading = ref(false)

const form = reactive({ oldPassword: '', newPassword: '', confirm: '' })
const fromApp = computed(() => !!route.query.app)

// 实时校验结果，驱动强度条与要求清单
const result = computed(() => checkPassword(form.newPassword))
const strength = computed(() => passwordStrength(form.newPassword))
const meta = computed(() => STRENGTH_META[strength.value] || STRENGTH_META[0])

function barColor(n: number): string {
  if (n <= strength.value) return meta.value.color || 'var(--border-subtle)'
  return 'var(--border-subtle)'
}

const rules = {
  oldPassword: [{ required: true, message: '请输入原密码' }],
  newPassword: [
    { required: true, message: '请输入新密码' },
    {
      validator: (_r: unknown, v: string) => {
        const r = checkPassword(v || '')
        return r.ok ? Promise.resolve() : Promise.reject(new Error(r.error))
      },
      trigger: 'change'
    }
  ],
  confirm: [
    { required: true, message: '请再次输入新密码' },
    {
      validator: (_r: unknown, v: string) =>
        v === form.newPassword ? Promise.resolve() : Promise.reject(new Error('两次输入不一致')),
      trigger: 'change'
    }
  ]
}

async function onSubmit() {
  loading.value = true
  try {
    await changeMyPassword(form.oldPassword, form.newPassword)
    message.success('密码已修改，正在退出登录')
    // 修改密码后必须重新登录：走全局登出（gl=1），清掉本地令牌与中心会话，避免旧密码仍可登录
    try {
      await logout(getRefreshToken())
    } catch {
      // 网络异常也继续本地登出，不能卡在"已改密却仍登录"的状态
    }
    store.clear()
    const q: Record<string, string> = { gl: '1' }
    if (route.query.app) q.app = String(route.query.app)
    if (route.query.redirect) q.redirect = String(route.query.redirect)
    router.replace({ path: '/login', query: q })
  } catch (e: any) {
    message.error(e?.message || '修改失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.pw {
  display: flex;
  justify-content: center;
  padding: 32px 16px;
}
.card {
  width: 460px;
  max-width: 100%;
}

.head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}
.head-icon {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #2f54eb;
  background: rgba(47, 84, 235, 0.1);
}
.title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-base);
}
.subtitle {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--muted);
}

.strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.bars {
  display: flex;
  gap: 6px;
  flex: 1;
}
.bar {
  height: 6px;
  flex: 1;
  border-radius: 3px;
  background: var(--border-subtle);
  transition: background 0.2s ease;
}
.strength-label {
  font-size: 12px;
  font-weight: 600;
  min-width: 28px;
  text-align: right;
}

.checks {
  list-style: none;
  padding: 0;
  margin: 12px 0 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px 16px;
}
.checks li {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--muted);
  transition: color 0.2s ease;
}
.checks li.ok {
  color: #52c41a;
}
.checks li .ico {
  font-size: 14px;
}
.checks.dim {
  opacity: 0.55;
}
</style>
