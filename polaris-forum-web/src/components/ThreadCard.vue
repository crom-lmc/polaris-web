<template>
  <article class="thread-card">
    <RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`" class="avatar-link" :aria-label="`查看${thread.author.name}的主页`"><UserAvatar :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" /></RouterLink>
    <UserAvatar v-else :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" />
    <div class="thread-content">
      <div class="thread-topline">
        <span class="content-kind-tag" :class="contentKind">{{ kindName }}</span>
        <RouterLink :to="`/boards/${thread.board}`" class="board-name">{{ boardName }}</RouterLink>
        <span v-if="thread.reward" class="status-tag reward-tag">悬赏 {{ thread.reward }} 积分</span>
        <span v-if="thread.pinned" class="status-tag pinned">置顶</span>
        <span v-if="thread.solved" class="status-tag solved"><check-circle-outlined />已解决</span>
      </div>
      <RouterLink v-if="contentKind !== 'feed'" :to="`/threads/${thread.id}`" class="thread-title">{{ thread.title }}</RouterLink>
      <RouterLink :to="`/threads/${thread.id}`" class="thread-excerpt" :class="{ 'feed-excerpt': contentKind === 'feed' }">{{ thread.excerpt }}</RouterLink>
      <RouterLink v-if="contentKind === 'article' && thread.coverUrl" :to="`/threads/${thread.id}`" class="thread-card-cover"><img :src="thread.coverUrl" alt="文章封面" loading="lazy" /></RouterLink>
      <div class="thread-footer">
        <div class="thread-author"><RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`" class="author-link">{{ thread.author.name }}</RouterLink><b v-else>{{ thread.author.name }}</b><span>·</span><span>{{ formatTime(thread.createdAt) }}</span></div>
        <div class="thread-stats">
          <span><eye-outlined />{{ format(thread.views) }}</span>
          <span><message-outlined />{{ thread.replies }}</span>
          <span><like-outlined />{{ thread.likes }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleOutlined, EyeOutlined, LikeOutlined, MessageOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { boards, formatTime } from '@/data/forum'
import type { Thread } from '@/types'

const props = defineProps<{ thread: Thread }>()
const boardName = computed(() => boards.find(item => item.key === props.thread.board)?.name || props.thread.board)
const authorAccountId = computed(() => props.thread.author.accountId || props.thread.authorAccountId)
const contentKind = computed(() => props.thread.kind || 'topic')
const kindName = computed(() => ({ feed: '动态', topic: '话题', question: '问答', article: '文章' })[contentKind.value])
function format(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
}
</script>
