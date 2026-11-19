<template>
  <div class="container">
    <section v-if="board" class="board-hero" :style="{ '--board-color': board.color }">
      <div class="board-hero-icon"><message-outlined /></div>
      <div><span class="eyebrow">COMMUNITY BOARD</span><h1>{{ board.name }}</h1><p>{{ board.description }}</p></div>
      <div class="board-count"><b>{{ board.count }}</b><span>社区讨论</span></div>
    </section>
    <div class="forum-layout forum-layout--tags">
      <section class="thread-section panel">
        <div class="thread-list-header">
          <div><h2>{{ board?.name || '板块讨论' }}</h2><span>{{ threads.length }} 条内容</span></div>
          <RouterLink to="/new" class="small-primary"><plus-outlined />新帖子</RouterLink>
        </div>
        <CategoryTabs />
        <div v-if="loading" class="empty-state"><h3>正在加载板块内容…</h3></div>
        <div v-else-if="error" class="empty-state"><h3>内容加载失败</h3><p>{{ error }}</p></div>
        <template v-else>
          <ThreadCard v-for="thread in threads" :key="thread.id" :thread="thread" />
          <div v-if="!threads.length" class="empty-state"><message-outlined /><h3>这个板块还没有帖子</h3><p>成为第一个发起讨论的人。</p></div>
        </template>
      </section>
      <CommunitySidebar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { MessageOutlined, PlusOutlined } from '@ant-design/icons-vue'
import CategoryTabs from '@/components/CategoryTabs.vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { boards } from '@/data/forum'
import { fetchThreads } from '@/api/forum'
import type { Thread } from '@/types'

const route = useRoute()
const threads = ref<Thread[]>([])
const loading = ref(false)
const error = ref('')
const boardKey = computed(() => String(route.params.key || 'general'))
const board = computed(() => boards.find(item => item.key === boardKey.value))
const keyword = computed(() => String(route.query.q || ''))
async function load() {
  loading.value = true
  error.value = ''
  try { threads.value = await fetchThreads({ board: boardKey.value, q: keyword.value }) }
  catch (e) { error.value = e instanceof Error ? e.message : '请稍后重试' }
  finally { loading.value = false }
}
watch([boardKey, keyword], load, { immediate: true })
</script>
