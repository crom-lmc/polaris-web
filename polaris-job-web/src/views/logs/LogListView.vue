<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { Dayjs } from 'dayjs'
import { listLogs, getLog, type JobLogVO } from '@/api/log'
import { listJobs, type JobInfo } from '@/api/job'
import { appLabel } from '@/utils/apps'
import { compareIdDesc, formatDateTime, formatDuration } from '@/utils/format'

const route = useRoute()

const size = 20
const loading = ref(false)
const rows = ref<JobLogVO[]>([])
const total = ref(0)
const page = ref(1)
const jobId = ref<string | undefined>()
const status = ref<number | undefined>()
const range = ref<[Dayjs, Dayjs] | undefined>()

const jobs = ref<JobInfo[]>([])
const detail = ref<JobLogVO | null>(null)

const jobOptions = computed(() =>
  jobs.value.map((j) => ({ value: String(j.id), label: j.name }))
)
const statusOptions = [
  { value: 0, label: '执行中' },
  { value: 1, label: '成功' },
  { value: 2, label: '失败' },
  { value: 3, label: '超时' },
  { value: 4, label: '取消' }
]

const columns = [
  { title: '执行 ID', key: 'id', width: 210 },
  { title: '任务', key: 'job', width: 220 },
  { title: '触发方式', key: 'trigger', width: 110 },
  { title: '执行器', key: 'executor', width: 170 },
  { title: '开始时间', key: 'startedAt', width: 180 },
  { title: '耗时', key: 'duration', width: 100 },
  { title: '状态', key: 'status', width: 160 },
  { title: '操作', key: 'action', width: 100 }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: size,
  total: total.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`
}))

function buildQuery(pageNo: number, pageSize: number) {
  return {
    page: pageNo,
    size: pageSize,
    jobId: jobId.value || undefined,
    status: status.value,
    startTime: range.value?.[0].format('YYYY-MM-DD HH:mm:ss'),
    endTime: range.value?.[1].format('YYYY-MM-DD HH:mm:ss')
  }
}

async function load() {
  loading.value = true
  try {
    // 后端未按时间倒序返回（默认主键升序），先探测顺序，把「第 1 页」映射到最后一页
    const probe = await listLogs(buildQuery(1, 2))
    const ascending = probe.records.length > 1 && compareIdDesc(probe.records[0].id, probe.records[1].id) > 0
    const totalPages = Math.max(1, Math.ceil(probe.total / size))
    const serverPage = ascending ? Math.min(totalPages, Math.max(1, totalPages - page.value + 1)) : page.value

    const r = await listLogs(buildQuery(serverPage, size))
    rows.value = [...r.records].sort((a, b) => compareIdDesc(a.id, b.id))
    total.value = r.total
  } finally {
    loading.value = false
  }
}

async function loadJobs() {
  try {
    const r = await listJobs({ page: 1, size: 200 })
    jobs.value = r.records
  } catch {
    /* 任务下拉失败不影响日志查询 */
  }
}

onMounted(async () => {
  const q = route.query.jobId
  if (q) jobId.value = String(q)
  await Promise.all([load(), loadJobs()])
})

function search() {
  page.value = 1
  load()
}

function reset() {
  jobId.value = undefined
  status.value = undefined
  range.value = undefined
  page.value = 1
  load()
}

function goto(p: number) {
  if (p < 1 || p === page.value) return
  page.value = p
  load()
}

function onTableChange(pag: { current?: number }) {
  goto(pag.current || 1)
}

const LOG_STATUS: Record<number, { text: string; color: string }> = {
  0: { text: '执行中', color: 'processing' },
  1: { text: '成功', color: 'success' },
  2: { text: '失败', color: 'error' },
  3: { text: '超时', color: 'warning' },
  4: { text: '取消', color: 'default' }
}

const TRIGGER: Record<string, string> = {
  SCHEDULE: '调度触发',
  MANUAL: '手动触发',
  RETRY: '失败重试'
}

function triggerText(t?: string) {
  return TRIGGER[t || ''] || t || '—'
}

function timeOnly(v?: string) {
  const t = formatDateTime(v)
  if (t === '—') return '—'
  return t.split(' ')[1] || t
}

async function openDetail(row: JobLogVO) {
  detail.value = await getLog(row.id)
}

const timelineItems = computed(() => {
  const d = detail.value
  if (!d) return [] as Array<{ color: string; time: string; title: string; sub: string }>
  const items: Array<{ color: string; time: string; title: string; sub: string }> = []
  items.push({
    color: 'blue',
    time: timeOnly(d.startedAt || d.plannedAt),
    title: '调度中心下发执行指令',
    sub: `执行器 ${d.executorAddress || '—'} · 触发方式 ${triggerText(d.triggerType)} · 耗时 ${formatDuration(d.durationMs)}`
  })
  const s = LOG_STATUS[d.status] || { text: '未知', color: 'default' }
  items.push({
    color: d.status === 1 ? 'green' : 'red',
    time: timeOnly(d.finishedAt),
    title: `执行${s.text}`,
    sub: [d.errorMsg || ''].filter(Boolean).join(' · ')
  })
  if (d.retryIndex > 0) {
    items.push({
      color: 'orange',
      time: '',
      title: `第 ${d.retryIndex} 次重试`,
      sub: '由调度中心按重试策略重新排队'
    })
  }
  return items
})
</script>

<template>
  <section class="view">
    <a-card :bordered="false" title="调度日志">
      <template #extra>
        <a-button @click="load">刷新</a-button>
      </template>

      <a-space wrap style="margin-bottom: 12px">
        <a-select
          v-model:value="jobId"
          style="width: 220px"
          placeholder="全部任务"
          allow-clear
          show-search
          option-filter-prop="label"
          :options="jobOptions"
        />
        <a-select
          v-model:value="status"
          style="width: 140px"
          placeholder="全部状态"
          allow-clear
          :options="statusOptions"
        />
        <a-range-picker v-model:value="range" show-time style="width: 380px" />
        <a-button type="primary" @click="search">查询</a-button>
        <a-button @click="reset">重置</a-button>
      </a-space>

      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :columns="columns"
        :data-source="rows"
        :pagination="pagination"
        :scroll="{ x: 1200 }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'id'">
            <span class="mono">#{{ record.id }}</span>
          </template>
          <template v-else-if="column.key === 'job'">
            {{ record.jobName || '—' }}
            <a-tag color="blue" style="margin-left: 6px">{{ appLabel(record.appCode) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'trigger'">
            <a-tag :color="record.triggerType === 'MANUAL' ? 'blue' : record.triggerType === 'RETRY' ? 'orange' : 'default'">
              {{ triggerText(record.triggerType) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'executor'">
            <span class="mono">{{ record.executorAddress || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'startedAt'">
            <span class="mono">{{ formatDateTime(record.startedAt) }}</span>
          </template>
          <template v-else-if="column.key === 'duration'">
            <span class="mono">{{ formatDuration(record.durationMs) }}</span>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="(LOG_STATUS[record.status] || { color: 'default' }).color">
              {{ (LOG_STATUS[record.status] || { text: '未知' }).text }}
            </a-tag>
            <a-tag v-if="record.retryIndex > 0" color="red">重试 {{ record.retryIndex }}</a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button type="link" size="small" @click="openDetail(record)">查看日志</a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card v-if="detail" :bordered="false" :title="`执行明细（#${detail.id} ${detail.jobName || ''}）`">
      <template #extra>
        <a-button @click="detail = null">收起</a-button>
      </template>

      <a-descriptions :column="3" size="small" bordered style="margin-bottom: 16px">
        <a-descriptions-item label="执行 ID">
          <span class="mono">{{ detail.id }}</span>
        </a-descriptions-item>
        <a-descriptions-item label="任务">{{ detail.jobName || '—' }}</a-descriptions-item>
        <a-descriptions-item label="触发方式">{{ triggerText(detail.triggerType) }}</a-descriptions-item>
        <a-descriptions-item label="执行器">{{ detail.executorAddress || '—' }}</a-descriptions-item>
        <a-descriptions-item label="耗时">{{ formatDuration(detail.durationMs) }}</a-descriptions-item>
        <a-descriptions-item label="状态">
          <a-tag :color="(LOG_STATUS[detail.status] || { color: 'default' }).color">
            {{ (LOG_STATUS[detail.status] || { text: '未知' }).text }}
          </a-tag>
        </a-descriptions-item>
      </a-descriptions>

      <a-timeline>
        <a-timeline-item v-for="(item, i) in timelineItems" :key="i" :color="item.color">
          <div class="text-secondary mono">{{ item.time }}</div>
          <div>{{ item.title }}</div>
          <div v-if="item.sub" class="text-secondary">{{ item.sub }}</div>
        </a-timeline-item>
      </a-timeline>

      <template v-if="detail.errorMsg || detail.output">
        <div class="hint" style="margin: 8px 0 6px">异常 / 输出</div>
        <pre class="pre-block">{{ [detail.errorMsg, detail.output].filter(Boolean).join('\n\n') }}</pre>
      </template>
    </a-card>
  </section>
</template>
