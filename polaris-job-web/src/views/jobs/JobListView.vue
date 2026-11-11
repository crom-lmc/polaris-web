<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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

const size = 20
const loading = ref(false)
const rows = ref<JobInfo[]>([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const appCode = ref('')
const status = ref('')

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
const maxPage = computed(() => Math.max(1, Math.ceil(total.value / size)))

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
      listLogs({ page: 1, size: 1, startTime: fmtTime(yesterdayStart), endTime: fmtTime(dayStart.subtract(1, 'second')) }),
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
        size,
        keyword: keyword.value || undefined,
        appCode: appCode.value || undefined,
        status: status.value === '' ? undefined : Number(status.value)
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
  }
}

async function refresh() {
  await Promise.all([loadRows(), loadStats()])
}

onMounted(refresh)

function search() {
  page.value = 1
  loadRows()
}

function reset() {
  keyword.value = ''
  appCode.value = ''
  status.value = ''
  page.value = 1
  loadRows()
}

function goto(p: number) {
  if (p < 1 || p > maxPage.value || p === page.value) return
  page.value = p
  loadRows()
}

function triggerText(job: JobInfo) {
  if (job.triggerType === 'CRON') return job.cronExpr || '—'
  const sec = job.intervalSec ?? 0
  return `每 ${sec} 秒（${job.triggerType === 'FIXED_RATE' ? '固定频率' : '固定延迟'}）`
}

const RESULT_TEXT: Record<number, string> = { 0: '执行中', 1: '成功', 2: '失败', 3: '超时', 4: '取消' }
const RESULT_CLASS: Record<number, string> = {
  0: 'tag-blue',
  1: 'tag-green',
  2: 'tag-red',
  3: 'tag-orange',
  4: 'tag-gray'
}

function resultText(log?: JobLogVO) {
  if (!log) return '未执行'
  const base = RESULT_TEXT[log.status] || '未知'
  if (log.status === 1 && log.durationMs != null) return `${base} · ${formatDuration(log.durationMs)}`
  if (log.status === 2 && log.retryIndex > 0) return `${base} · 重试中`
  return base
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
const paramRows = ref<Array<{ key: string; value: string }>>([])
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
  paramRows.value = Object.entries(row.params || {}).map(([key, value]) => ({ key, value }))
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
  if (!window.confirm(`确认删除「${form.value.name}」？`)) return
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
  <section class="view jobs">
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">任务总数</div>
        <div class="stat-value">{{ stats.total }}</div>
        <div class="stat-foot">覆盖 {{ stats.apps }} 个服务</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">运行中</div>
        <div class="stat-value">{{ stats.running }} <small>个</small></div>
        <div class="stat-foot">{{ stats.paused }} 个已暂停</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日执行</div>
        <div class="stat-value">{{ stats.todayRuns }} <small>次</small></div>
        <div class="stat-foot">
          <span v-if="trend !== null" :class="trend >= 0 ? 'trend-up' : 'trend-down'">
            {{ trend >= 0 ? '▲' : '▼' }} {{ Math.abs(trend) }}%
          </span>
          <span v-else>—</span>
          较昨日
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今日失败</div>
        <div class="stat-value" :style="stats.todayFail ? 'color:#ff4d4f' : ''">{{ stats.todayFail }} <small>次</small></div>
        <div class="stat-foot">失败率 {{ failRate }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">执行器在线</div>
        <div class="stat-value">{{ stats.online }} / {{ stats.execTotal }}</div>
        <div class="stat-foot">
          <span class="dot" :class="stats.online ? 'dot-green' : 'dot-red'"></span>
          {{ stats.online ? '心跳正常' : '暂无在线执行器' }}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <span>调用链路</span>
        <div class="actions">
          <span class="tag tag-gray">执行逻辑在应用内，调度中心只负责触发</span>
        </div>
      </div>
      <div class="panel-body">
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
      </div>
    </div>

    <div class="panel table-panel">
      <div class="panel-head">
        <span>任务列表</span>
        <div class="actions">
          <button class="btn" @click="refresh">刷新</button>
          <button v-if="user.hasPerm('job:manage')" class="btn btn-primary" @click="openCreate">新建任务</button>
        </div>
      </div>

      <div class="toolbar">
        <div class="field">
          <label>所属应用</label>
          <select v-model="appCode" class="select">
            <option value="">全部</option>
            <option v-for="c in APP_CODES" :key="c" :value="c">{{ appLabel(c) }}</option>
          </select>
        </div>
        <div class="field">
          <label>状态</label>
          <select v-model="status" class="select">
            <option value="">全部</option>
            <option value="1">运行中</option>
            <option value="0">已暂停</option>
          </select>
        </div>
        <div class="field">
          <label>关键字</label>
          <input
            v-model="keyword"
            class="input search-input"
            placeholder="任务名称 / Handler"
            @keyup.enter="search"
          />
        </div>
        <button class="btn btn-primary" @click="search">查询</button>
        <button class="btn" @click="reset">重置</button>
      </div>

      <div class="table-wrap" :class="{ loading }">
        <table class="jobs-table">
          <thead>
            <tr>
              <th style="width: 38%">任务名称</th>
              <th style="width: 170px">调度计划</th>
              <th style="width: 200px">状态 / 最近结果</th>
              <th style="width: 210px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in rows" :key="job.id">
              <td>
                <div class="job-name">
                  {{ job.name }}<span class="tag tag-blue">{{ appLabel(job.appCode) }}</span>
                </div>
                <div class="job-meta">
                  <span class="call-label">Handler</span><span class="mono">{{ job.handler }}</span>
                </div>
              </td>
              <td>
                <div class="mono">{{ triggerText(job) }}</div>
                <div class="job-meta mono">下次 {{ formatDateTime(job.nextFireTime) }}</div>
              </td>
              <td>
                <span class="dot" :class="job.status === 1 ? 'dot-green' : 'dot-orange'"></span>
                {{ job.status === 1 ? '运行中' : '已暂停' }}
                <span class="tag" :class="latest[job.id] ? RESULT_CLASS[latest[job.id].status] : 'tag-gray'">
                  {{ resultText(latest[job.id]) }}
                </span>
              </td>
              <td>
                <div class="cell-actions">
                  <button v-if="user.hasPerm('job:run')" class="btn-link" @click="onRun(job)">执行一次</button>
                  <button v-if="user.hasPerm('job:manage')" class="btn-link" @click="onToggle(job)">
                    {{ job.status === 1 ? '暂停' : '恢复' }}
                  </button>
                  <button v-if="user.hasPerm('job:manage')" class="btn-link" @click="openEdit(job)">编辑</button>
                  <button class="btn-link" @click="goLogs(job)">日志</button>
                </div>
              </td>
            </tr>
            <tr v-if="!loading && !rows.length">
              <td colspan="4" class="empty-cell">暂无任务数据</td>
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

    <!-- 新建 / 编辑抽屉 -->
    <div class="overlay" :class="{ open: drawerOpen }" @click="drawerOpen = false"></div>
    <div class="drawer" :class="{ open: drawerOpen }">
      <div class="drawer-head">
        <div class="drawer-title">
          {{ drawerMode === 'create' ? '新建任务' : '编辑任务 · ' + form.name }}
        </div>
        <button class="drawer-close" @click="drawerOpen = false">✕</button>
      </div>
      <div class="drawer-body">
        <div class="section">
          <div class="section-title">基本信息</div>
          <div class="form-row">
            <div class="form-item">
              <label>任务名称</label>
              <input v-model="form.name" class="input" placeholder="如：司龄每日刷新" />
            </div>
            <div class="form-item">
              <label>所属应用</label>
              <select v-model="form.appCode" class="select">
                <option v-for="c in APP_CODES" :key="c" :value="c">{{ appLabel(c) }}</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>Handler（应用内 Bean 名）</label>
              <input v-model="form.handler" class="input mono" placeholder="如：annualLeaveRefresh" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>任务描述</label>
              <input v-model="form.description" class="input" placeholder="可选" />
            </div>
          </div>
          <div class="hint">
            中心只按「应用 + Handler」调用统一入口 <span class="mono">POST /internal/jobs/run</span>，不感知 Feign 接口名与方法名。
          </div>
        </div>

        <div class="section">
          <div class="section-title">触发配置</div>
          <div class="form-row">
            <div class="form-item">
              <label>触发方式</label>
              <div class="radio-group">
                <div class="radio" :class="{ active: form.triggerType === 'CRON' }" @click="form.triggerType = 'CRON'">CRON</div>
                <div class="radio" :class="{ active: form.triggerType === 'FIXED_RATE' }" @click="form.triggerType = 'FIXED_RATE'">固定频率</div>
                <div class="radio" :class="{ active: form.triggerType === 'FIXED_DELAY' }" @click="form.triggerType = 'FIXED_DELAY'">固定延迟</div>
              </div>
            </div>
          </div>
          <template v-if="form.triggerType === 'CRON'">
            <div class="form-row">
              <div class="form-item">
                <label>CRON 表达式（6 位 Quartz）</label>
                <input
                  v-model="form.cronExpr"
                  class="input mono"
                  :class="{ invalid: !!cronError }"
                  placeholder="0 30 9 * * ?"
                  @blur="checkCron"
                />
              </div>
            </div>
            <div class="chips">
              <span v-for="c in CRON_CHIPS" :key="c.expr" class="chip" @click="pickCron(c.expr)">{{ c.label }}</span>
            </div>
            <div class="cron-msg" :class="cronError ? 'err' : 'ok'">
              <template v-if="cronError">✕ {{ cronError }}</template>
              <template v-else-if="cronChecked">✓ 校验通过，保存时后端会二次校验</template>
            </div>
            <div v-if="cronPreview.length" class="next-run">
              未来 {{ cronPreview.length }} 次执行：<br />
              <b>{{ cronPreview[0] }}</b>
              <span v-if="cronPreview.length > 1"> · {{ cronPreview.slice(1).join(' · ') }}</span>
            </div>
          </template>
          <div v-else class="form-row">
            <div class="form-item">
              <label>间隔（秒）</label>
              <input v-model.number="form.intervalSec" class="input" type="number" min="1" />
            </div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">执行配置</div>
          <div class="form-row">
            <div class="form-item">
              <label>超时时间（秒）</label>
              <input v-model.number="form.timeoutSec" class="input" type="number" min="1" />
            </div>
            <div class="form-item">
              <label>失败重试次数</label>
              <input v-model.number="form.retryTimes" class="input" type="number" min="0" />
            </div>
            <div class="form-item">
              <label>重试间隔（秒）</label>
              <input v-model.number="form.retryIntervalSec" class="input" type="number" min="1" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>路由策略</label>
              <select v-model="form.routeStrategy" class="select">
                <option value="ROUND">轮询</option>
                <option value="FAILOVER">故障转移（失败自动换实例）</option>
                <option value="BROADCAST">分片广播</option>
              </select>
            </div>
            <div class="form-item">
              <label>阻塞处理</label>
              <select v-model="form.blockStrategy" class="select">
                <option value="DISCARD">丢弃后续调度</option>
                <option value="SERIAL">单机串行</option>
                <option value="COVER">覆盖之前调度</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>任务状态</label>
              <div class="switch-line" style="cursor: pointer" @click="form.status = form.status === 1 ? 0 : 1">
                <span class="switch" :class="{ off: form.status !== 1 }"></span>
                {{ form.status === 1 ? '启用（保存后加入调度）' : '暂停（保存后不参与调度）' }}
              </div>
            </div>
          </div>
          <div class="hint">
            Feign 调用超时按失败处理；Handler 需保证幂等，长任务建议返回「已受理」并异步执行、由任务回报结果。
          </div>
        </div>

        <div class="section">
          <div class="section-title">任务参数</div>
          <table class="kv-table">
            <thead>
              <tr>
                <th style="width: 38%">参数名</th>
                <th>参数值</th>
                <th style="width: 64px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(p, i) in paramRows" :key="i">
                <td><input v-model="p.key" class="input mono" style="width: 100%" placeholder="key" /></td>
                <td><input v-model="p.value" class="input mono" style="width: 100%" placeholder="value" /></td>
                <td><button class="btn-link danger" @click="paramRows.splice(i, 1)">删除</button></td>
              </tr>
              <tr v-if="!paramRows.length">
                <td colspan="3" class="hint" style="text-align: center">暂无参数</td>
              </tr>
            </tbody>
          </table>
          <button class="btn" style="margin-top: 8px" @click="paramRows.push({ key: '', value: '' })">+ 新增参数</button>
          <div class="hint">参数以 key-value 维护，由应用侧 Handler 通过 JobContext.params 读取。</div>
        </div>
      </div>
      <div class="drawer-foot">
        <button v-if="drawerMode === 'edit'" class="btn btn-danger-text" @click="removeJob">删除任务</button>
        <span style="flex: 1"></span>
        <button class="btn" @click="drawerOpen = false">取消</button>
        <button class="btn btn-primary" :disabled="saving" @click="save">保存</button>
      </div>
    </div>
  </section>
</template>
