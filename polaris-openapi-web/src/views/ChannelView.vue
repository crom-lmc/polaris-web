<template>
  <div class="ft-page channel-page">
    <div class="toolbar ft-head">
      <a-button @click="load">刷新</a-button>
      <a-button v-if="canCreate" type="primary" @click="openCreate">新增渠道</a-button>
    </div>

    <section v-if="canList" class="ft-scroll ft-bottom">
      <a-table
        class="ft-table"
        :columns="columns"
        :data-source="pagedRows"
        :loading="loading"
        row-key="channelCode"
        :pagination="pagination"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'channelCode'">
            <span class="mono">{{ record.channelCode }}</span>
          </template>
          <template v-else-if="column.key === 'allowedApps'">
            <span class="cell-sub">{{ record.allowedApps || '不限制' }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'credential'">
            <span v-if="record.credentialConfigured" class="credential-ok">已配置</span>
            <a-tag v-else color="orange">未配置</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="8">
              <a-button v-if="canCredential" type="link" size="small" @click="openCredential(record)">
                维护凭证
              </a-button>
              <a-button v-if="canEdit" type="link" size="small" @click="openEdit(record)">编辑</a-button>
              <a-button
                v-if="canEdit"
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
      message="你没有「openapi:channel:list」权限，无法查看渠道列表"
    />

    <!-- 新增 / 编辑 -->
    <a-modal
      centered
      v-model:open="modalOpen"
      :title="editing ? '编辑渠道' : '新增渠道'"
      :confirm-loading="saving"
      @ok="submit"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="渠道编码" required extra="全局唯一，保存后不可修改">
          <a-input v-model:value="form.channelCode" :disabled="!!editing" placeholder="如 sso-center" />
        </a-form-item>
        <a-form-item label="渠道名称" required>
          <a-input v-model:value="form.channelName" placeholder="统一账号中心" />
        </a-form-item>
        <a-form-item label="基础地址">
          <a-input v-model:value="form.baseUrl" placeholder="https://example.com（可选）" />
        </a-form-item>
        <a-form-item label="鉴权方式">
          <a-select v-model:value="form.authType" :options="authOptions" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="超时（ms）">
              <a-input-number v-model:value="form.timeoutMs" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="重试次数">
              <a-input-number v-model:value="form.retryMax" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="允许的应用" extra="多个应用编码用逗号分隔；留空表示不限制">
          <a-input v-model:value="form.allowedApps" placeholder="如 cms,ehr,oa" />
        </a-form-item>
        <a-form-item label="鉴权配置">
          <a-textarea v-model:value="form.authConfig" :rows="3" placeholder="JSON 或其他配置项（可选）" />
        </a-form-item>
        <a-form-item label="状态">
          <a-select v-model:value="form.status" :options="statusOptions" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 维护凭证：先读已有字段名（值以 ****** 展示），再提交 user/password -->
    <a-modal
      centered
      v-model:open="credentialOpen"
      title="维护渠道凭证"
      :confirm-loading="credentialSaving"
      @ok="submitCredential"
    >
      <a-alert
        v-if="hasExistingFields"
        type="info"
        show-icon
        style="margin-bottom: 12px"
        message="已配置的凭证字段（值已隐藏）"
        :description="existingFieldsText"
      />
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="用户名（user）">
          <a-input v-model:value="credentialForm.user" autocomplete="off" placeholder="用户名 / clientId" />
        </a-form-item>
        <a-form-item label="密码（password）">
          <a-input-password
            v-model:value="credentialForm.password"
            autocomplete="new-password"
            placeholder="密码 / clientSecret"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  credentialFields,
  deleteChannel,
  listChannels,
  saveChannel,
  saveCredential,
  toggleChannel,
  type Channel
} from '@/api/openapi'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canList = computed(() => store.can('openapi:channel:list'))
const canCreate = computed(() => store.can('openapi:channel:create'))
const canEdit = computed(() => store.can('openapi:channel:edit'))
const canCredential = computed(() => store.can('openapi:channel:credential'))
const canDelete = computed(() => store.can('openapi:channel:delete'))

const columns = [
  { title: '渠道编码', key: 'channelCode', width: 150 },
  { title: '渠道名称', dataIndex: 'channelName', key: 'channelName', width: 140, ellipsis: true },
  { title: '鉴权方式', dataIndex: 'authType', key: 'authType', width: 130 },
  { title: '超时(ms)', dataIndex: 'timeoutMs', key: 'timeoutMs', width: 100 },
  { title: '重试', dataIndex: 'retryMax', key: 'retryMax', width: 70 },
  { title: '允许应用', key: 'allowedApps', width: 140, ellipsis: true },
  { title: '状态', key: 'status', width: 80 },
  { title: '凭证', key: 'credential', width: 90 },
  { title: '操作', key: 'action', width: 260 }
]

const authOptions = [
  { label: 'OAUTH_CLIENT', value: 'OAUTH_CLIENT' },
  { label: 'SIGNATURE', value: 'SIGNATURE' },
  { label: 'INTERNAL', value: 'INTERNAL' }
]
const statusOptions = [
  { label: '启用', value: 1 },
  { label: '停用', value: 2 }
]

const rows = ref<Channel[]>([])
const loading = ref(false)

/** 接口返回全量列表，这里做前端分页；分页条由 ft-bottom 固定到滚动容器底部 */
const page = ref(1)
const pageSize = ref(10)
const pagedRows = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return rows.value.slice(start, start + pageSize.value)
})
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: rows.value.length,
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
    rows.value = await listChannels()
  } catch (e: any) {
    message.error(e?.message || '加载渠道列表失败')
  } finally {
    loading.value = false
  }
}

/* ---------------- 新增 / 编辑 ---------------- */
const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<Channel | null>(null)

function emptyForm() {
  return {
    channelCode: '',
    channelName: '',
    baseUrl: '',
    authType: 'OAUTH_CLIENT',
    timeoutMs: 5000,
    retryMax: 0,
    allowedApps: '',
    authConfig: '',
    status: 1,
    remark: ''
  }
}
const form = reactive(emptyForm())

function openCreate() {
  editing.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(r: Channel) {
  editing.value = r
  Object.assign(form, {
    channelCode: r.channelCode,
    channelName: r.channelName || '',
    baseUrl: r.baseUrl || '',
    authType: r.authType || 'OAUTH_CLIENT',
    timeoutMs: r.timeoutMs ?? 5000,
    retryMax: r.retryMax ?? 0,
    allowedApps: r.allowedApps || '',
    authConfig: r.authConfig || '',
    status: r.status ?? 1,
    remark: r.remark || ''
  })
  modalOpen.value = true
}

async function submit() {
  if (!form.channelCode.trim() || !form.channelName.trim()) {
    message.warning('渠道编码与名称不能为空')
    return
  }
  saving.value = true
  try {
    await saveChannel({
      channelCode: form.channelCode.trim(),
      channelName: form.channelName.trim(),
      baseUrl: form.baseUrl.trim() || undefined,
      authType: form.authType,
      authConfig: form.authConfig.trim() || undefined,
      timeoutMs: form.timeoutMs,
      retryMax: form.retryMax,
      allowedApps: form.allowedApps.trim() || undefined,
      status: form.status,
      remark: form.remark.trim() || undefined
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

/* ---------------- 维护凭证 ---------------- */
const credentialOpen = ref(false)
const credentialSaving = ref(false)
const credentialChannel = ref('')
const credentialForm = reactive({ user: '', password: '' })
const existingFields = ref<Record<string, string>>({})

const hasExistingFields = computed(() => Object.keys(existingFields.value).length > 0)
const existingFieldsText = computed(() =>
  Object.keys(existingFields.value)
    .map((k) => `${k}：******`)
    .join('　')
)

async function openCredential(r: Channel) {
  credentialChannel.value = r.channelCode
  credentialForm.user = ''
  credentialForm.password = ''
  existingFields.value = {}
  credentialOpen.value = true
  try {
    existingFields.value = await credentialFields(r.channelCode)
  } catch (e: any) {
    message.error(e?.message || '加载凭证信息失败')
  }
}

async function submitCredential() {
  if (!credentialForm.user || !credentialForm.password) {
    message.warning('请填写用户名和密码')
    return
  }
  credentialSaving.value = true
  try {
    await saveCredential(credentialChannel.value, {
      user: credentialForm.user,
      password: credentialForm.password
    })
    message.success('凭证已保存')
    credentialOpen.value = false
    void load()
  } catch (e: any) {
    message.error(e?.message || '保存凭证失败')
  } finally {
    credentialSaving.value = false
  }
}

async function toggle(r: Channel) {
  const status = r.status === 1 ? 2 : 1
  try {
    await toggleChannel(r.channelCode, status)
    message.success(status === 1 ? '已启用' : '已停用')
    void load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function remove(r: Channel) {
  Modal.confirm({
    title: `删除渠道「${r.channelName}」`,
    content: `编码 ${r.channelCode}，删除后不可恢复，确定吗？`,
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        await deleteChannel(r.channelCode)
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
.channel-page {
  --ft-min-width: 1150px;
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
.cell-sub {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.credential-ok {
  color: #52c41a;
}
</style>
