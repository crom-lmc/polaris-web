<template>
  <div class="container notifications-page">
    <section class="profile-heading"><div><span class="eyebrow">FORUM MESSAGES</span><h1>论坛消息</h1><p>评论、回复、勋章获得记录和举报处理结果只保存在论坛消息中心。</p></div><button class="secondary-button" :disabled="!unreadCount || readingAll" @click="readAll"><check-outlined />{{ readingAll ? '处理中…' : '全部已读' }}</button></section>
    <section class="panel notification-card">
      <div class="notification-filters">
        <div class="notification-type-tabs"><button v-for="tab in tabs" :key="tab.key" :class="{ active: type === tab.key }" @click="type = tab.key">{{ tab.label }}<span v-if="badgeOf(tab.key)" class="tab-unread-badge">{{ badgeOf(tab.key) > 99 ? '99+' : badgeOf(tab.key) }}</span></button></div>
        <label class="unread-filter"><input v-model="unreadOnly" type="checkbox" />仅看未读</label>
      </div>
      <p v-if="actionError" class="form-message error" role="alert">{{ actionError }}</p>
      <div v-if="loading" class="page-state">正在加载论坛消息…</div>
      <div v-else-if="error" class="page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
      <div v-else-if="notifications.length" class="notification-list">
        <article v-for="item in notifications" :key="item.id" class="notification-row" :class="{ unread: !item.readAt }" tabindex="0" @click="open(item)" @keydown.enter="open(item)">
          <span class="notification-type-icon" :class="item.type.toLowerCase()"><component :is="typeIcons[item.type]" /></span>
          <div class="notification-copy"><div><span class="notification-kind">{{ typeNames[item.type] }}</span><time>{{ formatTime(item.createdAt) }}</time><span v-if="!item.readAt" class="notification-unread-dot">未读</span></div><h2>{{ item.title }}</h2><p>{{ item.summary }}</p><RouterLink v-if="item.actorAccountId" :to="`/members/${item.actorAccountId}`" class="notification-actor" @click.stop>{{ item.actorName || '查看触发成员' }}</RouterLink></div>
          <div class="notification-actions"><button v-if="!item.readAt" class="small-primary" :disabled="readingId === item.id" @click.stop="markRead(item)">{{ readingId === item.id ? '已读中…' : '标为已读' }}</button><right-outlined /></div>
        </article>
      </div>
      <div v-else class="empty-state"><bell-outlined /><h3>暂无消息</h3><p>{{ unreadOnly ? '当前没有符合条件的未读消息。' : '收到评论、回复、新勋章或举报处理结果后，消息会出现在这里。' }}</p></div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { BellOutlined, CheckOutlined, CommentOutlined, FlagOutlined, HeartOutlined, MessageOutlined, RightOutlined, TrophyOutlined } from '@ant-design/icons-vue'
import { fetchNotifications, fetchUnreadCounts, markAllNotificationsRead, markNotificationRead } from '@/api/forum'
import { refreshUnreadCount, unreadCount } from '@/auth'
import { formatTime } from '@/data/forum'
import type { ForumNotification, NotificationType } from '@/types'

const router = useRouter()
const notifications = ref<ForumNotification[]>([])
const type = ref<NotificationType | ''>('')
const unreadOnly = ref(false)
const loading = ref(true)
const readingId = ref('')
const readingAll = ref(false)
const error = ref('')
const actionError = ref('')
const typeNames: Record<NotificationType, string> = { THREAD_COMMENT: '帖子评论', COMMENT_REPLY: '评论回复', THREAD_LIKE: '点赞消息', BADGE_AWARDED: '勋章通知', REPORT_RESULT: '举报处理结果' }
const typeIcons = { THREAD_COMMENT: CommentOutlined, COMMENT_REPLY: MessageOutlined, THREAD_LIKE: HeartOutlined, BADGE_AWARDED: TrophyOutlined, REPORT_RESULT: FlagOutlined }
// 分类 tab：key 为空表示全部；角标取对应类型的未读数
const tabs: { key: NotificationType | ''; label: string }[] = [
  { key: '', label: '全部消息' },
  { key: 'THREAD_COMMENT', label: '帖子评论' },
  { key: 'COMMENT_REPLY', label: '评论回复' },
  { key: 'THREAD_LIKE', label: '点赞消息' },
  { key: 'BADGE_AWARDED', label: '勋章通知' },
  { key: 'REPORT_RESULT', label: '举报结果' }
]
const unreadCounts = ref<Record<string, number>>({})
function badgeOf(key: NotificationType | ''): number {
  return unreadCounts.value[key || 'ALL'] || 0
}
async function loadUnreadCounts() {
  try { unreadCounts.value = await fetchUnreadCounts() }
  catch { unreadCounts.value = {} }
}
watch([type, unreadOnly], load, { immediate: true })
loadUnreadCounts()

async function load() {
  loading.value = true
  error.value = ''
  try { notifications.value = await fetchNotifications({ type: type.value, unread: unreadOnly.value }) }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '消息加载失败' }
  finally { loading.value = false }
}

async function markRead(item: ForumNotification) {
  if (item.readAt) return
  readingId.value = item.id
  actionError.value = ''
  try {
    await markNotificationRead(item.id)
    item.readAt = new Date().toISOString()
    await refreshUnreadCount()
    await loadUnreadCounts()
    if (unreadOnly.value) notifications.value = notifications.value.filter(notification => notification.id !== item.id)
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '标记已读失败'
  } finally {
    readingId.value = ''
  }
}

async function readAll() {
  readingAll.value = true
  actionError.value = ''
  try {
    await markAllNotificationsRead()
    const now = new Date().toISOString()
    notifications.value.forEach(item => { item.readAt = item.readAt || now })
    unreadCount.value = 0
    unreadCounts.value = {}
    if (unreadOnly.value) notifications.value = []
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '全部已读失败'
  } finally {
    readingAll.value = false
  }
}

async function open(item: ForumNotification) {
  if (!item.readAt) await markRead(item)
  if (item.type === 'BADGE_AWARDED') {
    router.push('/badges')
  } else if ((item.type === 'REPORT_RESULT' || item.type === 'THREAD_LIKE') && item.threadId) {
    router.push(`/threads/${item.threadId}`)
  } else if (item.threadId) {
    router.push({ path: `/threads/${item.threadId}`, hash: `#comment-${item.bizId}` })
  }
}
</script>
