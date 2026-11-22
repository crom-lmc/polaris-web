<template>
  <div class="ft-page endpoint-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜 API 编码 / 名称"
        style="width: 240px"
        allow-clear
      />
      <a-select
        v-model:value="operationFilter"
        placeholder="操作类型"
        style="width: 130px"
        allow-clear
        :options="operationFilterOptions"
      />
      <a-select
        v-model:value="purposeFilter"
        placeholder="业务用途"
        style="width: 130px"
        allow-clear
        :options="purposeFilterOptions"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="canCreate" type="primary" @click="openCreate">新增 API</a-button>
    </div>

    <section v-if="canList" class="ft-scroll ft-bottom">
      <a-table
        class="ft-table"
        :columns="columns"
        :data-source="pagedRows"
        :loading="loading"
        row-key="apiCode"
        :pagination="pagination"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'apiCode'">
            <span class="mono">{{ record.apiCode }}</span>
          </template>
          <template v-else-if="column.key === 'direction'">
            <a-tag :color="record.direction === 1 ? 'green' : 'blue'">
              {{ directionLabel(record.direction) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'operationType'">
            <a-tag :color="operationColor(operationTypeOf(record))">{{ operationLabel(operationTypeOf(record)) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'purpose'">
            <span>{{ purposeOf(record.apiCode) }}</span>
          </template>
          <template v-else-if="column.key === 'method'">
            <a-tag>{{ record.method }}</a-tag>
          </template>
          <template v-else-if="column.key === 'path'">
            <span class="mono">{{ record.path }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="8">
              <a-button v-if="canEdit" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button
                v-if="canToggle"
                type="link"
                size="small"
                :danger="record.status === 1"
                @click="toggle(record)"
              >
                {{ record.status === 1 ? '停用' : '启用' }}
              </a-button>
              <a-button v-if="canDelete" type="link" size="small" danger @click="remove(record)">删除</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>
    <a-alert
      v-else
      type="warning"
      show-icon
      message="你没有「openapi:endpoint:list」权限，无法查看接口列表"
    />

    <!-- 新增 / 编辑 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="editing ? '编辑 API' : '新增 API'"
      :width="520"
      destroy-on-close
    >
      <a-form layout="vertical">
        <a-form-item label="API 编码" required extra="全局唯一，保存后不可修改">
          <a-input v-model:value="form.apiCode" :disabled="!!editing" placeholder="如 ehr.leave.list" />
        </a-form-item>
        <a-form-item label="API 名称" required>
          <a-input v-model:value="form.apiName" placeholder="请假列表" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="方向">
              <a-select v-model:value="form.direction" :options="directionOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="操作类型">
              <a-select v-model:value="form.operationType" :options="operationTypeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="归属应用">
          <a-input v-model:value="form.appCode" placeholder="如 ehr" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="方法">
              <a-select v-model:value="form.method" :options="methodOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="路径">
              <a-input v-model:value="form.path" placeholder="/api/ehr/leave" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item v-if="form.direction === 2" label="目标地址">
          <a-input v-model:value="form.targetUrl" placeholder="出站代理的目标 URL（可选）" />
        </a-form-item>
        <a-form-item label="鉴权方式">
          <a-select v-model:value="form.authType" :options="authOptions" />
        </a-form-item>
        <a-form-item label="所需权限码">
          <a-input v-model:value="form.requiredPerm" placeholder="如 openapi:endpoint:list" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="限流（次/分）">
              <a-input-number v-model:value="form.rateLimitPerMin" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="超时（ms）">
              <a-input-number v-model:value="form.timeoutMs" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="重试次数">
              <a-input-number v-model:value="form.retryMax" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="幂等">
              <a-select v-model:value="form.idempotent" :options="idempotentOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status" :options="statusOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="脱敏规则">
          <a-textarea v-model:value="form.maskRules" :rows="2" placeholder="JSON 配置，如 {&quot;fields&quot;:[&quot;idNo&quot;]}（可选）" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
      <template #footer>
        <div class="drawer-footer">
          <a-button style="margin-right: 8px" :disabled="saving" @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submit">保存</a-button>
        </div>
      </template>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  deleteEndpoint,
  listEndpoints,
  saveEndpoint,
  toggleEndpoint,
  type ApiEndpoint
} from '@/api/openapi'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canList = computed(() => store.can('openapi:endpoint:list'))
const canCreate = computed(() => store.can('openapi:endpoint:create'))
const canEdit = computed(() => store.can('openapi:endpoint:edit'))
const canToggle = computed(() => store.can('openapi:endpoint:toggle'))
const canDelete = computed(() => store.can('openapi:endpoint:delete'))

const columns = [
  { title: 'API 编码', key: 'apiCode', width: 150 },
  { title: '名称', dataIndex: 'apiName', key: 'apiName', width: 120, ellipsis: true },
  { title: '能力方向', key: 'direction', width: 100 },
  { title: '操作类型', key: 'operationType', width: 90 },
  { title: '业务用途', key: 'purpose', width: 90 },
  { title: '应用', dataIndex: 'appCode', key: 'appCode', width: 100 },
  { title: '方法', key: 'method', width: 80 },
  { title: '路径', key: 'path', width: 170, ellipsis: true },
  { title: '权限码', dataIndex: 'requiredPerm', key: 'requiredPerm', width: 150, ellipsis: true },
  { title: '限流/分', dataIndex: 'rateLimitPerMin', key: 'rateLimitPerMin', width: 90 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 180 }
]

// 业务语义方向：底层 1=INBOUND（第三方调我们=对外提供/出），2=OUTBOUND（我们调第三方=进）
const directionOptions = [
  { label: '对外提供（出）', value: 1 },
  { label: '调用第三方（进）', value: 2 }
]
function directionLabel(direction: number) {
  return direction === 1 ? '出·对外提供' : '进·调用第三方'
}

const operationTypeOptions = [
  { label: '查询 QUERY', value: 'QUERY' },
  { label: '新增 CREATE', value: 'CREATE' },
  { label: '修改 UPDATE', value: 'UPDATE' },
  { label: '删除 DELETE', value: 'DELETE' },
  { label: '执行 EXECUTE', value: 'EXECUTE' }
]
const operationFilterOptions = operationTypeOptions
const operationLabelMap: Record<string, string> = {
  QUERY: '查询', CREATE: '新增', UPDATE: '修改', DELETE: '删除', EXECUTE: '执行'
}
const operationColorMap: Record<string, string> = {
  QUERY: 'blue', CREATE: 'green', UPDATE: 'orange', DELETE: 'red', EXECUTE: 'purple'
}
function operationTypeOf(r: ApiEndpoint): string {
  if (r.operationType) return r.operationType
  // 老数据兼容：按方法与方向推断
  if (r.direction === 2) return 'EXECUTE'
  const m = (r.method || '').toUpperCase()
  if (m === 'POST') return 'CREATE'
  if (m === 'PUT' || m === 'PATCH') return 'UPDATE'
  if (m === 'DELETE') return 'DELETE'
  return 'QUERY'
}
function operationLabel(type: string) {
  return operationLabelMap[type] || type
}
function operationColor(type: string) {
  return operationColorMap[type] || 'default'
}

const purposeFilterOptions = [
  { label: '主数据', value: '主数据' },
  { label: '字典', value: '字典' },
  { label: '人员', value: '人员' },
  { label: '组织', value: '组织' },
  { label: '通知', value: '通知' }
]
/** 业务用途按 api_code 前缀推断 */
function purposeOf(apiCode: string): string {
  const c = (apiCode || '').toLowerCase()
  if (c.includes('master')) return '主数据'
  if (c.includes('dict')) return '字典'
  if (c.includes('employ')) return '人员'
  if (c.includes('org')) return '组织'
  if (c.includes('email') || c.includes('sms') || c.includes('notify')) return '通知'
  return '其他'
}
const methodOptions = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((v) => ({ label: v, value: v }))
const authOptions = [
  { label: 'OAUTH_CLIENT', value: 'OAUTH_CLIENT' },
  { label: 'SIGNATURE', value: 'SIGNATURE' },
  { label: 'INTERNAL', value: 'INTERNAL' }
]
const idempotentOptions = [
  { label: '否', value: 0 },
  { label: '是', value: 1 }
]
const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 2 }
]

const rows = ref<ApiEndpoint[]>([])
const loading = ref(false)
const keyword = ref('')

const operationFilter = ref<string | undefined>(undefined)
const purposeFilter = ref<string | undefined>(undefined)

/** 按 apiCode / apiName / 操作类型 / 业务用途前端过滤 */
const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return rows.value.filter((r) => {
    if (kw && !r.apiCode.toLowerCase().includes(kw) && !r.apiName.toLowerCase().includes(kw)) return false
    if (operationFilter.value && operationTypeOf(r) !== operationFilter.value) return false
    if (purposeFilter.value && purposeOf(r.apiCode) !== purposeFilter.value) return false
    return true
  })
})

/** 接口返回全量列表，这里做前端分页；分页条由 ft-bottom 固定到滚动容器底部 */
const page = ref(1)
const pageSize = ref(10)
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: filteredRows.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))
function onTableChange(pag: any) {
  page.value = pag?.current || 1
  pageSize.value = pag?.pageSize || pageSize.value
}

async function load() {
  if (!canList.value) return
  loading.value = true
  try {
    rows.value = await listEndpoints()
  } catch (e: any) {
    message.error(e?.message || '加载接口列表失败')
  } finally {
    loading.value = false
  }
}

/* ---------------- 新增 / 编辑 ---------------- */
const drawerOpen = ref(false)
const saving = ref(false)
const editing = ref<ApiEndpoint | null>(null)

function emptyForm() {
  return {
    apiCode: '',
    apiName: '',
    direction: 1,
    operationType: 'QUERY',
    appCode: '',
    method: 'GET',
    path: '',
    targetUrl: '',
    authType: 'OAUTH_CLIENT',
    requiredPerm: '',
    rateLimitPerMin: 600,
    timeoutMs: 5000,
    retryMax: 0,
    idempotent: 0,
    maskRules: '',
    remark: '',
    status: 1
  }
}
const form = reactive(emptyForm())

function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  drawerOpen.value = true
}

function openEdit(r: ApiEndpoint) {
  editing.value = r
  Object.assign(form, {
    apiCode: r.apiCode,
    apiName: r.apiName,
    direction: r.direction,
    operationType: operationTypeOf(r),
    appCode: r.appCode || '',
    method: r.method || 'GET',
    path: r.path || '',
    targetUrl: r.targetUrl || '',
    authType: r.authType || 'OAUTH_CLIENT',
    requiredPerm: r.requiredPerm || '',
    rateLimitPerMin: r.rateLimitPerMin ?? 600,
    timeoutMs: r.timeoutMs ?? 5000,
    retryMax: r.retryMax ?? 0,
    idempotent: r.idempotent ?? 0,
    maskRules: r.maskRules || '',
    remark: r.remark || '',
    status: r.status ?? 1
  })
  drawerOpen.value = true
}

async function submit() {
  if (!form.apiCode.trim() || !form.apiName.trim()) {
    message.warning('API 编码与名称不能为空')
    return
  }
  saving.value = true
  try {
    await saveEndpoint({
      ...(editing.value?.id ? { id: editing.value.id } : {}),
      apiCode: form.apiCode.trim(),
      apiName: form.apiName.trim(),
      direction: form.direction,
      operationType: form.operationType,
      appCode: form.appCode.trim(),
      method: form.method,
      path: form.path.trim(),
      targetUrl: form.targetUrl.trim() || undefined,
      authType: form.authType,
      requiredPerm: form.requiredPerm.trim(),
      rateLimitPerMin: form.rateLimitPerMin,
      timeoutMs: form.timeoutMs,
      retryMax: form.retryMax,
      idempotent: form.idempotent,
      maskRules: form.maskRules.trim() || undefined,
      remark: form.remark.trim() || undefined,
      status: form.status
    })
    message.success(editing.value ? '已保存' : '已创建')
    drawerOpen.value = false
    void load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function toggle(r: ApiEndpoint) {
  const status = r.status === 1 ? 2 : 1
  try {
    await toggleEndpoint(r.apiCode, status)
    message.success(status === 1 ? '已启用' : '已停用')
    void load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function remove(r: ApiEndpoint) {
  Modal.confirm({
    title: `删除 API「${r.apiName}」`,
    content: `编码 ${r.apiCode}，删除后不可恢复，确定吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        await deleteEndpoint(r.apiCode)
        message.success('已删除')
        void load()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
/* 表格最小宽度：横向滚动只发生在 .ft-scroll，操作列由 .ft-table 固定 */
.endpoint-page {
  --ft-min-width: 1400px;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.drawer-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
