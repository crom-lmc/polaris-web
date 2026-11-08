<template>
  <div class="ft-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="应用编码 / 名称"
        style="width: 260px"
        allow-clear
        @search="load"
      />
      <a-select
        v-model:value="statusFilter"
        style="width: 130px"
        :options="statusOptions"
        @change="load"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('app:create')" type="primary" @click="openCreate">新建应用</a-button>
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <section class="ft-scroll ft-bottom">
      <a-table
        class="ft-table"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="name-cell">
              <span class="name">
                {{ record.name }}
                <a-tag v-if="record.builtIn" class="builtin-tag" color="blue">内置</a-tag>
              </span>
              <span class="code">{{ record.code }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'baseUrl'">
            <a v-if="record.baseUrl" :href="record.baseUrl" target="_blank" rel="noopener">
              {{ record.baseUrl }}
            </a>
            <span v-else class="muted">未配置</span>
          </template>

          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'secret'">
            <span class="mono">{{ record.appSecretMasked || '****' }}</span>
          </template>

          <template v-else-if="column.key === 'action'">
            <!-- 内置应用（统一账号中心）：默认存在，不允许任何操作 -->
            <span v-if="record.builtIn" class="muted">内置应用，不可操作</span>
            <a-space v-else>
              <a-button v-if="store.can('app:edit')" type="link" size="small" @click="openEdit(record)">
                编辑
              </a-button>
              <a-button
                v-if="store.can('app:edit')"
                type="link"
                size="small"
                :danger="record.status === 1"
                @click="askToggle(record)"
              >
                {{ record.status === 1 ? '停用' : '启用' }}
              </a-button>
              <a-button
                v-if="store.can('app:secret:reset')"
                type="link"
                size="small"
                @click="askResetSecret(record)"
              >
                重置密钥
              </a-button>
              <a-button
                v-if="store.can('app:delete')"
                type="link"
                size="small"
                danger
                @click="askDelete(record)"
              >
                删除
              </a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新建 / 编辑 -->
    <a-modal
      centered
      v-model:open="editOpen"
      :title="editing ? '编辑应用' : '新建应用'"
      :confirm-loading="submitting"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-form-item
          label="应用编码"
          name="code"
          :rules="[
            { required: !editing, message: '请输入应用编码' },
            { pattern: /^[a-z0-9][a-z0-9_-]{1,63}$/, message: '2-64 位小写字母/数字/下划线/中划线' }
          ]"
        >
          <a-input
            v-model:value="editForm.code"
            :disabled="!!editing"
            placeholder="如 blog-admin"
          />
          <div class="field-tip">编码是 ticket 与用户授权的关联键，创建后不可修改</div>
        </a-form-item>

        <a-form-item label="应用名称" name="name" :rules="[{ required: true, message: '请输入名称' }]">
          <a-input v-model:value="editForm.name" placeholder="如 博客后台" />
        </a-form-item>

        <a-form-item
          label="访问地址"
          name="baseUrl"
          :rules="[{ type: 'url', message: '需为完整 URL，如 https://blog.example.com' }]"
        >
          <a-input v-model:value="editForm.baseUrl" placeholder="https://blog.example.com" />
          <div class="field-tip">单点跳转的目标；也会作为回跳地址的合法 origin 校验依据</div>
        </a-form-item>

        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="editForm.sort" :min="0" style="width: 120px" />
        </a-form-item>

        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="editForm.remark" :rows="2" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 密钥只显示一次：新建/重置后必须让用户当场复制 -->
    <a-modal centered v-model:open="secretOpen" title="应用密钥（仅显示一次）" :footer="null">
      <a-alert
        type="warning"
        show-icon
        message="请立即复制并填入该应用的服务端配置，关闭后将无法再次查看"
        style="margin-bottom: 12px"
      />
      <a-input-group compact>
        <a-input :value="newSecret" readonly class="mono" style="width: calc(100% - 76px)" />
        <a-button type="primary" style="width: 76px" @click="copySecret">复制</a-button>
      </a-input-group>
      <div class="field-tip" style="margin-top: 8px">
        应用后端调用 <span class="mono">POST /api/auth/ticket/exchange</span> 时需要携带它
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import {
  createApplication,
  deleteApplication,
  fetchApplications,
  resetApplicationSecret,
  updateApplication
} from '@/api/apps'
import { useUserStore } from '@/stores/user'
import type { ApplicationVO } from '@/types'
import { message } from 'ant-design-vue'
import { confirmAction } from '@/utils/confirm'

const store = useUserStore()

const columns = [
  { title: '应用', key: 'name', width: 200 },
  { title: '访问地址', key: 'baseUrl' },
  { title: '密钥', key: 'secret', width: 170 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 260 }
]

const statusOptions = [
  { label: '全部状态', value: 0 },
  { label: '启用', value: 1 },
  { label: '停用', value: 2 }
]

const records = ref<ApplicationVO[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref(0)
const errorMsg = ref('')

const editOpen = ref(false)
const submitting = ref(false)
const editing = ref<ApplicationVO | null>(null)
const editFormRef = ref()
const editForm = reactive({
  code: '',
  name: '',
  baseUrl: '',
  remark: '',
  sort: 0
})

const secretOpen = ref(false)
const newSecret = ref('')

onMounted(load)

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchApplications({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined
    })
    records.value = res.data || []
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(editForm, { code: '', name: '', baseUrl: '', remark: '', sort: 0 })
  editOpen.value = true
}

function openEdit(record: ApplicationVO) {
  editing.value = record
  Object.assign(editForm, {
    code: record.code,
    name: record.name,
    baseUrl: record.baseUrl || '',
    remark: record.remark || '',
    sort: record.sort ?? 0
  })
  editOpen.value = true
}

async function submitEdit() {
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (editing.value) {
      await updateApplication(editing.value.id, {
        name: editForm.name,
        baseUrl: editForm.baseUrl,
        remark: editForm.remark,
        sort: editForm.sort
      })
      message.success('已保存')
    } else {
      const res = await createApplication({
        code: editForm.code,
        name: editForm.name,
        baseUrl: editForm.baseUrl,
        remark: editForm.remark,
        sort: editForm.sort,
        status: 1
      })
      message.success('已创建')
      // 明文密钥只在创建响应里出现一次，立刻弹出来让用户复制
      if (res.data?.appSecret) {
        newSecret.value = res.data.appSecret
        secretOpen.value = true
      }
    }
    editOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

// 二次确认：把危险/状态变更操作统一收敛到 Modal.confirm 对话框
function askToggle(record: ApplicationVO) {
  const enabling = record.status !== 1
  confirmAction({
    title: enabling ? '启用应用' : '停用应用',
    content: enabling
      ? '启用后该应用恢复单点登录，确认吗？'
      : '停用后该应用将无法单点登录，确认吗？',
    okText: enabling ? '启用' : '停用',
    okType: enabling ? 'primary' : 'danger',
    onOk: () => toggleStatus(record)
  })
}

function askResetSecret(record: ApplicationVO) {
  confirmAction({
    title: '重置应用密钥',
    content: '重置后旧密钥立即失效，正在运行的应用需同步更新配置。确认吗？',
    okText: '重置',
    onOk: () => resetSecret(record)
  })
}

function askDelete(record: ApplicationVO) {
  confirmAction({
    title: '删除应用',
    content: '删除后该应用的授权关系一并清除，确认吗？',
    okText: '删除',
    okType: 'danger',
    onOk: () => remove(record)
  })
}

async function toggleStatus(record: ApplicationVO) {
  try {
    await updateApplication(record.id, { status: record.status === 1 ? 2 : 1 })
    message.success(record.status === 1 ? '已停用' : '已启用')
    await load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function resetSecret(record: ApplicationVO) {
  try {
    const res = await resetApplicationSecret(record.id)
    newSecret.value = res.data
    secretOpen.value = true
    await load()
  } catch (e: any) {
    message.error(e?.message || '重置失败')
  }
}

async function remove(record: ApplicationVO) {
  try {
    await deleteApplication(record.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

async function copySecret() {
  try {
    await navigator.clipboard.writeText(newSecret.value)
    message.success('已复制')
  } catch {
    message.warning('复制失败，请手动选中文本复制')
  }
}
</script>

<style scoped>
/* 固定列宽合计约 720px + 访问地址列，窄窗口下留一点横向滚动让操作列 sticky 生效 */
.ft-page {
  --ft-min-width: 1000px;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.name-cell {
  display: flex;
  flex-direction: column;
}

.name-cell .name {
  font-weight: 600;
}

.name-cell .builtin-tag {
  margin-left: 6px;
  font-weight: 400;
  line-height: 18px;
}

.name-cell .code,
.muted {
  font-size: 12px;
  color: var(--muted);
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}

.field-tip {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
</style>
