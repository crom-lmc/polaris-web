<template>
  <div class="ft-page endpoint-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="搜 API 编码 / 名称"
        style="width: 240px"
        allow-clear
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
              {{ record.direction === 1 ? '进' : '出' }}
            </a-tag>
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
    <a-modal
      centered
      v-model:open="modalOpen"
      :title="editing ? '编辑 API' : '新增 API'"
      :confirm-loading="saving"
      @ok="submit"
    >
      <a-form layout="vertical" style="margin-top: 12px">
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
            <a-form-item label="归属应用">
              <a-input v-model:value="form.appCode" placeholder="如 ehr" />
            </a-form-item>
          </a-col>
        </a-row>
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
    </a-modal>
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
  { title: '方向', key: 'direction', width: 70 },
  { title: '应用', dataIndex: 'appCode', key: 'appCode', width: 100 },
  { title: '方法', key: 'method', width: 80 },
  { title: '路径', key: 'path', width: 170, ellipsis: true },
  { title: '权限码', dataIndex: 'requiredPerm', key: 'requiredPerm', width: 150, ellipsis: true },
  { title: '限流/分', dataIndex: 'rateLimitPerMin', key: 'rateLimitPerMin', width: 90 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 180 }
]

const directionOptions = [
  { label: '入站（进）', value: 1 },
  { label: '出站（出）', value: 2 }
]
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

/** 按 apiCode / apiName 前端过滤 */
const filteredRows = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return rows.value
  return rows.value.filter(
    (r) => r.apiCode.toLowerCase().includes(kw) || r.apiName.toLowerCase().includes(kw)
  )
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
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<ApiEndpoint | null>(null)

function emptyForm() {
  return {
    apiCode: '',
    apiName: '',
    direction: 1,
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
  modalOpen.value = true
}

function openEdit(r: ApiEndpoint) {
  editing.value = r
  Object.assign(form, {
    apiCode: r.apiCode,
    apiName: r.apiName,
    direction: r.direction,
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
  modalOpen.value = true
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
    modalOpen.value = false
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
  --ft-min-width: 1180px;
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
</style>
