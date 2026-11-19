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
        <CategoryTabs />
        <div v-if="loading" class="empty-state"><h3>正在加载{{ currentConfig.nav }}…</h3></div>
        <div v-else-if="error" class="empty-state"><h3>内容加载失败</h3><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
        <div v-else-if="threads.length"><ThreadCard v-for="thread in threads" :key="thread.id" :thread="thread" /></div>
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
import CategoryTabs from '@/components/CategoryTabs.vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { fetchThreads } from '@/api/forum'
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
const contentType = computed(() => {
  const kind = String(route.meta.kind || 'topic') as keyof typeof contentConfigs
  return contentConfigs[kind] ? kind : 'topic'
})
const currentConfig = computed(() => contentConfigs[contentType.value])
const keyword = computed(() => String(route.query.q || ''))
async function load() {
  if (sort.value === 'following' && !authReady.value) return
  if (sort.value === 'following' && !currentUser.value) {
    threads.value = []
    if (!requireLogin('查看关注内容', `${route.path}?sort=following`)) return
  }
  loading.value = true
  error.value = ''
  try { threads.value = await fetchThreads({ kind: contentType.value, sort: sort.value, q: keyword.value }) }
  catch (e) { error.value = e instanceof Error ? e.message : '请稍后重试' }
  finally { loading.value = false }
}
function setSort(value: FeedSort) {
  if (value === 'following' && !currentUser.value && !requireLogin('查看关注内容', `${route.path}?sort=following`)) return
  sort.value = value
  router.replace({ path: route.path, query: { ...(keyword.value ? { q: keyword.value } : {}), ...(value === 'latest' ? {} : { sort: value }) } })
}
watch([contentType, sort, keyword, authReady, currentUser], load, { immediate: true })
watch(() => route.query.sort, value => {
  const next = String(value || 'latest')
  if (['latest', 'recommended', 'following'].includes(next)) sort.value = next as FeedSort
})
</script>
