<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  fetchApprovalDetail,
  INSTANCE_STATUS_NAME,
  TASK_STATUS_NAME,
  type ApprovalInstance
} from '@/api/approvals'

/**
 * 内容列表点「查看审批信息 / 查看流程」打开的审批单详情。
 * 数据来自统一账号中心代理的审批中心，只读，不做审批动作。
 */
const props = defineProps<{
  open: boolean
  instanceId?: string | null
}>()

const emit = defineEmits<{ (e: 'update:open', v: boolean): void }>()

const loading = ref(false)
const detail = ref<ApprovalInstance | null>(null)

watch(
  () => [props.open, props.instanceId] as const,
  async ([open, id]) => {
    if (!open || !id) {
      detail.value = null
      return
    }
    loading.value = true
    try {
      detail.value = await fetchApprovalDetail(String(id))
    } catch (e: any) {
      detail.value = null
      message.error(e?.message || '审批信息加载失败')
    } finally {
      loading.value = false
    }
  },
  { immediate: true }
)

function taskStatusText(status: number): string {
  return TASK_STATUS_NAME[status] || '未知'
}

function taskColor(status: number): string {
  if (status === 1) return 'green'
  if (status === 2) return 'red'
  if (status === 0) return 'blue'
  return 'gray'
}
</script>

<template>
  <a-drawer :open="open" title="审批信息" :width="560" @update:open="emit('update:open', $event)">
    <a-spin :spinning="loading">
      <template v-if="detail">
        <a-descriptions :column="1" bordered size="small">
          <a-descriptions-item label="标题">{{ detail.title }}</a-descriptions-item>
          <a-descriptions-item label="状态">
            {{ INSTANCE_STATUS_NAME[detail.status] || detail.statusName || detail.status }}
          </a-descriptions-item>
          <a-descriptions-item label="发起人">{{ detail.applicantName || '-' }}</a-descriptions-item>
          <a-descriptions-item label="发起时间">{{ detail.createdAt || '-' }}</a-descriptions-item>
          <a-descriptions-item label="完成时间">{{ detail.finishedAt || '-' }}</a-descriptions-item>
        </a-descriptions>

        <h4 class="sec-title">审批记录</h4>
        <a-timeline v-if="(detail.tasks || []).length">
          <a-timeline-item
            v-for="t in detail.tasks || []"
            :key="t.id"
            :color="taskColor(t.status)"
          >
            <div class="task-line">
              <b>{{ t.stepName || `第 ${t.stepSeq} 步` }}</b>
              <span v-if="t.nodeName"> · {{ t.nodeName }}</span>
              <a-tag :color="taskColor(t.status)" class="task-tag">
                {{ t.statusName || taskStatusText(t.status) }}
              </a-tag>
            </div>
            <div class="task-meta">
              审批人：{{ t.approverName || t.approverId || '-' }}
              <span v-if="t.actedAt || t.createdAt"> · {{ t.actedAt || t.createdAt }}</span>
            </div>
            <div v-if="t.opinion" class="task-opinion">意见：{{ t.opinion }}</div>
          </a-timeline-item>
        </a-timeline>
        <a-empty v-else description="暂无审批任务记录" />
      </template>
      <a-empty v-else-if="!loading" description="未找到审批单" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.sec-title {
  margin: 20px 0 12px;
  font-weight: 600;
}
.task-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}
.task-tag {
  margin-left: 6px;
}
.task-meta {
  font-size: 12px;
  opacity: 0.72;
  margin-top: 4px;
}
.task-opinion {
  margin-top: 4px;
  font-size: 13px;
}
</style>
