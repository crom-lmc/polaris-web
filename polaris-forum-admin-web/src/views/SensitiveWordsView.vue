<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  createSensitiveWord,
  deleteSensitiveWord,
  fetchSensitiveWordsPage,
  updateSensitiveWord,
  type SensitiveWord
} from '@/api/forum'
import { confirmAction } from '@/utils/confirm'

import { useUserStore } from '@/stores/user'
const words = ref<SensitiveWord[]>([])
const store = useUserStore()
const newWord = ref('')
const loading = ref(false)
const saving = ref(false)
const savingId = ref('')
const totalCount = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
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
  { title: '敏感词', dataIndex: 'word' },
  { title: '状态', key: 'status', width: 120 },
  { title: '创建时间', dataIndex: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 180 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const page = await fetchSensitiveWordsPage({ page: currentPage.value, size: pageSize.value })
    words.value = page.records
    totalCount.value = page.total
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '敏感词加载失败')
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

async function addWord() {
  if (!store.can('forum:sensitive:add')) return
  const value = newWord.value.trim()
  if (!value) {
    message.warning('请输入敏感词')
    return
  }
  saving.value = true
  try {
    await createSensitiveWord(value)
    newWord.value = ''
    message.success('敏感词已新增并启用')
    await load()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '新增失败')
  } finally {
    saving.value = false
  }
}

async function toggleWord(word: SensitiveWord) {
  savingId.value = word.id
  try {
    await updateSensitiveWord(word.id, !word.enabled)
    word.enabled = !word.enabled
    message.success('敏感词状态已更新')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '操作失败')
  } finally {
    savingId.value = ''
  }
}

function removeWord(word: SensitiveWord) {
  confirmAction({
    title: '删除敏感词',
    content: `确认删除敏感词“${word.word}”吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteSensitiveWord(word.id)
        words.value = words.value.filter((item) => item.id !== word.id)
        message.success('敏感词已删除')
        // 删光当前页时回退一页，再按后端总数刷新
        if (!words.value.length && currentPage.value > 1) currentPage.value -= 1
        void load()
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '删除失败')
      }
    }
  })
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>敏感词管理</h1>
      <p>启用后立即用于发布和评论检查，不回溯处理历史内容。</p>
    </header>
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-input v-model:value="newWord" class="filter-input" :maxlength="100" placeholder="输入敏感词" @press-enter="addWord" />
        <a-button v-if="store.can('forum:sensitive:add')" type="primary" :loading="saving" @click="addWord"><PlusOutlined />新增敏感词</a-button>
        <a-button v-if="store.can('forum:sensitive:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !words.length }">
        <a-table :columns="columns" :data-source="words" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'status'"><a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag></template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:sensitive:toggle')" type="link" size="small" :loading="savingId === record.id" @click="toggleWord(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                <a-button v-if="store.can('forum:sensitive:delete')" type="link" size="small" danger @click="removeWord(record)"><DeleteOutlined />删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>
