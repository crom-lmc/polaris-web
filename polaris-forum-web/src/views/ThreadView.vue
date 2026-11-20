<template>
  <div class="container thread-page">
    <div v-if="loading" class="panel page-state">正在加载讨论内容…</div>
    <div v-else-if="error" class="panel page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
    <template v-else-if="thread">
      <div class="breadcrumbs"><RouterLink to="/">首页</RouterLink><span>/</span><RouterLink :to="`/boards/${thread.board}`">{{ boardName }}</RouterLink><span>/</span><span>正文</span></div>
      <div class="thread-detail-layout">
        <article class="panel detail-card">
          <div v-if="thread.solved || thread.reward" class="detail-labels"><span v-if="thread.solved" class="status-tag solved"><check-circle-outlined />已解决</span><span v-if="thread.reward" class="status-tag reward-tag">悬赏 {{ thread.reward }} 积分</span></div>
          <h1 v-if="thread.title">{{ thread.title }}</h1>
          <div class="detail-author-row">
            <RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`" class="avatar-link"><UserAvatar :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" /></RouterLink>
            <UserAvatar v-else :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" />
            <div><RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`" class="author-link"><b>{{ thread.author.name }}</b></RouterLink><b v-else>{{ thread.author.name }}</b><span>{{ thread.author.title }} · {{ formatTime(thread.createdAt) }}</span></div>
            <div class="detail-stats"><span><eye-outlined />{{ thread.views }} 阅读</span><span><message-outlined />{{ thread.replies }} 评论</span></div>
          </div>
          <img v-if="thread.coverUrl" :src="thread.coverUrl" class="thread-cover" alt="文章封面" />
          <RichTextView class="article-body article-rich-text" :content="thread.content || thread.excerpt" />
          <section v-if="thread.attachments?.length" class="thread-attachments">
            <h2><paper-clip-outlined />附件（{{ thread.attachments.length }}）</h2>
            <a v-for="item in thread.attachments" :key="item.id" :href="item.url" target="_blank" rel="noopener"><paper-clip-outlined /><span>{{ item.originalName }}</span><small>{{ formatSize(item.size) }}</small><download-outlined /></a>
          </section>
          <section v-if="thread.poll" class="thread-poll">
            <div class="poll-heading"><h2>投票</h2><span>{{ thread.poll.mode === 'SINGLE' ? '单选' : `多选，最多 ${thread.poll.maxChoices} 项` }} · {{ thread.poll.totalVotes }} 票</span></div>
            <label v-for="option in thread.poll.options" :key="option.id" class="poll-option" :class="{ selected: thread.poll.selectedOptionIds?.includes(option.id) }">
              <input :type="thread.poll.mode === 'SINGLE' ? 'radio' : 'checkbox'" :name="`poll-${thread.poll.id}`" :checked="selectedOptionIds.includes(option.id)" :disabled="thread.poll.voted || voting" @change="selectOption(option.id)" />
              <span class="poll-option-copy"><b>{{ option.text }}</b><i><em :style="{ width: `${votePercent(option.votes, thread.poll.totalVotes)}%` }"></em></i></span>
              <strong>{{ option.votes }} 票</strong>
            </label>
            <div class="poll-footer"><span v-if="thread.poll.voted">你已参与投票，不能修改选票。</span><span v-else>每个账号只能提交一次。</span><button v-if="!thread.poll.voted" class="primary-button" :disabled="voting" @click="submitVote">{{ voting ? '提交中…' : isLoggedIn ? '提交投票' : '登录后投票' }}</button></div>
          </section>
          <div class="article-tags"><RouterLink v-for="tag in thread.tags" :key="tag" :to="`/?q=${encodeURIComponent(tag)}`"># {{ tag }}</RouterLink></div>
          <div class="article-actions">
            <button :class="{ liked: thread.liked }" :disabled="likingThread" @click="likeThread"><like-outlined />{{ thread.liked ? '已点赞' : '点赞' }} {{ thread.likes }}</button>
            <button :class="{ favorited: thread.favorited }" :disabled="favoriting" @click="toggleFavorite"><star-outlined />{{ thread.favorited ? '已收藏' : '收藏' }}</button>
            <button @click="share"><share-alt-outlined />{{ copied ? '链接已复制' : '分享' }}</button>
            <button @click="openReport('thread', thread.id)"><flag-outlined />举报</button>
          </div>
          <p v-if="actionError" class="form-message error" role="alert">{{ actionError }}</p>
        </article>

        <aside class="detail-sidebar">
          <section class="panel author-card">
            <RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`"><UserAvatar class="large" :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" :size="64" /></RouterLink>
            <UserAvatar v-else class="large" :name="thread.author.name" :avatar-url="thread.author.avatarUrl" :initials="thread.author.initials" :color="thread.author.color" :size="64" />
            <h3><RouterLink v-if="authorAccountId" :to="`/members/${authorAccountId}`">{{ thread.author.name }}</RouterLink><template v-else>{{ thread.author.name }}</template></h3><p>{{ thread.author.title }} · SSO 统一账号</p>
          </section>
          <section v-if="related.length" class="panel sidebar-section">
            <div class="panel-heading">同板块讨论</div>
            <RouterLink v-for="item in related" :key="item.id" :to="`/threads/${item.id}`" class="related-link">{{ cleanLiteralEscapes(item.title || item.excerpt) }}<span>{{ item.replies }} 回复</span></RouterLink>
          </section>
        </aside>
      </div>

      <section class="panel comments-card">
        <div class="comments-heading"><h2>全部评论 <span>{{ thread.replies }}</span></h2><span>按时间倒序</span></div>
        <div class="comment-composer">
          <UserAvatar :name="displayName" :avatar-url="currentUser?.member?.avatarUrl" :class="{ guest: !isLoggedIn }" />
          <div class="composer-box">
            <textarea v-model="commentContent" :readonly="!isLoggedIn" maxlength="2000" :placeholder="isLoggedIn ? '分享你的观点，评论成功可获得 5 积分…' : '登录后参与讨论，分享你的观点…'" @focus="!isLoggedIn && requireLogin('评论')" @click="!isLoggedIn && requireLogin('评论')"></textarea>
            <button class="primary-button" :disabled="commenting" @click="submitComment">{{ commenting ? '正在发布…' : isLoggedIn ? '发布评论' : '统一登录后评论' }}</button>
          </div>
        </div>
        <p v-if="commentError" class="form-message error" role="alert">{{ commentError }}</p>
        <div v-if="!comments.length" class="comments-more">还没有评论，来分享第一个观点吧。</div>
        <div v-for="comment in comments" :id="`comment-${comment.id}`" :key="comment.id" class="comment-thread">
          <ForumCommentItem :comment="comment" :thread-author-id="thread.authorAccountId" :can-reply="!comment.deleted" :liking="likingCommentId === comment.id" @like="likeComment" @reply="openReply" @report="openCommentReport" />
          <div v-if="replyingTo?.id === comment.id" class="reply-composer">
            <div class="reply-composer-heading">回复 <b>{{ comment.author.name }}</b><button @click="closeReply">取消</button></div>
            <textarea v-model="replyContent" maxlength="2000" placeholder="写下你的回复…"></textarea>
            <button class="primary-button" :disabled="replying" @click="submitReply">{{ replying ? '正在回复…' : '发布回复' }}</button>
          </div>
          <div v-if="comment.replies?.length" class="comment-replies">
            <ForumCommentItem v-for="reply in comment.replies" :id="`comment-${reply.id}`" :key="reply.id" :comment="reply" :thread-author-id="thread.authorAccountId" :liking="likingCommentId === reply.id" @like="likeComment" @report="openCommentReport" />
          </div>
        </div>
      </section>
    </template>
    <Teleport to="body">
      <div v-if="reportTarget" class="modal-mask" @click.self="closeReport">
        <section class="login-dialog report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
          <button class="dialog-close" aria-label="关闭" :disabled="reporting" @click="closeReport"><close-outlined /></button>
          <template v-if="reportSuccess">
            <div class="login-symbol report-success-symbol"><check-circle-outlined /></div>
            <h2 id="report-title">举报已提交</h2>
            <p>感谢你的反馈，社区管理人员会尽快核实处理。内容不会因提交举报而自动隐藏。</p>
            <button class="primary-button login-submit" @click="closeReport">完成</button>
          </template>
          <template v-else>
            <div class="login-symbol"><flag-outlined /></div>
            <h2 id="report-title">举报{{ reportTarget.targetType === 'thread' ? '帖子' : '评论' }}</h2>
            <p>请选择举报原因，并可补充具体说明。</p>
            <form @submit.prevent="submitReport">
              <label class="form-label" for="report-reason">举报原因 <span>必填</span></label>
              <select id="report-reason" v-model="reportReason" class="form-control" required>
                <option value="" disabled>请选择举报原因</option>
                <option v-for="reason in reportReasons" :key="reason" :value="reason">{{ reason }}</option>
              </select>
              <label class="form-label" for="report-detail">补充说明 <span>选填，最多 1000 字</span></label>
              <textarea id="report-detail" v-model="reportDetail" class="report-detail-input" maxlength="1000" placeholder="请描述需要社区管理人员核实的情况…"></textarea>
              <p v-if="reportError" class="form-message error" role="alert">{{ reportError }}</p>
              <button class="primary-button login-submit report-submit" type="submit" :disabled="reporting">{{ reporting ? '正在提交…' : '提交举报' }}</button>
            </form>
          </template>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CheckCircleOutlined, CloseOutlined, DownloadOutlined, EyeOutlined, FlagOutlined, LikeOutlined, MessageOutlined, PaperClipOutlined, ShareAltOutlined, StarOutlined } from '@ant-design/icons-vue'
import ForumCommentItem from '@/components/ForumCommentItem.vue'
import RichTextView from '@/components/RichTextView.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { createComment, createReport, favoriteThread, fetchComments, fetchThread, fetchThreadsPage, toggleLike, unfavoriteThread, vote } from '@/api/forum'
import { boards, formatTime } from '@/data/forum'
import { currentUser, isLoggedIn, refreshCurrentUser, refreshUnreadCount, requireLogin } from '@/auth'
import { cleanLiteralEscapes } from '@/utils/html'
import type { ForumComment, ReportTargetType, Thread } from '@/types'

const route = useRoute()
const router = useRouter()
const thread = ref<Thread | null>(null)
const comments = ref<ForumComment[]>([])
const related = ref<Thread[]>([])
const loading = ref(true)
const error = ref('')
const actionError = ref('')
const commentError = ref('')
const commentContent = ref('')
const commenting = ref(false)
const replyingTo = ref<ForumComment | null>(null)
const replyContent = ref('')
const replying = ref(false)
const likingThread = ref(false)
const favoriting = ref(false)
const likingCommentId = ref('')
const copied = ref(false)
const selectedOptionIds = ref<string[]>([])
const voting = ref(false)
const reportTarget = ref<{ targetType: ReportTargetType; targetId: string } | null>(null)
const reportReason = ref('')
const reportDetail = ref('')
const reportReasons = ['垃圾广告', '违法违规', '人身攻击', '不实信息', '其他']
const reporting = ref(false)
const reportError = ref('')
const reportSuccess = ref(false)
const boardName = computed(() => boards.find(item => item.key === thread.value?.board)?.name || thread.value?.board || '')
const authorAccountId = computed(() => thread.value?.author.accountId || thread.value?.authorAccountId)
const displayName = computed(() => currentUser.value?.member?.nickname || currentUser.value?.username || '?')

watch(() => route.params.id, load, { immediate: true })
watch(() => route.hash, () => nextTick(scrollToComment))

async function load() {
  const id = String(route.params.id || '')
  if (!/^[1-9]\d*$/.test(id)) {
    loading.value = false
    error.value = '内容编号不正确'
    return
  }
  loading.value = true
  error.value = ''
  actionError.value = ''
  commentError.value = ''
  thread.value = null
  comments.value = []
  related.value = []
  replyingTo.value = null
  reportTarget.value = null
  selectedOptionIds.value = []
  try {
    const [detail, commentList] = await Promise.all([fetchThread(id), fetchComments(id)])
    thread.value = detail
    // 顶部栏目导航按 query.board 高亮；进入详情后同步帖子所属栏目，使其定位到对应一级栏目
    if (detail.board && String(route.query.board || '') !== detail.board) {
      await router.replace({ query: { ...route.query, board: detail.board } })
    }
    selectedOptionIds.value = [...(detail.poll?.selectedOptionIds || [])]
    comments.value = commentList
    // 相关推荐取前 6 条摘要即可（过滤掉当前文章后取 3 条），不再拉全量正文
    const page = await fetchThreadsPage({ board: detail.board, size: 6 })
    related.value = page.records.filter(item => item.id !== id).slice(0, 3)
    await nextTick(scrollToComment)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '内容加载失败'
  } finally {
    loading.value = false
  }
}

function scrollToComment() {
  if (!route.hash.startsWith('#comment-')) return
  document.getElementById(decodeURIComponent(route.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

async function likeThread() {
  if (!thread.value || !requireLogin('点赞')) return
  likingThread.value = true
  actionError.value = ''
  try {
    const result = await toggleLike('thread', thread.value.id)
    thread.value.liked = result.liked
    thread.value.likes = result.likes
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '点赞失败'
  } finally {
    likingThread.value = false
  }
}

async function toggleFavorite() {
  if (!thread.value || !requireLogin('收藏帖子')) return
  favoriting.value = true
  actionError.value = ''
  try {
    if (thread.value.favorited) await unfavoriteThread(thread.value.id)
    else await favoriteThread(thread.value.id)
    thread.value.favorited = !thread.value.favorited
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '收藏操作失败'
  } finally {
    favoriting.value = false
  }
}

async function likeComment(comment: ForumComment) {
  if (!requireLogin('点赞评论')) return
  likingCommentId.value = comment.id
  commentError.value = ''
  try {
    const result = await toggleLike('comment', comment.id)
    comment.liked = result.liked
    comment.likes = result.likes
  } catch (cause) {
    commentError.value = cause instanceof Error ? cause.message : '点赞失败'
  } finally {
    likingCommentId.value = ''
  }
}

async function submitComment() {
  if (!thread.value || !requireLogin('评论')) return
  const content = commentContent.value.trim()
  if (!content) {
    commentError.value = '请输入评论内容'
    return
  }
  commenting.value = true
  commentError.value = ''
  try {
    const comment = await createComment(thread.value.id, content)
    comments.value.unshift(comment)
    thread.value.replies += 1
    commentContent.value = ''
    await Promise.all([refreshCurrentUser(), refreshUnreadCount()])
  } catch (cause) {
    commentError.value = cause instanceof Error ? cause.message : '评论发布失败'
  } finally {
    commenting.value = false
  }
}

function openReply(comment: ForumComment) {
  if (!requireLogin('回复评论')) return
  replyingTo.value = comment
  replyContent.value = ''
  commentError.value = ''
}

function closeReply() {
  replyingTo.value = null
  replyContent.value = ''
}

async function submitReply() {
  const parent = replyingTo.value
  if (!thread.value || !parent || !requireLogin('回复评论')) return
  const content = replyContent.value.trim()
  if (!content) {
    commentError.value = '请输入回复内容'
    return
  }
  replying.value = true
  commentError.value = ''
  try {
    const reply = await createComment(thread.value.id, content, parent.id)
    parent.replies = [...(parent.replies || []), reply]
    thread.value.replies += 1
    closeReply()
    await Promise.all([refreshCurrentUser(), refreshUnreadCount()])
  } catch (cause) {
    commentError.value = cause instanceof Error ? cause.message : '回复发布失败'
  } finally {
    replying.value = false
  }
}

function selectOption(optionId: string) {
  const poll = thread.value?.poll
  if (!poll || poll.voted) return
  if (poll.mode === 'SINGLE') {
    selectedOptionIds.value = [optionId]
    return
  }
  if (selectedOptionIds.value.includes(optionId)) {
    selectedOptionIds.value = selectedOptionIds.value.filter(id => id !== optionId)
  } else if (selectedOptionIds.value.length < poll.maxChoices) {
    selectedOptionIds.value = [...selectedOptionIds.value, optionId]
  } else {
    actionError.value = `最多选择 ${poll.maxChoices} 项`
  }
}

async function submitVote() {
  if (!thread.value?.poll || !requireLogin('参与投票')) return
  if (!selectedOptionIds.value.length) {
    actionError.value = '请至少选择一个选项'
    return
  }
  voting.value = true
  actionError.value = ''
  try {
    thread.value = await vote(thread.value.id, selectedOptionIds.value)
    selectedOptionIds.value = [...(thread.value.poll?.selectedOptionIds || [])]
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : '投票失败'
  } finally {
    voting.value = false
  }
}

function votePercent(votes: number, total: number) {
  return total > 0 ? Math.round(votes * 100 / total) : 0
}

function formatSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.ceil(size / 1024))}KB`
}

async function share() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    window.setTimeout(() => { copied.value = false }, 1600)
  } catch {
    actionError.value = '无法访问剪贴板，请手动复制浏览器地址'
  }
}

function openReport(targetType: ReportTargetType, targetId: string) {
  if (!requireLogin('举报内容')) return
  reportTarget.value = { targetType, targetId }
  reportReason.value = ''
  reportDetail.value = ''
  reportError.value = ''
  reportSuccess.value = false
}

function openCommentReport(comment: ForumComment) {
  openReport('comment', comment.id)
}

function closeReport() {
  if (!reporting.value) reportTarget.value = null
}

async function submitReport() {
  if (!reportTarget.value || !requireLogin('举报内容')) return
  const reason = reportReason.value.trim()
  if (!reason) {
    reportError.value = '请选择举报原因'
    return
  }
  reporting.value = true
  reportError.value = ''
  try {
    await createReport({ ...reportTarget.value, reason, detail: reportDetail.value.trim() })
    reportSuccess.value = true
  } catch (cause) {
    reportError.value = cause instanceof Error ? cause.message : '举报提交失败，请稍后重试'
  } finally {
    reporting.value = false
  }
}
</script>
