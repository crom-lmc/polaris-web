<template>
  <div class="container editor-page">
    <div class="breadcrumbs"><RouterLink to="/">首页</RouterLink><span>/</span><span>{{ config.heading }}</span></div>
    <section class="editor-heading">
      <div><span class="eyebrow">{{ config.eyebrow }}</span><h1>{{ config.heading }}</h1><p>{{ config.description }}</p></div>
      <button class="secondary-button" :disabled="submitting || savingDraft" @click="preview = !preview">{{ preview ? '返回编辑' : '预览' }}</button>
    </section>
    <div class="editor-layout">
      <section class="panel editor-card">
        <p v-if="loadingDraft" class="form-hint">正在恢复服务端草稿…</p>
        <template v-if="!preview">
          <template v-if="contentType !== 'feed'">
            <label class="form-label">{{ contentType === 'question' ? '问题标题' : contentType === 'article' ? '文章标题' : '话题标题' }}<span>{{ title.length }} / 80</span></label>
            <input v-model="title" class="form-control" maxlength="80" :placeholder="config.titlePlaceholder" />
          </template>
          <template v-if="contentType === 'article'">
            <label class="form-label">文章封面<span>发布后展示在文章列表和详情</span></label>
            <AttachmentUploader v-model="coverAttachments" usage-type="COVER" :disabled="submitting || savingDraft" @error="error = $event" />
          </template>
          <label class="form-label">{{ contentType === 'feed' ? '动态内容' : '正文内容' }}<span>{{ contentText.length }} / {{ contentType === 'feed' ? 5000 : 50000 }}</span></label>
          <RichTextEditor :key="contentType" v-model="content" class="content-editor" :class="{ 'feed-editor': contentType === 'feed', 'article-editor': contentType === 'article' }" :disabled="submitting || savingDraft" :placeholder="config.contentPlaceholder" />

          <div v-if="contentType === 'question'" class="question-reward">
            <label class="form-label">悬赏积分<span>0 表示不悬赏，发布后会额外获得 20 积分</span></label>
            <div><thunderbolt-outlined /><input v-model.number="reward" type="number" min="0" max="10000" class="form-control" /><span>积分</span></div>
          </div>

          <label class="form-label">内容标签<span>可选择后台预设标签，也可自行输入，逗号分隔，最多 5 个，每个不超过 20 字</span></label>
          <div v-if="presetTags.length" class="preset-tags">
            <button
              v-for="tag in presetTags"
              :key="tag.name"
              type="button"
              class="preset-tag"
              :class="{ selected: tagList().includes(tag.name) }"
              @click="toggleTag(tag.name)"
            >{{ tag.name }}</button>
          </div>
          <input v-model="tags" class="form-control" placeholder="输入自定义标签，例如：Vue 3，工程化，性能优化" />

          <label class="form-label">附件<span>附件随草稿保存，发布后可公开下载</span></label>
          <AttachmentUploader v-model="attachments" :disabled="submitting || savingDraft" @error="error = $event" />

          <template v-if="contentType === 'feed' || contentType === 'topic'">
            <label class="form-label">投票<span>支持单选和多选</span></label>
            <PollEditor v-model="poll" :disabled="submitting || savingDraft" />
          </template>
        </template>
        <div v-else class="post-preview">
          <span class="board-name">{{ config.nav }}</span>
          <h1 v-if="contentType !== 'feed'">{{ title || config.titlePlaceholder }}</h1>
          <RichTextView class="article-body" :content="content" />
          <p v-if="!contentText" class="muted">正文预览将在这里显示。</p>
          <div v-if="attachments.length" class="preview-attachments"><b>附件</b><span v-for="item in attachments" :key="item.id">{{ item.originalName }}</span></div>
          <div v-if="poll" class="preview-poll"><b>投票（{{ poll.mode === 'SINGLE' ? '单选' : `多选，最多 ${poll.maxChoices} 项` }}）</b><span v-for="(option, index) in poll.options" :key="index">{{ index + 1 }}. {{ option }}</span></div>
          <span v-if="contentType === 'question' && reward" class="preview-reward">悬赏 {{ reward }} 积分</span>
        </div>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success">{{ message }}</p>
        <p v-if="contentType === 'question'" class="form-hint">当前可用积分：{{ currentUser?.member.points.toLocaleString() || '登录后查看' }}，悬赏会在发布时扣除。</p>
        <div class="editor-actions">
          <RouterLink :to="config.path" class="cancel-button">取消</RouterLink>
          <RouterLink to="/drafts" class="secondary-button">我的草稿</RouterLink>
          <button class="secondary-button" :disabled="submitting || savingDraft || loadingDraft" @click="saveDraft"><save-outlined />{{ savingDraft ? '正在保存…' : '保存草稿' }}</button>
          <button class="primary-button" :disabled="submitting || savingDraft || loadingDraft" @click="submit"><send-outlined />{{ submitting ? '正在发布…' : config.action }}</button>
        </div>
      </section>
      <aside class="editor-sidebar">
        <section class="panel sidebar-section"><div class="panel-heading"><edit-outlined />{{ config.nav }}建议</div><ol class="writing-tips"><li v-for="tip in config.tips" :key="tip">{{ tip }}</li></ol></section>
        <section class="panel sso-tip"><safety-certificate-outlined /><div><b>统一账号发布</b><p>草稿保存在服务端，可跨设备恢复。发布和评论会检查敏感词，命中后将直接阻止。</p></div></section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditOutlined, SafetyCertificateOutlined, SaveOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { createDraft, createThread, fetchDraft, publishDraft, updateDraft, type ThreadInput } from '@/api/forum'
import { loadBoards, collectAllTags } from '@/data/forum'
import type { ForumTag } from '@/types'
import { currentUser, refreshCurrentUser, requireLogin } from '@/auth'
import AttachmentUploader from '@/components/AttachmentUploader.vue'
import PollEditor from '@/components/PollEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import RichTextView from '@/components/RichTextView.vue'
import { richTextToPlainText } from '@/utils/html'
import type { ContentKind, ForumAttachment, PollInput } from '@/types'

const contentConfigs = {
  feed: { path: '/feed', nav: '动态', heading: '发布动态', eyebrow: 'CREATE MOMENT', action: '发布动态', description: '不必长篇大论，记录此刻真实的想法。', titlePlaceholder: '', contentPlaceholder: '请输入你想分享的动态内容…', tips: ['分享真实、友善的内容', '使用标签帮助成员发现内容', '清楚表达当前的想法或进展', '注意保护个人与他人隐私'] },
  topic: { path: '/topics', nav: '话题', heading: '发起一个新话题', eyebrow: 'CREATE TOPIC', action: '发布话题', description: '清晰的标题和完整的背景，会让讨论更有价值。', titlePlaceholder: '用一句话说清楚你想讨论什么', contentPlaceholder: '描述话题背景、你的观点，以及希望与大家讨论的内容…', tips: ['标题具体，避免含义不清', '补充必要背景和上下文', '代码和日志注意隐藏敏感信息', '选择合适的板块和标签'] },
  question: { path: '/questions', nav: '问答', heading: '提出一个问题', eyebrow: 'ASK QUESTION', action: '发布问题', description: '说明已尝试的方法，让热心成员更快帮到你。', titlePlaceholder: '用一句话描述你遇到的问题', contentPlaceholder: '描述问题现象、预期结果、已经尝试过的方法和关键报错…', tips: ['优先搜索是否已有相似问题', '提供最小复现步骤和关键报错', '说明预期结果与实际结果', '可使用积分悬赏优质回答'] },
  article: { path: '/articles', nav: '文章', heading: '发布一篇文章', eyebrow: 'CREATE ARTICLE', action: '发布文章', description: '系统地沉淀知识，让经验被更多人看见。', titlePlaceholder: '为文章起一个准确、清晰的标题', contentPlaceholder: '从这里开始撰写完整内容…', tips: ['用清晰结构组织完整内容', '重要结论配合实例说明', '引用外部内容注明来源', '添加准确的标签提升可读性'] }
} as const

const route = useRoute()
const router = useRouter()
const contentType = computed<ContentKind>(() => {
  const value = String(route.query.type || 'topic') as ContentKind
  return Object.prototype.hasOwnProperty.call(contentConfigs, value) ? value : 'topic'
})
const config = computed(() => contentConfigs[contentType.value])
// 社区板块概念已移除，所有新内容统一归入默认板块，分类完全交给标签
const board = ref('general')
const presetTags = ref<ForumTag[]>([])
const title = ref('')
const content = ref('')
const tags = ref('')
const reward = ref(0)
const attachments = ref<ForumAttachment[]>([])
const coverAttachments = ref<ForumAttachment[]>([])
const poll = ref<PollInput | null>(null)
const draftId = ref('')
const loadingDraft = ref(false)
const preview = ref(false)
const submitting = ref(false)
const savingDraft = ref(false)
const error = ref('')
const message = ref('')
const contentText = computed(() => richTextToPlainText(content.value))

watch(contentType, () => {
  preview.value = false
  error.value = ''
  message.value = ''
  if (!loadingDraft.value && contentType.value !== 'question') reward.value = 0
})
watch(() => route.query.draftId, loadDraft, { immediate: true })

onMounted(async () => {
  // 预设标签由后台维护，前台只负责聚合展示供发帖时点选
  try {
    presetTags.value = await collectAllTags()
  } catch {
    presetTags.value = []
  }
})

function tagList() {
  return [...new Set(tags.value.split(/[,，]/).map(item => item.trim().replace(/^#/, '')).filter(Boolean))]
}

/** 点选预设标签：已选则移除，未选则追加，超过 5 个时保持原样（与提交校验一致） */
function toggleTag(name: string) {
  const current = tagList()
  if (current.includes(name)) {
    tags.value = current.filter(item => item !== name).join('，')
  } else if (current.length < 5) {
    tags.value = [...current, name].join('，')
  }
}

function payload(): ThreadInput {
  return {
    kind: contentType.value,
    board: board.value,
    title: title.value.trim(),
    content: content.value.trim(),
    tags: tagList(),
    reward: contentType.value === 'question' ? Number(reward.value) || 0 : 0,
    attachmentIds: attachments.value.map(item => item.id),
    coverAttachmentId: contentType.value === 'article' ? coverAttachments.value[0]?.id : undefined,
    poll: (contentType.value === 'feed' || contentType.value === 'topic') && poll.value ? {
      mode: poll.value.mode,
      maxChoices: poll.value.mode === 'SINGLE' ? 1 : Number(poll.value.maxChoices),
      options: poll.value.options.map(item => item.trim())
    } : undefined
  }
}

function validate(input: ThreadInput) {
  if (input.kind !== 'feed' && !input.title) return '请输入标题'
  const contentLength = richTextToPlainText(input.content).length
  if (!contentLength) return '请输入正文内容'
  const maxContent = input.kind === 'feed' ? 5000 : 50000
  if (contentLength > maxContent) return `正文内容不能超过 ${maxContent} 个字符`
  if (input.tags.length > 5 || input.tags.some(item => item.length > 20)) return '标签最多 5 个，每个不能超过 20 个字符'
  if (!Number.isInteger(input.reward) || input.reward < 0 || input.reward > 10000) return '悬赏积分应为 0-10000 的整数'
  if (input.poll) {
    if (input.poll.options.length < 2 || input.poll.options.length > 10 || input.poll.options.some(item => !item)) return '投票需要 2～10 个非空选项'
    if (input.poll.mode === 'MULTIPLE' && (!Number.isInteger(input.poll.maxChoices) || input.poll.maxChoices < 2 || input.poll.maxChoices > input.poll.options.length)) return '多选上限应为 2 到选项总数之间的整数'
  }
  return ''
}

async function loadDraft() {
  const id = String(route.query.draftId || '')
  if (!id) return
  if (!requireLogin('恢复草稿')) return
  loadingDraft.value = true
  error.value = ''
  try {
    const draft = await fetchDraft(id)
    if (draft.publishedThreadId) {
      await router.replace(`/threads/${draft.publishedThreadId}`)
      return
    }
    draftId.value = draft.id
    if (route.query.type !== draft.kind) await router.replace({ query: { ...route.query, type: draft.kind } })
    title.value = draft.title || ''
    content.value = draft.content || ''
    tags.value = (draft.tags || []).join('，')
    reward.value = draft.reward || 0
    attachments.value = (draft.attachments || []).filter(item => item.usageType === 'ATTACHMENT')
    coverAttachments.value = (draft.attachments || []).filter(item => item.usageType === 'COVER' || item.id === draft.coverAttachmentId).slice(0, 1)
    poll.value = draft.pollConfig ? { mode: draft.pollConfig.mode, maxChoices: draft.pollConfig.maxChoices, options: [...draft.pollConfig.options] } : null
    message.value = `已恢复 ${draft.updatedAt || ''} 保存的草稿`
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '草稿恢复失败'
  } finally {
    loadingDraft.value = false
  }
}

async function saveDraft() {
  error.value = ''
  message.value = ''
  if (!requireLogin('保存草稿')) return
  savingDraft.value = true
  try {
    const input = payload()
    const draft = draftId.value ? await updateDraft(draftId.value, input) : await createDraft(input)
    draftId.value = draft.id
    if (!route.query.draftId) await router.replace({ query: { ...route.query, draftId: String(draft.id) } })
    message.value = '草稿已保存到服务端'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '草稿保存失败'
  } finally {
    savingDraft.value = false
  }
}

async function submit() {
  error.value = ''
  message.value = ''
  if (!requireLogin(config.value.action)) return
  const input = payload()
  const validationError = validate(input)
  if (validationError) {
    error.value = validationError
    return
  }
  submitting.value = true
  try {
    if (draftId.value) await updateDraft(draftId.value, input)
    const thread = draftId.value ? await publishDraft(draftId.value) : await createThread(input)
    await Promise.all([loadBoards(), refreshCurrentUser()])
    await router.push(`/threads/${thread.id}`)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '发布失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>
