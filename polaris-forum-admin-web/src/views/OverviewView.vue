<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  AppstoreOutlined,
  AuditOutlined,
  BellOutlined,
  BookOutlined,
  EyeOutlined,
  HeartOutlined,
  MessageOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TrophyOutlined,
  UserOutlined
} from '@ant-design/icons-vue'
import { fetchForumOverview, type ForumOverview } from '@/api/forum'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const loading = ref(false)
const data = ref<ForumOverview>({
  threadCount: 0, commentCount: 0, memberCount: 0, likeCount: 0,
  viewCount: 0, pendingReportCount: 0, boardCount: 0, tagCount: 0,
  todayThreadCount: 0, monthThreadCount: 0, sensitiveWordCount: 0, badgeAwardCount: 0,
  contentTrend: [], boardDistribution: [], levelDistribution: []
})

/** 6 张主规模卡：色块图标 + 数字 + 说明，与统一账号中心概览同一视觉语言 */
const statCards = computed(() => [
  { label: '内容总数', value: data.value.threadCount, note: '帖子', icon: BookOutlined, color: '#2f54eb', bg: '#eef2ff' },
  { label: '评论互动', value: data.value.commentCount, note: '含回复', icon: MessageOutlined, color: '#13a8a8', bg: '#e6fffb' },
  { label: '社区成员', value: data.value.memberCount, note: '已注册', icon: UserOutlined, color: '#722ed1', bg: '#f9f0ff' },
  { label: '累计获赞', value: data.value.likeCount, note: '点赞', icon: HeartOutlined, color: '#eb2f96', bg: '#fff0f6' },
  { label: '内容浏览', value: data.value.viewCount, note: '累计', icon: EyeOutlined, color: '#fa8c16', bg: '#fff7e6' },
  { label: '待处理举报', value: data.value.pendingReportCount, note: '需关注', icon: AuditOutlined, color: '#f5222d', bg: '#fff1f0' }
])

/** 6 张次级卡：板块/标签/今日/本月/敏感词/勋章 */
const miniCards = computed(() => [
  { label: '一级板块', value: data.value.boardCount, icon: AppstoreOutlined, color: '#2f54eb', bg: '#eef2ff' },
  { label: '内容标签', value: data.value.tagCount, icon: BellOutlined, color: '#13a8a8', bg: '#e6fffb' },
  { label: '今日新增', value: data.value.todayThreadCount, icon: BookOutlined, color: '#52c41a', bg: '#f6ffed' },
  { label: '本月新增', value: data.value.monthThreadCount, icon: MessageOutlined, color: '#fa8c16', bg: '#fff7e6' },
  { label: '敏感词库', value: data.value.sensitiveWordCount, icon: SafetyCertificateOutlined, color: '#722ed1', bg: '#f9f0ff' },
  { label: '已发勋章', value: data.value.badgeAwardCount, icon: TrophyOutlined, color: '#d4a017', bg: '#fffbe6' }
])

function fmt(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : value.toLocaleString()
}

/* ---------- 近 14 天内容趋势折线（viewBox 560x180，绘图区 x∈[34,552]，y∈[20,156]） ---------- */
const trendMax = computed(() => {
  const max = Math.max(1, ...data.value.contentTrend.flatMap(p => [p.threads, p.comments]))
  return Math.ceil(max / 4) * 4 || 4
})
const trendHasData = computed(() => data.value.contentTrend.some(p => p.threads > 0 || p.comments > 0))
const trendPoints = computed(() => {
  const rows = data.value.contentTrend
  const n = rows.length
  const max = trendMax.value
  return rows.map((p, i) => ({
    x: n <= 1 ? 34 : 34 + i * (518 / (n - 1)),
    ty: 156 - (p.threads / max) * 136,
    cy: 156 - (p.comments / max) * 136,
    label: p.date.slice(5)
  }))
})
const trendLine = computed(() => {
  const pts = trendPoints.value
  const line = (key: 'ty' | 'cy') =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p[key].toFixed(1)}`).join(' ')
  return { threads: line('ty'), comments: line('cy') }
})
const trendArea = computed(() => {
  const pts = trendPoints.value
  if (!pts.length) return ''
  const top = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.ty.toFixed(1)}`).join(' ')
  return `${top} L${pts[pts.length - 1].x.toFixed(1)},156 L${pts[0].x.toFixed(1)},156 Z`
})

/* ---------- 一级板块内容分布：横向条形，按最大值归一 ---------- */
const boardBars = computed(() => {
  const rows = data.value.boardDistribution.filter(r => r.value > 0)
  const max = Math.max(1, ...rows.map(r => r.value))
  const colors = ['#2f54eb', '#13a8a8', '#722ed1', '#fa8c16', '#eb2f96', '#52c41a']
  return rows.slice(0, 10).map((r, i) => ({
    name: r.name, value: r.value,
    percent: Math.round((r.value / max) * 100),
    color: colors[i % colors.length]
  }))
})

/* ---------- 成员等级分布：垂直柱状图，横轴等级序号，纵轴人数，悬停显示等级全称 ---------- */
const LEVEL_COLORS = ['#9aa4b2', '#5b8def', '#13a8a8', '#22a06b', '#fa8c16', '#a855f7', '#eb4b8d', '#d4a017', '#2f54eb', '#e0301e']
const levelBars = computed(() => {
  const rows = data.value.levelDistribution
  const max = Math.max(1, ...rows.map(r => r.value))
  const mapped = rows.map((r, i) => ({
    name: r.name,
    no: i + 1,
    value: r.value,
    percent: Math.round((r.value / max) * 100),
    color: LEVEL_COLORS[i % LEVEL_COLORS.length]
  }))
  // 去掉尾部无人的等级（如 Lv.16-20），避免一排空柱；保留中间的空档以反映分布断层
  let last = mapped.length - 1
  while (last >= 0 && mapped[last].value === 0) last--
  return mapped.slice(0, last + 1)
})
const levelTotal = computed(() => data.value.levelDistribution.reduce((s, r) => s + r.value, 0))

async function load() {
  loading.value = true
  try {
    data.value = await fetchForumOverview()
  } catch {
    // 概览统计失败不阻塞页面其它模块，保留全 0 默认态
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="overview-page">
    <div class="page-heading">
      <div>
        <h1>概览</h1>
        <p>北极星核 · 论坛社区运营全貌</p>
      </div>
      <a-button v-if="store.can('forum:overview:view')" size="small" :loading="loading" @click="load"><reload-outlined />刷新</a-button>
    </div>

    <a-spin :spinning="loading">
      <!-- 6 张主规模卡 -->
      <a-row :gutter="16" class="stat-row main-stat-row">
        <a-col v-for="item in statCards" :key="item.label" :span="8">
          <a-card size="small" class="stat-card">
            <div class="stat-main">
              <div class="stat-icon" :style="{ color: item.color, background: item.bg }">
                <component :is="item.icon" />
              </div>
              <div class="stat-text">
                <div class="stat-value">{{ fmt(item.value) }}</div>
                <div class="stat-sub">
                  <span class="stat-label">{{ item.label }}</span>
                  <span class="stat-note">{{ item.note }}</span>
                </div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 6 张次级卡 -->
      <a-row :gutter="16" class="stat-row">
        <a-col v-for="item in miniCards" :key="item.label" :span="4">
          <a-card size="small" class="stat-card mini-card">
            <div class="stat-main">
              <div class="stat-icon" :style="{ color: item.color, background: item.bg }">
                <component :is="item.icon" />
              </div>
              <div class="stat-text">
                <div class="stat-value small">{{ fmt(item.value) }}</div>
                <div class="stat-sub"><span class="stat-label">{{ item.label }}</span></div>
              </div>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 图表区：趋势折线 + 板块分布 + 等级分布 -->
      <a-row :gutter="16" class="stat-row chart-row">
        <a-col :span="12">
          <a-card title="近 14 天内容趋势" size="small" class="chart-card">
            <template #extra>
              <span class="chart-legend"><i class="dot thread" />帖子 <i class="dot comment" />评论</span>
            </template>
            <div class="line-chart">
              <svg viewBox="0 0 560 180" preserveAspectRatio="none" role="img" aria-label="内容趋势折线图">
                <defs>
                  <linearGradient id="threadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#2f54eb" stop-opacity="0.28" />
                    <stop offset="100%" stop-color="#2f54eb" stop-opacity="0.02" />
                  </linearGradient>
                </defs>
                <g v-for="i in 5" :key="'g' + i">
                  <line x1="34" :y1="20 + (i - 1) * 34" x2="552" :y2="20 + (i - 1) * 34"
                        stroke="var(--panel-border)" stroke-width="1" />
                  <text x="30" :y="24 + (i - 1) * 34" text-anchor="end" class="chart-axis-text">
                    {{ trendMax - Math.round((i - 1) * trendMax / 4) }}
                  </text>
                </g>
                <path :d="trendArea" fill="url(#threadFill)" />
                <path :d="trendLine.threads" fill="none" stroke="#2f54eb" stroke-width="2.5"
                      stroke-linejoin="round" stroke-linecap="round" />
                <path :d="trendLine.comments" fill="none" stroke="#13a8a8" stroke-width="2"
                      stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="5 4" />
                <g v-for="(p, idx) in trendPoints" :key="'x' + idx">
                  <text v-if="idx % 2 === 0 || idx === trendPoints.length - 1" :x="p.x" y="172"
                        text-anchor="middle" class="chart-axis-text">{{ p.label }}</text>
                </g>
              </svg>
              <a-empty v-if="!trendHasData" class="chart-empty" description="近 14 天暂无内容" />
            </div>
          </a-card>
        </a-col>

        <a-col :span="12">
          <a-card title="板块内容分布" size="small" class="chart-card">
            <div class="bar-list">
              <div v-for="row in boardBars" :key="row.name" class="bar-item">
                <div class="bar-head">
                  <span :title="row.name">{{ row.name }}</span><b>{{ row.value }}</b>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: row.percent + '%', background: row.color }" />
                </div>
              </div>
              <a-empty v-if="!boardBars.length" :image-style="{ height: '40px' }" description="暂无内容" />
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 成员等级分布：柱状图独占一行，横轴等级、纵轴人数 -->
      <a-row :gutter="16" class="stat-row">
        <a-col :span="24">
          <a-card title="成员等级分布" size="small" class="chart-card level-bar-card">
            <template #extra>
              <span class="chart-legend">社区成员合计 <b>{{ levelTotal }}</b> 人</span>
            </template>
            <div class="level-bar-chart">
              <div v-for="bar in levelBars" :key="bar.no" class="level-bar-item" :title="`Lv.${bar.no} ${bar.name}：${bar.value} 人`">
                <span class="level-bar-value">{{ bar.value }}</span>
                <div class="level-bar-track">
                  <div class="level-bar-fill" :style="{ height: Math.max(bar.percent, bar.value > 0 ? 2 : 0) + '%', background: bar.color }" />
                </div>
                <span class="level-bar-label">Lv.{{ bar.no }}</span>
              </div>
              <a-empty v-if="!levelBars.length" :image-style="{ height: '40px' }" description="暂无数据" />
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<style scoped>
/* 管理端 .content 是 overflow:hidden + flex，概览内容较多，根节点自行滚动 */
.overview-page {
  width: 100%;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}

.stat-row { margin-top: 16px; }
.stat-row:first-of-type { margin-top: 0; }
/* 6 张主规模卡同一 a-row 内按 span=8 折成两行，gutter 只有水平间距，补行间距避免上下卡片紧贴 */
.main-stat-row { row-gap: 16px; }

.stat-card :deep(.ant-card-body) {
  min-height: 96px;
  padding: 16px 18px;
  display: flex;
  align-items: center;
}

.stat-main {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.stat-icon {
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 22px;
}

.stat-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.stat-value {
  color: var(--text-base);
  font-size: 30px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.stat-value.small { font-size: 24px; }

.stat-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.stat-label { color: var(--text-base); font-size: 13px; }
.stat-note { color: var(--muted); font-size: 12px; white-space: nowrap; }

.mini-card :deep(.ant-card-body) { min-height: 80px; padding: 14px; }
.mini-card .stat-icon { width: 40px; height: 40px; font-size: 19px; }

.chart-row { margin-top: 16px; }
.chart-card { height: 100%; }
.chart-card :deep(.ant-card-body) { min-height: 240px; }

.line-chart { position: relative; width: 100%; height: 200px; }
.line-chart svg { width: 100%; height: 100%; display: block; }
.chart-axis-text { fill: var(--muted); font-size: 11px; }
.chart-legend { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.dot.thread { background: #2f54eb; }
.dot.comment { background: #13a8a8; }
.chart-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }

.bar-list { display: flex; flex-direction: column; gap: 12px; padding: 2px 0; }
.bar-item { min-width: 0; }
.bar-head { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; margin-bottom: 5px; }
.bar-head span { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-head b { font-variant-numeric: tabular-nums; }
.bar-track { height: 8px; border-radius: 4px; background: var(--panel-border); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

/* 图表列允许收缩到 0，避免内部宽内容把整页撑出横向滚动条 */
.chart-row .ant-col, .stat-row > .ant-col { min-width: 0; }
.level-bar-card { min-width: 0; }

.level-bar-card :deep(.ant-card-body) { min-height: 260px; min-width: 0; }
.level-bar-chart {
  display: flex;
  align-items: stretch;
  gap: 4px;
  height: 200px;
  padding: 18px 4px 0;
  width: 100%;
  overflow-x: auto;
}
.level-bar-item {
  flex: 1 1 0;
  min-width: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.level-bar-value { color: var(--text-base); font-size: 11px; line-height: 16px; font-variant-numeric: tabular-nums; }
.level-bar-track {
  flex: 1;
  width: 100%;
  margin: 4px 0 6px;
  display: flex;
  align-items: flex-end;
  background: var(--panel-border);
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}
.level-bar-fill { width: 100%; border-radius: 4px 4px 0 0; transition: height 0.4s ease; }
.level-bar-label { color: var(--muted); font-size: 11px; white-space: nowrap; }
</style>
