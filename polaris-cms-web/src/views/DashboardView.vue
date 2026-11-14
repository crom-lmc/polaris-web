<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchDashboard,
  pageArticles,
  listCategories,
  type DashboardStats,
  type ArticleItem,
  type TaxonomyItem
} from '@/api/cms'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)

const recent = ref<ArticleItem[]>([])
const categories = ref<TaxonomyItem[]>([])

const STATUS = ['草稿', '待审核', '待发布', '已发布', '驳回', '已下线', '审批中']
const STATUS_COLOR = ['default', 'orange', 'purple', 'green', 'red', 'default', 'processing']

const cards = [
  { key: 'total', label: '全部内容', perm: 'article:view' },
  { key: 'published', label: '已发布', perm: 'article:view' },
  { key: 'pendingAudit', label: '待审核', perm: 'article:view' },
  { key: 'draft', label: '草稿箱', perm: 'article:view' },
  { key: 'media', label: '媒体文件', perm: 'media:view' },
  { key: 'banners', label: 'Banner', perm: 'banner:view' }
]

const visibleCards = computed(() => cards.filter((c) => store.can(c.perm)))
const statColumns = computed(() => Math.min(3, Math.max(1, visibleCards.value.length)))

/** 分类分布条形图的最大值，用于换算百分比 */
const maxCategoryCount = computed(() =>
  Math.max(1, ...categories.value.map((c) => c.articleCount || 0))
)

function fmtTime(s?: string | null) {
  if (!s) return '-'
  return s.replace('T', ' ').slice(0, 16)
}

onMounted(async () => {
  loading.value = true
  // 各卡片独立加载，单个接口失败不影响其它卡片
  const jobs: Promise<void>[] = [
    fetchDashboard().then((d) => { stats.value = d })
  ]
  if (store.can('article:view')) {
    jobs.push(pageArticles({ page: 1, size: 8 }).then((d) => { recent.value = d.list }))
  }
  if (store.can('category:view') || store.can('article:view')) {
    jobs.push(listCategories().then((d) => { categories.value = d }))
  }

  await Promise.allSettled(jobs)
  loading.value = false
})
</script>

<template>
  <div class="dash-page">
    <a-spin :spinning="loading">
      <div class="dash-inner">
        <!-- 统计卡：独立卡片，横竖都留间距 -->
        <div class="stat-grid" :style="{ gridTemplateColumns: `repeat(${statColumns}, 1fr)` }">
          <a-card
            v-for="c in visibleCards"
            :key="c.key"
            class="stat-card"
            :body-style="{ padding: '24px 16px' }"
          >
            <div class="stat-num">{{ stats ? (stats as any)[c.key] : '-' }}</div>
            <div class="stat-label">{{ c.label }}</div>
          </a-card>
        </div>

        <!-- 快捷操作 + 待审核提醒 -->
        <a-card size="small" class="quick-card" :body-style="{ padding: '12px 16px' }">
          <div class="quick-bar">
            <a-space wrap>
              <span class="quick-title">快捷操作</span>
              <a-button v-if="store.can('article:create')" type="primary" size="small" @click="router.push('/articles/new')">
                新建文章
              </a-button>
              <a-button v-if="store.can('media:upload')" size="small" @click="router.push('/media')">上传媒体</a-button>
              <a-button v-if="store.can('banner:manage')" size="small" @click="router.push('/banners')">管理 Banner</a-button>
            </a-space>
            <a v-if="stats && stats.pendingAudit > 0" class="pending-tip" @click="router.push('/articles?status=1')">
              {{ stats.pendingAudit }} 篇内容待审核，去处理 →
            </a>
          </div>
        </a-card>

        <!-- 最近内容 + 分类分布，撑满剩余高度 -->
        <div class="main-row">
          <a-card
            v-if="store.can('article:view')"
            size="small"
            title="最近内容"
            class="fill-card"
            :body-style="{ padding: '0 16px' }"
          >
            <template #extra><a @click="router.push('/articles')">全部 →</a></template>
            <a-empty v-if="!recent.length" description="暂无内容" class="fill-empty" />
            <div v-else class="list-fill">
              <div v-for="a in recent" :key="a.id" class="article-row" @click="router.push(`/articles/${a.id}/edit`)">
                <a-tag :color="STATUS_COLOR[a.status]" style="margin-right: 8px">{{ STATUS[a.status] }}</a-tag>
                <span class="article-title" :title="a.title">{{ a.title }}</span>
                <span class="article-meta">{{ a.categoryName || '未分类' }}</span>
                <span class="article-time">{{ fmtTime(a.updatedAt || a.createdAt) }}</span>
              </div>
            </div>
          </a-card>

          <a-card size="small" title="分类分布" class="fill-card" :body-style="{ padding: '8px 16px' }">
            <template #extra><a @click="router.push('/categories')">管理 →</a></template>
            <a-empty v-if="!categories.length" description="暂无分类" class="fill-empty" />
            <div v-else class="list-fill">
              <div v-for="c in categories" :key="c.id" class="cat-row">
                <span class="cat-name" :title="c.name">{{ c.name }}</span>
                <div class="cat-bar-track">
                  <div class="cat-bar" :style="{ width: ((c.articleCount || 0) / maxCategoryCount) * 100 + '%' }" />
                </div>
                <span class="cat-count">{{ c.articleCount || 0 }}</span>
              </div>
            </div>
          </a-card>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<style scoped>
.dash-page,
.dash-page :deep(.ant-spin-nested-loading),
.dash-page :deep(.ant-spin-container) {
  height: 100%;
}

.dash-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 统计卡：卡片之间横竖都留间距 */
.stat-grid {
  flex: 0 0 auto;
  display: grid;
  gap: 14px;
}

.stat-card :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 108px;
}

.stat-num {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary, var(--color-text));
}

.stat-label {
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.7;
}

.quick-card {
  flex: 0 0 auto;
}

.quick-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-title {
  font-weight: 600;
  margin-right: 4px;
}

.pending-tip {
  font-size: 13px;
  color: #fa8c16;
}

/* 下两栏：随剩余高度撑满 */
.main-row {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 14fr 10fr;
  gap: 12px;
}

.fill-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.fill-card :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.fill-card :deep(.ant-card-body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.list-fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.fill-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 最近内容 */
.article-row {
  flex: 1;
  min-height: 38px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border, rgba(128, 128, 128, 0.15));
  cursor: pointer;
}

.article-row:last-child {
  border-bottom: none;
}

.article-row:hover .article-title {
  color: #1677ff;
}

.article-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-meta {
  flex-shrink: 0;
  margin-left: 12px;
  font-size: 12px;
  opacity: 0.6;
}

.article-time {
  flex-shrink: 0;
  margin-left: 12px;
  font-size: 12px;
  opacity: 0.5;
  font-variant-numeric: tabular-nums;
}

/* 分类分布 */
.cat-row {
  flex: 1;
  min-height: 44px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.cat-name {
  width: 88px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.cat-bar-track {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: var(--color-border, rgba(128, 128, 128, 0.15));
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  border-radius: 5px;
  background: linear-gradient(90deg, #1677ff, #69b1ff);
  min-width: 2px;
  transition: width 0.4s;
}

.cat-count {
  width: 32px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
