<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import {
  listJobs,
  createJob,
  updateJob,
  deleteJob,
  runJob,
  toggleJobStatus,
  previewCron,
  type JobInfo,
  type JobSaveRequest
} from '@/api/job'
import { listLogs, type JobLogVO } from '@/api/log'
import { listExecutors } from '@/api/executor'
import { useUserStore } from '@/stores/user'
import { APP_CODES, appLabel } from '@/utils/apps'
import { compareIdDesc, formatDateTime, formatDuration } from '@/utils/format'

const router = useRouter()
const user = useUserStore()

const pageSize = ref(20)
const loading = ref(false)
const rows = ref<JobInfo[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const appCode = ref<string | undefined>()
const status = ref<number | undefined>()

const latest = ref<Record<string, JobLogVO>>({})

const stats = reactive({
  total: 0,
  running: 0,
  paused: 0,
  todayRuns: 0,
  yesterdayRuns: 0,
  todayFail: 0,
  online: 0,
  execTotal: 0,
  apps: 0
})

const fmtTime = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD HH:mm:ss')

const trend = computed(() => {
  if (!stats.yesterdayRuns) return null
  return Math.round(((stats.todayRuns - stats.yesterdayRuns) / stats.yesterdayRuns) * 100)
})
const failRate = computed(() => {
  if (!stats.todayRuns) return '0%'
  return Math.round((stats.todayFail / stats.todayRuns) * 100) + '%'
})

const appOptions = APP_CODES.map((c) => ({ value: c, label: appLabel(c) }))
const statusOptions = [
  { value: 1, label: '运行中' },
  { value: 0, label: '已暂停' }
]

const columns = [
  { title: '任务名称', key: 'name', dataIndex: 'name' },
  { title: '调度计划', key: 'plan', width: 190 },
  { title: '状态 / 最近结果', key: 'state', width: 230 },
  { title: '操作', key: 'action', width: 250 }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function loadStats() {
  const now = dayjs()
  const dayStart = now.startOf('day')
  const yesterdayStart = dayStart.subtract(1, 'day')
  try {
    const [all, running, todayLogs, todayFail, yesterdayLogs, execs] = await Promise.all([
      listJobs({ page: 1, size: 1 }),
      listJobs({ page: 1, size: 1, status: 1 }),
      listLogs({ page: 1, size: 1, startTime: fmtTime(dayStart), endTime: fmtTime(now) }),
      listLogs({ page: 1, size: 1, status: 2, startTime: fmtTime(dayStart), endTime: fmtTime(now) }),
      listLogs({
        page: 1,
        size: 1,
        startTime: fmtTime(yesterdayStart),
        endTime: fmtTime(dayStart.subtract(1, 'second'))
      }),
      listExecutors()
    ])
    stats.total = all.total
    stats.running = running.total
    stats.paused = Math.max(0, all.total - running.total)
    stats.todayRuns = todayLogs.total
    stats.todayFail = todayFail.total
    stats.yesterdayRuns = yesterdayLogs.total
    stats.execTotal = execs.length
    stats.online = execs.filter((e) => e.online).length
    stats.apps = new Set(execs.map((e) => e.appCode)).size
  } catch (e) {
    console.warn(e)
  }
}

/** 日志接口默认主键升序，取最后一页拿到最新记录，用于回显「最近结果」 */
async function loadRecentLogs() {
  const probe = await listLogs({ page: 1, size: 2 })
  const ascending = probe.records.length > 1 && compareIdDesc(probe.records[0].id, probe.records[1].id) > 0
  const pages = Math.max(1, Math.ceil(probe.total / 100))
  const r = await listLogs({ page: ascending ? pages : 1, size: 100 })
  return r.records
}

async function loadRows() {
  loading.value = true
  try {
    const [r, logs] = await Promise.all([
      listJobs({
        page: page.value,
        size: pageSize.value,
        keyword: keyword.value || undefined,
        appCode: appCode.value || undefined,
        status: status.value
      }),
      loadRecentLogs()
    ])
    rows.value = r.records
    total.value = r.total

    const map: Record<string, JobLogVO> = {}
    const sorted = [...logs].sort((a, b) => compareIdDesc(a.id, b.id))
    for (const log of sorted) {
      if (log.jobId && !map[log.jobId]) map[log.jobId] = log
    }
    latest.value = map
  } finally {
    loading.value = false
    nextTick(updateScrollY)
  }
}

async function refresh() {
  await Promise.all([loadRows(), loadStats()])
}

onMounted(refresh)

/* 列表区固定高度：表格在卡片内滚动，页面本身不出现垂直滚动条 */
const scrollY = ref(240)

function updateScrollY() {
  const body = document.querySelector('.fill-card > .ant-card-body') as HTMLElement | null
  const table = body?.querySelector('.ant-table-wrapper') as HTMLElement | null
  if (!body || !table) return
  const style = getComputedStyle(body)
  const padTop = parseFloat(style.paddingTop) || 0
  const padBottom = parseFloat(style.paddingBottom) || 0
  const toolbar = body.querySelector('.ant-space') as HTMLElement | null
  const header = table.querySelector('.ant-table-header') as HTMLElement | null
  const pager = table.querySelector('.ant-pagination') as HTMLElement | null
  // 逐项量取，保证表头与分页器始终留在卡片内，只让表体滚动
  const used =
    padTop +
    padBottom +
    (toolbar ? toolbar.offsetHeight + 12 : 44) +
    (header ? header.offsetHeight : 47) +
    (pager ? pager.offsetHeight + 16 : 40)
  // 低高度屏幕保留可读的表格区域，页面改为纵向滚动，避免表体被压成 0
  const minTableHeight = window.innerHeight <= 820 ? 240 : 120
  scrollY.value = Math.max(minTableHeight, body.clientHeight - used)
}

onMounted(() => {
  window.addEventListener('resize', updateScrollY)
  requestAnimationFrame(updateScrollY)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateScrollY)
})

function search() {
  page.value = 1
  loadRows()
}

function reset() {
  keyword.value = ''
  appCode.value = undefined
  status.value = undefined
  page.value = 1
  loadRows()
}

function goto(p: number) {
  if (p < 1 || p === page.value) return
  page.value = p
  loadRows()
}

function onTableChange(pag: { current?: number }) {
  goto(pag.current || 1)
}

function triggerText(job: JobInfo) {
  if (job.triggerType === 'CRON') return job.cronExpr || '—'
  const sec = job.intervalSec ?? 0
  return `每 ${sec} 秒（${job.triggerType === 'FIXED_RATE' ? '固定频率' : '固定延迟'}）`
}

const RESULT_TEXT: Record<number, string> = { 0: '执行中', 1: '成功', 2: '失败', 3: '超时', 4: '取消' }
const RESULT_COLOR: Record<number, string> = {
  0: 'processing',
  1: 'success',
  2: 'error',
  3: 'warning',
  4: 'default'
}

function resultText(log?: JobLogVO) {
  if (!log) return '未执行'
  const base = RESULT_TEXT[log.status] || '未知'
  if (log.status === 1 && log.durationMs != null) return `${base} · ${formatDuration(log.durationMs)}`
  if (log.status === 2 && log.retryIndex > 0) return `${base} · 重试中`
  return base
}

function resultColor(log?: JobLogVO) {
  return log ? RESULT_COLOR[log.status] || 'default' : 'default'
}

async function onRun(row: JobInfo) {
  try {
    const msg = await runJob(row.id)
    message.success(msg || '已触发')
    loadRows()
  } catch (e: any) {
    message.error(e?.message || '触发失败')
  }
}

async function onToggle(row: JobInfo) {
  const next = row.status === 1 ? 0 : 1
  try {
    await toggleJobStatus(row.id, next as 0 | 1)
    message.success(next === 1 ? '已恢复' : '已暂停')
    await refresh()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

function goLogs(row: JobInfo) {
  router.push({ path: '/logs', query: { jobId: String(row.id) } })
}

/* ===== 抽屉：新建 / 编辑 ===== */
const drawerOpen = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const saving = ref(false)
let paramSeq = 0
const paramRows = ref<Array<{ id: number; key: string; value: string }>>([])
const cronPreview = ref<string[]>([])
const cronError = ref('')
const cronChecked = ref(false)

function emptyForm(): JobSaveRequest {
  return {
    appCode: 'ehr',
    name: '',
    handler: '',
    description: '',
    triggerType: 'CRON',
    cronExpr: '',
    intervalSec: 60,
    timeoutSec: 300,
    retryTimes: 0,
    retryIntervalSec: 30,
    routeStrategy: 'ROUND',
    blockStrategy: 'DISCARD',
    status: 0
  }
}

const form = ref<JobSaveRequest>(emptyForm())

const enabled = computed({
  get: () => form.value.status === 1,
  set: (v: boolean) => {
    form.value.status = v ? 1 : 0
  }
})

const paramColumns = [
  { title: '参数名', key: 'key', width: '38%' },
  { title: '参数值', key: 'value' },
  { title: '操作', key: 'op', width: 70 }
]

function addParam() {
  paramRows.value.push({ id: ++paramSeq, key: '', value: '' })
}

function openCreate() {
  drawerMode.value = 'create'
  editingId.value = null
  form.value = emptyForm()
  paramRows.value = []
  cronPreview.value = []
  cronError.value = ''
  cronChecked.value = false
  drawerOpen.value = true
}

function openEdit(row: JobInfo) {
  drawerMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    appCode: row.appCode,
    name: row.name,
    handler: row.handler,
    description: row.description,
    triggerType: row.triggerType,
    cronExpr: row.cronExpr,
    intervalSec: row.intervalSec ?? 60,
    timeoutSec: row.timeoutSec,
    retryTimes: row.retryTimes,
    retryIntervalSec: row.retryIntervalSec,
    routeStrategy: row.routeStrategy,
    blockStrategy: row.blockStrategy,
    status: row.status
  }
  paramRows.value = Object.entries(row.params || {}).map(([key, value]) => ({
    id: ++paramSeq,
    key,
    value
  }))
  cronPreview.value = []
  cronError.value = ''
  cronChecked.value = false
  drawerOpen.value = true
  if (form.value.triggerType === 'CRON') checkCron()
}

const CRON_CHIPS = [
  { label: '每 1 分钟', expr: '0 */1 * * * ?' },
  { label: '每 5 分钟', expr: '0 */5 * * * ?' },
  { label: '每小时', expr: '0 0 * * * ?' },
  { label: '每天 02:00', expr: '0 0 2 * * ?' },
  { label: '每天 09:00', expr: '0 0 9 * * ?' },
  { label: '每周一 09:00', expr: '0 0 9 ? * MON' }
]

async function checkCron(): Promise<boolean> {
  cronPreview.value = []
  cronError.value = ''
  cronChecked.value = false
  const expr = (form.value.cronExpr || '').trim()
  if (!expr) {
    cronError.value = 'CRON 表达式不能为空'
    return false
  }
  try {
    cronPreview.value = await previewCron(expr)
    cronChecked.value = true
    return true
  } catch (e: any) {
    cronError.value = e?.message || 'CRON 表达式不合法'
    return false
  }
}

function pickCron(expr: string) {
  form.value.cronExpr = expr
  checkCron()
}

async function save() {
  if (!form.value.name.trim() || !form.value.appCode || !form.value.handler.trim()) {
    message.warning('请填写任务名称、所属应用和 Handler')
    return
  }
  if (form.value.triggerType === 'CRON' && !(await checkCron())) {
    message.error(cronError.value || 'CRON 表达式不合法')
    return
  }
  saving.value = true
  try {
    const payload: JobSaveRequest = {
      ...form.value,
      params: Object.fromEntries(
        paramRows.value.filter((p) => p.key.trim()).map((p) => [p.key.trim(), p.value])
      )
    }
    if (drawerMode.value === 'create') {
      await createJob(payload)
      message.success('已创建')
    } else if (editingId.value != null) {
      await updateJob(editingId.value, payload)
      message.success('已保存')
    }
    drawerOpen.value = false
    await refresh()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

async function removeJob() {
  if (editingId.value == null) return
  try {
    await deleteJob(editingId.value)
    message.success('已删除')
    drawerOpen.value = false
    await refresh()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}
</script>

<template>
  <section class="view">
    <div class="stat-row">
      <a-card :bordered="false" class="stat-card" :body-style="{ padding: '14px 16px' }">
        <a-statistic title="任务总数" :value="stats.total" />
        <div class="stat-foot">覆盖 {{ stats.apps }} 个服务</div>
      </a-card>
      <a-card :bordered="false" class="stat-card" :body-style="{ padding: '14px 16px' }">
        <a-statistic title="运行中" :value="stats.running">
          <template #suffix><span class="stat-unit">个</span></template>
        </a-statistic>
        <div class="stat-foot">{{ stats.paused }} 个已暂停</div>
      </a-card>
      <a-card :bordered="false" class="stat-card" :body-style="{ padding: '14px 16px' }">
        <a-statistic title="今日执行" :value="stats.todayRuns">
          <template #suffix><span class="stat-unit">次</span></template>
        </a-statistic>
        <div class="stat-foot">
          <span v-if="trend !== null" :class="trend >= 0 ? 'trend-up' : 'trend-down'">
            {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }}%
          </span>
          <span v-else>—</span>
          较昨日
        </div>
      </a-card>
      <a-card :bordered="false" class="stat-card" :body-style="{ padding: '14px 16px' }">
        <a-statistic
          title="今日失败"
          :value="stats.todayFail"
          :value-style="stats.todayFail ? { color: 'var(--danger)' } : undefined"
        >
          <template #suffix><span class="stat-unit">次</span></template>
        </a-statistic>
        <div class="stat-foot">失败率 {{ failRate }}</div>
      </a-card>
      <a-card :bordered="false" class="stat-card" :body-style="{ padding: '14px 16px' }">
        <a-statistic title="执行器在线" :value="stats.online">
          <template #suffix><span class="stat-unit">/ {{ stats.execTotal }}</span></template>
        </a-statistic>
        <div class="stat-foot">
          <a-badge :status="stats.online ? 'success' : 'error'" :text="stats.online ? '心跳正常' : '暂无在线执行器'" />
        </div>
      </a-card>
    </div>

    <a-card :bordered="false" title="调用链路">
      <template #extra>
        <a-tag>执行逻辑在应用内，调度中心只负责触发</a-tag>
      </template>
      <div class="flow">
        <div class="flow-step"><b>① 扫描任务</b><span class="cn">每 5 秒读取 job_info</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-step"><b>② 命中触发</b><span class="cn">下次执行时间到期（行锁防重复）</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-step"><b>③ Feign 调用</b><span>JobApi#run(appCode, handler)</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-step"><b>④ 应用内分发</b><span>JobDispatcher → approvalCallbackRetry</span></div>
        <span class="flow-arrow">→</span>
        <div class="flow-step"><b>⑤ 回写结果</b><span class="cn">job_log · 失败重试 · 超限报警</span></div>
      </div>
      <div class="hint">
        调用超时只代表调度中心放弃等待，应用侧任务仍会继续执行。耗时较长的任务应返回「已受理」并异步执行，由任务自身回报最终结果。
      </div>
    </a-card>

    <a-card :bordered="false" title="任务列表" class="fill-card">
      <template #extra>
        <a-space>
          <a-button @click="refresh">刷新</a-button>
          <a-button v-if="user.hasPerm('job:manage')" type="primary" @click="openCreate">新建任务</a-button>
        </a-space>
      </template>

      <a-space wrap style="margin-bottom: 12px">
        <a-select
          v-model:value="appCode"
          style="width: 160px"
          placeholder="所属应用"
          allow-clear
          :options="appOptions"
        />
        <a-select
          v-model:value="status"
          style="width: 140px"
          placeholder="状态"
          allow-clear
          :options="statusOptions"
        />
        <a-input
          v-model:value="keyword"
          style="width: 220px"
          placeholder="任务名称 / Handler"
          allow-clear
          @press-enter="search"
        />
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
        :scroll="{ x: 960, y: scrollY }"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div style="font-weight: 500">
              {{ record.name }}
              <a-tag color="blue" style="margin-left: 6px">{{ appLabel(record.appCode) }}</a-tag>
            </div>
            <div class="text-secondary mono">{{ record.handler }}</div>
          </template>
          <template v-else-if="column.key === 'plan'">
            <div class="mono">{{ triggerText(record) }}</div>
            <div class="text-secondary mono">下次 {{ formatDateTime(record.nextFireTime) }}</div>
          </template>
          <template v-else-if="column.key === 'state'">
            <a-badge
              :status="record.status === 1 ? 'success' : 'warning'"
              :text="record.status === 1 ? '运行中' : '已暂停'"
            />
            <a-tag :color="resultColor(latest[record.id])" style="margin-left: 8px">
              {{ resultText(latest[record.id]) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space :size="4">
              <a-button v-if="user.hasPerm('job:run')" type="link" size="small" @click="onRun(record)">
                执行一次
              </a-button>
              <a-button v-if="user.hasPerm('job:manage')" type="link" size="small" @click="onToggle(record)">
                {{ record.status === 1 ? '暂停' : '恢复' }}
              </a-button>
              <a-button v-if="user.hasPerm('job:manage')" type="link" size="small" @click="openEdit(record)">
                编辑
              </a-button>
              <a-button type="link" size="small" @click="goLogs(record)">日志</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer
      v-model:open="drawerOpen"
      :width="560"
      :title="drawerMode === 'create' ? '新建任务' : '编辑任务 · ' + form.name"
      :body-style="{ paddingBottom: '8px' }"
    >
      <a-form layout="vertical">
        <a-divider orientation="left" plain>基本信息</a-divider>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="任务名称">
              <a-input v-model:value="form.name" placeholder="如：司龄每日刷新" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="所属应用">
              <a-select v-model:value="form.appCode" :options="appOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="Handler（应用内 Bean 名）">
          <a-input v-model:value="form.handler" placeholder="如：annualLeaveRefresh" />
        </a-form-item>
        <a-form-item label="任务描述">
          <a-input v-model:value="form.description" placeholder="可选" />
        </a-form-item>
        <div class="hint" style="margin: -8px 0 16px">
          中心只按「应用 + Handler」调用统一入口 <span class="mono">POST /internal/jobs/run</span>，不感知 Feign
          接口名与方法名。
        </div>

        <a-divider orientation="left" plain>触发配置</a-divider>
        <a-form-item label="触发方式">
          <a-radio-group v-model:value="form.triggerType" button-style="solid">
            <a-radio-button value="CRON">CRON</a-radio-button>
            <a-radio-button value="FIXED_RATE">固定频率</a-radio-button>
            <a-radio-button value="FIXED_DELAY">固定延迟</a-radio-button>
          </a-radio-group>
        </a-form-item>
        <template v-if="form.triggerType === 'CRON'">
          <a-form-item label="CRON 表达式（6 位 Quartz）">
            <a-input
              v-model:value="form.cronExpr"
              placeholder="0 30 9 * * ?"
              :status="cronError ? 'error' : undefined"
              @blur="checkCron"
            />
          </a-form-item>
          <a-space wrap style="margin-bottom: 12px">
            <a-tag
              v-for="c in CRON_CHIPS"
              :key="c.expr"
              color="processing"
              style="cursor: pointer"
              @click="pickCron(c.expr)"
            >
              {{ c.label }}
            </a-tag>
          </a-space>
          <a-alert v-if="cronError" type="error" :message="cronError" show-icon style="margin-bottom: 12px" />
          <a-alert
            v-else-if="cronChecked"
            type="success"
            message="校验通过，保存时后端会二次校验"
            show-icon
            style="margin-bottom: 12px"
          />
          <a-alert v-if="cronPreview.length" type="info" style="margin-bottom: 12px">
            <template #message>
              未来 {{ cronPreview.length }} 次执行：
              <div class="mono" style="margin-top: 4px">
                {{ cronPreview.join(' · ') }}
              </div>
            </template>
          </a-alert>
        </template>
        <a-form-item v-else label="间隔（秒）">
          <a-input-number v-model:value="form.intervalSec" :min="1" style="width: 100%" />
        </a-form-item>

        <a-divider orientation="left" plain>执行配置</a-divider>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="超时时间（秒）">
              <a-input-number v-model:value="form.timeoutSec" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="失败重试次数">
              <a-input-number v-model:value="form.retryTimes" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="重试间隔（秒）">
              <a-input-number v-model:value="form.retryIntervalSec" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="路由策略">
              <a-select
                v-model:value="form.routeStrategy"
                :options="[
                  { value: 'ROUND', label: '轮询' },
                  { value: 'FAILOVER', label: '故障转移（失败自动换实例）' },
                  { value: 'BROADCAST', label: '分片广播' }
                ]"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="阻塞处理">
              <a-select
                v-model:value="form.blockStrategy"
                :options="[
                  { value: 'DISCARD', label: '丢弃后续调度' },
                  { value: 'SERIAL', label: '单机串行' },
                  { value: 'COVER', label: '覆盖之前调度' }
                ]"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="任务状态">
          <a-space>
            <a-switch v-model:checked="enabled" checked-children="启用" un-checked-children="暂停" />
            <span class="text-secondary">
              {{ enabled ? '保存后加入调度' : '保存后不参与调度' }}
            </span>
          </a-space>
        </a-form-item>
        <div class="hint" style="margin-bottom: 16px">
          Feign 调用超时按失败处理；Handler 需保证幂等，长任务建议返回「已受理」并异步执行、由任务回报结果。
        </div>

        <a-divider orientation="left" plain>任务参数</a-divider>
        <a-table
          row-key="id"
          size="small"
          :columns="paramColumns"
          :data-source="paramRows"
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'key'">
              <a-input v-model:value="record.key" placeholder="key" />
            </template>
            <template v-else-if="column.key === 'value'">
              <a-input v-model:value="record.value" placeholder="value" />
            </template>
            <template v-else>
              <a-button type="link" size="small" danger @click="paramRows = paramRows.filter((p) => p.id !== record.id)">
                删除
              </a-button>
            </template>
          </template>
        </a-table>
        <a-button type="dashed" block style="margin-top: 8px" @click="addParam">+ 新增参数</a-button>
        <div class="hint">参数以 key-value 维护，由应用侧 Handler 通过 JobContext.params 读取。</div>
      </a-form>

      <template #footer>
        <div style="display: flex; align-items: center; justify-content: space-between">
          <a-popconfirm
            v-if="drawerMode === 'edit'"
            title="确认删除该任务？"
            ok-text="删除"
            cancel-text="取消"
            @confirm="removeJob"
          >
            <a-button danger type="text">删除任务</a-button>
          </a-popconfirm>
          <span v-else />
          <a-space>
            <a-button @click="drawerOpen = false">取消</a-button>
            <a-button type="primary" :loading="saving" @click="save">保存</a-button>
          </a-space>
        </div>
      </template>
    </a-drawer>
  </section>
</template>
