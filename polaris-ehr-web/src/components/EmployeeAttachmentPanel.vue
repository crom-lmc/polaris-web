<template>
  <div class="attachment-panel">
    <div class="sub-toolbar">
      <span class="muted">档案附件直接上传/删除，无需审批；删除仅做逻辑删除并保留落盘文件</span>
      <a-upload
        v-if="canManage"
        :show-upload-list="false"
        :before-upload="beforeUpload"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
      >
        <a-button size="small" type="primary">上传附件</a-button>
      </a-upload>
    </div>

    <a-table :columns="columns" :data-source="rows" :loading="loading" row-key="id" size="small" :pagination="false">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <a @click="download(record)">{{ record.fileName }}</a>
        </template>
        <template v-else-if="column.key === 'size'">{{ formatSize(record.size) }}</template>
        <template v-else-if="column.key === 'createdAt'">{{ record.createdAt || '—' }}</template>
        <template v-else-if="column.key === 'action'">
          <a-space size="small">
            <a @click="download(record)">下载</a>
            <a-popconfirm v-if="canManage" title="确定删除该附件？" ok-text="删除" cancel-text="取消" @confirm="remove(record)">
              <a class="danger">删除</a>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
      <template #emptyText>
        <a-empty description="暂无档案附件" />
      </template>
    </a-table>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  deleteEhrAttachment,
  downloadEhrAttachment,
  listEhrAttachments,
  uploadEhrAttachment,
  type EhrAttachment
} from '@/api/ehr'

const props = defineProps<{
  employeeId?: string
  canManage?: boolean
}>()

const rows = ref<EhrAttachment[]>([])
const loading = ref(false)

const columns = [
  { title: '文件名', key: 'name' },
  { title: '大小', key: 'size', width: 100 },
  { title: '上传时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 120 }
]

async function load() {
  if (!props.employeeId) return
  loading.value = true
  try {
    rows.value = await listEhrAttachments('EMPLOYEE', props.employeeId)
  } catch (e: any) {
    message.error(e?.message || '加载附件失败')
  } finally {
    loading.value = false
  }
}

watch(() => props.employeeId, () => load(), { immediate: true })

async function beforeUpload(file: File) {
  if (!props.employeeId) return false
  try {
    await uploadEhrAttachment(file, 'EMPLOYEE', props.employeeId)
    message.success('附件已上传')
    await load()
  } catch (e: any) {
    message.error(e?.message || '附件上传失败')
  }
  return false
}

async function remove(record: EhrAttachment) {
  try {
    await deleteEhrAttachment(record.id)
    message.success('附件已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

async function download(record: EhrAttachment) {
  try {
    const res: any = await downloadEhrAttachment(record.id)
    const blob = new Blob([res.data], { type: record.mime || 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = record.fileName
    a.click()
    URL.revokeObjectURL(url)
  } catch (e: any) {
    message.error(e?.message || '下载失败')
  }
}

function formatSize(size: number) {
  if (!size) return '0 B'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

defineExpose({ reload: load })
</script>

<style scoped>
.attachment-panel {
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
.danger {
  color: var(--color-error, #ff4d4f);
}
</style>
