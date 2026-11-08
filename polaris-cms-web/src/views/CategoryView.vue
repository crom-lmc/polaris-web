<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createCategory, deleteCategory, listCategories, updateCategory, type TaxonomyItem } from '@/api/cms'
import { confirmAction } from '@/utils/confirm'

const loading = ref(false)
const list = ref<TaxonomyItem[]>([])
const open = ref(false)
const editing = ref<TaxonomyItem | null>(null)
const form = reactive({ name: '', sort: 0 })

const columns = [
  { title: 'ID', dataIndex: 'id', width: 90 },
  { title: '分类名', dataIndex: 'name' },
  { title: '排序', dataIndex: 'sort', width: 90 },
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
    list.value = await listCategories()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  form.name = ''
  form.sort = 0
  open.value = true
}

function openEdit(r: TaxonomyItem) {
  editing.value = r
  form.name = r.name
  form.sort = r.sort ?? 0
  open.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('请填写分类名')
    return
  }
  try {
    if (editing.value) {
      await updateCategory(editing.value.id, { name: form.name.trim(), sort: form.sort })
      message.success('已保存')
    } else {
      await createCategory({ name: form.name.trim(), sort: form.sort })
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
    title: '删除分类',
    content: `删除「${r.name}」？该分类下有文章时会被拒绝。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteCategory(r.id)
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
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('category:manage')" type="primary" @click="openCreate">新建分类</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table" :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-space>
            <a-button v-if="store.can('category:manage')" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-if="store.can('category:manage')" type="link" size="small" danger @click="askDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <a-modal centered v-model:open="open" :title="editing ? '编辑分类' : '新建分类'" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="分类名" required>
          <a-input v-model:value="form.name" :maxlength="64" />
        </a-form-item>
        <a-form-item label="排序（小的在前）">
          <a-input-number v-model:value="form.sort" :min="0" style="width: 120px" />
        </a-form-item>
      </a-form>
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
