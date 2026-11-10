<template>
  <div class="notice-page ft-page">
    <div class="head ft-head">
      <a-tabs v-model:activeKey="tab" class="tabs">
        <a-tab-pane key="todo">
          <template #tab>
            <span class="tab">
              待办
              <a-badge v-if="unreadTodoCount" :count="unreadTodoCount" :overflow-count="99" class="badge" />
            </span>
          </template>
        </a-tab-pane>
        <a-tab-pane key="msg">
          <template #tab>
            <span class="tab">
              消息
              <a-badge v-if="unreadMsgCount" :count="unreadMsgCount" :overflow-count="99" class="badge" />
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
    </div>

    <!-- 筛选区：待办与消息共用，参考收银待办列表 -->
    <div class="filter-row ft-head">
      <a-input v-model:value="query.subject" placeholder="主题" allow-clear class="f-subject" />
      <a-select
        v-model:value="query.app"
        placeholder="应用"
        allow-clear
        class="f-app"
        :options="appOptions"
      />
      <a-input v-model:value="query.bizNo" placeholder="业务编码" allow-clear class="f-bizno" />
      <a-input v-model:value="query.applicant" placeholder="发起人" allow-clear class="f-applicant" />
      <a-button type="primary" @click="applyQuery">搜索</a-button>
      <a-button @click="resetQuery">重置</a-button>
      <a-button v-if="tab === 'msg'" class="push-right" :disabled="!hasUnreadMsg" @click="readAll">全部已读</a-button>
    </div>

    <section class="ft-scroll ft-bottom">
      <!-- 待办 / 消息共用同一套列：序号 / 主题 / 待办类型 / 业务编码 / 发起人 / 发起时间 -->
      <a-table
        class="tbl ft-table"
        :class="{ 'tbl-empty-mode': !loading && !visibleRows.length }"
        :columns="todoColumns"
        :data-source="visibleRows"
        :loading="loading"
        :pagination="{ pageSize: 10, size: 'small', hideOnSinglePage: true }"
        row-key="id"
        size="middle"
        :custom-row="(record: MsgItem) => ({ onClick: () => openItem(record) })"
      >
        <!-- 空态用页面级文案，避免和 antd 默认「暂无数据」叠成两层 -->
        <template #emptyText>
          <div class="tbl-empty">
            <a-empty v-if="!loading" :description="tab === 'todo' ? '没有待办事项' : '暂无消息'" />
          </div>
        </template>

        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'index'">{{ index + 1 }}</template>
          <template v-else-if="column.key === 'title'">
            <div class="title-cell">
              <a class="tt" :class="{ unread: !record.readAt }">{{ record.title }}</a>
              <span v-if="record.content" class="sub">{{ record.content }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            <span class="muted">{{ fmtTime(record.createdAt) }}</span>
          </template>
          <template v-else-if="column.key === 'applicantName'">
            {{ record.applicantName || '—' }}
          </template>
          <template v-else-if="column.key === 'bizNo'">
            <span class="mono">{{ record.bizNo || '—' }}</span>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 消息：弹窗查看内容，打开即置为已读 -->
    <a-modal
      v-model:open="msgOpen"
      :title="activeMsg?.title || '消息详情'"
      :footer="null"
      width="760px"
      centered
    >
      <div class="msg-detail">
        <div class="msg-meta">
          <span v-if="activeMsg?.todoType">模块：{{ activeMsg.todoType }}</span>
          <span v-if="activeMsg?.bizNo">业务编码：{{ activeMsg.bizNo }}</span>
          <span v-if="activeMsg?.createdAt">时间：{{ fmtTime(activeMsg.createdAt) }}</span>
        </div>
        <div class="msg-body">{{ activeMsg?.content || '暂无消息内容' }}</div>
      </div>
    </a-modal>

    <!-- 待办：直接拉起审批抽屉，处理完待办自动消失 -->
    <ApprovalDetailDrawer
      v-model:open="drawerOpen"
      :instance-id="activeId"
      mode="approve"
      @done="onApproved"
    />

    <!-- 面试待办：直接在统一账号中心维护面试结果，不跳转 EHR -->
    <a-modal
      v-model:open="ivOpen"
      :title="ivReadonly ? '面试结果' : '维护面试结果'"
      :footer="null"
      width="560px"
      centered
    >
      <a-spin :spinning="ivLoading">
        <div class="iv-meta">
          <div>
            <span class="iv-label">候选人</span>{{ ivForm.candidateName }}
            <span v-if="ivForm.position" class="muted"> · {{ ivForm.position }}</span>
          </div>
          <div><span class="iv-label">轮次</span>第 {{ ivForm.roundNo }} 轮面试</div>
          <div><span class="iv-label">时间</span>{{ ivForm.scheduledAt || '待定' }}</div>
          <div><span class="iv-label">方式</span>{{ ivMethodText }}</div>
          <div v-if="ivForm.location"><span class="iv-label">地点</span>{{ ivForm.location }}</div>
          <div v-if="ivReadonly"><span class="iv-label">状态</span>面试已结束，以下为已维护的结果</div>
        </div>
        <div class="iv-field">
          <div class="iv-label">本轮结果 <span v-if="!ivReadonly" class="req">*</span></div>
          <a-radio-group v-model:value="ivForm.result" :disabled="ivReadonly">
            <a-radio value="PASS">通过</a-radio>
            <a-radio value="FAIL">不通过</a-radio>
          </a-radio-group>
          <template v-if="!ivReadonly">
            <div v-if="ivForm.result === 'FAIL'" class="iv-warn">
              不通过将直接淘汰候选人，且其半年内不可网投。
            </div>
            <div v-else class="muted iv-tip">通过后由 HR 决定直接发 Offer 或安排下一轮。</div>
          </template>
        </div>
        <div class="iv-field">
          <div class="iv-label">评分</div>
          <a-rate v-model:value="ivForm.score" :disabled="ivReadonly" />
        </div>
        <div class="iv-field">
          <div class="iv-label">面试反馈 <span v-if="!ivReadonly" class="req">*</span></div>
          <a-textarea v-model:value="ivForm.feedback" :rows="4" :disabled="ivReadonly" placeholder="请填写本轮面试评价" />
        </div>
        <div class="iv-actions">
          <template v-if="ivReadonly">
            <a-button @click="ivOpen = false">关闭</a-button>
          </template>
          <template v-else>
            <a-button @click="ivOpen = false">取消</a-button>
            <a-button type="primary" :loading="ivSaving" @click="saveInterviewFeedback">提交反馈</a-button>
          </template>
        </div>
      </a-spin>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { message } from 'ant-design-vue'
import { fetchAllEnabledApplications } from '@/api/apps'
import { fetchApprovals } from '@/api/approvals'
import {
  fetchMyNotices,
  markNoticesRead,
  type NoticeMessage
} from '@/api/notice'
import ApprovalDetailDrawer from './components/ApprovalDetailDrawer.vue'
import { fetchMyInterviews, submitInterviewFeedback } from '@/api/interview'
import { useUserStore } from '@/stores/user'

/** 列表项：站内消息 + 直接由待审批单据合成的待办 */
type MsgItem = NoticeMessage & {
  /** 站内消息ID；由审批单合成的待办没有 */
  noticeId?: string
  /** 待办类型（审批业务名），「待办类型」列用 */
  todoType?: string
  /** 所属应用编码，「应用」筛选用 */
  appCode?: string
  /** 发起人，来自审批单 */
  applicantName?: string
  /** 关联审批单ID：能匹配上审批单时用它打开抽屉（站内待办的 bizId 历史数据可能是业务ID） */
  instId?: string
}

const loading = ref(false)
const rows = ref<MsgItem[]>([])
/** 概览数字卡带 ?kind= 进入：1 定位「待办」、2 定位「消息」，不传默认待办 */
const route = useRoute()
const tab = ref<'todo' | 'msg'>(route.query.kind === '2' ? 'msg' : 'todo')
watch(
  () => route.query.kind,
  (kind) => {
    tab.value = kind === '2' ? 'msg' : 'todo'
  }
)

/** 待办列表列：序号 / 主题 / 待办类型 / 业务编码 / 发起人 / 发起时间；消息用同一套列 */
const todoColumns = [
  { title: '序号', key: 'index', width: 70, align: 'center' },
  // 主题用百分比收窄，避免把其余列挤到最右侧；百分比合计不到 100%，余量留给序号列
  { title: '主题', key: 'title', width: '30%' },
  { title: '模块', dataIndex: 'todoType', key: 'todoType', width: '15%', ellipsis: true },
  { title: '业务编码', dataIndex: 'bizNo', key: 'bizNo', width: '20%', ellipsis: true },
  { title: '发起人', dataIndex: 'applicantName', key: 'applicantName', width: '12%', ellipsis: true },
  { title: '发起时间', key: 'createdAt', width: '15%' }
]

/* ---------------- 待办筛选：主题 / 应用 / 业务编码 / 发起人 ---------------- */

const query = reactive({ subject: '', app: undefined as string | undefined, bizNo: '', applicant: '' })
/** 点「搜索」后生效的条件快照，输入过程不实时过滤 */
const applied = reactive({ subject: '', app: undefined as string | undefined, bizNo: '', applicant: '' })

/** 「应用」下拉展示平台全部启用应用，不按登录人授权过滤（授权少的账号否则只看得到几个应用）；
 *  额外补「通用」项，对应没归属应用的待办/消息（同消息配置的「通用」分组）。
 *  接口失败时退回登录人可见应用，保证筛选仍可用。 */
const userStore = useUserStore()
const GENERAL_APP = '__general__'
const allApps = ref<Array<{ code: string; name: string }>>([])
const appOptions = computed(() => [
  { value: GENERAL_APP, label: '通用' },
  ...(allApps.value.length ? allApps.value : userStore.appList).map((a) => ({ value: a.code, label: a.name }))
])

async function loadAllApps() {
  try {
    allApps.value = (await fetchAllEnabledApplications()).data || []
  } catch {
    allApps.value = []
  }
}

const drawerOpen = ref(false)
const activeId = ref<string | null>(null)
/** 抽屉里处理完的待办，回来时同步成已读 */
const activeNoticeId = ref<string>('')

/* 面试待办：直接在当前页面维护面试结果 */
const ivOpen = ref(false)
const ivLoading = ref(false)
const ivSaving = ref(false)
const ivNoticeId = ref('')
/** 面试已结束（已维护结果）：只展示，不提供取消/提交反馈 */
const ivReadonly = ref(false)
const ivForm = reactive({
  id: '',
  candidateName: '',
  position: '',
  roundNo: 1,
  scheduledAt: '',
  method: '',
  location: '',
  result: 'PASS' as 'PASS' | 'FAIL',
  score: 4 as number | undefined,
  feedback: ''
})
const ivMethodText = computed(() => {
  const map: Record<string, string> = { ONSITE: '现场面试', VIDEO: '视频面试', PHONE: '电话面试' }
  return map[ivForm.method] || ivForm.method || '—'
})

async function openInterviewFeedback(m: MsgItem) {
  ivNoticeId.value = m.noticeId || ''
  ivForm.id = String(m.bizId || '')
  ivForm.candidateName = ''
  ivForm.position = ''
  ivForm.roundNo = 1
  ivForm.scheduledAt = ''
  ivForm.method = ''
  ivForm.location = ''
  ivForm.result = 'PASS'
  ivForm.score = 4
  ivForm.feedback = ''
  ivReadonly.value = false
  ivOpen.value = true
  ivLoading.value = true
  try {
    const res = await fetchMyInterviews()
    const t = (res.data || []).find((x) => String(x.id) === String(m.bizId))
    if (!t) {
      ivOpen.value = false
      message.warning('该面试已完成或不是您的面试')
      return
    }
    ivForm.candidateName = t.candidateName || ''
    ivForm.position = t.position || ''
    ivForm.roundNo = t.roundNo
    ivForm.scheduledAt = t.scheduledAt || ''
    ivForm.method = t.method || ''
    ivForm.location = t.location || ''
    if (t.status === 'DONE') {
      ivReadonly.value = true
      ivForm.result = (t.result as 'PASS' | 'FAIL') || 'PASS'
      ivForm.score = t.score ?? 0
      ivForm.feedback = t.feedback || ''
    }
  } catch (e: any) {
    ivOpen.value = false
    message.error(e?.message || '加载面试信息失败')
  } finally {
    ivLoading.value = false
  }
}

async function saveInterviewFeedback() {
  if (!ivForm.result) {
    message.warning('请选择本轮面试结果')
    return
  }
  if (!ivForm.feedback.trim()) {
    message.warning('请填写面试反馈')
    return
  }
  ivSaving.value = true
  try {
    await submitInterviewFeedback(ivForm.id, {
      score: ivForm.score,
      feedback: ivForm.feedback.trim(),
      result: ivForm.result
    })
    message.success(ivForm.result === 'FAIL' ? '反馈已提交，候选人已淘汰' : '反馈已提交')
    ivOpen.value = false
    if (ivNoticeId.value) {
      await markNoticesRead([ivNoticeId.value]).catch(() => {})
    }
    await load()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    ivSaving.value = false
  }
}

onMounted(() => {
  loadAllApps()
  load()
})

async function load() {
  loading.value = true
  try {
    // 待办以「待我审批」为准，站内消息只做补充：
    // 这样功能上线前就存在的在途单也会出现在待办里，审批完自动消失。
    const [noticeRes, pending] = await Promise.all([
      fetchMyNotices({ limit: 100 }),
      fetchApprovals('pending')
        .then((res) => res.data || [])
        .catch(() => [])
    ])
    // 审批单索引：站内待办缺发起人/业务编码时从对应审批单补齐。
    // 同时按「审批单ID」和「业务ID」两种键索引：历史待办通知里 bizId 存的是业务ID而不是审批单ID，
    // 只认一种就会匹配不上，于是既显示站内待办、又合成一条审批单待办（同一单出现两条）。
    const instMap = new Map<string, any>()
    pending.forEach((i: any) => {
      instMap.set(String(i.id), i)
      if (i.bizId) instMap.set(String(i.bizId), i)
    })
    // 同一审批单可能产生多条站内待办（多级/多人任务），按审批单去重，只保留最新一条
    const seenTodo = new Set<string>()
    const noticeItems = (noticeRes.data || [])
      .filter((m) => {
        if (m.kind !== 1) return true
        const inst = m.bizId ? instMap.get(String(m.bizId)) : undefined
        const key = inst ? String(inst.id) : m.bizId ? String(m.bizId) : `notice-${m.id}`
        if (seenTodo.has(key)) return false
        seenTodo.add(key)
        return true
      })
      .map<MsgItem>((m) => {
        const inst = m.bizId ? instMap.get(String(m.bizId)) : undefined
        return {
          ...m,
          noticeId: m.id,
          instId: inst ? String(inst.id) : undefined,
          // 模块取消息配置里的「模块」，没有时按审批单业务名兜底
          todoType: m.module || inst?.bizName || m.groupName,
          // 消息带模板推导的应用编码；缺省按 bizType 前缀兜底
          appCode: m.groupApp || bizTypeApp(inst?.bizType) || bizTypeApp(m.bizType),
          // 消息自带发起人（审批结果消息是实际审批人），待办再回退到审批单申请人
          applicantName: m.applicantName || inst?.applicantName,
          bizNo: m.bizNo || inst?.apprNo
        }
      })
    const items: MsgItem[] = noticeItems
    // 已覆盖的审批单：站内待办关联的审批单不再重复合成
    const covered = new Set<string>()
    items.forEach((m) => {
      if (m.kind !== 1) return
      if (m.instId) covered.add(m.instId)
      if (m.bizId) covered.add(String(m.bizId))
    })
    for (const inst of pending) {
      if (covered.has(String(inst.id))) continue
      items.push({
        id: `approval-${inst.id}`,
        kind: 1,
        title: inst.title,
        content: [inst.applicantName, inst.apprNo ? `单号 ${inst.apprNo}` : ''].filter(Boolean).join(' · '),
        bizType: inst.bizType,
        bizId: String(inst.id),
        instId: String(inst.id),
        bizNo: inst.apprNo,
        // 无站内记录的审批单待办：模块统一归「审批中心」，与消息配置里的审批规则模块一致
        todoType: '审批中心',
        appCode: bizTypeApp(inst.bizType),
        applicantName: inst.applicantName,
        groupName: inst.bizName || inst.bizType,
        createdAt: inst.createdAt
      })
    }
    items.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    rows.value = items
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** bizType 约定为「应用编码.业务」，取前缀作为所属应用 */
function bizTypeApp(bizType?: string) {
  if (!bizType) return undefined
  const idx = bizType.indexOf('.')
  return idx > 0 ? bizType.slice(0, idx) : bizType
}

/** 待办：只要还在途就一直显示，已读只影响红点；审批完成后由服务端不再返回，自然消失 */
const rawTodos = computed(() => rows.value.filter((m) => m.kind === 1))

/** 待办页签角标：未读待办数 */
const unreadTodoCount = computed(() => rawTodos.value.filter((m) => !m.readAt).length)

/** 按已生效的筛选条件过滤，待办与消息共用 */
function filterByQuery(list: MsgItem[]) {
  return list.filter((m) => {
    if (applied.subject && !(m.title || '').includes(applied.subject.trim())) return false
    if (applied.app && (m.appCode || GENERAL_APP) !== applied.app) return false
    if (applied.bizNo && !(m.bizNo || '').includes(applied.bizNo.trim())) return false
    if (applied.applicant && !(m.applicantName || '').includes(applied.applicant.trim())) return false
    return true
  })
}

/** 待办 tab：未读待办 */
const todoRows = computed(() => filterByQuery(rawTodos.value))

function applyQuery() {
  Object.assign(applied, {
    subject: query.subject,
    app: query.app,
    bizNo: query.bizNo,
    applicant: query.applicant
  })
}

function resetQuery() {
  Object.assign(query, { subject: '', app: undefined, bizNo: '', applicant: '' })
  applyQuery()
}

/** 后端返回 ISO，列表截到分钟 */
function fmtTime(v?: string) {
  return v ? v.replace('T', ' ').slice(0, 16) : ''
}

/** 消息 tab：全部消息（含已读），与待办共用同一套列和筛选 */
const msgRows = computed(() => filterByQuery(rows.value.filter((m) => m.kind === 2)))

/** 当前页签的数据 */
const visibleRows = computed(() => (tab.value === 'todo' ? todoRows.value : msgRows.value))

const unreadMsgCount = computed(() => msgRows.value.filter((m) => !m.readAt).length)

/** 「全部已读」只作用于消息：还有未读消息时按钮可点 */
const hasUnreadMsg = computed(() => rows.value.some((m) => m.kind === 2 && !m.readAt))

/** 弹窗展示的消息 */
const msgOpen = ref(false)
const activeMsg = ref<MsgItem | null>(null)

function isClickable(m: MsgItem) {
  // 待办：能打开审批抽屉即可点；消息：已读也能再点开查看
  return m.kind === 1 ? !!(m.instId || m.bizId) : true
}

async function openItem(m: MsgItem) {
  if (!isClickable(m)) return
  if (m.kind === 1 && m.bizType === 'EHR_INTERVIEW') {
    // 面试待办：直接弹出维护面试结果，不跳转 EHR
    await openInterviewFeedback(m)
    return
  }
  if (m.kind === 1 && m.link && /^https?:\/\//i.test(m.link)) {
    // 跨应用待办（如「关闭离职/减员员工账号」）：直接跳到对应应用；置读由业务处理完后服务端统一完成
    window.open(m.link, '_blank', 'noopener')
    return
  }
  if (m.kind === 1 && (m.instId || m.bizId)) {
    // 待办：打开审批抽屉，审批完成后再置读并移除；优先用审批单ID，历史 bizId 可能是业务ID
    activeId.value = m.instId || m.bizId || null
    activeNoticeId.value = m.noticeId || ''
    drawerOpen.value = true
    return
  }
  // 消息：打开弹窗时即置为已读
  activeMsg.value = m
  msgOpen.value = true
  await markRead(m)
}

async function onApproved() {
  const target = rows.value.find((m) => m.noticeId && m.noticeId === activeNoticeId.value)
  if (target) {
    await markRead(target)
  }
  // 审批动作可能连带状态变化，重新拉一次保证角标准确
  await load()
}

/** 全部已读：只批量置读消息；待办要处理完审批才会消，不提供一键已读 */
async function readAll() {
  const ids = rows.value.filter((m) => m.kind === 2 && m.noticeId && !m.readAt).map((m) => m.noticeId as string)
  try {
    if (ids.length) {
      await markNoticesRead(ids)
    }
    const now = new Date().toISOString()
    rows.value.forEach((m) => {
      if (m.kind === 2 && !m.readAt) m.readAt = now
    })
    message.success('已全部标记为已读')
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function markRead(m: MsgItem) {
  if (!m.noticeId || m.readAt) return
  try {
    await markNoticesRead([m.noticeId])
    m.readAt = new Date().toISOString()
  } catch (e: any) {
    message.error(e?.message || '标记已读失败')
  }
}
</script>

<style scoped>
/* 页签 + 右上角按钮：与审批中心同一套头部结构 */
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.tabs {
  flex: 1;
  min-width: 0;
}

.tabs :deep(.ant-tabs-nav) {
  margin-bottom: 8px;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.badge :deep(.ant-badge-count) {
  box-shadow: none;
  font-size: 11px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
}

/* 筛选区：各输入固定宽度，不撑成整行 */
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.f-subject,
.f-app,
.f-bizno {
  width: 150px;
}

.f-applicant {
  width: 120px;
}

/* 全部已读靠右，跟筛选输入区分开 */
.push-right {
  margin-left: auto;
}

/* 主题 + 副标题两行，和其他页面单据列一致 */
.title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  cursor: pointer;
}

/* 已读：浅灰、正常字重，仍然保留在列表里 */
.tt {
  color: #8c8c8c;
  font-weight: 400;
}

/* 未读：蓝色加粗，方便一眼区分 */
.tt.unread {
  color: #1677ff;
  font-weight: 600;
}

.sub {
  font-size: 12px;
  color: #8c8c8c;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: #8c8c8c;
}

/* 消息详情弹窗 */
.msg-detail {
  padding: 4px 0 8px;
}

.msg-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #8c8c8c;
}

.msg-body {
  min-height: 140px;
  font-size: 14px;
  line-height: 1.8;
  color: #262626;
  white-space: pre-wrap;
  word-break: break-word;
}

.mono {
  font-family: Consolas, Monaco, monospace;
  color: #595959;
}

/* 本页不需要冻结末列：覆盖 ft-table 的「末列吸右」，让「发起时间」表头与其它列表头同色 */
.ft-table :deep(.ant-table-thead > tr > th:last-child) {
  position: static;
  border-left: none;
  background: var(--table-head-bg) !important;
}

.ft-table :deep(.ant-table-tbody > tr > td:last-child) {
  position: static;
  border-left: none;
  background: inherit !important;
}

/* 行 hover：所有单元格统一底色，避免末列沿用固定列的白色背景而和其它列不一致。
   底色走主题变量，深色模式下悬停不会出现白块。 */
.ft-table :deep(.ant-table-tbody > tr:hover > td),
.ft-table :deep(.ant-table-tbody > tr:hover > td:last-child) {
  background: var(--table-row-hover) !important;
}

/* 空态：撑满表格剩余高度并垂直居中（同审批中心的 tbl-empty-mode） */
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

.iv-meta {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
  padding: 10px 12px;
  background: #fafafa;
  border-radius: 6px;
  font-size: 13px;
}
.iv-meta .iv-label {
  display: inline-block;
  width: 64px;
  color: #8c8c8c;
}
.iv-field {
  margin-bottom: 14px;
}
.iv-field > .iv-label {
  margin-bottom: 6px;
  color: #595959;
}
.iv-warn {
  margin-top: 6px;
  font-size: 12px;
  color: #cf1322;
}
.iv-tip {
  margin-top: 6px;
  font-size: 12px;
}
.req {
  color: #cf1322;
}
.iv-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.tbl-empty {
  height: 100%;
  min-height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
