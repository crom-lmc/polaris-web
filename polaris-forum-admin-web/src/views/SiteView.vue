<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'
import {
  createAdminFriendLink,
  fetchAdminFriendLinks,
  fetchAdminSite,
  updateAdminFriendLink,
  updateAdminSite,
  type FriendLink,
  type FriendLinkInput,
  type SiteConfig
} from '@/api/forum'

const siteForm = reactive<SiteConfig>({ aboutContent: '', footerText: '' })
const links = ref<FriendLink[]>([])
const store = useUserStore()
const siteLoading = ref(false)
const siteSaving = ref(false)
const linkLoading = ref(false)
const linkSaving = ref(false)
const savingLinkId = ref('')
const linkModalOpen = ref(false)
const editingLinkId = ref<string | null>(null)
const linkForm = reactive<FriendLinkInput>({ name: '', url: '', sortNo: 0, enabled: true })
const { pagination: linkPagination, pagedSource: pagedLinks, reset: resetLinkPage, onChange: onLinkTableChange } = useTablePagination(links)
const linkColumns = [
  { title: '名称', dataIndex: 'name', width: 180 },
  { title: '链接地址', key: 'url', width: 340 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '更新时间', key: 'updatedAt', width: 170 },
  { title: '操作', key: 'action', width: 150 }
]

onMounted(() => {
  void loadSite()
  void loadLinks()
})

async function loadSite() {
  siteLoading.value = true
  try {
    Object.assign(siteForm, await fetchAdminSite())
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '站点配置加载失败')
  } finally {
    siteLoading.value = false
  }
}

async function saveSite() {
  siteSaving.value = true
  try {
    Object.assign(siteForm, await updateAdminSite({
      aboutContent: siteForm.aboutContent.trim(),
      footerText: siteForm.footerText.trim()
    }))
    message.success('站点信息已保存')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '站点信息保存失败')
  } finally {
    siteSaving.value = false
  }
}

async function loadLinks() {
  linkLoading.value = true
  try {
    links.value = await fetchAdminFriendLinks()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '友情链接加载失败')
  } finally {
    linkLoading.value = false
  }
}

function reloadLinks() {
  resetLinkPage()
  void loadLinks()
}

function openLinkCreate() {
  editingLinkId.value = null
  Object.assign(linkForm, { name: '', url: '', sortNo: 0, enabled: true })
  linkModalOpen.value = true
}

function openLinkEdit(link: FriendLink) {
  editingLinkId.value = link.id
  Object.assign(linkForm, {
    name: link.name,
    url: link.url,
    sortNo: link.sortNo ?? 0,
    enabled: link.enabled
  })
  linkModalOpen.value = true
}

function validHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.host
  } catch {
    return false
  }
}

async function submitLink() {
  const name = linkForm.name.trim()
  const url = linkForm.url.trim()
  if (!name) {
    message.warning('请输入友链名称')
    return
  }
  if (!validHttpUrl(url)) {
    message.warning('请输入有效的 http/https 链接地址')
    return
  }
  linkSaving.value = true
  const data: FriendLinkInput = { name, url, sortNo: linkForm.sortNo, enabled: linkForm.enabled }
  try {
    if (editingLinkId.value !== null) {
      await updateAdminFriendLink(editingLinkId.value, data)
      message.success('友情链接已保存')
    } else {
      await createAdminFriendLink(data)
      message.success('友情链接已创建')
    }
    linkModalOpen.value = false
    await loadLinks()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '友情链接保存失败')
  } finally {
    linkSaving.value = false
  }
}

async function toggleLink(link: FriendLink) {
  savingLinkId.value = link.id
  try {
    Object.assign(link, await updateAdminFriendLink(link.id, { enabled: !link.enabled }))
    message.success(link.enabled ? '友情链接已启用' : '友情链接已停用')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '友情链接状态更新失败')
  } finally {
    savingLinkId.value = ''
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>站点管理</h1>
      <p>维护关于页面、页脚文案和友情链接；链接仅支持 http/https 地址，不提供删除操作。</p>
    </header>

    <a-card class="site-card" :bordered="false" :loading="siteLoading">
      <template #title>站点信息</template>
      <template #extra><a-button v-if="store.can('forum:site:edit')" type="primary" :loading="siteSaving" @click="saveSite">保存站点信息</a-button></template>
      <a-form layout="vertical">
        <a-form-item label="关于页面内容">
          <a-textarea v-model:value="siteForm.aboutContent" :maxlength="50000" :rows="10" show-count placeholder="请输入关于页面的展示内容" />
        </a-form-item>
        <a-form-item label="页脚文案" class="footer-item">
          <a-textarea v-model:value="siteForm.footerText" :maxlength="500" :rows="3" show-count placeholder="请输入页脚文案" />
        </a-form-item>
      </a-form>
    </a-card>

    <a-card class="table-card" :bordered="false">
      <template #title>友情链接</template>
      <template #extra>
        <a-space>
          <a-button v-if="store.can('forum:site:view')" @click="reloadLinks"><ReloadOutlined />刷新</a-button>
          <a-button v-if="store.can('forum:site:link:manage')" type="primary" @click="openLinkCreate"><PlusOutlined />新增友链</a-button>
        </a-space>
      </template>
      <div class="table-scroll" :class="{ 'is-empty': !linkLoading && !pagedLinks.length }">
        <a-table :columns="linkColumns" :data-source="pagedLinks" :loading="linkLoading" :pagination="linkPagination" row-key="id" size="middle" @change="onLinkTableChange">
          <template #emptyText>
            <a-empty v-if="!linkLoading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'url'">
              <a class="link-url" :href="record.url" target="_blank" rel="noopener noreferrer">{{ record.url }}</a>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'updatedAt'">{{ record.updatedAt || '-' }}</template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:site:link:manage')" type="link" size="small" @click="openLinkEdit(record)">编辑</a-button>
                <a-button v-if="store.can('forum:site:link:manage')" type="link" size="small" :loading="savingLinkId === record.id" @click="toggleLink(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="linkModalOpen" centered :title="editingLinkId !== null ? '编辑友情链接' : '新增友情链接'" ok-text="保存" cancel-text="取消" :confirm-loading="linkSaving" @ok="submitLink">
      <a-form layout="vertical">
        <a-form-item label="友链名称" required><a-input v-model:value="linkForm.name" :maxlength="80" placeholder="请输入友链名称" /></a-form-item>
        <a-form-item label="链接地址" required><a-input v-model:value="linkForm.url" type="url" :maxlength="500" placeholder="https://example.com" /></a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="linkForm.sortNo" :min="0" :precision="0" class="full-width" /></a-form-item>
        <a-form-item label="启用状态"><a-switch v-model:checked="linkForm.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.site-card { margin-bottom: 16px; }
.footer-item { margin-bottom: 0; }
.link-url { display: block; overflow-wrap: anywhere; word-break: break-word; }
.full-width { width: 100%; }
@media (max-width: 640px) {
  .site-card :deep(.ant-card-head-wrapper), .table-card :deep(.ant-card-head-wrapper) { flex-wrap: wrap; align-items: flex-start; gap: 8px; }
  .site-card :deep(.ant-card-extra), .table-card :deep(.ant-card-extra) { margin-left: 0; padding-bottom: 12px; }
}
</style>
