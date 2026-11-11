<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listExecutors, type ExecutorVO } from '@/api/executor'
import { appLabel } from '@/utils/apps'
import { formatDateTime } from '@/utils/format'

const loading = ref(false)
const data = ref<ExecutorVO[]>([])

async function load() {
  loading.value = true
  try {
    data.value = await listExecutors()
  } finally {
    loading.value = false
  }
}

onMounted(load)

function relTime(v?: string) {
  if (!v) return ''
  const t = new Date(v.replace(' ', 'T')).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Math.round((Date.now() - t) / 1000))
  if (diff < 60) return `${diff} 秒前`
  if (diff < 3600) return `${Math.round(diff / 60)} 分钟前`
  return `${Math.round(diff / 3600)} 小时前`
}
</script>

<template>
  <section class="view">
    <a-card :bordered="false" title="执行器">
      <template #extra>
        <a-button @click="load">刷新</a-button>
      </template>

      <a-spin :spinning="loading">
        <a-row :gutter="[12, 12]">
          <a-col v-for="e in data" :key="e.id" :xs="24" :md="12">
            <a-card size="small" :bordered="true">
              <template #title>
                <a-badge :status="e.online ? 'success' : 'error'" :text="e.appCode" />
                <a-tag color="blue" style="margin-left: 8px">{{ appLabel(e.appCode) }}</a-tag>
              </template>
              <a-descriptions :column="1" size="small">
                <a-descriptions-item label="地址">
                  <span class="mono">{{ e.address || '—' }}</span>
                </a-descriptions-item>
                <a-descriptions-item label="最后心跳">
                  <span class="mono">{{ formatDateTime(e.lastHeartbeat) }}</span>
                  <span v-if="relTime(e.lastHeartbeat)" class="text-secondary">
                    （{{ relTime(e.lastHeartbeat) }}）
                  </span>
                </a-descriptions-item>
                <a-descriptions-item label="注册任务">
                  {{ e.jobCount }} 个 · 版本 {{ e.version || '—' }} · 实例 {{ e.online ? '1/1' : '0/1' }}
                </a-descriptions-item>
              </a-descriptions>
              <div v-if="e.handlers && e.handlers.length" style="margin-top: 8px">
                <a-space wrap :size="[4, 4]">
                  <a-tag v-for="h in e.handlers" :key="h.name">{{ h.name }}</a-tag>
                </a-space>
              </div>
            </a-card>
          </a-col>
        </a-row>
        <a-empty v-if="!loading && !data.length" description="新增服务接入后自动出现在这里" />
      </a-spin>
    </a-card>
  </section>
</template>
