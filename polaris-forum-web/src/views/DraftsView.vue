<template>
  <div class="container drafts-page">
    <section class="editor-heading">
      <div><span class="eyebrow">MY DRAFTS</span><h1>我的草稿</h1><p>草稿保存在服务端，可在不同设备继续编辑和发布。</p></div>
      <RouterLink to="/new" class="primary-button"><plus-outlined />新建内容</RouterLink>
    </section>
    <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
    <p v-if="message" class="form-message success">{{ message }}</p>
    <div v-if="loading" class="panel page-state">正在加载草稿…</div>
    <div v-else-if="!drafts.length" class="panel empty-state"><file-text-outlined /><h3>还没有草稿</h3><p>在发布页面点击“保存草稿”，即可在这里恢复。</p></div>
    <section v-else class="panel draft-list">
      <article v-for="draft in drafts" :key="draft.id" class="draft-row">
        <div class="draft-copy">
          <div><span class="draft-board">{{ draft.board }}</span></div>
          <h2>{{ draft.title || plainText(draft.content).slice(0, 60) || '未命名草稿' }}</h2>
          <p>{{ plainText(draft.content) || '尚未填写正文' }}</p>
          <small>更新于 {{ draft.updatedAt || draft.createdAt }} · {{ draft.attachments?.length || 0 }} 个附件<template v-if="draft.pollConfig"> · 含投票</template></small>
        </div>
        <div class="draft-actions">
          <RouterLink :to="`/new?draftId=${draft.id}`" class="secondary-button"><edit-outlined />继续编辑</RouterLink>
          <button class="secondary-button danger-text" :disabled="deletingId === draft.id" @click="remove(draft)"><delete-outlined />删除</button>
          <button class="primary-button" :disabled="publishingId === draft.id" @click="publish(draft)"><send-outlined />{{ publishingId === draft.id ? '发布中…' : '发布' }}</button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { DeleteOutlined, EditOutlined, FileTextOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons-vue'
import { deleteDraft, fetchDrafts, publishDraft } from '@/api/forum'
import { refreshCurrentUser } from '@/auth'
import { richTextToPlainText as plainText } from '@/utils/html'
import type { ForumDraft } from '@/types'

const router = useRouter()
const drafts = ref<ForumDraft[]>([])
const loading = ref(true)
const deletingId = ref('')
const publishingId = ref('')
const error = ref('')
const message = ref('')

onMounted(load)
async function load() {
  loading.value = true
  error.value = ''
  try { drafts.value = await fetchDrafts() } catch (cause) { error.value = cause instanceof Error ? cause.message : '草稿加载失败' } finally { loading.value = false }
}
async function remove(draft: ForumDraft) {
  if (!window.confirm('确认删除这份草稿吗？')) return
  deletingId.value = draft.id
  error.value = ''
  try {
    await deleteDraft(draft.id)
    drafts.value = drafts.value.filter(item => item.id !== draft.id)
    message.value = '草稿已删除'
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '删除失败' } finally { deletingId.value = '' }
}
async function publish(draft: ForumDraft) {
  publishingId.value = draft.id
  error.value = ''
  message.value = ''
  try {
    const thread = await publishDraft(draft.id)
    await refreshCurrentUser()
    await router.push(`/threads/${thread.id}`)
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '草稿发布失败' } finally { publishingId.value = '' }
}
</script>
