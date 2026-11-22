<template>
  <div class="ft-page app-page">
    <div class="ft-head app-head">
      <a-alert
        type="info"
        show-icon
        message="此处仅展示外部第三方对接应用（应用类型：第三方对接应用 / OPENAPI_CLIENT）。应用的创建、接口授权、密钥重置与启停请在统一登录中心完成；Polaris 内部系统不属于对接应用。点每行左侧箭头可查看该应用被授权调用的接口清单与调用方向。"
      />
    </div>

    <section class="ft-scroll ft-bottom">
      <a-table
        class="ft-table"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        row-key="code"
        :expanded-row-keys="expandedKeys"
        @expanded-rows-change="onExpanded"
      >
        <template #expandIcon="{ expanded, onExpand, record }">
          <a-button type="link" size="small" @click="onExpand(record, $event)">
            {{ expanded ? '▾' : '▸' }}
          </a-button>
        </template>
        <template #expandedRowRender="{ record }">
          <EndpointList :app="record" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono">{{ record.code }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag v-if="record.status !== undefined" :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
            <span v-else class="muted">-</span>
          </template>
          <template v-else-if="column.key === 'remark'">
            <span>{{ record.remark || '-' }}</span>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { listApps, type AppInfo } from '@/api/openapi'
import EndpointList from '@/components/AppEndpointList.vue'

const columns = [
  { title: '应用编码', dataIndex: 'code', key: 'code', width: 220 },
  { title: '应用名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '状态', key: 'status', width: 100 },
  { title: '备注', dataIndex: 'remark', key: 'remark' }
]

const rows = ref<AppInfo[]>([])
const loading = ref(false)
const expandedKeys = ref<string[]>([])

function onExpanded(keys: readonly (string | number)[]) {
  expandedKeys.value = keys.map(String)
}

async function load() {
  loading.value = true
  try {
    rows.value = await listApps()
  } catch (e: any) {
    message.error(e?.message || '加载应用列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.app-page {
  --ft-min-width: 720px;
}
.app-head {
  padding-bottom: 12px;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.muted {
  color: var(--muted);
}
</style>
