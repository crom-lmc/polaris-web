<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'
import {
  createAdminBanner,
  createAdminFriendLink,
  fetchAdminBanners,
  fetchAdminFriendLinks,
  fetchAdminSite,
  updateAdminBanner,
  updateAdminFriendLink,
  updateAdminSite,
  uploadBannerImage,
  type Banner,
  type BannerInput,
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

const banners = ref<Banner[]>([])
const bannerLoading = ref(false)
const bannerSaving = ref(false)
const savingBannerId = ref('')
const bannerModalOpen = ref(false)
const editingBannerId = ref<string | null>(null)
const bannerForm = reactive({ title: '', imageUrl: '', imageAttachmentId: '', linkUrl: '', sortNo: 0, enabled: true })
const bannerUploading = ref(false)
const { pagination: bannerPagination, pagedSource: pagedBanners, reset: resetBannerPage, onChange: onBannerTableChange } = useTablePagination(banners)
const bannerColumns = [
  { title: '图片', key: 'image', width: 160 },
  { title: '标题', dataIndex: 'title', width: 200 },
  { title: '跳转地址', key: 'linkUrl', width: 280 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 150 }
]

onMounted(() => {
  void loadBanners()
})

async function loadBanners() {
  bannerLoading.value = true
  try {
    banners.value = await fetchAdminBanners()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '轮播图加载失败')
  } finally {
    bannerLoading.value = false
  }
}

function reloadBanners() {
  resetBannerPage()
  void loadBanners()
}

function openBannerCreate() {
  editingBannerId.value = null
  Object.assign(bannerForm, { title: '', imageUrl: '', imageAttachmentId: '', linkUrl: '', sortNo: 0, enabled: true })
  bannerModalOpen.value = true
}

function openBannerEdit(banner: Banner) {
  editingBannerId.value = banner.id
  Object.assign(bannerForm, {
    title: banner.title,
    imageUrl: banner.imageUrl || '',
    imageAttachmentId: '',
    linkUrl: banner.linkUrl,
    sortNo: banner.sortNo ?? 0,
    enabled: banner.enabled
  })
  bannerModalOpen.value = true
}

async function uploadBanner(event: Event) {
  if (!store.can('forum:site:edit')) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  bannerUploading.value = true
  try {
    const uploaded = await uploadBannerImage(file)
    bannerForm.imageAttachmentId = uploaded.id
    bannerForm.imageUrl = uploaded.url
    message.success('图片已上传')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '图片上传失败')
  } finally {
    bannerUploading.value = false
    input.value = ''
  }
}

function validLink(value: string): boolean {
  if (!value) return true
  if (value.startsWith('/')) return true
  return validHttpUrl(value)
}

async function submitBanner() {
  const title = bannerForm.title.trim()
  const linkUrl = bannerForm.linkUrl.trim()
  if (!bannerForm.imageAttachmentId && !bannerForm.imageUrl) {
    message.warning('请上传轮播图片')
    return
  }
  if (!validLink(linkUrl)) {
    message.warning('请输入有效的 http/https 地址或站内路径')
    return
  }
  bannerSaving.value = true
  const data: BannerInput = { title, linkUrl, sortNo: bannerForm.sortNo, enabled: bannerForm.enabled }
  // 新建必须有图片附件ID；编辑时未重新上传则保持原图，不传该字段
  if (bannerForm.imageAttachmentId) data.imageAttachmentId = bannerForm.imageAttachmentId
  try {
    if (editingBannerId.value !== null) {
      await updateAdminBanner(editingBannerId.value, data)
      message.success('轮播图已保存')
    } else {
      await createAdminBanner(data)
      message.success('轮播图已创建')
    }
    bannerModalOpen.value = false
    await loadBanners()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '轮播图保存失败')
  } finally {
    bannerSaving.value = false
  }
}

async function toggleBanner(banner: Banner) {
  savingBannerId.value = banner.id
  try {
    Object.assign(banner, await updateAdminBanner(banner.id, { enabled: !banner.enabled }))
    message.success(banner.enabled ? '轮播图已启用' : '轮播图已停用')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '轮播图状态更新失败')
  } finally {
    savingBannerId.value = ''
  }
}
</script>

<template>
  <div class="admin-page site-page">
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

    <a-card class="table-card" :bordered="false">
      <template #title>首页轮播图</template>
      <template #extra>
        <a-space>
          <a-button v-if="store.can('forum:site:view')" @click="reloadBanners"><ReloadOutlined />刷新</a-button>
          <a-button v-if="store.can('forum:site:edit')" type="primary" @click="openBannerCreate"><PlusOutlined />新增轮播图</a-button>
        </a-space>
      </template>
      <div class="table-scroll" :class="{ 'is-empty': !bannerLoading && !pagedBanners.length }">
        <a-table :columns="bannerColumns" :data-source="pagedBanners" :loading="bannerLoading" :pagination="bannerPagination" row-key="id" size="middle" @change="onBannerTableChange">
          <template #emptyText>
            <a-empty v-if="!bannerLoading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'image'">
              <img v-if="record.imageUrl" class="banner-thumb" :src="record.imageUrl" :alt="record.title || '轮播图'" />
              <span v-else class="muted">未上传</span>
            </template>
            <template v-else-if="column.key === 'linkUrl'">
              <span v-if="record.linkUrl" class="link-url">{{ record.linkUrl }}</span>
              <span v-else class="muted">不跳转</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:site:edit')" type="link" size="small" @click="openBannerEdit(record)">编辑</a-button>
                <a-button v-if="store.can('forum:site:edit')" type="link" size="small" :loading="savingBannerId === record.id" @click="toggleBanner(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
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

    <a-modal v-model:open="bannerModalOpen" centered :title="editingBannerId !== null ? '编辑轮播图' : '新增轮播图'" ok-text="保存" cancel-text="取消" :confirm-loading="bannerSaving" @ok="submitBanner">
      <a-form layout="vertical">
        <a-form-item label="轮播图片" required>
          <div class="banner-upload-row">
            <img v-if="bannerForm.imageUrl" class="banner-preview" :src="bannerForm.imageUrl" alt="图片预览" />
            <label class="banner-upload-btn">
              <input type="file" accept="image/*" :disabled="bannerUploading" @change="uploadBanner" />
              {{ bannerUploading ? '上传中…' : (bannerForm.imageUrl ? '更换图片' : '选择图片') }}
            </label>
          </div>
          <div class="banner-upload-hint">仅支持图片，最大 10MB；上传后自动保存图片。</div>
        </a-form-item>
        <a-form-item label="标题"><a-input v-model:value="bannerForm.title" :maxlength="120" placeholder="选填，用于图片说明" /></a-form-item>
        <a-form-item label="跳转链接">
          <a-input v-model:value="bannerForm.linkUrl" :maxlength="500" placeholder="https://example.com 或 /new（留空则不跳转）" />
        </a-form-item>
        <a-form-item label="排序"><a-input-number v-model:value="bannerForm.sortNo" :min="0" :precision="0" class="full-width" /></a-form-item>
        <a-form-item label="启用状态"><a-switch v-model:checked="bannerForm.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
/* 站点管理页内容较多：整页允许滚动，两个表格区块固定高度，避免被 flex 压扁 */
.site-page { display: block; overflow-y: auto; overflow-x: hidden; }
.site-page .table-card { height: 340px; margin-bottom: 16px; }
/* 卡片标题与表格首列文字左对齐（表头单元格 padding-left 为 10px） */
.site-page :deep(.table-card > .ant-card-head) { padding-left: 10px; }
.site-card { margin-bottom: 16px; }
.footer-item { margin-bottom: 16px; }
.link-url { display: block; overflow-wrap: anywhere; word-break: break-word; }
.full-width { width: 100%; }
.muted { color: #999; }
.banner-thumb { max-width: 140px; max-height: 60px; object-fit: cover; border-radius: 6px; }
.banner-upload-row { display: flex; align-items: center; gap: 12px; }
.banner-preview { width: 160px; height: 72px; object-fit: cover; border: 1px solid #e8eaf1; border-radius: 8px; }
.banner-upload-btn { display: inline-flex; align-items: center; padding: 6px 14px; border: 1px solid #d9d9d9; border-radius: 6px; cursor: pointer; }
.banner-upload-btn:hover { border-color: #5b67f1; color: #5b67f1; }
.banner-upload-btn input { display: none; }
.banner-upload-hint { margin-top: 6px; color: #999; font-size: 12px; }
@media (max-width: 640px) {
  .site-card :deep(.ant-card-head-wrapper), .table-card :deep(.ant-card-head-wrapper) { flex-wrap: wrap; align-items: flex-start; gap: 8px; }
  .site-card :deep(.ant-card-extra), .table-card :deep(.ant-card-extra) { margin-left: 0; padding-bottom: 12px; }
}
</style>
