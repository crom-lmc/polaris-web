<template>
  <div class="contract-panel">
    <div class="sub-toolbar">
      <span class="muted">续签、终止需经人力资源中心审批；到期前 30/7/1 天自动提醒本人、主管与 HR</span>
      <a-button v-if="canManage" size="small" type="primary" @click="openCreate">新增合同</a-button>
    </div>

    <a-table :columns="columns" :data-source="rows" :loading="loading" row-key="id" size="small" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'type'">
          <b>{{ record.contractTypeName || record.contractType }}</b>
          <div v-if="record.contractNo" class="muted">{{ record.contractNo }}</div>
        </template>
        <template v-else-if="column.key === 'range'">
          {{ record.startDate || '—' }} ~ {{ record.endDate || '无固定期限' }}
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusColor(record.status)">{{ record.statusName || record.status }}</a-tag>
          <a-tag v-if="record.expireFlag === 'RED'" color="red" class="expire-tag">7 天内到期</a-tag>
          <a-tag v-else-if="record.expireFlag === 'YELLOW'" color="orange" class="expire-tag">30 天内到期</a-tag>
        </template>
        <template v-else-if="column.key === 'file'">
          <a v-if="record.fileId && record.fileName" @click="download(record)">{{ record.fileName }}</a>
          <span v-else class="muted">—</span>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space size="small">
            <a v-if="canManage && canEdit(record)" @click="openEdit(record)">编辑</a>
            <a v-if="canManage && canRenew(record)" @click="openRenew(record)">续签</a>
            <a-popconfirm
              v-if="canManage && record.status === 'ACTIVE'"
              title="终止合同需经人力资源中心审批，确定发起？"
              ok-text="发起终止"
              cancel-text="取消"
              @confirm="openTerminate(record)"
            >
              <a class="danger">终止</a>
            </a-popconfirm>
            <span v-if="!canManage" class="muted">—</span>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新增 / 编辑 -->
    <a-modal
      v-model:open="modal.open"
      :title="modal.editing ? '编辑合同' : '新增合同'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="modal.saving"
      width="560px"
      centered
      destroy-on-close
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="合同类型" required>
              <a-select v-model:value="modal.form.contractType" :options="typeOptions" @change="onTypeChange" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="合同编号">
              <a-input v-model:value="modal.form.contractNo" :maxlength="64" placeholder="可留空" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="开始日期" required>
              <a-date-picker v-model:value="modal.form.startDate" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item :label="modal.form.contractType === 'UNFIXED' ? '结束日期' : '结束日期（必填）'" :required="modal.form.contractType !== 'UNFIXED'">
              <a-date-picker
                v-model:value="modal.form.endDate"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="modal.form.contractType === 'UNFIXED'"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="签订日期">
              <a-date-picker v-model:value="modal.form.signDate" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="合同附件">
              <a-upload :show-upload-list="false" :before-upload="beforeUpload" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx">
                <a-button size="small">{{ modal.form.fileId ? '重新上传' : '上传附件' }}</a-button>
              </a-upload>
              <span v-if="modal.form.fileName" class="muted file-name">{{ modal.form.fileName }}</span>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-input v-model:value="modal.form.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 续签 -->
    <a-modal
      v-model:open="renewModal.open"
      title="发起续签审批"
      ok-text="提交审批"
      cancel-text="取消"
      :confirm-loading="renewModal.saving"
      width="560px"
      centered
      destroy-on-close
      @ok="submitRenew"
    >
      <a-alert type="info" show-icon :message="`原合同 ${renewModal.oldRange}，审批通过后新合同自动生效`" class="renew-alert" />
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="新合同开始日期" required>
              <a-date-picker v-model:value="renewModal.form.startDate" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="新合同结束日期" :required="renewModal.type !== 'UNFIXED'">
              <a-date-picker
                v-model:value="renewModal.form.endDate"
                value-format="YYYY-MM-DD"
                style="width: 100%"
                :disabled="renewModal.type === 'UNFIXED'"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="合同编号">
              <a-input v-model:value="renewModal.form.contractNo" :maxlength="64" placeholder="可留空" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="签订日期">
              <a-date-picker v-model:value="renewModal.form.signDate" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="续签说明">
          <a-textarea v-model:value="renewModal.form.reason" :rows="3" :maxlength="200" show-count />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 终止 -->
    <a-modal
      v-model:open="terminateModal.open"
      title="发起终止审批"
      ok-text="提交审批"
      cancel-text="取消"
      :confirm-loading="terminateModal.saving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitTerminate"
    >
      <a-alert type="warning" show-icon message="审批通过后合同置为已终止；驳回则恢复生效中" class="renew-alert" />
      <a-form layout="vertical">
        <a-form-item label="终止原因" required>
          <a-textarea v-model:value="terminateModal.reason" :rows="3" :maxlength="200" show-count placeholder="请填写终止原因" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  addContract,
  downloadEhrAttachment,
  listContracts,
  renewContract,
  terminateContract,
  updateContract,
  uploadEhrAttachment,
  type ContractItem
} from '@/api/ehr'

const props = defineProps<{
  employeeId?: string
  canManage?: boolean
}>()

const rows = ref<ContractItem[]>([])
const loading = ref(false)

const typeOptions = [
  { value: 'FIXED', label: '固定期限' },
  { value: 'UNFIXED', label: '无固定期限' },
  { value: 'INTERN', label: '实习' },
  { value: 'LABOR', label: '劳务' }
]

const columns = [
  { title: '合同类型', key: 'type', width: 150 },
  { title: '合同期限', key: 'range', width: 200 },
  { title: '状态', key: 'status', width: 160 },
  { title: '附件', key: 'file', width: 140 },
  { title: '操作', key: 'action', width: 150 }
]

function statusColor(status: string) {
  switch (status) {
    case 'ACTIVE':
      return 'green'
    case 'PENDING':
      return 'blue'
    case 'TERMINATING':
      return 'orange'
    case 'EXPIRED':
      return 'red'
    case 'RENEWED':
      return 'purple'
    case 'TERMINATED':
      return 'default'
    default:
      return 'default'
  }
}

function canEdit(record: ContractItem) {
  return record.status === 'ACTIVE' || record.status === 'EXPIRED'
}

function canRenew(record: ContractItem) {
  return record.status === 'ACTIVE' || record.status === 'EXPIRED'
}

async function load() {
  if (!props.employeeId) return
  loading.value = true
  try {
    rows.value = await listContracts(props.employeeId)
  } catch (e: any) {
    message.error(e?.message || '加载合同失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.employeeId, () => load(), { immediate: true })

/* ---------- 新增 / 编辑 ---------- */
const modal = reactive({
  open: false,
  editing: false,
  saving: false,
  id: '',
  form: {
    contractType: 'FIXED',
    contractNo: '',
    startDate: '',
    endDate: '',
    signDate: '',
    fileId: '',
    fileName: '',
    remark: ''
  }
})

function openCreate() {
  modal.editing = false
  modal.id = ''
  Object.assign(modal.form, {
    contractType: 'FIXED',
    contractNo: '',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: '',
    signDate: dayjs().format('YYYY-MM-DD'),
    fileId: '',
    fileName: '',
    remark: ''
  })
  modal.open = true
}

function openEdit(record: ContractItem) {
  modal.editing = true
  modal.id = record.id
  Object.assign(modal.form, {
    contractType: record.contractType,
    contractNo: record.contractNo || '',
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    signDate: record.signDate || '',
    fileId: record.fileId || '',
    fileName: record.fileName || '',
    remark: record.remark || ''
  })
  modal.open = true
}

function onTypeChange() {
  if (modal.form.contractType === 'UNFIXED') {
    modal.form.endDate = ''
  }
}

async function beforeUpload(file: File) {
  try {
    const res = await uploadEhrAttachment(file, 'TEMP')
    modal.form.fileId = res.id
    modal.form.fileName = res.fileName
    message.success('附件已上传，保存合同后生效')
  } catch (e: any) {
    message.error(e?.message || '附件上传失败')
  }
  return false
}

async function submit() {
  if (!props.employeeId) return
  if (!modal.form.contractType || !modal.form.startDate) {
    message.warning('请填写合同类型与开始日期')
    return
  }
  if (modal.form.contractType !== 'UNFIXED' && !modal.form.endDate) {
    message.warning('非无固定期限合同必须填写结束日期')
    return
  }
  modal.saving = true
  try {
    const body = {
      contractNo: modal.form.contractNo,
      contractType: modal.form.contractType,
      startDate: modal.form.startDate,
      endDate: modal.form.contractType === 'UNFIXED' ? undefined : modal.form.endDate,
      signDate: modal.form.signDate || undefined,
      fileId: modal.form.fileId || undefined,
      remark: modal.form.remark
    }
    if (modal.editing) {
      await updateContract(modal.id, body)
      message.success('合同已更新')
    } else {
      await addContract(props.employeeId, body)
      message.success('合同已新增')
    }
    modal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    modal.saving = false
  }
}

/* ---------- 续签 ---------- */
const renewModal = reactive({
  open: false,
  saving: false,
  id: '',
  type: 'FIXED',
  oldRange: '',
  form: {
    startDate: '',
    endDate: '',
    contractNo: '',
    signDate: '',
    fileId: '',
    fileName: '',
    reason: ''
  }
})

function openRenew(record: ContractItem) {
  renewModal.id = record.id
  renewModal.type = record.contractType
  renewModal.oldRange = `${record.startDate || '—'} ~ ${record.endDate || '无固定期限'}`
  const nextStart = record.endDate ? dayjs(record.endDate).add(1, 'day') : dayjs()
  Object.assign(renewModal.form, {
    startDate: nextStart.format('YYYY-MM-DD'),
    endDate: record.contractType === 'UNFIXED' ? '' : nextStart.add(3, 'year').subtract(1, 'day').format('YYYY-MM-DD'),
    contractNo: record.contractNo || '',
    signDate: dayjs().format('YYYY-MM-DD'),
    fileId: '',
    fileName: '',
    reason: ''
  })
  renewModal.open = true
}

async function submitRenew() {
  if (!renewModal.form.startDate) {
    message.warning('请填写新合同开始日期')
    return
  }
  if (renewModal.type !== 'UNFIXED' && !renewModal.form.endDate) {
    message.warning('非无固定期限合同必须填写结束日期')
    return
  }
  renewModal.saving = true
  try {
    await renewContract(renewModal.id, {
      contractNo: renewModal.form.contractNo || undefined,
      contractType: renewModal.type,
      startDate: renewModal.form.startDate,
      endDate: renewModal.type === 'UNFIXED' ? undefined : renewModal.form.endDate,
      signDate: renewModal.form.signDate || undefined,
      reason: renewModal.form.reason
    })
    message.success('续签审批已提交，请在审批中心跟进')
    renewModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    renewModal.saving = false
  }
}

/* ---------- 终止 ---------- */
const terminateModal = reactive({
  open: false,
  saving: false,
  id: '',
  reason: ''
})

function openTerminate(record: ContractItem) {
  terminateModal.id = record.id
  terminateModal.reason = ''
  terminateModal.open = true
}

async function submitTerminate() {
  if (!terminateModal.reason.trim()) {
    message.warning('请填写终止原因')
    return
  }
  terminateModal.saving = true
  try {
    await terminateContract(terminateModal.id, terminateModal.reason.trim())
    message.success('终止审批已提交，请在审批中心跟进')
    terminateModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    terminateModal.saving = false
  }
}

/* ---------- 附件下载 ---------- */
async function download(record: ContractItem) {
  if (!record.fileId) return
  try {
    const res: any = await downloadEhrAttachment(record.fileId)
    const blob = new Blob([res.data], { type: record.fileName?.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = record.fileName || '合同附件'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    message.error(e?.message || '下载失败')
  }
}

defineExpose({ reload: load })
</script>

<style scoped>
.contract-panel {
  min-height: 120px;
}
.sub-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.muted {
  color: var(--color-text-tertiary, #8c8c8c);
  font-size: 12px;
}
.file-name {
  display: inline-block;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
  margin-left: 6px;
}
.expire-tag {
  margin-left: 4px;
}
.renew-alert {
  margin-bottom: 12px;
}
.danger {
  color: var(--color-error, #ff4d4f);
}
</style>
