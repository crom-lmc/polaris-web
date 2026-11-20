<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  fetchAdminThreadsPage,
  fetchBoards,
  publicThreadUrl,
  updateAdminThread,
  type Board,
  type ContentKind,
  type Thread
} from '@/api/forum'
import { confirmAction } from '@/utils/confirm'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const threads = ref<Thread[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const boards = ref<Board[]>([])
const board = ref('')
const deleted = ref('')
const keyword = ref('')
const loading = ref(false)
const savingId = ref('')
// 服务端分页：分页条按后端 total 渲染，翻页/改每页条数都重新请求
const pagination = computed(() => {
  if (!totalCount.value) return false
  return {
    current: currentPage.value,
    pageSize: pageSize.value,
    total: totalCount.value,
    showSizeChanger: true,
    showTotal: (value: number) => `共 ${value} 条`
  }
})
const kindNames: Record<ContentKind, string> = { feed: '动态', topic: '话题', question: '问答', article: '文章' }
const columns = [
  { title: '内容', key: 'content', width: 300 },
  { title: '类型', key: 'kind', width: 80 },
  { title: '作者', key: 'author', width: 110 },
  { title: '点赞', key: 'likes', width: 70 },
  { title: '查看', key: 'views', width: 70 },
  { title: '评论', key: 'replies', width: 70 },
  { title: '状态', key: 'status', width: 220 },
  { title: '发布时间', dataIndex: 'createdAt', width: 150 },
  { title: '操作', key: 'action', width: 300 }
]

onMounted(() => {
  void loadBoards()
  void load()
})

async function loadBoards() {
  try {
    boards.value = await fetchBoards()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '板块加载失败')
  }
}

async function load() {
  loading.value = true
  try {
    const page = await fetchAdminThreadsPage({
      board: board.value || undefined,
      deleted: deleted.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: currentPage.value,
      size: pageSize.value
    })
    threads.value = page.records
    totalCount.value = page.total
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '内容加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  currentPage.value = 1
  void load()
}

function onTableChange(pag: { current?: number; pageSize?: number }) {
  currentPage.value = pag?.current || 1
  pageSize.value = pag?.pageSize || pageSize.value
  void load()
}

async function changeThread(thread: Thread, data: { deleted?: boolean; pinned?: boolean; solved?: boolean; recommended?: boolean }) {
  savingId.value = thread.id
  try {
    Object.assign(thread, await updateAdminThread(thread.id, data))
    message.success('内容状态已更新')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    savingId.value = ''
  }
}

function recommendThread(thread: Thread) {
  const recommended = !thread.recommended
  confirmAction({
    title: recommended ? '推荐内容' : '取消推荐',
    content: `确认${recommended ? '推荐' : '取消推荐'}“${thread.title || thread.excerpt}”吗？`,
    okText: recommended ? '推荐' : '取消推荐',
    onOk: () => changeThread(thread, { recommended })
  })
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>内容管理</h1>
      <p>管理公开内容的置顶、推荐、解决和删除状态，不设置内容审核流程。</p>
    </header>
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-select v-model:value="board" class="filter-select" @change="reload">
          <a-select-option value="">全部板块</a-select-option>
          <a-select-option v-for="item in boards" :key="item.key" :value="item.key">{{ item.name }}</a-select-option>
        </a-select>
        <a-select v-model:value="deleted" class="filter-select" @change="reload">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="false">公开展示</a-select-option>
          <a-select-option value="true">已删除</a-select-option>
        </a-select>
        <a-input v-model:value="keyword" class="filter-input" allow-clear placeholder="搜索标题或正文" @press-enter="reload" />
        <a-button v-if="store.can('forum:content:view')" type="primary" @click="reload"><SearchOutlined />查询</a-button>
        <a-button v-if="store.can('forum:content:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !threads.length }">
        <a-table :columns="columns" :data-source="threads" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'content'">
              <div class="title-cell">
                <a v-if="!record.deleted" :href="publicThreadUrl(record.id)" target="_blank" rel="noopener noreferrer">{{ record.title || record.excerpt }}</a>
                <span v-else>{{ record.title || record.excerpt }}</span>
                <small>#{{ record.id }} · {{ record.board }}</small>
              </div>
            </template>
            <template v-else-if="column.key === 'kind'">{{ kindNames[record.kind as ContentKind] }}</template>
            <template v-else-if="column.key === 'author'">{{ record.author?.name || '-' }}</template>
            <template v-else-if="column.key === 'likes'">{{ record.likes ?? 0 }}</template>
            <template v-else-if="column.key === 'views'">{{ record.views ?? 0 }}</template>
            <template v-else-if="column.key === 'replies'">{{ record.replies ?? 0 }}</template>
            <template v-else-if="column.key === 'status'">
              <a-space :size="4" wrap>
                <a-tag :color="record.deleted ? 'red' : 'green'">{{ record.deleted ? '已删除' : '公开' }}</a-tag>
                <a-tag v-if="record.pinned" color="blue">置顶</a-tag>
                <a-tag v-if="record.recommended" color="gold">推荐</a-tag>
                <a-tag v-if="record.solved" color="purple">已解决</a-tag>
              </a-space>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:content:pin')" type="link" size="small" :disabled="savingId === record.id" @click="changeThread(record, { pinned: !record.pinned })">{{ record.pinned ? '取消置顶' : '置顶' }}</a-button>
                <a-button v-if="store.can('forum:content:recommend')" type="link" size="small" :disabled="savingId === record.id" @click="recommendThread(record)">{{ record.recommended ? '取消推荐' : '推荐' }}</a-button>
                <a-button v-if="store.can('forum:content:solve') && record.kind === 'question'" type="link" size="small" :disabled="savingId === record.id" @click="changeThread(record, { solved: !record.solved })">{{ record.solved ? '取消解决' : '标记解决' }}</a-button>
                <a-button v-if="store.can('forum:content:delete')" type="link" size="small" :danger="!record.deleted" :disabled="savingId === record.id" @click="changeThread(record, { deleted: !record.deleted })">{{ record.deleted ? '恢复' : '删除' }}</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>
