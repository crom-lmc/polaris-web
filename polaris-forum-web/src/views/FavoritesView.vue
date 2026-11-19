<template>
  <div class="container favorites-page">
    <section class="profile-heading"><div><span class="eyebrow">MY FAVORITES</span><h1>我的收藏</h1><p>收藏的公开帖子会保存在这里，可随时取消收藏。</p></div><span class="profile-count">{{ threads.length }} 条内容</span></section>
    <p v-if="message" class="form-message success">{{ message }}</p>
    <p v-if="actionError" class="form-message error" role="alert">{{ actionError }}</p>
    <section class="panel favorite-list">
      <div v-if="loading" class="page-state">正在加载收藏内容…</div>
      <div v-else-if="error" class="page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
      <template v-else-if="threads.length">
        <div v-for="thread in threads" :key="thread.id" class="favorite-row">
          <ThreadCard :thread="thread" />
          <div class="favorite-row-footer"><RouterLink :to="`/threads/${thread.id}`">进入帖子 <arrow-right-outlined /></RouterLink><button class="secondary-button danger-text" :disabled="removingId === thread.id" @click="remove(thread)"><delete-outlined />{{ removingId === thread.id ? '取消中…' : '取消收藏' }}</button></div>
        </div>
      </template>
      <div v-else class="empty-state"><heart-outlined /><h3>还没有收藏内容</h3><p>在帖子详情点击收藏，稍后可回到这里查看。</p><RouterLink to="/" class="primary-button">去社区看看</RouterLink></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowRightOutlined, DeleteOutlined, HeartOutlined } from '@ant-design/icons-vue'
import ThreadCard from '@/components/ThreadCard.vue'
import { fetchFavorites, unfavoriteThread } from '@/api/forum'
import type { Thread } from '@/types'

const threads = ref<Thread[]>([])
const loading = ref(true)
const removingId = ref('')
const error = ref('')
const actionError = ref('')
const message = ref('')
onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try { threads.value = await fetchFavorites() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '收藏列表加载失败' }
  finally { loading.value = false }
}

async function remove(thread: Thread) {
  removingId.value = thread.id
  actionError.value = ''
  message.value = ''
  try {
    await unfavoriteThread(thread.id)
    threads.value = threads.value.filter(item => item.id !== thread.id)
    message.value = '已取消收藏'
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '取消收藏失败'
  } finally {
    removingId.value = ''
  }
}
</script>
