<template>
  <div class="ft-page setting-page">
    <div class="ft-head setting-head">
      <div>
        <div class="setting-title">平台设置</div>
        <div class="setting-desc">网关级全局参数；保存后立即对所有调用生效</div>
      </div>
      <a-button size="small" :loading="loading" @click="load">刷新</a-button>
    </div>

    <div class="ft-scroll setting-scroll">
      <a-spin :spinning="loading">
        <a-alert
          v-if="!canEdit"
          type="warning"
          show-icon
          style="margin-bottom: 12px"
          message="你没有「openapi:setting:edit」权限，当前页面为只读"
        />
        <a-collapse v-if="keys.length" :default-active-key="keys">
          <a-collapse-panel v-for="key in keys" :key="key" :header="`${metaOf(key).label}（${key}）`">
            <div class="setting-row">
              <div class="setting-control">
                <IpWhitelistEditor
                  v-if="key === IP_WHITELIST_KEY"
                  ref="whitelistRef"
                  v-model="formValues[key]"
                  :disabled="!canEdit"
                />
                <template v-else>
                  <a-textarea
                    v-if="metaOf(key).kind === 'textarea'"
                    v-model:value="formValues[key]"
                    :rows="metaOf(key).rows || 3"
                    :placeholder="metaOf(key).hint"
                    :disabled="!canEdit"
                  />
                  <a-input-number
                    v-else
                    v-model:value="formValues[key]"
                    :min="0"
                    :precision="0"
                    style="width: 240px"
                    :disabled="!canEdit"
                  />
                  <div class="hint">{{ metaOf(key).hint }}</div>
                </template>
              </div>
              <a-button
                v-if="canEdit"
                type="primary"
                :loading="savingKey === key"
                @click="save(key)"
              >
                保存
              </a-button>
            </div>
          </a-collapse-panel>
        </a-collapse>
        <a-empty v-else description="暂无设置项" />
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { listSettings, saveSetting, type Setting } from '@/api/openapi'
import { useUserStore } from '@/stores/user'
import IpWhitelistEditor from '@/components/IpWhitelistEditor.vue'

const IP_WHITELIST_KEY = 'ip.whitelist'

const store = useUserStore()
const canEdit = computed(() => store.can('openapi:setting:edit'))
const whitelistRef = ref<InstanceType<typeof IpWhitelistEditor> | null>(null)

interface SettingMeta {
  label: string
  hint: string
  kind: 'textarea' | 'number'
  rows?: number
}

/** 已知键的展示方式；后端返回的其它键统一按通用文本域渲染 */
const META: Record<string, SettingMeta> = {
  'ip.whitelist': {
    label: 'IP 白名单',
    hint: '每行一条规则：IPv4 或 CIDR 网段，* 表示全部，留空不限制',
    kind: 'textarea',
    rows: 5
  },
  'global.rate.limit': {
    label: '全局限流',
    hint: '每分钟上限',
    kind: 'number'
  },
  'nonce.ttl.seconds': {
    label: '防重放窗口',
    hint: '防重放窗口秒数',
    kind: 'number'
  }
}

function metaOf(key: string): SettingMeta {
  return META[key] || { label: key, hint: '自定义设置项（文本内容）', kind: 'textarea', rows: 3 }
}

const loading = ref(false)
const savingKey = ref('')
const settings = ref<Setting[]>([])
const formValues = reactive<Record<string, string>>({})
const formRemarks = reactive<Record<string, string>>({})

/** 已知键固定展示，后端多出的键追加在后面 */
const keys = computed(() => {
  const list = Object.keys(META)
  settings.value.forEach((s) => {
    if (!list.includes(s.settingKey)) list.push(s.settingKey)
  })
  return list
})

async function load() {
  loading.value = true
  try {
    const rows = await listSettings()
    settings.value = rows
    rows.forEach((s) => {
      formValues[s.settingKey] = s.settingValue ?? ''
      formRemarks[s.settingKey] = s.remark ?? ''
    })
    Object.keys(META).forEach((k) => {
      if (!(k in formValues)) formValues[k] = ''
      if (!(k in formRemarks)) formRemarks[k] = ''
    })
  } catch (e: any) {
    message.error(e?.message || '加载平台设置失败')
  } finally {
    loading.value = false
  }
}

async function save(key: string) {
  if (!canEdit.value) return
  if (key === IP_WHITELIST_KEY && whitelistRef.value && !whitelistRef.value.validate()) return
  savingKey.value = key
  try {
    await saveSetting(key, formValues[key] ?? '', formRemarks[key] || undefined)
    message.success('设置已保存')
  } catch (e: any) {
    message.error(e?.message || '保存设置失败')
  } finally {
    savingKey.value = ''
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.setting-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
}
.setting-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-base);
}
.setting-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}
.setting-scroll {
  padding-right: 4px;
}
.setting-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.setting-control {
  flex: 1;
  min-width: 0;
}
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}
</style>
