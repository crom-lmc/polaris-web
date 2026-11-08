<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createTag, deleteTag, listTags, renameTag, type TaxonomyItem } from '@/api/cms'
import { confirmAction } from '@/utils/confirm'

const loading = ref(false)
const keyword = ref('')
const list = ref<TaxonomyItem[]>([])
const open = ref(false)
const editing = ref<TaxonomyItem | null>(null)
const form = reactive({ name: '' })

const columns = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '标签名', dataIndex: 'name' },
  { title: '文章数', dataIndex: 'articleCount', width: 110 },
  { title: '操作', key: 'action', width: 160 }
]

const page = ref(1)
const pageSize = ref(10)
/** 接口返回全量列表，这里做前端分页；分页条由 ft-bottom 固定到滚动容器底部 */
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: list.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))
function onTableChange(pag: any) {
  page.value = pag?.current || 1
  pageSize.value = pag?.pageSize || pageSize.value
}

onMounted(load)

async function load() {
  page.value = 1
  loading.value = true
  try {
    list.value = await listTags(keyword.value || undefined)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.name = ''
  open.value = true
}

function openEdit(r: TaxonomyItem) {
  editing.value = r
  form.name = r.name
  open.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('请填写标签名')
    return
  }
  try {
    if (editing.value) {
      await renameTag(editing.value.id, form.name.trim())
      message.success('已保存')
    } else {
      await createTag(form.name.trim())
      message.success('已创建')
    }
    open.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const askDelete = (r: TaxonomyItem) =>
  confirmAction({
    title: '删除标签',
    content: `删除「${r.name}」？仍被文章使用的标签会被拒绝。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteTag(r.id)
        message.success('已删除')
        await load()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
</script>

<template>
  <div class="ft-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="标签名"
        style="width: 220px"
        allow-clear
        @search="load"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('tag:manage')" type="primary" @click="openCreate">新建标签</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table" :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button v-if="store.can('tag:manage')" type="link" size="small" @click="openEdit(record)">改名</a-button>
            <a-button v-if="store.can('tag:manage')" type="link" size="small" danger @click="askDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <a-modal centered v-model:open="open" :title="editing ? '标签改名' : '新建标签'" @ok="submit">
      <a-input v-model:value="form.name" :maxlength="64" placeholder="标签名（自动去重）" />
    </a-modal>
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
</style>
