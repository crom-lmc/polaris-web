<template>
  <div class="my-apps-page">
    <div class="page-head">
      <h2>我的应用</h2>
      <span>共 {{ store.appList.length }} 个应用</span>
    </div>

    <a-alert
      v-if="enterError"
      type="error"
      show-icon
      style="margin-bottom: 16px"
      :message="enterError"
    />

    <a-spin :spinning="typeLoading">
      <a-empty v-if="!store.appList.length" class="empty" description="还没有被授权任何应用" />

      <section v-for="group in appGroups" v-else :key="group.type" class="app-group">
        <div class="group-head">
          <h3>{{ group.label }}</h3>
          <span>{{ group.apps.length }} 个应用</span>
        </div>
        <a-row :gutter="[16, 16]">
          <a-col v-for="app in group.apps" :key="app.id" :xs="24" :sm="12" :lg="8" :xl="6">
            <a-card
              size="small"
              class="app-card"
              :class="{ 'is-clickable': !isBuiltin(app) }"
              :hoverable="!isBuiltin(app)"
              :role="isBuiltin(app) ? undefined : 'link'"
              :tabindex="isBuiltin(app) ? undefined : 0"
              @click="enter(app)"
              @keydown.enter="enter(app)"
              @keydown.space.prevent="enter(app)"
            >
              <div class="app-main">
                <img class="app-logo" :src="logoOf(app)" :alt="app.name" />
                <div class="app-text">
                  <div class="app-name">{{ app.name }}</div>
                  <div class="app-code">{{ app.code }}</div>
                </div>
              </div>
              <div class="app-remark" :title="app.remark">{{ app.remark || '暂无简介' }}</div>
            </a-card>
          </a-col>
        </a-row>
      </section>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { dictOptions, type DictOption } from '@/api/announcement'
import { useUserStore } from '@/stores/user'
import { oauthAuthorize } from '@/api/oauth'
import { APPLICATION_TYPE_FALLBACK } from '@/api/apps'
import type { ApplicationVO } from '@/types'

const store = useUserStore()
const typeOptions = ref<DictOption[]>(APPLICATION_TYPE_FALLBACK)
const typeLoading = ref(false)
const entering = ref('')
const enterError = ref('')

const typeOrder = computed(() => new Map(typeOptions.value.map((item, index) => [item.value, index])))

const appGroups = computed(() => {
  const grouped = new Map<string, ApplicationVO[]>()
  for (const app of store.appList) {
    const type = app.appType || 'OTHER'
    const apps = grouped.get(type) || []
    apps.push(app)
    grouped.set(type, apps)
  }
  return Array.from(grouped, ([type, apps]) => ({
    type,
    apps,
    label: typeOptions.value.find((item) => item.value === type)?.label
      || (type === 'OTHER' ? '其他应用' : type)
  })).sort((a, b) => {
    const order = (typeOrder.value.get(a.type) ?? 999) - (typeOrder.value.get(b.type) ?? 999)
    return order || a.label.localeCompare(b.label, 'zh-CN')
  })
})

onMounted(() => {
  loadTypes()
  if (!store.appList.length) store.loadAppList()
})

async function loadTypes() {
  typeLoading.value = true
  try {
    const res = await dictOptions('sso.application_type')
    typeOptions.value = res.data?.length ? res.data : APPLICATION_TYPE_FALLBACK
  } catch (e: any) {
    message.error(e?.message || '应用类型字典加载失败')
  } finally {
    typeLoading.value = false
  }
}

function logoOf(app: ApplicationVO) {
  return app.icon || `/icons/${app.code}.svg`
}

function isBuiltin(app: ApplicationVO) {
  return app.code === 'sso-center' || !!app.builtIn
}

function randomState(): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function enter(app: ApplicationVO) {
  if (isBuiltin(app) || entering.value) return
  enterError.value = ''
  const target = (app.redirectUri && app.redirectUri.trim()) || (app.baseUrl || '').trim()
  if (!target) {
    enterError.value = '该应用未配置访问地址'
    return
  }

  // 异步签码前先打开页签，避免浏览器拦截弹窗。
  const tab = window.open('about:blank', '_blank')
  entering.value = app.code
  try {
    const res = await oauthAuthorize({
      responseType: 'code',
      clientId: app.code,
      redirectUri: target,
      state: randomState()
    })
    const url = res.data.redirectTo
    if (tab) {
      tab.location.href = url
      try {
        tab.opener = null
      } catch {
        /* 跨源后不可写，忽略 */
      }
    } else {
      const fallback = window.open(url, '_blank')
      if (!fallback) window.location.href = url
    }
  } catch (e: any) {
    try {
      tab?.close()
    } catch {
      /* ignore */
    }
    enterError.value = e?.message || '跳转失败'
  } finally {
    entering.value = ''
  }
}
</script>

<style scoped>
.page-head,
.group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.page-head {
  margin-bottom: 20px;
}

.page-head h2,
.group-head h3 {
  margin: 0;
  color: var(--text-base, var(--color-text, inherit));
}

.page-head h2 {
  font-size: 20px;
  font-weight: 600;
}

.page-head span,
.group-head span {
  color: var(--muted);
  font-size: 12px;
}

.empty {
  margin-top: 120px;
}

.app-group + .app-group {
  margin-top: 24px;
}

.group-head {
  margin-bottom: 12px;
}

.group-head h3 {
  font-size: 16px;
  font-weight: 600;
}

.app-card {
  height: 100%;
  border-color: var(--border-subtle);
  border-radius: 10px;
}

.app-card.is-clickable {
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.app-card.is-clickable:hover,
.app-card.is-clickable:focus-visible {
  border-color: rgba(47, 84, 235, 0.7);
  box-shadow: 0 4px 16px rgba(47, 84, 235, 0.16);
  outline: none;
}

.app-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.app-logo {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 10px;
}

.app-text {
  min-width: 0;
}

.app-name {
  overflow: hidden;
  color: var(--text-base, var(--color-text, inherit));
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-code {
  margin-top: 4px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-remark {
  margin-top: 14px;
  overflow: hidden;
  color: var(--muted);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
