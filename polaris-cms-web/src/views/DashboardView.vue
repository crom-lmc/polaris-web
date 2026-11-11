<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  fetchDashboard,
  pageArticles,
  listCategories,
  listTags,
  pageMedia,
  listBanners,
  listFriendLinks,
  type DashboardStats,
  type ArticleItem,
  type TaxonomyItem,
  type MediaItem,
  type BannerItem,
  type FriendLinkItem
} from '@/api/cms'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const store = useUserStore()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)

const recent = ref<ArticleItem[]>([])
const categories = ref<TaxonomyItem[]>([])
const tags = ref<TaxonomyItem[]>([])
const mediaList = ref<MediaItem[]>([])
const banners = ref<BannerItem[]>([])
const friendLinks = ref<FriendLinkItem[]>([])

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

/** 分类分布条形图的最大值，用于换算百分比 */
const maxCategoryCount = computed(() =>
  Math.max(1, ...categories.value.map((c) => c.articleCount || 0))
)

const enabledBanners = computed(() => banners.value.filter((b) => b.status !== 0))

function isImage(m: MediaItem) {
  return (m.contentType || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(m.url)
}

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
    jobs.push(listTags().then((d) => { tags.value = d }))
  }
  if (store.can('media:view')) {
    jobs.push(pageMedia({ page: 1, size: 6 }).then((d) => { mediaList.value = d.list }))
  }
  if (store.can('banner:view')) {
    jobs.push(listBanners().then((d) => { banners.value = d }))
  }
  jobs.push(listFriendLinks().then((d) => { friendLinks.value = d }))

  await Promise.allSettled(jobs)
  loading.value = false
})
</script>

<template>
  <div>
    <a-spin :spinning="loading">
      <!-- 统计卡 -->
      <a-row :gutter="12" align="stretch" class="dash-row">
        <a-col v-for="c in cards.filter((c) => store.can(c.perm))" :key="c.key" :span="8" style="display: flex">
          <a-card class="stat-card" :body-style="{ padding: '16px' }">
            <div class="stat-num">{{ stats ? (stats as any)[c.key] : '-' }}</div>
            <div class="stat-label">{{ c.label }}</div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 快捷操作 + 待审核提醒 -->
      <a-card size="small" style="margin-top: 12px" :body-style="{ padding: '12px 16px' }">
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

      <!-- 最近内容 + 分类分布 -->
      <a-row :gutter="12" style="margin-top: 12px" align="stretch">
        <a-col :span="14" style="display: flex">
          <a-card
            v-if="store.can('article:view')"
            size="small"
            title="最近内容"
            class="fill-card"
            :body-style="{ padding: '0 16px' }"
          >
            <template #extra><a @click="router.push('/articles')">全部 →</a></template>
            <a-empty v-if="!recent.length" description="暂无内容" style="padding: 24px 0" />
            <div v-for="a in recent" :key="a.id" class="article-row" @click="router.push(`/articles/${a.id}/edit`)">
              <a-tag :color="STATUS_COLOR[a.status]" style="margin-right: 8px">{{ STATUS[a.status] }}</a-tag>
              <span class="article-title" :title="a.title">{{ a.title }}</span>
              <span class="article-meta">{{ a.categoryName || '未分类' }}</span>
              <span class="article-time">{{ fmtTime(a.updatedAt || a.createdAt) }}</span>
            </div>
          </a-card>
        </a-col>
        <a-col :span="10" style="display: flex">
          <a-card size="small" title="分类分布" class="fill-card">
            <template #extra><a @click="router.push('/categories')">管理 →</a></template>
            <a-empty v-if="!categories.length" description="暂无分类" style="padding: 24px 0" />
            <div v-for="c in categories" :key="c.id" class="cat-row">
              <span class="cat-name" :title="c.name">{{ c.name }}</span>
              <div class="cat-bar-track">
                <div class="cat-bar" :style="{ width: ((c.articleCount || 0) / maxCategoryCount) * 100 + '%' }" />
              </div>
              <span class="cat-count">{{ c.articleCount || 0 }}</span>
            </div>
          </a-card>
        </a-col>
      </a-row>

      <!-- 最新媒体 + Banner + 标签/友链 -->
      <a-row :gutter="12" style="margin-top: 12px" align="stretch">
        <a-col :span="10" style="display: flex">
          <a-card v-if="store.can('media:view')" size="small" title="最新媒体" class="fill-card">
            <template #extra><a @click="router.push('/media')">媒体库 →</a></template>
            <a-empty v-if="!mediaList.length" description="暂无媒体" style="padding: 24px 0" />
            <div class="media-grid">
              <div v-for="m in mediaList" :key="m.id" class="media-cell" :title="m.originalName" @click="router.push('/media')">
                <img v-if="isImage(m)" :src="m.url" :alt="m.originalName" />
                <span v-else class="media-file">{{ m.originalName.split('.').pop()?.toUpperCase() }}</span>
              </div>
            </div>
          </a-card>
        </a-col>
        <a-col :span="7" style="display: flex">
          <a-card v-if="store.can('banner:view')" size="small" title="Banner" class="fill-card">
            <template #extra><a @click="router.push('/banners')">管理 →</a></template>
            <a-empty v-if="!enabledBanners.length" description="暂无 Banner" style="padding: 24px 0" />
            <a-carousel v-else autoplay :dots="enabledBanners.length > 1" style="border-radius: 6px; overflow: hidden">
              <div v-for="b in enabledBanners" :key="b.id" class="banner-slide">
                <img :src="b.imageUrl" :alt="b.title" />
                <div class="banner-caption">{{ b.title }}</div>
              </div>
            </a-carousel>
          </a-card>
        </a-col>
        <a-col :span="7" style="display: flex; flex-direction: column; gap: 12px">
          <a-card size="small" title="标签" class="fill-card">
            <template #extra><a @click="router.push('/tags')">管理 →</a></template>
            <a-empty v-if="!tags.length" description="暂无标签" style="padding: 12px 0" />
            <a-space v-else wrap :size="6">
              <a-tag v-for="t in tags" :key="t.id" color="blue">{{ t.name }}</a-tag>
            </a-space>
          </a-card>
          <a-card size="small" title="友情链接" class="fill-card">
            <template #extra><a @click="router.push('/links')">管理 →</a></template>
            <a-empty v-if="!friendLinks.length" description="暂无友链" style="padding: 12px 0" />
            <div v-for="l in friendLinks" :key="l.id" class="link-row">
              <a :href="l.url" target="_blank" rel="noopener">{{ l.name }}</a>
            </div>
          </a-card>
        </a-col>
      </a-row>
    </a-spin>
  </div>
</template>

<style scoped>
.dash-row {
  margin-bottom: 4px;
}

.stat-card {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary, var(--color-text));
}

.stat-label {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.7;
}

.fill-card {
  flex: 1;
  width: 100%;
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

/* 最近内容 */
.article-row {
  display: flex;
  align-items: center;
  padding: 9px 0;
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
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 0;
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
  height: 8px;
  border-radius: 4px;
  background: var(--color-border, rgba(128, 128, 128, 0.15));
  overflow: hidden;
}

.cat-bar {
  height: 100%;
  border-radius: 4px;
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

/* 最新媒体 */
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.media-cell {
  aspect-ratio: 4 / 3;
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-border, rgba(128, 128, 128, 0.12));
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.media-file {
  font-size: 12px;
  opacity: 0.6;
}

/* Banner */
.banner-slide {
  position: relative;
  height: 150px;
}

.banner-slide img {
  width: 100%;
  height: 150px;
  object-fit: cover;
}

.banner-caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 10px;
  font-size: 12px;
  color: #fff;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 友情链接 */
.link-row {
  padding: 5px 0;
  font-size: 13px;
}
</style>
