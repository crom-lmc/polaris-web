<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  createFriendLink,
  deleteFriendLink,
  listFriendLinks,
  updateFriendLink,
  type FriendLinkItem
} from '@/api/cms'
import { confirmAction } from '@/utils/confirm'

const loading = ref(false)
const list = ref<FriendLinkItem[]>([])
const open = ref(false)
const editing = ref<FriendLinkItem | null>(null)
const form = reactive<FriendLinkItem>({ name: '', url: '', logo: '', description: '', sort: 0, status: 1 })

const columns = [
  { title: '站点', key: 'site', width: 220 },
  { title: '地址', key: 'url' },
  { title: '排序', dataIndex: 'sort', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 150 }
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
    list.value = await listFriendLinks()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', url: '', logo: '', description: '', sort: 0, status: 1 })
  open.value = true
}

function openEdit(r: FriendLinkItem) {
  editing.value = r
  Object.assign(form, {
    name: r.name,
    url: r.url || '',
    logo: r.logo || '',
    description: r.description || '',
    sort: r.sort ?? 0,
    status: r.status ?? 1
  })
  open.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('站点名称不能为空')
    return
  }
  const payload: FriendLinkItem = {
    name: form.name.trim(),
    url: (form.url || '').trim(),
    logo: (form.logo || '').trim(),
    description: (form.description || '').trim(),
    sort: form.sort ?? 0,
    status: form.status ?? 1
  }
  try {
    if (editing.value?.id) {
      await updateFriendLink(editing.value.id, payload)
      message.success('已保存')
    } else {
      await createFriendLink(payload)
      message.success('已创建')
    }
    open.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

const askDelete = (r: FriendLinkItem) =>
  confirmAction({
    title: '删除友情链接',
    content: `删除「${r.name}」？门户首页将不再展示。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteFriendLink(r.id!)
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
      <div class="hint">这里的站点会出现在门户首页「友情链接」模块（按排序、仅启用）</div>
      <a-space>
        <a-button @click="load">刷新</a-button>
        <a-button v-if="store.can('link:manage')" type="primary" @click="openCreate">新建链接</a-button>
      </a-space>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table" :columns="columns" :data-source="list" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'site'">
          <div class="site">
            <a-avatar v-if="record.logo" :src="record.logo" shape="square" :size="34" />
            <a-avatar v-else shape="square" :size="34" class="ph">{{ (record.name || '?').slice(0, 1) }}</a-avatar>
            <div class="site-meta">
              <div class="site-name">{{ record.name }}</div>
              <div class="site-desc">{{ record.description || '—' }}</div>
            </div>
          </div>
        </template>
        <template v-else-if="column.key === 'url'">
          <a :href="record.url" target="_blank" rel="noopener" class="link">{{ record.url || '—' }}</a>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 1 ? 'green' : 'default'">
            {{ record.status === 1 ? '启用' : '停用' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button v-if="store.can('link:manage')" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <a-button v-if="store.can('link:manage')" type="link" size="small" danger @click="askDelete(record)">删除</a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <a-modal centered v-model:open="open" :title="editing ? '编辑友情链接' : '新建友情链接'" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="站点名称" required>
          <a-input v-model:value="form.name" :maxlength="64" placeholder="如：统一账号中心官网" />
        </a-form-item>
        <a-form-item label="跳转地址">
          <a-input v-model:value="form.url" placeholder="https://..." />
        </a-form-item>
        <a-form-item label="Logo 图片 URL">
          <a-input v-model:value="form.logo" placeholder="可空，空则显示名称首字" />
        </a-form-item>
        <a-form-item label="一句话描述">
          <a-input v-model:value="form.description" :maxlength="128" placeholder="可选" />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="排序（小的在前）">
              <a-input-number v-model:value="form.sort" :min="0" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态">
              <a-select
                v-model:value="form.status"
                :options="[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]"
              />
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.hint {
  font-size: 13px;
  color: var(--muted);
}

.site {
  display: flex;
  align-items: center;
  gap: 10px;
}

.site .ph {
  background: #4e6ef2;
  color: #fff;
  font-size: 14px;
}

.site-meta {
  min-width: 0;
}

.site-name {
  font-size: 13px;
  font-weight: 500;
}

.site-desc {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.link {
  font-size: 13px;
  color: #4e6ef2;
  word-break: break-all;
}
</style>
