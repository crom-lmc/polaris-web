<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { deleteMedia, pageMedia, uploadMedia, type MediaItem } from '@/api/cms'
import { confirmAction } from '@/utils/confirm'

const loading = ref(false)
const uploading = ref(false)
const list = ref<MediaItem[]>([])
const total = ref(0)
const query = reactive({ keyword: '', page: 1, size: 24 })
const fileInput = ref<HTMLInputElement>()

const columns = [
  { title: '预览', key: 'preview', width: 90 },
  { title: '文件名', dataIndex: 'originalName' },
  { title: '类型', dataIndex: 'contentType', width: 130 },
  { title: '大小', key: 'size', width: 90 },
  { title: '上传人', dataIndex: 'uploadedName', width: 100 },
  { title: '操作', key: 'action', width: 150 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await pageMedia(query)
    list.value = data.list
    total.value = data.total
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function pick() {
  fileInput.value?.click()
}

async function onPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  uploading.value = true
  try {
    for (const f of Array.from(files)) {
      await uploadMedia(f)
    }
    message.success('上传完成')
    await load()
  } catch (e: any) {
    message.error(e?.message || '上传失败')
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

async function copyUrl(m: MediaItem) {
  const url = window.location.origin + m.url
  try {
    await navigator.clipboard.writeText(url)
    message.success('已复制访问地址')
  } catch {
    message.warning('复制失败，请手动复制：' + m.url)
  }
}

const askDelete = (m: MediaItem) =>
  confirmAction({
    title: '删除文件',
    content: `删除「${m.originalName}」？引用它的文章图片会失效。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteMedia(m.id)
        message.success('已删除')
        await load()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })

const isImage = (m: MediaItem) => (m.contentType || m.originalName).toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|ico)$/) !== null
</script>

<template>
  <div class="ft-page">
    <input ref="fileInput" type="file" multiple style="display: none" @change="onPicked" />
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="query.keyword"
        placeholder="文件名"
        style="width: 220px"
        allow-clear
        @search="() => { query.page = 1; load() }"
      />
      <a-button v-if="store.can('media:upload')" :loading="uploading" type="primary" @click="pick">上传文件</a-button>
      <a-button @click="load">刷新</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table" :columns="columns" :data-source="list" :loading="loading" row-key="id"
      :pagination="{ current: query.page, pageSize: query.size, total, showSizeChanger: true,
        showTotal: (t: number) => `共 ${t} 条`,
        onChange: (p: number, s: number) => { query.page = p; query.size = s; load() } }">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'preview'">
          <a-image v-if="isImage(record)" :src="record.url" :width="56" :height="40" style="object-fit: cover" />
          <span v-else class="muted">文件</span>
        </template>
        <template v-else-if="column.key === 'size'">{{ fmtSize(record.size) }}</template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button type="link" size="small" @click="copyUrl(record)">复制地址</a-button>
            <a-button v-if="store.can('media:delete')" type="link" size="small" danger @click="askDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>
  </div>
</template>

<style scoped>
/* 表格最小宽度：横向滚动只发生在 .ft-scroll，操作列由 .ft-table 固定 */
.ft-page {
  --ft-min-width: 900px;
}
.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.muted {
  opacity: 0.6;
  font-size: 12px;
}
</style>
