<template>
  <div class="container home-container">
    <CarouselBanner :banners="banners" />
    <div class="forum-layout forum-layout--tags">
      <section class="thread-section panel">
        <div class="thread-list-header">
          <div><h2>{{ listTitle }}</h2><span>{{ totalCount }} 条内容</span></div>
          <div class="sort-tabs">
            <button :class="{ active: sort !== 'hot' }" @click="setSort('latest')">最新</button>
            <button :class="{ active: sort === 'hot' }" @click="setSort('hot')">热门</button>
          </div>
        </div>
        <div v-if="loading" class="empty-state"><h3>正在加载社区内容…</h3></div>
        <div v-else-if="error" class="empty-state"><h3>内容加载失败</h3><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
        <div v-else-if="threads.length">
          <ThreadCard v-for="thread in pagedThreads" :key="thread.id" :thread="thread" />
          <nav v-if="totalPages > 1" class="thread-pagination" aria-label="帖子分页">
            <button class="page-btn" :disabled="currentPage === 1" @click="goPage(currentPage - 1)">上一页</button>
            <template v-for="(item, index) in visiblePages" :key="typeof item === 'number' ? item : `gap-${index}`">
              <span v-if="item === '…'" class="page-ellipsis">{{ item }}</span>
              <button v-else class="page-btn page-num" :class="{ active: currentPage === item }" @click="goPage(Number(item))">{{ item }}</button>
            </template>
            <button class="page-btn" :disabled="currentPage === totalPages" @click="goPage(currentPage + 1)">下一页</button>
          </nav>
        </div>
        <div v-else class="empty-state"><search-outlined /><h3>没有找到相关讨论</h3><p>换个关键词试试，或者发起一个新话题。</p></div>
      </section>
      <CommunitySidebar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SearchOutlined } from '@ant-design/icons-vue'
import CarouselBanner from '@/components/CarouselBanner.vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { fetchBanners, fetchBoards, fetchThreadsPage } from '@/api/forum'
import type { Banner, Board, Thread } from '@/types'

const route = useRoute()
const router = useRouter()
const threads = ref<Thread[]>([])
const banners = ref<Banner[]>([])
const boards = ref<Board[]>([])
onMounted(async () => {
  try { banners.value = await fetchBanners() } catch { banners.value = [] }
  try { boards.value = await fetchBoards() } catch { boards.value = [] }
})
const loading = ref(false)
const error = ref('')
const pageSize = 20
const currentPage = ref(1)
// 「N 条内容」用后端全量 total；threads 在服务端分页后只装当前页，不能再拿它的 length 当总数
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
const keyword = computed(() => String(route.query.q || ''))
const board = computed(() => String(route.query.board || ''))
const sort = computed(() => String(route.query.sort || 'latest'))
// 纯一级栏目显示栏目名；一级栏目 + 二级栏目筛选时显示二级栏目名；纯搜索保留“搜索结果”语义
const boardName = computed(() => boards.value.find(item => item.key === board.value)?.name || '')
const listTitle = computed(() => {
  if (keyword.value && board.value) return keyword.value
  if (keyword.value) return `“${keyword.value}”的搜索结果`
  if (board.value) return boardName.value || '最新'
  return '最新'
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    const page = await fetchThreadsPage({ board: board.value, q: keyword.value, sort: sort.value, page: currentPage.value, size: pageSize })
    threads.value = page.records
    totalCount.value = page.total
  }
  catch (e) { error.value = e instanceof Error ? e.message : '请稍后重试' }
  finally { loading.value = false }
}
function setSort(value: string) {
  router.push({ path: '/', query: { ...(board.value ? { board: board.value } : {}), ...(keyword.value ? { q: keyword.value } : {}), sort: value } })
}
function goPage(value: number) {
  if (value < 1 || value > totalPages.value) return
  currentPage.value = value
  window.scrollTo({ top: 0, behavior: 'smooth' })
  void load()
}
// 切换分类/搜索/排序后回到第一页，避免停在新筛选下不存在的页码
watch([keyword, board, sort], () => {
  currentPage.value = 1
  void load()
}, { immediate: true })
</script>
