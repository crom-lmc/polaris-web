<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-input
          v-model:value="keyword"
          allow-clear
          placeholder="搜索标题 / 摘要"
          style="width: 220px"
          @press-enter="reload"
        />
        <a-select
          v-model:value="statusFilter"
          :options="statusOptions"
          allow-clear
          placeholder="全部状态"
          style="width: 130px"
          @change="reload"
        />
        <a-select
          v-model:value="categoryFilter"
          :options="categoryOptions"
          allow-clear
          placeholder="全部类型"
          style="width: 140px"
          @change="reload"
        />
        <a-button @click="reload">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
      <div class="toolbar-right">
        <a-button type="primary" @click="openCreate">
          <template #icon><plus-outlined /></template>
          新建通知
        </a-button>
      </div>
    </div>

    <section class="panel ft-grow">
      <div class="panel-head">
        <span class="muted">共 {{ total }} 条 · 已发布的通知会出现在统一账号中心「通知中心」</span>
      </div>
      <div class="panel-body table-body ft-scroll ft-bottom">
        <a-table
          class="ft-table"
          :class="{ 'tbl-empty-mode': !loading && !rows.length }"
          table-layout="fixed"
          :columns="columns"
          :data-source="rows"
          :loading="loading"
          row-key="id"
          size="middle"
          :pagination="pagination"
          @change="onTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'no'">
              <span class="cell-no">{{ record.announcementNo || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'title'">
              <div class="cell-title">
                <a-tag v-if="record.pinned" color="red" class="pin-tag">置顶</a-tag>
                <span>{{ record.title }}</span>
              </div>
              <div v-if="record.summary" class="muted cell-sub">{{ record.summary }}</div>
            </template>
            <template v-else-if="column.key === 'category'">
              <a-tag color="blue">{{ record.categoryName }}</a-tag>
            </template>
            <template v-else-if="column.key === 'target'">
              <span>{{ record.targetType === 0 ? '全员（集团）' : record.targetOrgNames || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
            </template>
            <template v-else-if="column.key === 'read'">
              <span>{{ record.readCount }} / {{ record.targetCount }}</span>
            </template>
            <template v-else-if="column.key === 'time'">
              <div>{{ record.publishAt || '—' }}</div>
              <div class="muted cell-sub">创建：{{ record.createdAt || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a v-if="record.status === 1" class="act" @click="openView(record)">查看</a>
                <a v-else class="act" @click="openEdit(record)">编辑</a>

                <a-popconfirm
                  v-if="record.status !== 1"
                  title="发布后通知会立即出现在账号中心的通知中心，确定发布？"
                  ok-text="发布"
                  cancel-text="取消"
                  @confirm="doPublish(record)"
                >
                  <a class="act">发布</a>
                </a-popconfirm>
                <a-popconfirm
                  v-else
                  title="下架后账号中心将不再展示该通知，确定下架？"
                  ok-text="下架"
                  cancel-text="取消"
                  @confirm="doOffline(record)"
                >
                  <a class="act">下架</a>
                </a-popconfirm>

                <a-popconfirm
                  v-if="record.status !== 1"
                  title="删除后不可恢复，确定删除？"
                  ok-text="删除"
                  cancel-text="取消"
                  @confirm="doDelete(record)"
                >
                  <a class="act danger">删除</a>
                </a-popconfirm>
              </div>
            </template>
          </template>
          <template #emptyText>
            <div class="tbl-empty">
              <a-empty v-if="!loading" description="暂无数据" />
            </div>
          </template>
        </a-table>
      </div>
    </section>

    <!-- 新建 / 编辑 -->
    <a-modal
      v-model:open="editorOpen"
      :title="editingId ? '编辑通知' : '新建通知'"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      width="880px"
      centered
      destroy-on-close
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-row :gutter="16">
          <a-col :span="16">
            <a-form-item label="标题" required>
              <a-input v-model:value="form.title" :maxlength="200" show-count placeholder="如：2026 年国庆节放假安排" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="通知类型">
              <a-select v-model:value="form.category" :options="categoryOptions" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="通知目标" required>
          <a-radio-group v-model:value="form.targetType" @change="onTargetTypeChange">
            <a-radio :value="0">全员（集团）</a-radio>
            <a-radio :value="1">按部门</a-radio>
          </a-radio-group>
          <div v-if="form.targetType === 1" class="target-tree">
            <a-tree-select
              v-model:value="form.targetOrgIds"
              :tree-data="orgTreeOptions"
              multiple
              show-search
              tree-node-filter-prop="title"
              placeholder="选择部门（含其下级部门）"
              style="width: 100%"
            />
            <div class="muted">选中部门后，该部门及其下级部门的员工都能在通知中心看到这条通知。</div>
          </div>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="18">
            <a-form-item label="摘要">
              <a-input
                v-model:value="form.summary"
                :maxlength="500"
                placeholder="列表里展示的一句话说明（可不填，此时展示正文前段）"
              />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="置顶">
              <a-switch v-model:checked="form.pinned" checked-children="置顶" un-checked-children="普通" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="通知内容" required>
          <rich-text-editor v-model="form.content" placeholder="请输入通知正文（支持加粗、标题、列表、对齐、链接等排版）" />
        </a-form-item>

        <a-form-item label="备注">
          <a-input v-model:value="form.remark" :maxlength="255" placeholder="内部备注，不会展示给员工" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 已发布通知只读查看 -->
    <a-modal
      v-model:open="viewOpen"
      :title="viewItem?.title || '通知详情'"
      :footer="null"
      width="760px"
      centered
    >
      <div v-if="viewItem" class="view-meta">
        <a-tag color="blue">{{ viewItem.categoryName }}</a-tag>
        <a-tag v-if="viewItem.pinned" color="red">置顶</a-tag>
        <span class="muted">编号：{{ viewItem.announcementNo || '—' }}</span>
        <span class="muted">目标：{{ viewItem.targetType === 0 ? '全员（集团）' : viewItem.targetOrgNames }}</span>
        <span class="muted">阅读：{{ viewItem.readCount }} / {{ viewItem.targetCount }}</span>
        <span class="muted">发布：{{ viewItem.publishAt || '—' }} · {{ viewItem.publisherName }}</span>
      </div>
      <div v-if="viewItem" class="view-content" v-html="DOMPurify.sanitize(viewItem.content || '')" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import DOMPurify from 'dompurify'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  type AnnouncementItem,
  type AnnouncementSaveBody,
  type OrgNode,
  announcementOrgTree,
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  offlineAnnouncement,
  pageAnnouncements,
  publishAnnouncement,
  updateAnnouncement,
  dictOptions
} from '@/api/ehr'
import RichTextEditor from '@/components/RichTextEditor.vue'

const columns = [
  { key: 'no', title: '编号', dataIndex: 'announcementNo', width: '12%' },
  { key: 'title', title: '标题', dataIndex: 'title', width: '24%' },
  { key: 'category', title: '类型', width: '8%' },
  { key: 'target', title: '通知目标', width: '14%' },
  { key: 'status', title: '状态', width: '8%' },
  { key: 'read', title: '阅读 / 应读', width: '8%' },
  { key: 'time', title: '发布时间', width: '14%' },
  { key: 'action', title: '操作', width: '12%' }
]

const statusOptions = [
  { value: 0, label: '编辑中' },
  { value: 1, label: '已发布' },
  { value: 2, label: '已下架' }
]

/** 通知类型取配置中心字典 ehr.announcement_category，取不到时用内置兜底 */
const CATEGORY_DICT = 'ehr.announcement_category'
const categoryOptions = ref([
  { value: 'HOLIDAY', label: '节假日通知' },
  { value: 'COMMENDATION', label: '表彰通知' },
  { value: 'DEPARTMENT', label: '部门通知' },
  { value: 'POLICY', label: '制度通知' },
  { value: 'APPOINTMENT', label: '部门任命' },
  { value: 'OTHER', label: '其他' }
])

async function loadCategoryOptions() {
  try {
    const items = await dictOptions(CATEGORY_DICT)
    if (items?.length) {
      categoryOptions.value = items.map((i) => ({ value: i.value, label: i.label }))
    }
  } catch {
    // 配置中心不可用时保留内置兜底，不阻断通知维护
  }
}

const keyword = ref('')
const statusFilter = ref<number | undefined>(undefined)
const categoryFilter = ref<string | undefined>(undefined)
const loading = ref(false)
const rows = ref<AnnouncementItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(10)

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const orgTreeOptions = ref<Array<{ title: string; value: string; children?: unknown[] }>>([])

async function loadOrgs() {
  try {
    const nodes = await announcementOrgTree()
    orgTreeOptions.value = nodes.map(toTreeOption)
  } catch (e: any) {
    message.error(e?.message || '组织架构加载失败')
  }
}

function toTreeOption(node: OrgNode): { title: string; value: string; children?: unknown[] } {
  const children = (node.children || []).map(toTreeOption)
  return { title: node.name, value: node.id, children: children.length ? children : undefined }
}

async function load() {
  loading.value = true
  try {
    const data = await pageAnnouncements({
      status: statusFilter.value,
      category: categoryFilter.value || undefined,
      keyword: keyword.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = data.list || []
    total.value = Number(data.total) || 0
  } catch (e: any) {
    message.error(e?.message || '通知列表加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  load()
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  page.value = p.current || 1
  size.value = p.pageSize || 10
  load()
}

function statusColor(status: number) {
  if (status === 1) return 'green'
  if (status === 2) return 'red'
  return 'default'
}

/* ---------------- 编辑 ---------------- */

const editorOpen = ref(false)
const saving = ref(false)
const editingId = ref('')
const form = reactive({
  title: '',
  summary: '',
  category: 'OTHER',
  content: '',
  targetType: 0,
  targetOrgIds: [] as string[],
  pinned: false,
  remark: ''
})

function resetForm() {
  editingId.value = ''
  form.title = ''
  form.summary = ''
  form.category = 'OTHER'
  form.content = ''
  form.targetType = 0
  form.targetOrgIds = []
  form.pinned = false
  form.remark = ''
}

function openCreate() {
  resetForm()
  editorOpen.value = true
}

function onTargetTypeChange() {
  if (form.targetType === 0) {
    form.targetOrgIds = []
  }
}

async function openEdit(row: AnnouncementItem) {
  resetForm()
  editingId.value = row.id
  try {
    const detail = await getAnnouncement(row.id)
    form.title = detail.title || ''
    form.summary = detail.summary || ''
    form.category = detail.category || 'OTHER'
    form.content = detail.content || ''
    form.targetType = detail.targetType === 1 ? 1 : 0
    form.targetOrgIds = [...(detail.targetOrgIds || [])]
    form.pinned = detail.pinned === 1
    form.remark = detail.remark || ''
    editorOpen.value = true
  } catch (e: any) {
    message.error(e?.message || '通知详情加载失败')
  }
}

function plainText(html: string) {
  return (html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

async function submit() {
  if (!form.title.trim()) {
    message.warning('请填写标题')
    return
  }
  if (!plainText(form.content)) {
    message.warning('请填写通知内容')
    return
  }
  if (form.targetType === 1 && form.targetOrgIds.length === 0) {
    message.warning('按部门发送时请选择至少一个部门')
    return
  }
  const body: AnnouncementSaveBody = {
    title: form.title.trim(),
    summary: form.summary.trim(),
    category: form.category,
    content: form.content,
    targetType: form.targetType,
    targetOrgIds: form.targetType === 1 ? form.targetOrgIds : [],
    pinned: form.pinned,
    remark: form.remark.trim()
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateAnnouncement(editingId.value, body)
    } else {
      await createAnnouncement(body)
    }
    message.success('已保存')
    editorOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------------- 发布 / 下架 / 删除 / 查看 ---------------- */

async function doPublish(row: AnnouncementItem) {
  try {
    await publishAnnouncement(row.id)
    message.success('已发布，账号中心通知中心立即可见')
    await load()
  } catch (e: any) {
    message.error(e?.message || '发布失败')
  }
}

async function doOffline(row: AnnouncementItem) {
  try {
    await offlineAnnouncement(row.id)
    message.success('已下架')
    await load()
  } catch (e: any) {
    message.error(e?.message || '下架失败')
  }
}

async function doDelete(row: AnnouncementItem) {
  try {
    await deleteAnnouncement(row.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

const viewOpen = ref(false)
const viewItem = ref<AnnouncementItem | null>(null)

async function openView(row: AnnouncementItem) {
  try {
    viewItem.value = await getAnnouncement(row.id)
    viewOpen.value = true
  } catch (e: any) {
    message.error(e?.message || '通知详情加载失败')
  }
}

onMounted(() => {
  loadOrgs()
  loadCategoryOptions()
  load()
})
</script>

<style scoped>
.page-root {
  --ft-min-width: 1180px;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.table-body {
  padding: 0;
}

/* 空态：撑满表格剩余高度并垂直居中（与待办提醒 / 通知中心一致） */
.tbl-empty-mode :deep(.ant-table-container) {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
}

.tbl-empty-mode :deep(.ant-table-content) {
  flex: 1 0 auto;
}

.tbl-empty-mode :deep(.ant-table-content > table) {
  height: 100%;
}

.tbl-empty-mode :deep(.ant-table-placeholder > td) {
  height: 100%;
  padding: 0;
  border-bottom: none;
}

.tbl-empty {
  height: 100%;
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.pin-tag {
  margin-inline-end: 0;
}

.cell-sub {
  margin-top: 2px;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.act {
  cursor: pointer;
}

.cell-no {
  color: #595959;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.act.danger {
  color: #ff4d4f;
}

.target-tree {
  margin-top: 10px;
}

.target-tree .muted {
  margin-top: 6px;
  font-size: 12px;
}

.view-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}

.view-content {
  max-height: 56vh;
  overflow-y: auto;
  padding: 4px 2px;
  line-height: 1.8;
  word-break: break-word;
}

.view-content :deep(h2) {
  margin: 8px 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.view-content :deep(p) {
  margin: 0 0 8px;
}

.view-content :deep(ul),
.view-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 22px;
}

.view-content :deep(a) {
  color: #1677ff;
  text-decoration: underline;
}
</style>
