<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { createBanner, deleteBanner, listBanners, updateBanner, type BannerItem } from '@/api/cms'
import { confirmAction } from '@/utils/confirm'

const loading = ref(false)
const list = ref<BannerItem[]>([])
const open = ref(false)
const editing = ref<BannerItem | null>(null)
const form = reactive({ title: '', imageUrl: '', linkUrl: '', sort: 0, status: 1 })

const columns = [
  { title: '预览', key: 'preview', width: 140 },
  { title: '标题', dataIndex: 'title' },
  { title: '链接', dataIndex: 'linkUrl' },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', key: 'status', width: 90 },
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
    list.value = await listBanners()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { title: '', imageUrl: '', linkUrl: '', sort: 0, status: 1 })
  open.value = true
}

function openEdit(r: BannerItem) {
  editing.value = r
  Object.assign(form, { title: r.title, imageUrl: r.imageUrl, linkUrl: r.linkUrl || '', sort: r.sort ?? 0, status: r.status ?? 1 })
  open.value = true
}

async function submit() {
  if (!form.title.trim() || !form.imageUrl.trim()) {
    message.warning('标题和图片不能为空')
    return
  }
  try {
    if (editing.value?.id) {
      await updateBanner(editing.value.id, { ...form, title: form.title.trim(), imageUrl: form.imageUrl.trim() })
      message.success('已保存')
    } else {
      await createBanner({ ...form, title: form.title.trim(), imageUrl: form.imageUrl.trim() })
      message.success('已创建')
    }
    open.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const askDelete = (r: BannerItem) =>
  confirmAction({
    title: '删除 Banner',
    content: `删除「${r.title}」？确认吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteBanner(r.id!)
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
      <a-button v-if="store.can('banner:manage')" type="primary" @click="openCreate">新建 Banner</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table" :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'preview'">
          <a-image :src="record.imageUrl" :width="110" :height="56" style="object-fit: cover" />
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'default'">
            {{ record.status === 1 ? '启用' : '停用' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="store.can('banner:manage')" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-if="store.can('banner:manage')" type="link" size="small" danger @click="askDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <a-modal centered v-model:open="open" :title="editing ? '编辑 Banner' : '新建 Banner'" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" :maxlength="128" />
        </a-form-item>
        <a-form-item label="图片 URL" required>
          <a-input v-model:value="form.imageUrl" placeholder="/api/cms/media/file/... 或完整 URL" />
        </a-form-item>
        <a-form-item label="跳转链接">
          <a-input v-model:value="form.linkUrl" placeholder="可选" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="排序（小的在前）">
              <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select v-model:value="form.status"
                :options="[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]" />
            </a-form-item>
          </a-col>
        </a-row>
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
