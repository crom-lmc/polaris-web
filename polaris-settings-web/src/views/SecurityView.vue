<template>
  <div class="page-container security-page">
    <div class="page-root">
      <div class="page-head">
        <div>
          <h2 class="page-title">安全配置</h2>
          <p class="page-desc">密码规则与登录安全策略；保存后对登录、重置密码生效</p>
        </div>
        <a-button
          v-if="canManage"
          type="primary"
          :loading="saving"
          :disabled="!loaded"
          @click="save"
        >
          保存
        </a-button>
      </div>

      <a-spin :spinning="loading">
        <section class="panel">
          <div class="panel-head"><span>密码安全策略</span></div>
          <div class="panel-body">
            <a-form
              layout="horizontal"
              :label-col="{ style: { width: '132px' } }"
              :wrapper-col="{ style: { flex: 1 } }"
            >
              <div class="field-grid">
                <a-form-item label="初始密码规则">
                  <a-radio-group v-model:value="form.initialPasswordMode">
                    <a-radio value="RANDOM">随机密码</a-radio>
                    <a-radio value="FIXED">固定密码</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-form-item label="默认密码">
                  <a-input
                    v-model:value="form.defaultPassword"
                    :disabled="form.initialPasswordMode === 'RANDOM'"
                    :maxlength="64"
                    placeholder="固定密码模式下必填"
                  />
                </a-form-item>

                <a-form-item label="密码必须包含" class="span-2">
                  <a-checkbox-group v-model:value="form.passwordRules" :options="ruleOptions" />
                </a-form-item>

                <a-form-item label="密码最小长度">
                  <div class="inline">
                    <a-input-number v-model:value="form.passwordMinLength" :min="6" :max="32" :precision="0" />
                    <span class="unit">位</span>
                  </div>
                </a-form-item>

                <a-form-item label="密码最大长度">
                  <div class="inline">
                    <a-input-number v-model:value="form.passwordMaxLength" :min="6" :max="64" :precision="0" />
                    <span class="unit">位</span>
                  </div>
                </a-form-item>

                <a-form-item label="修改密码验证">
                  <a-radio-group v-model:value="form.passwordLockMode">
                    <a-radio value="ACCOUNT">账号密码锁</a-radio>
                    <a-radio value="EMAIL">邮箱验证锁</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-form-item label="登录密码输入失败">
                  <div class="inline">
                    <a-input-number v-model:value="form.loginFailLimit" :min="1" :max="20" :precision="0" />
                    <span class="unit">次后锁定</span>
                  </div>
                </a-form-item>

                <a-form-item label="登录失败锁定时间">
                  <div class="inline">
                    <a-input-number v-model:value="form.loginFailLockMinutes" :min="0" :max="1440" :precision="0" />
                    <span class="unit">分钟</span>
                  </div>
                </a-form-item>

                <a-form-item label="连续登录检测次数">
                  <div class="inline">
                    <a-input-number v-model:value="form.loginFailDetectCount" :min="1" :max="50" :precision="0" />
                    <span class="unit">次</span>
                  </div>
                </a-form-item>
              </div>
            </a-form>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><span>登录安全策略</span></div>
          <div class="panel-body">
            <a-form
              layout="horizontal"
              :label-col="{ style: { width: '132px' } }"
              :wrapper-col="{ style: { flex: 1 } }"
            >
              <div class="field-grid">
                <a-form-item label="首次登录强制改密">
                  <a-radio-group v-model:value="form.forceChangePassword">
                    <a-radio :value="true">启用</a-radio>
                    <a-radio :value="false">不启用</a-radio>
                  </a-radio-group>
                </a-form-item>

                <a-form-item label="登录过期时间">
                  <div class="inline">
                    <a-input-number v-model:value="form.sessionTimeoutMinutes" :min="1" :max="10080" :precision="0" />
                    <span class="unit">分钟</span>
                  </div>
                </a-form-item>

                <a-form-item label="最大登录错误次数">
                  <div class="inline">
                    <a-input-number v-model:value="form.maxLoginErrorCount" :min="1" :max="50" :precision="0" />
                    <span class="unit">次</span>
                  </div>
                </a-form-item>

                <a-form-item label="用户锁定时长">
                  <div class="inline">
                    <a-input-number v-model:value="form.userLockMinutes" :min="0" :max="1440" :precision="0" />
                    <span class="unit">分钟</span>
                  </div>
                </a-form-item>

                <a-form-item label="邮箱验证码位数">
                  <div class="inline">
                    <a-input-number v-model:value="form.emailCodeDigits" :min="4" :max="10" :precision="0" />
                    <span class="unit">位</span>
                  </div>
                </a-form-item>

                <a-form-item label="验证码过期时间">
                  <div class="inline">
                    <a-input-number v-model:value="form.verifyCodeExpireMinutes" :min="1" :max="120" :precision="0" />
                    <span class="unit">分钟</span>
                  </div>
                </a-form-item>
              </div>
            </a-form>
          </div>
        </section>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  fetchSecurityConfig,
  saveSecurityConfig,
  type SecurityConfig,
  type SecurityConfigBody
} from '@/api/security'

const store = useUserStore()
/** 保存按钮权限：无 security:manage 只读 */
const canManage = store.can('security:manage')

const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)

const ruleOptions = [
  { label: '数字', value: 'DIGIT' },
  { label: '大写字母', value: 'UPPER' },
  { label: '小写字母', value: 'LOWER' },
  { label: '特殊字符', value: 'SPECIAL' }
]

/** 默认值只用于加载失败时兜底展示，真实值以后端为准 */
const form = reactive<SecurityConfigBody>({
  initialPasswordMode: 'RANDOM',
  defaultPassword: '',
  passwordRules: ['DIGIT', 'UPPER', 'LOWER', 'SPECIAL'],
  passwordMinLength: 6,
  passwordMaxLength: 15,
  passwordLockMode: 'EMAIL',
  loginFailLimit: 3,
  loginFailLockMinutes: 15,
  loginFailDetectCount: 5,
  forceChangePassword: false,
  sessionTimeoutMinutes: 420,
  maxLoginErrorCount: 5,
  userLockMinutes: 10,
  emailCodeDigits: 6,
  verifyCodeExpireMinutes: 10
})

function applyConfig(raw: SecurityConfig) {
  const rules = raw.passwordRules ? raw.passwordRules.split(',').filter(Boolean) : []
  Object.assign(form, raw, { passwordRules: rules })
  loaded.value = true
}

async function load() {
  loading.value = true
  try {
    applyConfig(await fetchSecurityConfig())
  } catch (e: any) {
    message.error(e?.message || '加载安全配置失败')
  } finally {
    loading.value = false
  }
}

function validate(): string | null {
  if (!form.passwordRules.length) return '密码规则至少选择一项'
  if (form.initialPasswordMode === 'FIXED' && !form.defaultPassword.trim()) return '请填写默认密码'
  if (form.passwordMaxLength < form.passwordMinLength) return '密码最大长度不能小于最小长度'
  return null
}

async function save() {
  const err = validate()
  if (err) {
    message.warning(err)
    return
  }
  saving.value = true
  try {
    applyConfig(await saveSecurityConfig({ ...form, passwordRules: [...form.passwordRules] }))
    message.success('安全配置已保存')
  } catch (e: any) {
    message.error(e?.message || '保存安全配置失败')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-base);
}
.page-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 28px;
}
.field-grid .span-2 {
  grid-column: 1 / -1;
}
.inline {
  display: flex;
  align-items: center;
}
.unit {
  margin-left: 6px;
  font-size: 12px;
  color: var(--muted);
}
.panel + .panel {
  margin-top: 12px;
}
@media (max-width: 900px) {
  .field-grid {
    grid-template-columns: 1fr;
  }
}
</style>
