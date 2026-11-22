<template>
  <div class="ft-page dash-page">
    <div class="ft-head dash-head">
      <span class="dash-title">接口调用概览</span>
      <a-button size="small" :loading="loading" @click="load">刷新</a-button>
    </div>

    <div class="ft-scroll dash-scroll">
      <a-spin :spinning="loading">
        <!-- 指标卡：调用总量 / 成功 / 失败 / 成功率 / 平均耗时 / P95 / 接入应用数 -->
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

        <!-- 调用趋势（纯 SVG 折线，不引入图表库）+ 失败 TOP API -->
        <a-row :gutter="12" class="chart-row">
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
                    <linearGradient id="openapiTotalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stop-color="#2f54eb" stop-opacity="0.28" />
                      <stop offset="100%" stop-color="#2f54eb" stop-opacity="0.02" />
                    </linearGradient>
                  </defs>
                  <!-- 横向网格线与刻度 -->
                  <g v-for="i in 5" :key="'g' + i">
                    <line x1="34" :y1="20 + (i - 1) * 34" x2="552" :y2="20 + (i - 1) * 34"
                          stroke="var(--border-subtle, #eee)" stroke-width="1" />
                    <text x="30" :y="24 + (i - 1) * 34" text-anchor="end" class="chart-axis-text">
                      {{ trendMax - Math.round((i - 1) * trendMax / 4) }}
                    </text>
                  </g>
                  <path :d="totalAreaPath" fill="url(#openapiTotalFill)" />
                  <path :d="totalLinePath" fill="none" stroke="#2f54eb" stroke-width="2.5"
                        stroke-linejoin="round" stroke-linecap="round" />
                  <path :d="failedLinePath" fill="none" stroke="#fa541c" stroke-width="2"
                        stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4" />
                  <!-- x 轴日期（隔点显示避免拥挤） -->
                  <g v-for="(p, idx) in trendPoints" :key="'x' + idx">
                    <text v-if="idx % 2 === 0 || idx === trendPoints.length - 1" :x="p.x" y="172"
                          text-anchor="middle" class="chart-axis-text">{{ p.label }}</text>
                  </g>
                </svg>
                <a-empty v-if="!trendHasData" class="chart-empty" description="暂无调用记录" />
              </div>
            </a-card>
          </a-col>

          <a-col :xs="24" :lg="8">
            <a-card title="失败 TOP API" size="small" class="chart-card">
              <div class="bar-list">
                <div v-for="row in topFailedRows" :key="row.apiCode" class="bar-item">
                  <div class="bar-head">
                    <span :title="row.apiCode">{{ row.apiCode }}</span>
                    <b>{{ row.failed }}</b>
                  </div>
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ width: failedPercent(row.failed) + '%' }" />
                  </div>
                </div>
                <a-empty v-if="!topFailedRows.length" :image-style="{ height: '40px' }" description="暂无失败记录" />
              </div>
            </a-card>
          </a-col>
        </a-row>

        <!-- 最近异常（设计 §7.1 概览「近期异常」） -->
        <a-row :gutter="12" class="chart-row">
          <a-col :span="24">
            <a-card title="最近异常" size="small" class="chart-card">
              <a-table
                v-if="recentErrors.length"
                size="small"
                :columns="recentErrorColumns"
                :data-source="recentErrors"
                :pagination="false"
                row-key="traceId"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'httpStatus'">
                    <a-tag color="red">{{ record.httpStatus }}</a-tag>
                  </template>
                  <template v-else-if="column.key === 'bizCode'">
                    <span class="mono">{{ record.bizCode }}</span>
                  </template>
                  <template v-else-if="column.key === 'errorMsg'">
                    <span :title="record.errorMsg || ''">{{ record.errorMsg || '—' }}</span>
                  </template>
                  <template v-else-if="column.key === 'createdAt'">
                    <span class="mono">{{ record.createdAt }}</span>
                  </template>
                </template>
              </a-table>
              <a-empty v-else :image-style="{ height: '40px' }" description="暂无异常记录" />
            </a-card>
          </a-col>
        </a-row>
      </a-spin>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { getOverview } from '@/api/openapi'

type OverviewData = Awaited<ReturnType<typeof getOverview>>

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
  { label: '成功数', value: formatNumber(overview.value.success), color: '#52c41a' },
  { label: '失败数', value: formatNumber(overview.value.failed), color: '#fa541c' },
  { label: '成功率', value: rateText.value, color: '#13a8a8' },
  { label: '平均耗时', value: `${formatNumber(overview.value.avgCostMs)} ms`, color: '#fa8c16' },
  { label: 'P95 耗时', value: `${formatNumber(overview.value.p95CostMs)} ms`, color: '#722ed1' },
  { label: '接入应用数', value: formatNumber(overview.value.appCount), color: '#597ef7' }
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

/* 失败 TOP API 条形列表 */
const topFailedRows = computed(() => overview.value.topFailed || [])
const failedMax = computed(() => Math.max(1, ...topFailedRows.value.map((r) => r.failed)))
function failedPercent(failed: number): number {
  return Math.round((failed / failedMax.value) * 100)
}

/* 最近异常表格 */
const recentErrors = computed(() => overview.value.recentErrors || [])
const recentErrorColumns = [
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '方向', dataIndex: 'direction', key: 'direction', width: 100 },
  { title: '应用', dataIndex: 'appCode', key: 'appCode', ellipsis: true },
  { title: 'API', dataIndex: 'apiCode', key: 'apiCode', ellipsis: true },
  { title: '状态', dataIndex: 'httpStatus', key: 'httpStatus', width: 80 },
  { title: '业务码', dataIndex: 'bizCode', key: 'bizCode', width: 80 },
  { title: '异常信息', dataIndex: 'errorMsg', key: 'errorMsg', ellipsis: true }
]

async function load() {
  loading.value = true
  try {
    overview.value = await getOverview({})
  } catch (e: any) {
    message.error(e?.message || '加载概览统计失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})
</script>

<style scoped>
.dash-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
}
.dash-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-base);
}
.ft-scroll.dash-scroll {
  padding-right: 2px;
  overflow-x: hidden;
}

/* 内容撑满滚动容器高度；gutter 用 padding 实现，抵消 a-row 负 margin 造成的横向溢出 */
.dash-scroll :deep(.ant-spin-nested-loading),
.dash-scroll :deep(.ant-spin-container) {
  min-height: 100%;
}
.dash-scroll :deep(.ant-spin-container) {
  display: flex;
  flex-direction: column;
}
.dash-scroll :deep(.ant-row) {
  margin-left: 0 !important;
  margin-right: 0 !important;
}
.dash-scroll :deep(.ant-col) {
  padding-left: 6px;
  padding-right: 6px;
}
.dash-scroll .chart-row:last-child {
  flex: 1 1 auto;
}
.dash-scroll .chart-row:last-child :deep(.ant-col),
.dash-scroll .chart-row:last-child .chart-card {
  height: 100%;
}

/* 指标卡自适应网格：窄屏 2 列，宽屏最多 7 列 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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
.dash-scroll .chart-row:last-child :deep(.ant-card) {
  display: flex;
  flex-direction: column;
}
.dash-scroll .chart-row:last-child :deep(.ant-card-body) {
  flex: 1;
  min-height: 240px;
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

.bar-list {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  background: #fa541c;
  transition: width 0.4s ease;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
