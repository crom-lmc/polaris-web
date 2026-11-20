<template>
  <div class="container editor-page">
    <div class="breadcrumbs"><RouterLink to="/">首页</RouterLink><span>/</span><span>发布内容</span><button class="breadcrumb-preview" :disabled="submitting || savingDraft" @click="preview = !preview">{{ preview ? '返回编辑' : '预览' }}</button></div>
    <div class="editor-layout">
      <section class="panel editor-card">
        <p v-if="loadingDraft" class="form-hint">正在恢复服务端草稿…</p>
        <template v-if="!preview">
          <label class="form-label">一级栏目<span>选择帖子所属栏目，仅可从已有栏目中选择</span></label>
          <div class="board-picker">
            <button v-for="item in boardList" :key="item.key" type="button" class="board-picker-item" :class="{ active: board === item.key }" @click="selectBoard(item.key)">{{ item.name }}</button>
            <span v-if="!boardList.length" class="form-hint">栏目加载中或暂无可用栏目</span>
          </div>

          <label class="form-label">二级栏目<span>选择「{{ selectedBoardName }}」下的栏目，仅可从已有栏目中选择</span></label>
          <div class="board-picker column-picker">
            <button v-for="tag in currentBoardTags" :key="tag.key" type="button" class="board-picker-item" :class="{ active: columnTag === tag.name }" @click="columnTag = columnTag === tag.name ? '' : tag.name">{{ tag.name }}</button>
            <span v-if="!currentBoardTags.length" class="form-hint">该栏目暂无二级栏目</span>
          </div>

          <div class="column-summary"><span>一级栏目：<b>{{ selectedBoardName }}</b></span><span>二级栏目：<b>{{ columnTag || '未选择' }}</b></span><small>选中的栏目将自动带入，发布时不可更改</small></div>

          <label class="form-label">标题<span>{{ title.length }} / 80</span></label>
          <input v-model="title" class="form-control" maxlength="80" placeholder="用一句话概括你想分享的内容" />
          <label class="form-label">正文内容<span>{{ contentText.length }} / 50000</span></label>
          <RichTextEditor v-model="content" class="content-editor" :disabled="submitting || savingDraft" placeholder="从这里开始撰写内容…" />

          <label class="form-label">内容标签<span>可搜索选择后台预设标签，也可自行输入，最多 5 个，每个不超过 20 字</span></label>
          <TagSearchSelect v-model="tags" :options="allTagNames" />

          <label class="form-label">附件<span>附件随草稿保存，发布后可公开下载</span></label>
          <AttachmentUploader v-model="attachments" :disabled="submitting || savingDraft" @error="error = $event" />

          <label class="form-label">投票<span>支持单选和多选</span></label>
          <PollEditor v-model="poll" :disabled="submitting || savingDraft" />
        </template>
        <div v-else class="post-preview">
          <h1>{{ title || '未命名内容' }}</h1>
          <RichTextView class="article-body" :content="content" />
          <p v-if="!contentText" class="muted">正文预览将在这里显示。</p>
          <div v-if="attachments.length" class="preview-attachments"><b>附件</b><span v-for="item in attachments" :key="item.id">{{ item.originalName }}</span></div>
          <div v-if="poll" class="preview-poll"><b>投票（{{ poll.mode === 'SINGLE' ? '单选' : `多选，最多 ${poll.maxChoices} 项` }}）</b><span v-for="(option, index) in poll.options" :key="index">{{ index + 1 }}. {{ option }}</span></div>
        </div>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p v-if="message" class="form-message success">{{ message }}</p>
        <div class="editor-actions">
          <RouterLink to="/" class="cancel-button">取消</RouterLink>
          <RouterLink to="/drafts" class="secondary-button">我的草稿</RouterLink>
          <button class="secondary-button" :disabled="submitting || savingDraft || loadingDraft" @click="saveDraft"><save-outlined />{{ savingDraft ? '正在保存…' : '保存草稿' }}</button>
          <button class="primary-button" :disabled="submitting || savingDraft || loadingDraft" @click="submit"><send-outlined />{{ submitting ? '正在发布…' : '发布' }}</button>
        </div>
      </section>
      <aside class="editor-sidebar">
        <section class="panel sidebar-section"><div class="panel-heading"><edit-outlined />发布建议</div><ol class="writing-tips"><li v-for="tip in writingTips" :key="tip">{{ tip }}</li></ol></section>
        <section class="panel sso-tip"><safety-certificate-outlined /><div><b>统一账号发布</b><p>草稿保存在服务端，可跨设备恢复。发布和评论会检查敏感词，命中后将直接阻止。</p></div></section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditOutlined, SafetyCertificateOutlined, SaveOutlined, SendOutlined } from '@ant-design/icons-vue'
import { createDraft, createThread, fetchBoards, fetchDraft, publishDraft, updateDraft, type ThreadInput } from '@/api/forum'
import { collectAllTags, loadBoards } from '@/data/forum'
import type { Board, ForumTag } from '@/types'
import { refreshCurrentUser, requireLogin } from '@/auth'
import AttachmentUploader from '@/components/AttachmentUploader.vue'
import PollEditor from '@/components/PollEditor.vue'
import RichTextEditor from '@/components/RichTextEditor.vue'
import RichTextView from '@/components/RichTextView.vue'
import TagSearchSelect from '@/components/TagSearchSelect.vue'
import { richTextToPlainText } from '@/utils/html'
import type { ForumAttachment, PollInput } from '@/types'

const writingTips = [
  '标题具体清晰，让人一眼知道内容主题',
  '正文结构完整，重要结论配合实例说明',
  '使用标签帮助成员发现内容',
  '引用外部内容注明来源，注意保护隐私'
]

const route = useRoute()
const router = useRouter()
// 内容类型概念已移除，所有新内容统一为帖子，kind 固定 topic（后端既有值，无需改动）
const boardList = ref<Board[]>([])
// 一级栏目即 board（帖子归属）；二级栏目为该一级板块下的二级板块（单选，仅可选已有）；内容标签可搜索/自定义
const board = ref('general')
const columnTag = ref('')
const allPresetTags = ref<ForumTag[]>([])
const selectedBoardName = computed(() => boardList.value.find(item => item.key === board.value)?.name || '所选栏目')
const currentBoardTags = computed(() => boardList.value.find(item => item.key === board.value)?.children || [])
const allTagNames = computed(() => [...new Set([...allPresetTags.value.map(tag => tag.name), ...boardList.value.flatMap(item => (item.tags || []).map(tag => tag.name))])])
const title = ref('')
const content = ref('')
const tags = ref('')
const attachments = ref<ForumAttachment[]>([])
const poll = ref<PollInput | null>(null)
const draftId = ref('')
const loadingDraft = ref(false)
const preview = ref(false)
const submitting = ref(false)
const savingDraft = ref(false)
const error = ref('')
const message = ref('')
const contentText = computed(() => richTextToPlainText(content.value))

watch(() => route.query.draftId, loadDraft, { immediate: true })

onMounted(async () => {
  // 一级栏目、二级栏目、预设标签都由后台维护，前台只负责加载展示
  try {
    boardList.value = await fetchBoards()
  } catch {
    boardList.value = []
  }
  try {
    allPresetTags.value = await collectAllTags()
  } catch {
    allPresetTags.value = []
  }
  // 默认选中第一个可用栏目（后台没配 general 时避免落空）
  if (boardList.value.length && !boardList.value.some(item => item.key === board.value)) {
    board.value = boardList.value[0].key
  }
})

function selectBoard(key: string) {
  if (board.value === key) return
  board.value = key
  // 切换一级栏目后清空二级栏目，避免串栏目
  columnTag.value = ''
}

function tagList() {
  return [...new Set(tags.value.split(/[,，]/).map(item => item.trim().replace(/^#/, '')).filter(Boolean))]
}

function payload(): ThreadInput {
  // 二级栏目作为帖子的一个标签写入，首页按栏目筛选时可命中；内容标签仍可自定义
  const finalTags = [...new Set([...(columnTag.value ? [columnTag.value] : []), ...tagList()])]
  return {
    kind: 'topic',
    board: board.value,
    title: title.value.trim(),
    content: content.value.trim(),
    tags: finalTags,
    reward: 0,
    attachmentIds: attachments.value.map(item => item.id),
    poll: poll.value ? {
      mode: poll.value.mode,
      maxChoices: poll.value.mode === 'SINGLE' ? 1 : Number(poll.value.maxChoices),
      options: poll.value.options.map(item => item.trim())
    } : undefined
  }
}

function validate(input: ThreadInput) {
  if (!input.title) return '请输入标题'
  const contentLength = richTextToPlainText(input.content).length
  if (!contentLength) return '请输入正文内容'
  if (contentLength > 50000) return '正文内容不能超过 50000 个字符'
  if (input.tags.length > 5 || input.tags.some(item => item.length > 20)) return '标签最多 5 个，每个不能超过 20 个字符'
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
    board.value = draft.board || board.value
    title.value = draft.title || ''
    content.value = draft.content || ''
    const restored = draft.tags || []
    const presetNames = (boardList.value.find(item => item.key === board.value)?.children || []).map(child => child.name)
    const matched = restored.find(tag => presetNames.includes(tag))
    columnTag.value = matched || ''
    tags.value = restored.filter(tag => tag !== matched).join('，')
    attachments.value = (draft.attachments || []).filter(item => item.usageType === 'ATTACHMENT')
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
  if (!requireLogin('发布内容')) return
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
