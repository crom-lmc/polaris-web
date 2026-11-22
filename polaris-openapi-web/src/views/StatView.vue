<template>
  <div class="ft-page stat-page">
    <div class="ft-head toolbar">
      <a-select v-model:value="direction" style="width: 150px" :options="directionOptions" />
      <a-input v-model:value="appCode" style="width: 160px" placeholder="应用编码" allow-clear />
      <a-range-picker
        v-model:value="range"
        show-time
        format="YYYY-MM-DD HH:mm:ss"
        style="width: 380px"
      />
      <a-button type="primary" @click="search">查询</a-button>
      <a-button @click="reset">重置</a-button>
    </div>

    <div class="ft-scroll stat-scroll">
      <a-spin :spinning="loading">
        <a-alert
          v-if="!canView"
          type="warning"
          show-icon
          style="margin-bottom: 12px"
          message="你没有「openapi:stat:view」权限，无法查看统计报表"
        />
        <template v-else>
          <!-- 核心指标卡 -->
          <div class="stat-grid">
            <a-card v-for="card in statCards" :key="card.label" size="small" class="stat-card">
              <div class="stat-main">
                <span class="stat-mark" :style="{ background: card.color }" />
                <div class="stat-text">
                  <div class="stat-value">{{ card.value }}</div>
                  <div class="stat-label">{{ card.label }}</div>
                </div>
              </div>
            </a-card>
          </div>

          <a-row :gutter="12" class="chart-row">
            <!-- 按天趋势：纯 SVG 折线，不引入图表库 -->
            <a-col :xs="24" :lg="16">
              <a-card title="调用趋势（按天）" size="small" class="chart-card">
                <template #extra>
                  <span class="chart-legend">
                    <i class="dot total" />调用量
                    <i class="dot fail" />失败量
                  </span>
                </template>
                <div class="line-chart">
                  <svg viewBox="0 0 560 180" preserveAspectRatio="none" role="img" aria-label="调用趋势折线图">
                    <defs>
                      <linearGradient id="statTotalFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="#2f54eb" stop-opacity="0.28" />
                        <stop offset="100%" stop-color="#2f54eb" stop-opacity="0.02" />
                      </linearGradient>
                    </defs>
                    <g v-for="i in 5" :key="'g' + i">
                      <line
                        x1="34" :y1="20 + (i - 1) * 34" x2="552" :y2="20 + (i - 1) * 34"
                        stroke="var(--border-subtle, #eee)" stroke-width="1"
                      />
                      <text x="30" :y="24 + (i - 1) * 34" text-anchor="end" class="chart-axis-text">
                        {{ trendMax - Math.round((i - 1) * trendMax / 4) }}
                      </text>
                    </g>
                    <path :d="totalAreaPath" fill="url(#statTotalFill)" />
                    <path :d="totalLinePath" fill="none" stroke="#2f54eb" stroke-width="2.5"
                          stroke-linejoin="round" stroke-linecap="round" />
                    <path :d="failedLinePath" fill="none" stroke="#fa541c" stroke-width="2"
                          stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4" />
                    <g v-for="(p, idx) in trendPoints" :key="'x' + idx">
                      <text v-if="idx % 2 === 0 || idx === trendPoints.length - 1" :x="p.x" y="172"
                            text-anchor="middle" class="chart-axis-text">{{ p.label }}</text>
                    </g>
                  </svg>
                  <a-empty v-if="!trendHasData" class="chart-empty" description="暂无调用记录" />
                </div>
              </a-card>
            </a-col>

            <!-- 失败 TOP API 表格 -->
            <a-col :xs="24" :lg="8">
              <a-card title="失败 TOP API" size="small" class="chart-card">
                <a-table
                  v-if="topFailedRows.length"
                  size="small"
                  :columns="topFailedColumns"
                  :data-source="topFailedRows"
                  :pagination="false"
                  row-key="apiCode"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'apiCode'">
                      <span class="mono" :title="record.apiCode">{{ record.apiCode }}</span>
                    </template>
                    <template v-else-if="column.key === 'failed'">
                      <a-tag color="red">{{ record.failed }}</a-tag>
                    </template>
                  </template>
                </a-table>
                <a-empty v-else :image-style="{ height: '40px' }" description="暂无失败记录" />
              </a-card>
            </a-col>
          </a-row>

          <!-- 按应用 / 按 API 排行 + 耗时分布（设计 §7.2 统计报表） -->
          <a-row :gutter="12" class="chart-row">
            <a-col :xs="24" :lg="8">
              <a-card title="应用调用排行" size="small" class="chart-card">
                <a-table
                  v-if="topApps.length"
                  size="small" :columns="rankAppColumns" :data-source="topApps"
                  :pagination="false" row-key="appCode"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'total'"><b>{{ record.total }}</b></template>
                    <template v-else-if="column.key === 'failed'">
                      <a-tag :color="record.failed > 0 ? 'red' : 'green'">{{ record.failed }}</a-tag>
                    </template>
                  </template>
                </a-table>
                <a-empty v-else :image-style="{ height: '40px' }" description="暂无数据" />
              </a-card>
            </a-col>
            <a-col :xs="24" :lg="8">
              <a-card title="API 调用排行" size="small" class="chart-card">
                <a-table
                  v-if="topApis.length"
                  size="small" :columns="rankApiColumns" :data-source="topApis"
                  :pagination="false" row-key="apiCode"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'apiCode'">
                      <span class="mono" :title="record.apiCode">{{ record.apiCode }}</span>
                    </template>
                    <template v-else-if="column.key === 'total'"><b>{{ record.total }}</b></template>
                    <template v-else-if="column.key === 'failed'">
                      <a-tag :color="record.failed > 0 ? 'red' : 'green'">{{ record.failed }}</a-tag>
                    </template>
                  </template>
                </a-table>
                <a-empty v-else :image-style="{ height: '40px' }" description="暂无数据" />
              </a-card>
            </a-col>
            <a-col :xs="24" :lg="8">
              <a-card title="耗时分布" size="small" class="chart-card">
                <div class="cost-list">
                  <div v-for="row in costRows" :key="row.label" class="bar-item">
                    <div class="bar-head">
                      <span>{{ row.label }}</span><b>{{ row.count }}</b>
                    </div>
                    <div class="bar-track">
                      <div class="bar-fill" :style="{ width: costPercent(row.count) + '%' }" />
                    </div>
                  </div>
                </div>
              </a-card>
            </a-col>
          </a-row>
        </template>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { Dayjs } from 'dayjs'
import { message } from 'ant-design-vue'
import { getOverview, type StatQuery } from '@/api/openapi'
import { useUserStore } from '@/stores/user'

type OverviewData = Awaited<ReturnType<typeof getOverview>>

const store = useUserStore()
const canView = computed(() => store.can('openapi:stat:view'))

const directionOptions = [
  { label: '全部方向', value: '' },
  { label: '入站 INBOUND', value: 'INBOUND' },
  { label: '出站 OUTBOUND', value: 'OUTBOUND' }
]

const direction = ref('')
const appCode = ref('')
const range = ref<[Dayjs, Dayjs] | undefined>()

const loading = ref(false)
const overview = ref<OverviewData>({
  total: 0,
  success: 0,
  failed: 0,
  successRate: 0,
  avgCostMs: 0,
  p95CostMs: 0,
  appCount: 0,
  topFailed: [],
  trend: [],
  recentErrors: [],
  topApps: [],
  topApis: [],
  costDistribution: { lt100: 0, b100_500: 0, b500_1000: 0, b1000_3000: 0, gte3000: 0 }
})

function buildQuery(): StatQuery {
  return {
    direction: direction.value || undefined,
    appCode: appCode.value.trim() || undefined,
    from: range.value?.[0].format('YYYY-MM-DD HH:mm:ss'),
    to: range.value?.[1].format('YYYY-MM-DD HH:mm:ss')
  }
}

async function load() {
  if (!canView.value) return
  loading.value = true
  try {
    overview.value = await getOverview(buildQuery())
  } catch (e: any) {
    message.error(e?.message || '加载统计报表失败')
  } finally {
    loading.value = false
  }
}

function search() {
  void load()
}

function reset() {
  direction.value = ''
  appCode.value = ''
  range.value = undefined
  void load()
}

function formatNumber(v: number): string {
  return Number(v || 0).toLocaleString('zh-CN')
}

/** successRate 后端可能返回 0~1 小数或 0~100 百分数，统一按百分数展示 */
const rateText = computed(() => {
  const raw = Number(overview.value.successRate || 0)
  const percent = raw > 0 && raw <= 1 ? raw * 100 : raw
  return `${percent.toFixed(1)}%`
})

const statCards = computed(() => [
  { label: '调用总量', value: formatNumber(overview.value.total), color: '#2f54eb' },
  { label: '成功率', value: rateText.value, color: '#13a8a8' },
  { label: '平均耗时', value: `${formatNumber(overview.value.avgCostMs)} ms`, color: '#fa8c16' },
  { label: 'P95 耗时', value: `${formatNumber(overview.value.p95CostMs)} ms`, color: '#722ed1' }
])

/* 折线图坐标：viewBox 560x180，绘图区 x∈[34,552]，y∈[20,156] */
const trendMax = computed(() => {
  const max = Math.max(1, ...overview.value.trend.flatMap((p) => [p.total, p.failed]))
  return Math.ceil(max / 4) * 4 || 4
})
const trendHasData = computed(() =>
  overview.value.trend.some((p) => p.total > 0 || p.failed > 0)
)
const trendPoints = computed(() => {
  const rows = overview.value.trend
  const n = rows.length
  const max = trendMax.value
  return rows.map((p, i) => ({
    x: n <= 1 ? 34 : 34 + i * (518 / (n - 1)),
    ty: 156 - (p.total / max) * 136,
    fy: 156 - (p.failed / max) * 136,
    label: (p.day || '').slice(5)
  }))
})
const totalLinePath = computed(() =>
  trendPoints.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.ty.toFixed(1)}`)
    .join(' ')
)
const failedLinePath = computed(() =>
  trendPoints.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.fy.toFixed(1)}`)
    .join(' ')
)
const totalAreaPath = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return ''
  const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.ty.toFixed(1)}`).join(' ')
  return `${top} L${pts[pts.length - 1].x.toFixed(1)},156 L${pts[0].x.toFixed(1)},156 Z`
})

const topFailedColumns = [
  { title: 'API 编码', dataIndex: 'apiCode', key: 'apiCode', ellipsis: true },
  { title: '失败次数', dataIndex: 'failed', key: 'failed', width: 100 }
]
const topFailedRows = computed(() => overview.value.topFailed || [])

/* 应用 / API 排行 */
const topApps = computed(() => overview.value.topApps || [])
const topApis = computed(() => overview.value.topApis || [])
const rankAppColumns = [
  { title: '应用', dataIndex: 'appCode', key: 'appCode', ellipsis: true },
  { title: '调用量', dataIndex: 'total', key: 'total', width: 80 },
  { title: '失败', dataIndex: 'failed', key: 'failed', width: 80 }
]
const rankApiColumns = [
  { title: 'API', dataIndex: 'apiCode', key: 'apiCode', ellipsis: true },
  { title: '调用量', dataIndex: 'total', key: 'total', width: 80 },
  { title: '失败', dataIndex: 'failed', key: 'failed', width: 80 }
]

/* 耗时分布 */
const costRows = computed(() => {
  const d = overview.value.costDistribution
  return [
    { label: '< 100 ms', count: d?.lt100 || 0 },
    { label: '100 - 500 ms', count: d?.b100_500 || 0 },
    { label: '500 - 1000 ms', count: d?.b500_1000 || 0 },
    { label: '1000 - 3000 ms', count: d?.b1000_3000 || 0 },
    { label: '>= 3000 ms', count: d?.gte3000 || 0 }
  ]
})
const costMax = computed(() => Math.max(1, ...costRows.value.map((r) => r.count)))
function costPercent(count: number): number {
  return Math.round((count / costMax.value) * 100)
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.stat-scroll {
  padding-right: 2px;
}

/* 指标卡自适应网格：窄屏 2 列，宽屏最多 4 列 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.stat-card :deep(.ant-card-body) {
  padding: 14px 16px;
}
.stat-main {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stat-mark {
  width: 8px;
  height: 38px;
  border-radius: 4px;
  flex: 0 0 auto;
}
.stat-text {
  min-width: 0;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-base);
  font-variant-numeric: tabular-nums;
}
.stat-label {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.chart-row {
  margin-top: 12px;
}
.chart-card {
  height: 100%;
}
.chart-card :deep(.ant-card-body) {
  min-height: 240px;
}
.line-chart {
  position: relative;
  width: 100%;
  height: 210px;
}
.line-chart svg {
  width: 100%;
  height: 100%;
  display: block;
}
.chart-axis-text {
  fill: var(--muted, #8c8c8c);
  font-size: 11px;
}
.chart-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot.total { background: #2f54eb; }
.dot.fail { background: #fa541c; }
.chart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
.cost-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}
.bar-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.bar-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.bar-head span {
  color: var(--muted);
}
.bar-track {
  height: 8px;
  border-radius: 4px;
  background: var(--border-subtle, #f0f0f0);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
  background: #2f54eb;
  transition: width 0.4s ease;
}
</style>
