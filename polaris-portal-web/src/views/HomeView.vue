<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import ArticleCard from '@/components/ArticleCard.vue'
import {
  IS_PREVIEW,
  PREVIEW_MSG_TYPE,
  SSO_AUTHORIZE_URL,
  fetchBanners,
  fetchCategories,
  fetchLayout,
  fetchLinks,
  fetchTags,
  fetchTodos,
  moduleLimit,
  pageArticles,
  type ArticleItem,
  type BannerItem,
  type FriendLinkItem,
  type LayoutModule,
  type TaxonomyItem,
  type TodoSummary
} from '@/api/portal'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const user = useUserStore()

/* 登录后展示审批中心待办；未登录或审批中心不可用时整块隐藏 */
const todos = ref<TodoSummary | null>(null)
const approvalUrl = `${SSO_AUTHORIZE_URL}/approvals`

const modules = ref<LayoutModule[]>([])
const banners = ref<BannerItem[]>([])
const articles = ref<ArticleItem[]>([])
const categories = ref<TaxonomyItem[]>([])
const tags = ref<TaxonomyItem[]>([])
const links = ref<FriendLinkItem[]>([])
const loading = ref(true)

/** 各数据源是否已取过，避免后台调布局时重复请求 */
const fetched = { banner: false, article: false, category: false, tag: false, link: false }
/** 收到后台下发的预览布局后，不再让接口返回的已保存布局覆盖它 */
let layoutLocked = false

const featured = computed(() => {
  const lim = moduleLimit(configOf('featured'), 3)
  const pick = articles.value.filter((a) => a.pinned === 1 || a.recommended === 1)
  const base = pick.length ? pick : articles.value
  return base.slice(0, lim)
})

const latest = computed(() => {
  const lim = moduleLimit(configOf('latest'), 8)
  return articles.value.slice(0, lim)
})

function configOf(key: string): string | undefined {
  return modules.value.find((m) => m.moduleKey === key)?.config
}

/** 按需取数；预览模式下模块开关变化时会再次调用，已取过的跳过 */
async function ensureData(keys: Iterable<string>): Promise<void> {
  const set = new Set(keys)
  const tasks: Promise<void>[] = []
  if (set.has('banner') && !fetched.banner) {
    fetched.banner = true
    tasks.push(
      fetchBanners()
        .then((d) => { banners.value = d })
        .catch(() => { fetched.banner = false })
    )
  }
  if ((set.has('featured') || set.has('latest')) && !fetched.article) {
    fetched.article = true
    tasks.push(
      pageArticles({ page: 1, size: 20 })
        .then((d) => { articles.value = d.list || [] })
        .catch(() => { fetched.article = false })
    )
  }
  if (set.has('category') && !fetched.category) {
    fetched.category = true
    tasks.push(
      fetchCategories()
        .then((d) => { categories.value = d })
        .catch(() => { fetched.category = false })
    )
  }
  if (set.has('tags') && !fetched.tag) {
    fetched.tag = true
    tasks.push(
      fetchTags()
        .then((d) => { tags.value = d })
        .catch(() => { fetched.tag = false })
    )
  }
  if (set.has('links') && !fetched.link) {
    fetched.link = true
    tasks.push(
      fetchLinks()
        .then((d) => { links.value = d })
        .catch(() => { fetched.link = false })
    )
  }
  await Promise.all(tasks)
}

function enabledKeys(): string[] {
  return modules.value.filter((m) => m.enabled === 1).map((m) => m.moduleKey)
}

/** 后台「门户设置」改开关 / 排序后实时下发，无需刷新页面 */
function onPreviewMessage(e: MessageEvent) {
  const d = e.data as { type?: string; modules?: LayoutModule[] }
  if (!d || d.type !== PREVIEW_MSG_TYPE || !Array.isArray(d.modules)) return
  layoutLocked = true
  modules.value = d.modules
  loading.value = true
  ensureData(enabledKeys()).finally(() => { loading.value = false })
}

onMounted(async () => {
  if (IS_PREVIEW) window.addEventListener('message', onPreviewMessage)
  const saved = await fetchLayout().catch(() => [] as LayoutModule[])
  if (!layoutLocked) modules.value = saved
  await ensureData(enabledKeys())
  if (!IS_PREVIEW) {
    await user.bootstrap().catch(() => false)
    if (user.isLoggedIn) {
      await fetchTodos().then((d) => { todos.value = d }).catch(() => { todos.value = null })
    }
  }
  loading.value = false
})

onBeforeUnmount(() => {
  if (IS_PREVIEW) window.removeEventListener('message', onPreviewMessage)
})

function goArticle(id: number) {
  if (IS_PREVIEW) return
  router.push(`/article/${id}`)
}

function goList(query: Record<string, string>) {
  if (IS_PREVIEW) return
  router.push({ path: '/list', query })
}

/** 无封面时的柔和占位底色（按分类 id 取色，同一分类颜色一致、不同分类明显区分；深浅色由 CSS 变量切换） */
const COVER_GRADIENTS = [
  'var(--cover-grad-1)',
  'var(--cover-grad-2)',
  'var(--cover-grad-3)',
  'var(--cover-grad-4)',
  'var(--cover-grad-5)'
]

function coverGrad(categoryId?: number | null) {
  const i = Math.abs(categoryId ?? 0) % COVER_GRADIENTS.length
  return COVER_GRADIENTS[i]
}

function fmtDate(s?: string | null) {
  return s ? s.slice(0, 10) : ''
}

/** 图片加载失败时隐藏，露出底下的标题占位，避免出现破图 */
function onImgError(e: Event) {
  const el = e.target as HTMLImageElement
  el.style.visibility = 'hidden'
}

const visibleModules = computed(() => modules.value.filter((m) => m.enabled === 1))
</script>

<template>
  <div>
    <PortalHeader />
    <main class="portal-main">
      <div class="container">
        <!-- 登录后的统一待办：审批中心待我处理，按业务类型汇总 -->
        <section v-if="todos && todos.total" class="todo-block">
          <div class="todo-head">
            <div class="todo-title-row">
              <h2>我的待办</h2>
              <span class="muted">共 {{ todos.total }} 项</span>
            </div>
            <div class="todo-cats">
              <a-tag v-for="c in todos.categories" :key="c.name" color="blue">
                {{ c.name }} {{ c.count }}
              </a-tag>
            </div>
          </div>
          <div class="todo-list">
            <a
              v-for="item in todos.items.slice(0, 8)"
              :key="item.id"
              class="todo-item"
              :href="approvalUrl"
              target="_blank"
              rel="noopener"
            >
              <span class="todo-cat">{{ item.category }}</span>
              <span class="todo-name">{{ item.title || item.bizName || '待审批单据' }}</span>
              <span class="todo-meta">{{ item.applicantName || '' }}{{ item.applicantName ? ' · ' : '' }}{{ item.createdAt || '' }}</span>
            </a>
          </div>
          <div v-if="todos.total > 8" class="todo-more">
            <a :href="approvalUrl" target="_blank" rel="noopener">查看全部 {{ todos.total }} 项</a>
          </div>
        </section>

        <a-spin :spinning="loading">
          <template v-for="mod in visibleModules" :key="mod.moduleKey">
            <!-- Banner 轮播 -->
            <section v-if="mod.moduleKey === 'banner' && banners.length" class="block">
              <a-carousel autoplay :dots="true">
                <div v-for="b in banners" :key="b.id" class="slide">
                  <div class="slide-fallback">{{ b.title }}</div>
                  <a
                    v-if="b.linkUrl"
                    :href="b.linkUrl"
                    target="_blank"
                    rel="noopener"
                    class="slide-link"
                  >
                    <img
                      :src="b.imageUrl"
                      :alt="b.title"
                      class="slide-img"
                      @error="onImgError"
                    />
                  </a>
                  <img v-else :src="b.imageUrl" :alt="b.title" class="slide-img" @error="onImgError" />
                </div>
              </a-carousel>
            </section>

            <!-- 精选推荐 -->
            <section v-else-if="mod.moduleKey === 'featured' && featured.length" class="block">
              <div class="section-title"><h2>精选推荐</h2></div>
              <div class="featured-grid">
                <div v-for="a in featured" :key="a.id" class="fcard" @click="goArticle(a.id)">
                  <div
                    class="fcover"
                    :style="
                      a.cover
                        ? { backgroundImage: `url(${a.cover})` }
                        : { backgroundImage: coverGrad(a.categoryId) }
                    "
                  >
                    <span v-if="!a.cover" class="fcover-ph">
                      {{ (a.categoryName || '精选').slice(0, 4) }}
                    </span>
                  </div>
                  <div class="fbody">
                    <div class="ftitle clamp-2">{{ a.title }}</div>
                    <div class="fmeta muted">{{ a.categoryName || '文章' }} · {{ fmtDate(a.publishedAt) }}</div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 最新文章 -->
            <section v-else-if="mod.moduleKey === 'latest' && latest.length" class="block">
              <div class="section-title">
                <h2>最新文章</h2>
                <span class="more" @click="goList({})">查看全部</span>
              </div>
              <div class="latest-grid">
                <ArticleCard v-for="a in latest" :key="a.id" :article="a" />
              </div>
            </section>

            <!-- 分类导航 -->
            <section v-else-if="mod.moduleKey === 'category' && categories.length" class="block">
              <div class="section-title"><h2>分类导航</h2></div>
              <div class="chips">
                <span
                  v-for="c in categories"
                  :key="c.id"
                  class="chip"
                  @click="goList({ categoryId: String(c.id), title: c.name })"
                >
                  {{ c.name }}
                  <em v-if="c.articleCount != null">{{ c.articleCount }}</em>
                </span>
              </div>
            </section>

            <!-- 热门标签 -->
            <section v-else-if="mod.moduleKey === 'tags' && tags.length" class="block">
              <div class="section-title"><h2>热门标签</h2></div>
              <div class="chips">
                <span
                  v-for="t in tags.slice(0, moduleLimit(mod.config, 12))"
                  :key="t.id"
                  class="chip tag"
                  @click="goList({ tagId: String(t.id), title: `标签：${t.name}` })"
                >
                  #{{ t.name }}
                </span>
              </div>
            </section>

            <!-- 友情链接 -->
            <section v-else-if="mod.moduleKey === 'links' && links.length" class="block">
              <div class="section-title"><h2>友情链接</h2></div>
              <div class="link-grid">
                <a
                  v-for="l in links.slice(0, moduleLimit(mod.config, 12))"
                  :key="l.id"
                  class="lcard"
                  :href="l.url || undefined"
                  :target="l.url ? '_blank' : undefined"
                  rel="noopener"
                >
                  <span v-if="l.logo" class="llogo">
                    <img :src="l.logo" :alt="l.name" @error="onImgError" />
                  </span>
                  <span v-else class="llogo ph">{{ (l.name || '?').slice(0, 1) }}</span>
                  <span class="lmeta">
                    <span class="lname">{{ l.name }}</span>
                    <span v-if="l.description" class="ldesc">{{ l.description }}</span>
                  </span>
                </a>
              </div>
            </section>
          </template>

          <a-empty v-if="!loading && visibleModules.length === 0" description="门户尚未配置展示模块" />
        </a-spin>
      </div>
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
/* 登录后的统一待办 */
.todo-block {
  margin-bottom: 28px;
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-card);
}

.todo-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.todo-title-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.todo-title-row h2 {
  margin: 0;
  font-size: 18px;
}

.todo-cats {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.todo-list {
  display: flex;
  flex-direction: column;
}

.todo-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-top: 1px dashed var(--line);
  color: inherit;
}

.todo-item:first-child {
  border-top: none;
}

.todo-item:hover .todo-name {
  color: var(--accent);
}

.todo-cat {
  flex: none;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
}

.todo-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.todo-meta {
  flex: none;
  color: var(--text-3);
  font-size: 12px;
}

.todo-more {
  margin-top: 10px;
  text-align: right;
  font-size: 13px;
}

.block {
  margin-bottom: 34px;
}

/* Banner */
.slide {
  position: relative;
  height: 300px;
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-mute);
}

.slide-fallback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 1px;
}

.slide-link,
.slide-img {
  display: block;
  width: 100%;
  height: 300px;
  position: relative;
}

.slide-link {
  line-height: 0;
}

.slide-img {
  object-fit: cover;
  background: transparent;
}

:deep(.slick-dots li button) {
  background: #fff;
  opacity: 0.6;
}

:deep(.slick-dots li.slick-active button) {
  background: var(--accent);
  opacity: 1;
}

/* Featured */
.featured-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.fcard {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
  background: var(--bg-card);
}

.fcard:hover {
  border-color: var(--line-hover);
  transform: translateY(-2px);
}

.fcover {
  height: 150px;
  background-color: var(--bg-mute);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fcover-ph {
  font-size: 15px;
  color: var(--text-2);
  font-weight: 600;
  letter-spacing: 2px;
}

.fbody {
  padding: 12px 14px 16px;
}

.ftitle {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
  min-height: 44px;
}

.fmeta {
  margin-top: 8px;
}

/* Latest */
.latest-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

/* Chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--bg-card);
}

.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}

.chip em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-3);
}

.chip.tag {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: transparent;
}

/* 友情链接 */
.link-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.lcard {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-card);
  transition: border-color 0.15s, transform 0.15s;
  min-width: 0;
}

.lcard:hover {
  border-color: var(--line-hover);
  transform: translateY(-2px);
}

.llogo {
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 9px;
  overflow: hidden;
  background: var(--bg-mute);
  display: flex;
  align-items: center;
  justify-content: center;
}

.llogo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.llogo.ph {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
  font-size: 15px;
}

.lmeta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.lname {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ldesc {
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 860px) {
  .featured-grid {
    grid-template-columns: 1fr;
  }
  .latest-grid {
    grid-template-columns: 1fr;
  }
  .link-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  /* 窄屏收一下 Banner 高度，避免图被裁得太狠、占屏太多 */
  .slide,
  .slide-img,
  .slide-link {
    height: 200px;
  }
}

@media (max-width: 460px) {
  .link-grid {
    grid-template-columns: 1fr;
  }
}
</style>
