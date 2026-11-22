<template>
  <div class="ft-page log-page">
    <div class="ft-head toolbar">
      <a-select v-model:value="direction" style="width: 150px" :options="directionOptions" />
      <a-input v-model:value="appCode" style="width: 140px" placeholder="应用编码" allow-clear />
      <a-input v-model:value="apiCode" style="width: 170px" placeholder="API 编码" allow-clear />
      <a-input v-model:value="channel" style="width: 140px" placeholder="渠道编码" allow-clear />
      <a-range-picker
        v-model:value="range"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        style="width: 380px"
      />
      <a-checkbox v-model:checked="onlyFailed">仅看失败</a-checkbox>
      <a-button type="primary" @click="search">查询</a-button>
      <a-button @click="reset">重置</a-button>
      <a-button v-if="canExport" :loading="exporting" @click="doExport">导出</a-button>
    </div>

    <section v-if="canList" class="ft-scroll ft-bottom">
      <a-table
        class="ft-table"
        row-key="id"
        size="middle"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        @change="onTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'traceId'">
            <a-button v-if="canDetail" type="link" size="small" class="trace-id" @click="openDetail(record)">
              {{ record.traceId }}
            </a-button>
            <span v-else class="mono">{{ record.traceId }}</span>
          </template>
          <template v-else-if="column.key === 'direction'">
            <a-tag :color="directionColor(record.direction)">{{ directionText(record.direction) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'httpStatus'">
            <a-tag :color="record.httpStatus >= 400 ? 'red' : 'green'">{{ record.httpStatus }}</a-tag>
          </template>
          <template v-else-if="column.key === 'costMs'">
            <span class="mono">{{ record.costMs }} ms</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            <span class="mono">{{ formatTime(record.createdAt) }}</span>
          </template>
        </template>
      </a-table>
    </section>
    <a-alert
      v-else
      type="warning"
      show-icon
      message="你没有「openapi:log:list」权限，无法查看调用日志"
    />

    <!-- 详情：请求/响应报文已脱敏，JSON 可解析时美化展示 -->
    <a-modal
      centered
      v-model:open="detailOpen"
      title="调用日志详情"
      :footer="null"
      width="760px"
    >
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <a-descriptions :column="{ xs: 1, sm: 2, md: 3 }" size="small" bordered>
            <a-descriptions-item label="Trace ID"><span class="mono">{{ detail.traceId }}</span></a-descriptions-item>
            <a-descriptions-item label="方向">{{ directionText(detail.direction) }}</a-descriptions-item>
            <a-descriptions-item label="应用"><span class="mono">{{ detail.appCode }}</span></a-descriptions-item>
            <a-descriptions-item label="API"><span class="mono">{{ detail.apiCode }}</span></a-descriptions-item>
            <a-descriptions-item label="渠道"><span class="mono">{{ detail.channel }}</span></a-descriptions-item>
            <a-descriptions-item label="HTTP 状态">
              <a-tag :color="detail.httpStatus >= 400 ? 'red' : 'green'">{{ detail.httpStatus }}</a-tag>
            </a-descriptions-item>
            <a-descriptions-item label="业务码"><span class="mono">{{ detail.bizCode }}</span></a-descriptions-item>
            <a-descriptions-item label="方法与路径">
              <span class="mono">{{ detail.httpMethod }} {{ detail.requestPath }}</span>
            </a-descriptions-item>
            <a-descriptions-item label="耗时"><span class="mono">{{ detail.costMs }} ms</span></a-descriptions-item>
            <a-descriptions-item label="客户端 IP"><span class="mono">{{ detail.clientIp }}</span></a-descriptions-item>
            <a-descriptions-item label="时间"><span class="mono">{{ formatTime(detail.createdAt) }}</span></a-descriptions-item>
          </a-descriptions>

          <div class="hint">请求报文（脱敏）</div>
          <pre class="pre-block">{{ prettyJson(detail.reqMasked) }}</pre>
          <div class="hint">响应报文（脱敏）</div>
          <pre class="pre-block">{{ prettyJson(detail.respMasked) }}</pre>
          <template v-if="detail.errorMsg">
            <div class="hint">错误信息</div>
            <pre class="pre-block pre-error">{{ detail.errorMsg }}</pre>
          </template>
        </template>
        <a-empty v-else-if="!detailLoading" description="暂无详情" />
      </a-spin>
    </a-modal>

    <!-- 导出下载：responseType:'blob' 不经响应壳解包，res.data 即 Blob -->
    <a ref="exportLink" style="display: none" :href="exportUrl" download="openapi-call-log.csv" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { exportLogs, listLogs, logDetail, type CallLog, type LogQuery } from '@/api/openapi'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canList = computed(() => store.can('openapi:log:list'))
const canDetail = computed(() => store.can('openapi:log:detail'))
const canExport = computed(() => store.can('openapi:log:export'))

const directionOptions = [
  { label: '全部方向', value: '' },
  { label: '入站 INBOUND', value: 'INBOUND' },
  { label: '出站 OUTBOUND', value: 'OUTBOUND' }
]

const direction = ref('')
const appCode = ref('')
const apiCode = ref('')
const channel = ref('')
const range = ref<[Dayjs, Dayjs] | undefined>()
const onlyFailed = ref(false)

const size = ref(20)
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const rows = ref<CallLog[]>([])

const columns = [
  { title: 'Trace ID', key: 'traceId', width: 180 },
  { title: '方向', key: 'direction', width: 90 },
  { title: '应用', dataIndex: 'appCode', key: 'appCode', width: 110, ellipsis: true },
  { title: 'API', dataIndex: 'apiCode', key: 'apiCode', width: 160, ellipsis: true },
  { title: '渠道', dataIndex: 'channel', key: 'channel', width: 120, ellipsis: true },
  { title: 'HTTP', key: 'httpStatus', width: 90 },
  { title: '耗时', key: 'costMs', width: 100 },
  { title: '调用时间', key: 'createdAt', width: 180 }
]

/** 不传页码时用于导出：按当前过滤条件导出全量 */
function buildQuery(pageNo?: number, pageSize?: number): LogQuery {
  const q: LogQuery = {
    direction: direction.value || undefined,
    appCode: appCode.value.trim() || undefined,
    apiCode: apiCode.value.trim() || undefined,
    channel: channel.value.trim() || undefined,
    from: range.value?.[0].format('YYYY-MM-DD HH:mm:ss'),
    to: range.value?.[1].format('YYYY-MM-DD HH:mm:ss'),
    onlyFailed: onlyFailed.value || undefined
  }
  if (pageNo && pageSize) {
    q.page = pageNo
    q.size = pageSize
  }
  return q
}

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function load() {
  if (!canList.value) return
  loading.value = true
  try {
    const r = await listLogs(buildQuery(page.value, size.value))
    rows.value = r.records
    total.value = r.total
  } catch (e: any) {
    message.error(e?.message || '加载调用日志失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  void load()
}

function reset() {
  direction.value = ''
  appCode.value = ''
  apiCode.value = ''
  channel.value = ''
  range.value = undefined
  onlyFailed.value = false
  page.value = 1
  void load()
}

function onTableChange(pag: { current?: number; pageSize?: number }) {
  page.value = pag.current || 1
  if (pag.pageSize) size.value = pag.pageSize
  void load()
}

function directionText(v?: string): string {
  const map: Record<string, string> = {
    INBOUND: '入站', OUTBOUND: '出站', IN: '入站', OUT: '出站', '1': '入站', '2': '出站'
  }
  return map[v || ''] || v || '—'
}

function directionColor(v?: string): string {
  return v === 'OUTBOUND' || v === 'OUT' || v === '2' ? 'green' : 'blue'
}

function formatTime(v?: string): string {
  return v ? v.replace('T', ' ').slice(0, 19) : '—'
}

function prettyJson(raw?: string): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

/* ---------------- 详情 ---------------- */
const detailOpen = ref(false)
const detailLoading = ref(false)
const detail = ref<CallLog | null>(null)

async function openDetail(row: CallLog) {
  if (!canDetail.value) return
  detailOpen.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await logDetail(row.id)
  } catch (e: any) {
    message.error(e?.message || '加载日志详情失败')
    detailOpen.value = false
  } finally {
    detailLoading.value = false
  }
}

/* ---------------- 导出 ---------------- */
const exporting = ref(false)
const exportUrl = ref('')
const exportLink = ref<HTMLAnchorElement | null>(null)

async function doExport() {
  if (!canExport.value) return
  exporting.value = true
  try {
    const res = await exportLogs(buildQuery())
    const url = URL.createObjectURL(new Blob([res.data as Blob]))
    exportUrl.value = url
    await nextTick()
    exportLink.value?.click()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      exportUrl.value = ''
    }, 1000)
    message.success('导出已开始')
  } catch (e: any) {
    message.error(e?.message || '导出日志失败')
  } finally {
    exporting.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.log-page {
  --ft-min-width: 1100px;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.trace-id {
  padding: 0;
  height: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.hint {
  margin: 12px 0 6px;
  font-size: 12px;
  color: var(--muted);
}
.pre-block {
  margin: 0;
  padding: 10px 12px;
  border-radius: 6px;
  background: var(--code-bg, rgba(0, 0, 0, 0.04));
  color: var(--text-base);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  max-height: 240px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
.pre-error {
  color: #ff4d4f;
}
</style>
