<template>
  <div class="notice-page ft-page">
    <div class="filter-row ft-head">
      <a-input
        v-model:value="query.keyword"
        placeholder="搜索标题 / 摘要"
        allow-clear
        class="f-keyword"
        @press-enter="reload"
      />
      <a-select
        v-model:value="query.category"
        :options="categoryOptions"
        placeholder="全部类型"
        allow-clear
        class="f-cat"
        @change="reload"
      />
      <a-checkbox v-model:checked="onlyUnread">只看未读</a-checkbox>
      <a-button type="primary" @click="reload">搜索</a-button>
      <a-button @click="resetQuery">重置</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
      <a-table
        class="tbl ft-table"
        :class="{ 'tbl-empty-mode': !loading && !rows.length }"
        table-layout="fixed"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        row-key="id"
        size="middle"
        :row-class-name="rowClass"
        :custom-row="(record: NoticeItem) => ({ onClick: () => openDetail(record) })"
        @change="onTableChange"
      >
        <template #emptyText>
          <div class="tbl-empty">
            <a-empty v-if="!loading" description="暂无通知" />
          </div>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'title'">
            <div class="title-cell">
              <a-tag v-if="record.pinned" color="red" class="pin">置顶</a-tag>
              <a class="tt" :class="{ unread: !record.read }">{{ record.title }}</a>
              <span v-if="!record.read" class="dot" />
              <span v-if="record.summary" class="sub">{{ record.summary }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'category'">
            <a-tag color="blue">{{ record.categoryName }}</a-tag>
          </template>
          <template v-else-if="column.key === 'target'">
            {{ record.targetType === 0 ? '全员（集团）' : record.targetOrgNames || '—' }}
          </template>
          <template v-else-if="column.key === 'publisher'">
            {{ record.publisherName || '—' }}
          </template>
          <template v-else-if="column.key === 'time'">
            <span class="muted">{{ fmtTime(record.publishAt) }}</span>
          </template>
        </template>
      </a-table>
    </section>

    <a-modal v-model:open="detailOpen" :title="detail?.title || '通知详情'" :footer="null" width="760px" centered>
      <div v-if="detail" class="detail-meta">
        <a-tag color="blue">{{ detail.categoryName }}</a-tag>
        <a-tag v-if="detail.pinned" color="red">置顶</a-tag>
        <span class="muted">目标：{{ detail.targetType === 0 ? '全员（集团）' : detail.targetOrgNames }}</span>
        <span class="muted">发布：{{ fmtTime(detail.publishAt) }} · {{ detail.publisherName }}</span>
      </div>
      <div v-if="detail" class="detail-content" v-html="detail.content" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { type NoticeItem, dictOptions, fetchNoticeDetail, fetchNoticeUnreadCount, pageNotices } from '@/api/announcement'

const columns = [
  { key: 'title', title: '通知标题', dataIndex: 'title', width: '36%' },
  { key: 'category', title: '类型', width: '12%' },
  { key: 'target', title: '通知目标', width: '22%' },
  { key: 'publisher', title: '发布人', width: '12%' },
  { key: 'time', title: '发布时间', width: '18%' }
]

/** 已读通知整行文字淡一些（参考「待办提醒」消息列表的已读样式） */
function rowClass(record: NoticeItem) {
  return record.read ? 'read-row' : ''
}

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
    const res = await dictOptions(CATEGORY_DICT)
    if (res.data?.length) {
      categoryOptions.value = res.data.map((i) => ({ value: i.value, label: i.label }))
    }
  } catch {
    // 配置中心不可用时保留内置兜底，不影响通知查询
  }
}

const rows = ref<NoticeItem[]>([])
const total = ref(0)
const loading = ref(false)
const unreadCount = ref(0)
const page = ref(1)
const size = ref(10)
const onlyUnread = ref(false)
const query = reactive<{ keyword: string; category: string | undefined }>({ keyword: '', category: undefined })

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

async function load() {
  loading.value = true
  try {
    const res = await pageNotices({
      page: page.value,
      size: size.value,
      category: query.category || undefined,
      keyword: query.keyword.trim() || undefined,
      unreadOnly: onlyUnread.value
    })
    const data = res.data
    rows.value = data.list || []
    total.value = Number(data.total) || 0
  } catch (e: any) {
    message.error(e?.message || '通知加载失败')
  } finally {
    loading.value = false
  }
}

async function loadUnread() {
  try {
    const res = await fetchNoticeUnreadCount()
    unreadCount.value = Number(res.data) || 0
  } catch {
    /* 未读数失败不打断列表 */
  }
}

function reload() {
  page.value = 1
  load()
}

// checkbox 用 watch 而不是 @change：antd-vue 的 change 可能早于 v-model 回写
watch(onlyUnread, () => reload())

function resetQuery() {
  const wasUnread = onlyUnread.value
  query.keyword = ''
  query.category = undefined
  onlyUnread.value = false
  // onlyUnread 由 watch 触发刷新；没变过才需要手动刷
  if (!wasUnread) reload()
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  page.value = p.current || 1
  size.value = p.pageSize || 10
  load()
}

function fmtTime(value?: string) {
  if (!value) return '—'
  return value.replace('T', ' ').slice(0, 16)
}

/* ---------------- 详情：打开即记读 ---------------- */

const detailOpen = ref(false)
const detail = ref<NoticeItem | null>(null)

async function openDetail(row: NoticeItem) {
  try {
    const res = await fetchNoticeDetail(row.id)
    detail.value = res.data
    detailOpen.value = true
    // 后端已落阅读记录：本地同步未读态与角标，避免再拉一次列表
    if (!row.read) {
      row.read = true
      if (unreadCount.value > 0) unreadCount.value -= 1
    }
  } catch (e: any) {
    message.error(e?.message || '通知详情加载失败')
  }
}

onMounted(() => {
  loadCategoryOptions()
  load()
  loadUnread()
})
</script>

<style scoped>
/* 高度与分页固定统一走 global.css 的 ft-page / ft-scroll / ft-bottom：
   页面撑满视口、表格区内部滚动、分页条 sticky 在右下角。这里不要再写 height:100%，
   否则会覆盖 .ft-page 的 calc(100vh - 96px)，父容器高度为 auto 时页面会被内容压扁。 */

/* 空态：撑满表格剩余高度并垂直居中（与待办提醒 / 审批中心一致） */
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
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.f-keyword {
  width: 220px;
}

.f-cat {
  width: 150px;
}

.title-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

/* 已读通知：整行文字淡化（参考「待办提醒」消息列表） */
.tbl :deep(.read-row > td) {
  color: #9aa4b2;
}

.tbl :deep(.read-row) .tt,
.tbl :deep(.read-row) .sub {
  color: #9aa4b2;
}

.pin {
  margin-inline-end: 0;
}

.tt {
  color: inherit;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tt.unread {
  color: var(--ant-color-text, rgba(0, 0, 0, 0.88));
  font-weight: 600;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
  flex: 0 0 auto;
}

.sub {
  width: 100%;
  font-size: 12px;
  color: var(--ant-color-text-tertiary, rgba(0, 0, 0, 0.45));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  font-size: 12px;
}

.detail-content {
  max-height: 56vh;
  overflow-y: auto;
  line-height: 1.8;
  word-break: break-word;
}

.detail-content :deep(h2) {
  margin: 8px 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.detail-content :deep(p) {
  margin: 0 0 8px;
}

.detail-content :deep(ul),
.detail-content :deep(ol) {
  margin: 0 0 8px;
  padding-left: 22px;
}

.detail-content :deep(a) {
  color: #1677ff;
  text-decoration: underline;
}
</style>
