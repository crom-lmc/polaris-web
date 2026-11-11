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
    <div class="panel">
      <div class="panel-head">
        <span>执行器</span>
        <div class="actions">
          <button class="btn" @click="load">刷新</button>
        </div>
      </div>
      <div class="panel-body">
        <div class="executor-grid" :class="{ loading }">
          <div v-for="e in data" :key="e.id" class="executor-card">
            <div class="executor-head">
              <span class="dot" :class="e.online ? 'dot-green' : 'dot-red'"></span>
              <span class="executor-name">{{ e.appCode }}</span>
              <span class="tag tag-blue">{{ appLabel(e.appCode) }}</span>
            </div>
            <div class="executor-meta">
              地址：<span class="mono">{{ e.address || '—' }}</span><br />
              最后心跳：<span class="mono">{{ formatDateTime(e.lastHeartbeat) }}</span>
              <template v-if="relTime(e.lastHeartbeat)">（{{ relTime(e.lastHeartbeat) }}）</template><br />
              注册任务：{{ e.jobCount }} 个 · 版本：{{ e.version || '—' }} · 实例：{{ e.online ? '1/1' : '0/1' }}
            </div>
            <div v-if="e.handlers && e.handlers.length" class="hint">
              Handler：{{ e.handlers.map((h) => h.name).join('、') }}
            </div>
          </div>
          <div v-if="!data.length" class="executor-card executor-empty">
            新增服务接入后自动出现在这里
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
