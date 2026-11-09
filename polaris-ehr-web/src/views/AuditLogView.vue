<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-select
          v-model:value="action"
          :options="actionOptions"
          allow-clear
          placeholder="全部动作"
          style="width: 130px"
          @change="reload"
        />
        <a-input
          v-model:value="operator"
          allow-clear
          placeholder="操作人账号"
          style="width: 160px"
          @press-enter="reload"
        />
        <a-range-picker
          v-model:value="range"
          value-format="YYYY-MM-DD"
          allow-clear
          style="width: 240px"
          @change="reload"
        />
        <a-button @click="reload">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
      <div class="toolbar-right">
        <span class="muted">共 {{ total }} 条 · 查看 / 明文 / 导出都会留痕</span>
      </div>
    </div>

    <section class="panel ft-grow">
      <div class="panel-body table-body ft-scroll ft-bottom">
        <a-table
          class="ft-table"
          table-layout="fixed"
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="id"
          size="middle"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'time'">
              <div>{{ record.createdAt || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'operator'">
              <div>{{ record.operatorName || '—' }}</div>
              <div class="muted cell-sub">ID：{{ record.operatorId }}</div>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-tag :color="actionMeta(record.action).color">{{ actionMeta(record.action).label }}</a-tag>
            </template>
            <template v-else-if="column.key === 'target'">
              <span v-if="record.targetType === 'EMPLOYEE'">{{ record.targetName || record.targetId || '—' }}</span>
              <span v-else>{{ record.targetType }} {{ record.targetId || '' }}</span>
            </template>
            <template v-else-if="column.key === 'fields'">
              <span class="ellipsis" :title="record.fields">{{ fieldText(record.fields) }}</span>
            </template>
            <template v-else-if="column.key === 'ip'">
              <span class="ellipsis" :title="record.ip">{{ record.ip || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'ua'">
              <span class="ellipsis muted" :title="record.ua">{{ record.ua || '—' }}</span>
            </template>
          </template>
          <template #emptyText>
            <a-empty v-if="!loading" description="暂无审计记录" />
          </template>
        </a-table>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { pageAuditLogs, type AuditLogItem } from '@/api/ehr'

const columns = [
  { key: 'time', title: '时间', dataIndex: 'createdAt', width: '16%' },
  { key: 'operator', title: '操作人', width: '13%' },
  { key: 'action', title: '动作', width: '10%' },
  { key: 'target', title: '目标', width: '16%' },
  { key: 'fields', title: '涉及字段', width: '15%' },
  { key: 'ip', title: 'IP', width: '13%' },
  { key: 'ua', title: '终端', width: '17%' }
]

const actionOptions = [
  { value: 'VIEW', label: '查看' },
  { value: 'PLAIN', label: '查看明文' },
  { value: 'EXPORT', label: '导出' }
]

const ACTION_META: Record<string, { label: string; color: string }> = {
  VIEW: { label: '查看', color: 'blue' },
  PLAIN: { label: '查看明文', color: 'orange' },
  EXPORT: { label: '导出', color: 'purple' }
}

const FIELD_LABELS: Record<string, string> = {
  mobile: '手机号',
  idCard: '身份证号',
  emergencyPhone: '紧急联系电话'
}

function actionMeta(action: string) {
  return ACTION_META[action] || { label: action || '—', color: 'default' }
}

function fieldText(fields?: string) {
  if (!fields) return '—'
  if (fields.startsWith('rows=')) return fields
  return fields
    .split(',')
    .map((k) => FIELD_LABELS[k] || k)
    .join('、')
}

const action = ref<string | undefined>(undefined)
const operator = ref('')
const range = ref<string[] | undefined>(undefined)
const loading = ref(false)
const rows = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function load() {
  loading.value = true
  try {
    const data = await pageAuditLogs({
      action: action.value || undefined,
      operator: operator.value || undefined,
      startDate: range.value?.[0] || undefined,
      endDate: range.value?.[1] || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = data.list || []
    total.value = Number(data.total) || 0
  } catch (e: any) {
    message.error(e?.message || '审计日志加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  page.value = p.current || 1
  size.value = p.pageSize || 10
  load()
}

onMounted(load)
</script>

<style scoped>
.cell-sub {
  font-size: 12px;
}
.ellipsis {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
