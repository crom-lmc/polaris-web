<template>
  <div class="container home-container">
    <div class="forum-layout forum-layout--tags">
      <section class="thread-section panel">
        <div class="content-type-hero">
          <span class="content-type-icon"><component :is="currentConfig.icon" /></span>
          <div><h1>{{ currentConfig.title }}</h1><p>{{ currentConfig.description }}</p></div>
          <RouterLink :to="`/new?type=${contentType}`" class="primary-button"><plus-outlined />{{ currentConfig.action }}</RouterLink>
        </div>
        <div class="content-type-tabs">
          <RouterLink v-for="item in contentConfigs" :key="item.key" :to="item.path" :class="{ active: contentType === item.key }"><component :is="item.icon" />{{ item.nav }}</RouterLink>
          <div class="sort-tabs"><button :class="{ active: sort === 'latest' }" @click="setSort('latest')">最新</button><button :class="{ active: sort === 'recommended' }" @click="setSort('recommended')">推荐</button><button :class="{ active: sort === 'following' }" @click="setSort('following')">关注</button></div>
        </div>
        <div v-if="loading" class="empty-state"><h3>正在加载{{ currentConfig.nav }}…</h3></div>
        <div v-else-if="error" class="empty-state"><h3>内容加载失败</h3><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
        <div v-else-if="threads.length">
          <ThreadCard v-for="thread in pagedThreads" :key="thread.id" :thread="thread" />
          <nav v-if="totalPages > 1" class="thread-pagination" aria-label="内容分页">
            <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">上一页</button>
            <template v-for="(item, index) in visiblePages" :key="typeof item === 'number' ? item : `gap-${index}`">
              <span v-if="item === '…'" class="page-ellipsis">{{ item }}</span>
              <button v-else class="page-btn page-num" :class="{ active: currentPage === item }" @click="goPage(Number(item))">{{ item }}</button>
            </template>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页</button>
          </nav>
        </div>
        <div v-else class="empty-state"><message-outlined /><h3>还没有相关内容</h3><p>来分享第一条{{ currentConfig.nav }}吧。</p></div>
      </section>
      <CommunitySidebar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { FileTextOutlined, CommentOutlined, MessageOutlined, PlusOutlined, QuestionCircleOutlined } from '@ant-design/icons-vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { fetchThreadsPage } from '@/api/forum'
import { authReady, currentUser, requireLogin } from '@/auth'
import type { Thread } from '@/types'

const contentConfigs = {
  feed: { key: 'feed', path: '/feed', nav: '动态', title: '社区动态', description: '记录此刻的想法，分享工作与生活的新鲜事。', action: '发动态', icon: CommentOutlined },
  topic: { key: 'topic', path: '/topics', nav: '话题', title: '话题讨论', description: '围绕感兴趣的主题，一起交流经验和观点。', action: '发话题', icon: MessageOutlined },
  question: { key: 'question', path: '/questions', nav: '问答', title: '互助问答', description: '描述遇到的问题，也可以帮助其他成员解答。', action: '提问题', icon: QuestionCircleOutlined },
  article: { key: 'article', path: '/articles', nav: '文章', title: '专栏文章', description: '沉淀系统知识，分享完整、深入的技术与实践。', action: '写文章', icon: FileTextOutlined }
} as const

type FeedSort = 'latest' | 'recommended' | 'following'

const route = useRoute()
const router = useRouter()
const routeSort = String(route.query.sort || '')
const sort = ref<FeedSort>(['latest', 'recommended', 'following'].includes(routeSort) ? routeSort as FeedSort : 'latest')
const threads = ref<Thread[]>([])
const loading = ref(false)
const error = ref('')
const pageSize = 20
const currentPage = ref(1)
const totalCount = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
// 服务端已按页返回，前端不再切片
const pagedThreads = computed(() => threads.value)
// 页码多时只展示首尾与当前页附近，避免整排平铺后换行
const visiblePages = computed<(number | '…')[]>(() => {
  const total = totalPages.value
  if (total <= 9) return Array.from({ length: total }, (_, index) => index + 1)
  const current = currentPage.value
  const numbers = new Set<number>([1, total])
  for (let page = Math.max(2, current - 2); page <= Math.min(total - 1, current + 2); page++) numbers.add(page)
  const sorted = [...numbers].sort((a, b) => a - b)
  const result: (number | '…')[] = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('…')
    result.push(page)
  })
  return result
})
const contentType = computed(() => {
  const kind = String(route.meta.kind || 'topic') as keyof typeof contentConfigs
  return contentConfigs[kind] ? kind : 'topic'
})
const currentConfig = computed(() => contentConfigs[contentType.value])
const keyword = computed(() => String(route.query.q || ''))
const board = computed(() => String(route.query.board || ''))
async function load() {
  if (sort.value === 'following' && !authReady.value) return
  if (sort.value === 'following' && !currentUser.value) {
    threads.value = []
    totalCount.value = 0
    if (!requireLogin('查看关注内容', `${route.path}?sort=following`)) return
  }
  loading.value = true
  error.value = ''
  try {
    const page = await fetchThreadsPage({ kind: contentType.value, sort: sort.value, board: board.value, q: keyword.value, page: currentPage.value, size: pageSize })
    threads.value = page.records
    totalCount.value = page.total
  }
  catch (e) { error.value = e instanceof Error ? e.message : '请稍后重试' }
  finally { loading.value = false }
}
function setSort(value: FeedSort) {
  if (value === 'following' && !currentUser.value && !requireLogin('查看关注内容', `${route.path}?sort=following`)) return
  sort.value = value
  router.replace({ path: route.path, query: { ...(board.value ? { board: board.value } : {}), ...(keyword.value ? { q: keyword.value } : {}), ...(value === 'latest' ? {} : { sort: value }) } })
}
function goPage(value: number) {
  if (value < 1 || value > totalPages.value) return
  currentPage.value = value
  window.scrollTo({ top: 0, behavior: 'smooth' })
  void load()
}
watch([contentType, sort, keyword, board, authReady, currentUser], () => {
  currentPage.value = 1
  void load()
}, { immediate: true })
watch(() => route.query.sort, value => {
  const next = String(value || 'latest')
  if (['latest', 'recommended', 'following'].includes(next)) sort.value = next as FeedSort
})
</script>
