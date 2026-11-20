<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { fetchAdminCommentsPage, publicThreadUrl, updateAdminComment, type ForumComment } from '@/api/forum'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const comments = ref<ForumComment[]>([])
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
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
const columns = [
  { title: '评论内容', key: 'content', width: 380 },
  { title: '帖子', key: 'thread', width: 100 },
  { title: '作者', key: 'author', width: 140 },
  { title: '状态', key: 'status', width: 100 },
  { title: '时间', key: 'time', width: 170 },
  { title: '操作', key: 'action', width: 100 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const page = await fetchAdminCommentsPage({
      deleted: deleted.value || undefined,
      keyword: keyword.value.trim() || undefined,
      page: currentPage.value,
      size: pageSize.value
    })
    comments.value = page.records
    totalCount.value = page.total
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '评论加载失败')
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

async function changeComment(comment: ForumComment) {
  savingId.value = comment.id
  try {
    const updated = await updateAdminComment(comment.id, !comment.deleted)
    Object.assign(comment, updated)
    message.success(updated.deleted ? '评论已删除' : '评论已恢复')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    savingId.value = ''
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>评论管理</h1>
      <p>筛选评论及回复，删除或恢复公开内容。</p>
    </header>
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-select v-model:value="deleted" class="filter-select" @change="reload">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="false">公开展示</a-select-option>
          <a-select-option value="true">已删除</a-select-option>
        </a-select>
        <a-input v-model:value="keyword" class="filter-input" allow-clear placeholder="搜索评论内容" @press-enter="reload" />
        <a-button v-if="store.can('forum:comment:view')" type="primary" @click="reload"><SearchOutlined />查询</a-button>
        <a-button v-if="store.can('forum:comment:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !comments.length }">
        <a-table :columns="columns" :data-source="comments" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'content'"><div class="content-cell">{{ record.content }}</div></template>
            <template v-else-if="column.key === 'thread'">
              <a v-if="!record.deleted" :href="publicThreadUrl(record.threadId)" target="_blank" rel="noopener noreferrer">#{{ record.threadId }}</a>
              <span v-else>#{{ record.threadId }}</span>
            </template>
            <template v-else-if="column.key === 'author'">{{ record.author?.name || '-' }}</template>
            <template v-else-if="column.key === 'status'"><a-tag :color="record.deleted ? 'red' : 'green'">{{ record.deleted ? '已删除' : '公开' }}</a-tag></template>
            <template v-else-if="column.key === 'time'">{{ record.createdAt || record.time }}</template>
            <template v-else-if="column.key === 'action'">
              <a-button v-if="store.can('forum:comment:delete')" type="link" size="small" :danger="!record.deleted" :loading="savingId === record.id" @click="changeComment(record)">{{ record.deleted ? '恢复' : '删除' }}</a-button>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>
