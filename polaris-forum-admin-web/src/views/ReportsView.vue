<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import {
  fetchAdminReports,
  processAdminReport,
  publicThreadUrl,
  type ForumReport,
  type ReportStatus,
  type ReportTargetType
} from '@/api/forum'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'

const reports = ref<ForumReport[]>([])
const store = useUserStore()
const status = ref('')
const targetType = ref('')
const loading = ref(false)
const processing = ref(false)
const open = ref(false)
const currentReport = ref<ForumReport | null>(null)
const processForm = reactive<{ status: 'RESOLVED' | 'REJECTED'; remark: string }>({ status: 'RESOLVED', remark: '' })
const { pagination, pagedSource: pagedReports, reset: resetPage, onChange: onTableChange } = useTablePagination(reports)
const statusNames: Record<ReportStatus, string> = { PENDING: '待处理', RESOLVED: '已解决', REJECTED: '已驳回' }
const statusColors: Record<ReportStatus, string> = { PENDING: 'orange', RESOLVED: 'green', REJECTED: 'default' }
const targetNames: Record<ReportTargetType, string> = { thread: '帖子', comment: '评论' }
const columns = [
  { title: '举报人', key: 'reporter', width: 180 },
  { title: '目标摘要', key: 'target', width: 280 },
  { title: '原因与详情', key: 'reason', width: 280 },
  { title: '所属帖子', key: 'thread', width: 240 },
  { title: '状态', key: 'status', width: 100 },
  { title: '举报时间', dataIndex: 'createdAt', width: 170 },
  { title: '处理信息', key: 'handling', width: 300 },
  { title: '操作', key: 'action', width: 90 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    reports.value = await fetchAdminReports({
      status: status.value || undefined,
      targetType: targetType.value || undefined
    })
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '举报记录加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  resetPage()
  void load()
}

function openProcess(report: ForumReport) {
  if (report.status !== 'PENDING') return
  currentReport.value = report
  processForm.status = 'RESOLVED'
  processForm.remark = ''
  open.value = true
}

async function submitProcess() {
  const report = currentReport.value
  if (!report || report.status !== 'PENDING') return
  processing.value = true
  try {
    Object.assign(report, await processAdminReport(report.id, {
      status: processForm.status,
      remark: processForm.remark.trim()
    }))
    open.value = false
    currentReport.value = null
    message.success('举报处理结果已保存')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '举报处理失败')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>举报管理</h1>
      <p>查看帖子与评论举报，记录处理结果和说明；已处理举报不可重复处理。</p>
    </header>
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-select v-model:value="status" class="filter-select" @change="reload">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="PENDING">待处理</a-select-option>
          <a-select-option value="RESOLVED">已解决</a-select-option>
          <a-select-option value="REJECTED">已驳回</a-select-option>
        </a-select>
        <a-select v-model:value="targetType" class="filter-select" @change="reload">
          <a-select-option value="">全部目标</a-select-option>
          <a-select-option value="thread">帖子</a-select-option>
          <a-select-option value="comment">评论</a-select-option>
        </a-select>
        <a-button v-if="store.can('forum:report:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !pagedReports.length }">
        <a-table :columns="columns" :data-source="pagedReports" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'reporter'">
              <div class="stacked-text">
                <span>{{ record.reporterName || '未知用户' }}</span>
                <small>账号 ID：{{ record.reporterAccountId }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'target'">
              <div class="stacked-text">
                <span class="target-content" :title="record.targetContent">{{ record.targetContent || '内容已不可用' }}</span>
                <small>{{ targetNames[record.targetType as ReportTargetType] }} #{{ record.targetId }} · 举报 #{{ record.id }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'reason'">
              <div class="report-detail">
                <strong>{{ record.reason }}</strong>
                <span v-if="record.detail">{{ record.detail }}</span>
                <span v-else class="secondary-text">无补充说明</span>
              </div>
            </template>
            <template v-else-if="column.key === 'thread'">
              <div class="thread-cell">
                <a :href="publicThreadUrl(record.threadId)" target="_blank" rel="noopener noreferrer">{{ record.threadTitle || `帖子 #${record.threadId}` }}</a>
                <small>#{{ record.threadId }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColors[record.status as ReportStatus]">{{ statusNames[record.status as ReportStatus] }}</a-tag>
            </template>
            <template v-else-if="column.key === 'handling'">
              <div v-if="record.status !== 'PENDING'" class="report-detail">
                <span>{{ record.handledAt || '-' }} · {{ record.handlerName || '-' }}</span>
                <small v-if="record.handlerAccountId">处理人 ID：{{ record.handlerAccountId }}</small>
                <span>{{ record.handleResult || '无处理说明' }}</span>
              </div>
              <span v-else class="secondary-text">尚未处理</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button v-if="store.can('forum:report:process') && record.status === 'PENDING'" type="link" size="small" @click="openProcess(record)">处理</a-button>
              <span v-else class="secondary-text">已处理</span>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="open" centered title="处理举报" ok-text="保存处理结果" cancel-text="取消" :confirm-loading="processing" @ok="submitProcess">
      <a-form layout="vertical">
        <a-form-item label="处理结果" required>
          <a-radio-group v-model:value="processForm.status">
            <a-radio value="RESOLVED">已解决</a-radio>
            <a-radio value="REJECTED">已驳回</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="处理说明">
          <a-textarea v-model:value="processForm.remark" :maxlength="500" :rows="4" show-count placeholder="填写处理依据或结果说明" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.stacked-text, .thread-cell, .report-detail { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.stacked-text small, .thread-cell small, .report-detail small { color: var(--muted); }
.target-content { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 3; white-space: pre-wrap; overflow-wrap: anywhere; }
.report-detail { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.thread-cell { overflow-wrap: anywhere; }
</style>
