<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
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
const jobId = ref<string>('')
const status = ref('')
const startTime = ref('')
const endTime = ref('')

const jobs = ref<JobInfo[]>([])
const detail = ref<JobLogVO | null>(null)

const maxPage = computed(() => Math.max(1, Math.ceil(total.value / size)))

function toApiTime(v: string) {
  if (!v) return undefined
  return v.replace('T', ' ') + (v.length === 16 ? ':00' : '')
}

function buildQuery(pageNo: number, pageSize: number) {
  return {
    page: pageNo,
    size: pageSize,
    jobId: jobId.value || undefined,
    status: status.value === '' ? undefined : Number(status.value),
    startTime: toApiTime(startTime.value),
    endTime: toApiTime(endTime.value)
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

function goto(p: number) {
  if (p < 1 || p > maxPage.value || p === page.value) return
  page.value = p
  load()
}

const LOG_STATUS: Record<number, { text: string; cls: string }> = {
  0: { text: '执行中', cls: 'tag-blue' },
  1: { text: '成功', cls: 'tag-green' },
  2: { text: '失败', cls: 'tag-red' },
  3: { text: '超时', cls: 'tag-orange' },
  4: { text: '取消', cls: 'tag-gray' }
}

const TRIGGER: Record<string, { text: string; cls: string }> = {
  SCHEDULE: { text: '调度触发', cls: 'tag-gray' },
  MANUAL: { text: '手动触发', cls: 'tag-blue' },
  RETRY: { text: '失败重试', cls: 'tag-orange' }
}

function triggerText(t?: string) {
  return TRIGGER[t || '']?.text || t || '—'
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
  if (!d) return [] as Array<{ dot: string; time: string; title: string; sub: string }>
  const items: Array<{ dot: string; time: string; title: string; sub: string }> = []
  items.push({
    dot: 'retry',
    time: timeOnly(d.startedAt || d.plannedAt),
    title: '调度中心下发执行指令',
    sub: `执行器 ${d.executorAddress || '—'} · 触发方式 ${triggerText(d.triggerType)} · 耗时 ${formatDuration(d.durationMs)}`
  })
  const s = LOG_STATUS[d.status] || { text: '未知', cls: 'tag-gray' }
  items.push({
    dot: d.status === 1 ? 'ok' : 'fail',
    time: timeOnly(d.finishedAt),
    title: `执行${s.text}`,
    sub: [d.errorMsg || ''].filter(Boolean).join(' · ')
  })
  if (d.retryIndex > 0) {
    items.push({
      dot: 'retry',
      time: '',
      title: `第 ${d.retryIndex} 次重试`,
      sub: '由调度中心按重试策略重新排队'
    })
  }
  return items
})
</script>

<template>
  <section class="view" id="view-logs">
    <div class="panel">
      <div class="panel-head">
        <span>调度日志</span>
        <div class="actions">
          <button class="btn" @click="load">刷新</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="field">
          <label>任务</label>
          <select v-model="jobId" class="select">
            <option value="">全部任务</option>
            <option v-for="j in jobs" :key="j.id" :value="String(j.id)">{{ j.name }}</option>
          </select>
        </div>
        <div class="field">
          <label>状态</label>
          <select v-model="status" class="select">
            <option value="">全部</option>
            <option value="0">执行中</option>
            <option value="1">成功</option>
            <option value="2">失败</option>
            <option value="3">超时</option>
            <option value="4">取消</option>
          </select>
        </div>
        <div class="field">
          <label>开始</label>
          <input v-model="startTime" class="input" type="datetime-local" style="width: 190px" />
        </div>
        <div class="field">
          <label>结束</label>
          <input v-model="endTime" class="input" type="datetime-local" style="width: 190px" />
        </div>
        <button class="btn btn-primary" @click="search">查询</button>
      </div>

      <div class="table-wrap" :class="{ loading }">
        <table>
          <thead>
            <tr>
              <th>执行 ID</th>
              <th>任务</th>
              <th>触发方式</th>
              <th>执行器</th>
              <th>开始时间</th>
              <th>耗时</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td class="mono">#{{ row.id }}</td>
              <td>
                {{ row.jobName || '—' }}
                <span class="tag tag-blue" style="margin-left: 6px">{{ appLabel(row.appCode) }}</span>
              </td>
              <td>
                <span class="tag" :class="TRIGGER[row.triggerType]?.cls || 'tag-gray'">
                  {{ triggerText(row.triggerType) }}
                </span>
              </td>
              <td class="mono">{{ row.executorAddress || '—' }}</td>
              <td class="mono">{{ formatDateTime(row.startedAt) }}</td>
              <td class="mono">{{ formatDuration(row.durationMs) }}</td>
              <td>
                <span class="tag" :class="(LOG_STATUS[row.status] || { cls: 'tag-gray' }).cls">
                  {{ (LOG_STATUS[row.status] || { text: '未知' }).text }}
                </span>
                <span v-if="row.retryIndex > 0" class="retry-badge">重试 {{ row.retryIndex }}</span>
              </td>
              <td>
                <button class="btn-link" @click="openDetail(row)">查看日志</button>
              </td>
            </tr>
            <tr v-if="!loading && !rows.length">
              <td colspan="8" class="empty-cell">暂无执行日志</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pager">
        <span>共 {{ total }} 条</span>
        <span class="pg" :class="{ disabled: page <= 1 }" @click="goto(page - 1)">‹</span>
        <span class="pg active">{{ page }}</span>
        <span class="pg" :class="{ disabled: page >= maxPage }" @click="goto(page + 1)">›</span>
      </div>
    </div>

    <div v-if="detail" class="panel">
      <div class="panel-head">
        <span>执行明细（#{{ detail.id }} {{ detail.jobName || '' }}）</span>
        <div class="actions">
          <button class="btn" @click="detail = null">收起</button>
        </div>
      </div>
      <div class="timeline">
        <div v-for="(item, i) in timelineItems" :key="i" class="tl-item">
          <div class="tl-dot" :class="item.dot"></div>
          <div class="tl-time">{{ item.time }}</div>
          <div class="tl-body">
            {{ item.title }}
            <br v-if="item.sub" />
            <span v-if="item.sub" class="tl-sub">{{ item.sub }}</span>
          </div>
        </div>
      </div>
      <div v-if="detail.errorMsg || detail.output" class="panel-body" style="border-top: 1px solid var(--border-subtle)">
        <div class="hint" style="margin: 0 0 6px">异常 / 输出</div>
        <pre class="log-pre">{{ [detail.errorMsg, detail.output].filter(Boolean).join('\n\n') }}</pre>
      </div>
    </div>
  </section>
</template>
