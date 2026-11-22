<template>
  <div class="app-endpoint-list">
    <a-spin :spinning="loading">
      <a-alert v-if="!loading && !rows.length" type="default" show-icon
        message="该应用尚未被授权调用任何开放接口，请在统一登录中心为其分配 inbound:* / outbound:* 权限码。" />
      <a-table v-else :columns="columns" :data-source="rows" row-key="apiCode" size="small" :pagination="false">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'directionFlow'">
            <a-tag :color="record.direction === 1 ? 'green' : 'blue'">{{ record.directionFlow }}</a-tag>
          </template>
          <template v-else-if="column.key === 'operationType'">
            <a-tag>{{ operationLabel(record.operationType) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
        </template>
      </a-table>
    </a-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { listAppEndpoints, type AppInfo, type AppEndpoint } from '@/api/openapi'

const props = defineProps<{ app: AppInfo }>()

const columns = [
  { title: 'API 编码', dataIndex: 'apiCode', key: 'apiCode', width: 200 },
  { title: '名称', dataIndex: 'apiName', key: 'apiName', width: 140 },
  { title: '调用方向', key: 'directionFlow', width: 260 },
  { title: '操作类型', key: 'operationType', width: 100 },
  { title: '方法', dataIndex: 'method', key: 'method', width: 80 },
  { title: '路径', dataIndex: 'path', key: 'path' },
  { title: '权限码', dataIndex: 'requiredPerm', key: 'requiredPerm', width: 180 },
  { title: '状态', key: 'status', width: 80 }
]
const operationLabelMap: Record<string, string> = {
  QUERY: '查询', CREATE: '新增', UPDATE: '修改', DELETE: '删除', EXECUTE: '执行'
}
function operationLabel(t?: string) {
  return (t && operationLabelMap[t]) || t || '-'
}

const rows = ref<AppEndpoint[]>([])
const loading = ref(false)

async function load() {
  if (!props.app?.code) return
  loading.value = true
  try {
    rows.value = await listAppEndpoints(props.app.code)
  } catch (e: any) {
    message.error(e?.message || '加载接口清单失败')
    rows.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => { void load() })
watch(() => props.app?.code, () => { void load() })
</script>

<style scoped>
.app-endpoint-list {
  padding: 8px 0 8px 32px;
  background: var(--bg-soft, rgba(0, 0, 0, 0.02));
}
</style>
