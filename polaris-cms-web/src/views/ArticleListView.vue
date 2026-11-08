<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import {
  approveArticle,
  flagArticle,
  offlineArticle,
  pageArticles,
  publishArticle,
  recycleArticle,
  rejectArticle,
  restoreArticle,
  deleteArticleForever,
  submitArticle,
  withdrawArticle,
  type ArticleItem
} from '@/api/cms'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  briefsForRow,
  buildBizRefs,
  fetchLatestApprovals,
  runningBriefOf,
  rejectedBriefOf,
  type ApprovalBrief
} from '@/api/approvals'
import { useUserStore } from '@/stores/user'
import { confirmAction } from '@/utils/confirm'

const router = useRouter()
const store = useUserStore()

const STATUS = ['草稿', '待审核', '待发布', '已发布', '驳回', '已下线', '审批中']
const STATUS_COLOR = ['default', 'orange', 'purple', 'green', 'red', 'default', 'processing']

const loading = ref(false)
const records = ref<ArticleItem[]>([])
const total = ref(0)
const query = reactive({
  keyword: '',
  status: undefined as number | undefined,
  page: 1,
  size: 10
})

/** 该页文章的最新审批单：在途 / 驳回提示都按审批中心真实状态判定 */
const approvalBriefs = ref<ApprovalBrief[]>([])
const ARTICLE_BIZ_TYPES = ['cms.article_publish']
const detailOpen = ref(false)
const detailId = ref<string | null>(null)

async function loadApprovalBriefs(list: ArticleItem[]) {
  const refs = buildBizRefs(list.map((r) => r.id), ARTICLE_BIZ_TYPES)
  // 审批中心偶发不可用时静默降级：不能因为提示查不到就让整个列表加载失败
  approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
}

function openApprovalDetail(id: string) {
  detailId.value = id
  detailOpen.value = true
}

/** 审批入口统一放操作列：以审批中心返回的真实 status 判定在途 / 驳回 */
function runningBriefForRow(r: ArticleItem) {
  return runningBriefOf(
    briefsForRow(approvalBriefs.value, r.id),
    r.approvalInstanceId,
    'cms.article_publish'
  )
}
function rejectedBriefForRow(r: ArticleItem) {
  return rejectedBriefOf(briefsForRow(approvalBriefs.value, r.id))
}

/** 拒绝理由弹窗 */
const rejectOpen = ref(false)
const rejectId = ref<number | null>(null)
const rejectNote = ref('')

const columns = [
  { title: '标题', key: 'title' },
  { title: '分类', dataIndex: 'categoryName', width: 110 },
  { title: '状态', key: 'status', width: 90 },
  { title: '标记', key: 'flags', width: 110 },
  { title: '作者', dataIndex: 'authorName', width: 100 },
  { title: '更新时间', dataIndex: 'updatedAt', width: 160 },
  { title: '操作', key: 'action', width: 300 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    const data = await pageArticles({ ...query })
    records.value = data.list
    total.value = data.total
    await loadApprovalBriefs(records.value)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function act(fn: () => Promise<unknown>, ok: string) {
  try {
    await fn()
    message.success(ok)
    await load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

const openAskReject = (id: number) => {
  rejectId.value = id
  rejectNote.value = ''
  rejectOpen.value = true
}

const askSubmit = (r: ArticleItem) =>
  confirmAction({
    title: '提交审批',
    content: `将「${r.title}」提交到审批中心（内容审核 → 总编终审），审批通过后进入待发布。确认吗？`,
    okText: '提交审批',
    onOk: () => act(() => submitArticle(r.id, ''), '已提交审批，等待审批人处理')
  })

const askWithdraw = (r: ArticleItem) =>
  confirmAction({
    title: '撤回审批',
    content: `撤回「${r.title}」的在途审批，稿件退回草稿。确认吗？`,
    okText: '撤回',
    onOk: () => act(() => withdrawArticle(r.id), '已撤回，稿件退回草稿')
  })

const askApprove = (r: ArticleItem) =>
  confirmAction({
    title: '审核通过',
    content: `通过后「${r.title}」将立即发布。确认吗？`,
    okText: '通过并发布',
    onOk: () => act(() => approveArticle(r.id, ''), '已发布')
  })

/** 发布：仅「审批通过后的待发布」可点，点完才变成已发布并对门户可见 */
const askPublish = (r: ArticleItem) =>
  confirmAction({
    title: '发布文章',
    content: `发布「${r.title}」后将在门户展示。确认吗？`,
    okText: '发布',
    onOk: () => act(() => publishArticle(r.id), '已发布，门户可见')
  })

const askOffline = (r: ArticleItem) =>
  confirmAction({
    title: '下线',
    content: `下线后前台不再展示「${r.title}」。确认吗？`,
    okText: '下线',
    okType: 'danger',
    onOk: () => act(() => offlineArticle(r.id), '已下线')
  })

const askRecycle = (r: ArticleItem) =>
  confirmAction({
    title: '移入回收站',
    content: `「${r.title}」将进入回收站，可随时恢复。确认吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: () => act(() => recycleArticle(r.id), '已移入回收站')
  })

const askRestore = (r: ArticleItem) =>
  confirmAction({
    title: '恢复文章',
    content: `从回收站恢复「${r.title}」。确认吗？`,
    okText: '恢复',
    onOk: () => act(() => restoreArticle(r.id), '已恢复')
  })

const askForever = (r: ArticleItem) =>
  confirmAction({
    title: '彻底删除',
    content: `「${r.title}」及其全部版本将不可恢复！确认彻底删除吗？`,
    okText: '彻底删除',
    okType: 'danger',
    onOk: () => act(() => deleteArticleForever(r.id), '已彻底删除')
  })

const toggleFlag = (r: ArticleItem, flag: 'pin' | 'recommend') =>
  act(() => flagArticle(r.id, flag, flag === 'pin' ? !r.pinned : !r.recommended), '已更新')
</script>

<template>
  <div class="ft-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="query.keyword"
        placeholder="标题 / 摘要"
        style="width: 240px"
        allow-clear
        @search="() => { query.page = 1; load() }"
      />
      <a-select
        v-model:value="query.status"
        style="width: 130px"
        placeholder="全部状态"
        allow-clear
        :options="STATUS.map((s, i) => ({ label: s, value: i }))"
        @change="() => { query.page = 1; load() }"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('article:create')" type="primary" @click="router.push('/articles/new')">
        新建文章
      </a-button>
    </div>

    <section class="ft-scroll ft-bottom">
    <a-table class="ft-table"
      :columns="columns"
      :data-source="records"
      :loading="loading"
      row-key="id"
      :pagination="{
        current: query.page,
        pageSize: query.size,
        total,
        showSizeChanger: true,
        showTotal: (t: number) => `共 ${t} 条`,
        onChange: (p: number, s: number) => { query.page = p; query.size = s; load() }
      }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'title'">
          <div class="title-cell">
            <span class="t">{{ record.title }}</span>
            <span class="s">{{ record.summary }}</span>
          </div>
        </template>

        <template v-else-if="column.key === 'status'">
          <a-tag :color="STATUS_COLOR[record.status]">
            {{ STATUS[record.status] }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'flags'">
          <a-space size="4">
            <a-tag v-if="record.pinned" color="red">置顶</a-tag>
            <a-tag v-if="record.recommended" color="gold">推荐</a-tag>
            <a-tag v-if="record.versionCount" color="blue">v{{ record.versionCount }}</a-tag>
          </a-space>
        </template>

        <template v-else-if="column.key === 'action'">
          <a-space size="0">
            <a-button v-if="runningBriefForRow(record)" type="link" size="small"
              @click="openApprovalDetail(runningBriefForRow(record)!.id)">审批详情</a-button>
            <a-button v-else-if="rejectedBriefForRow(record)" type="link" size="small"
              @click="openApprovalDetail(rejectedBriefForRow(record)!.id)">审批信息</a-button>
            <a-button v-if="store.can('article:edit') && record.status !== -1" type="link" size="small"
              @click="router.push(`/articles/${record.id}/edit`)">编辑</a-button>
            <a-button v-if="store.can('article:view') && record.status !== -1" type="link" size="small"
              @click="router.push(`/articles/${record.id}/edit`)">查看</a-button>
            <template v-if="(record.status === 0 || record.status === 4) && store.can('article:edit')">
              <a-button type="link" size="small" @click="askSubmit(record)">提审</a-button>
            </template>
            <template v-if="record.status === 2 && store.can('article:publish')">
              <a-button type="link" size="small" @click="askPublish(record)">发布</a-button>
            </template>
            <template v-if="record.status === 6 && store.can('article:edit')">
              <a-button type="link" size="small" danger @click="askWithdraw(record)">撤回审批</a-button>
            </template>
            <template v-if="record.status === 1 && store.can('article:audit')">
              <a-button type="link" size="small" @click="askApprove(record)">通过</a-button>
              <a-button type="link" size="small" danger @click="openAskReject(record.id)">驳回</a-button>
            </template>
            <template v-if="record.status === 3 && store.can('article:publish')">
              <a-button type="link" size="small" danger @click="askOffline(record)">下线</a-button>
            </template>
            <template v-if="record.status !== -1 && store.can('article:pin')">
              <a-button type="link" size="small" @click="toggleFlag(record, 'pin')">
                {{ record.pinned ? '取消置顶' : '置顶' }}
              </a-button>
              <a-button type="link" size="small" @click="toggleFlag(record, 'recommend')">
                {{ record.recommended ? '取消推荐' : '推荐' }}
              </a-button>
            </template>
            <template v-if="record.status !== -1 && store.can('article:delete')">
              <a-button type="link" size="small" danger @click="askRecycle(record)">删除</a-button>
            </template>
            <template v-if="record.status === -1">
              <a-button v-if="store.can('article:delete')" type="link" size="small" @click="askRestore(record)">恢复</a-button>
              <a-button v-if="store.can('article:delete')" type="link" size="small" danger @click="askForever(record)">彻底删除</a-button>
            </template>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <a-modal
      centered
      v-model:open="rejectOpen"
      title="驳回稿件"
      @ok="async () => {
        if (rejectId != null) await act(() => rejectArticle(rejectId!, rejectNote), '已驳回')
      }"
    >
      <a-textarea v-model:value="rejectNote" :rows="3" placeholder="填写驳回理由（作者可见）" />
    </a-modal>

    <ApprovalDetailDrawer v-model:open="detailOpen" :instance-id="detailId" />
  </div>
</template>

<style scoped>
/* 表格最小宽度：横向滚动只发生在 .ft-scroll，操作列由 .ft-table 固定 */
.ft-page {
  --ft-min-width: 1100px;
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.title-cell {
  display: flex;
  flex-direction: column;
}

.title-cell .t {
  font-weight: 600;
}

.title-cell .s {
  font-size: 12px;
  opacity: 0.65;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
