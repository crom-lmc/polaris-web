<template>
  <div class="comment-row" :class="{ 'comment-deleted': comment.deleted }">
    <RouterLink :to="`/members/${comment.authorAccountId}`" class="avatar-link"><UserAvatar :name="comment.author.name" :avatar-url="comment.author.avatarUrl" :initials="comment.author.initials" :color="comment.author.color" /></RouterLink>
    <div class="comment-content">
      <div class="comment-meta">
        <div><RouterLink :to="`/members/${comment.authorAccountId}`" class="comment-author-link">{{ comment.author.name }}</RouterLink><span v-if="comment.authorAccountId === threadAuthorId" class="author-badge">作者</span><span>{{ comment.author.title }}</span></div>
        <time>{{ formatTime(comment.time) }}</time>
      </div>
      <p>{{ comment.deleted ? '该评论已删除' : comment.content }}</p>
      <div v-if="!comment.deleted" class="comment-actions">
        <button class="comment-like" :class="{ liked: comment.liked }" :disabled="liking" @click="emit('like', comment)"><like-outlined />{{ comment.likes }}</button>
        <button v-if="canReply" class="comment-reply-button" @click="emit('reply', comment)"><message-outlined />回复</button>
        <button class="comment-reply-button" @click="emit('report', comment)"><flag-outlined />举报</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FlagOutlined, LikeOutlined, MessageOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { formatTime } from '@/data/forum'
import type { ForumComment } from '@/types'

defineProps<{
  comment: ForumComment
  threadAuthorId?: string
  canReply?: boolean
  liking?: boolean
}>()
const emit = defineEmits<{
  like: [comment: ForumComment]
  reply: [comment: ForumComment]
  report: [comment: ForumComment]
}>()
</script>
