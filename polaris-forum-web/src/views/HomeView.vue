<template>
  <div class="container home-container">
    <div class="forum-layout forum-layout--tags">
      <section class="thread-section panel">
        <CategoryTabs />
        <div class="thread-list-header">
          <div><h2>{{ keyword ? `“${keyword}”的搜索结果` : '社区讨论' }}</h2><span>{{ threads.length }} 条内容</span></div>
          <div class="sort-tabs">
            <button :class="{ active: sort !== 'hot' }" @click="setSort('latest')">最新</button>
            <button :class="{ active: sort === 'hot' }" @click="setSort('hot')">热门</button>
          </div>
        </div>
        <div v-if="loading" class="empty-state"><h3>正在加载社区内容…</h3></div>
        <div v-else-if="error" class="empty-state"><h3>内容加载失败</h3><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
        <div v-else-if="threads.length"><ThreadCard v-for="thread in threads" :key="thread.id" :thread="thread" /></div>
        <div v-else class="empty-state"><search-outlined /><h3>没有找到相关讨论</h3><p>换个关键词试试，或者发起一个新话题。</p></div>
      </section>
      <CommunitySidebar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SearchOutlined } from '@ant-design/icons-vue'
import CategoryTabs from '@/components/CategoryTabs.vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { fetchThreads } from '@/api/forum'
import type { Thread } from '@/types'

const route = useRoute()
const router = useRouter()
const threads = ref<Thread[]>([])
const loading = ref(false)
const error = ref('')
const keyword = computed(() => String(route.query.q || ''))
const sort = computed(() => String(route.query.sort || 'latest'))
async function load() {
  loading.value = true
  error.value = ''
  try { threads.value = await fetchThreads({ q: keyword.value, sort: sort.value }) }
  catch (e) { error.value = e instanceof Error ? e.message : '请稍后重试' }
  finally { loading.value = false }
}
function setSort(value: string) {
  router.push({ path: '/', query: { ...(keyword.value ? { q: keyword.value } : {}), sort: value } })
}
watch([keyword, sort], load, { immediate: true })
</script>
