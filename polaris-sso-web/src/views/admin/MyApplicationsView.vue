<template>
  <div class="my-apps-page">
    <div class="page-head">
      <h2>我的应用</h2>
      <span>共 {{ store.appList.length }} 个应用</span>
    </div>

    <a-spin :spinning="typeLoading">
      <a-empty v-if="!store.appList.length" class="empty" description="还没有被授权任何应用" />

      <section v-for="group in appGroups" v-else :key="group.type" class="app-group">
        <div class="group-head">
          <h3>{{ group.label }}</h3>
          <span>{{ group.apps.length }} 个应用</span>
        </div>
        <a-row :gutter="[16, 16]">
          <a-col v-for="app in group.apps" :key="app.id" :xs="24" :sm="12" :lg="8" :xl="6">
            <a-card size="small" class="app-card">
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
import type { ApplicationVO } from '@/types'

const store = useUserStore()
const typeOptions = ref<DictOption[]>([])
const typeLoading = ref(false)

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
    typeOptions.value = res.data || []
  } catch (e: any) {
    message.error(e?.message || '应用类型字典加载失败')
  } finally {
    typeLoading.value = false
  }
}

function logoOf(app: ApplicationVO) {
  return app.icon || `/icons/${app.code}.svg`
}
</script>

<style scoped>
.my-apps-page {
  max-width: 1600px;
  margin: 0 auto;
}

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
