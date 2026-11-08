<template>
  <div class="page-root">
    <!-- 与统一账号中心审批中心同一套版式：下划线 tabs + 右上角工具按钮，不套面板边框/说明条 -->
    <div class="head ft-head">
      <a-tabs v-model:activeKey="tab" class="tabs" @change="onTabChange">
        <a-tab-pane v-for="t in visibleTabs" :key="t.key">
          <template #tab>
            <span class="tab">
              {{ t.label }}
              <a-badge
                v-if="t.key === 'todo' && todoCount > 0"
                :count="todoCount"
                :overflow-count="99"
                class="badge"
              />
              <a-badge
                v-else-if="t.key === 'handover' && handoverTodo.length"
                :count="handoverTodo.length"
                :overflow-count="99"
                class="badge"
              />
            </span>
          </template>
        </a-tab-pane>
      </a-tabs>
      <a-space :size="8">
        <a-select
          v-if="tab === 'mine'"
          v-model:value="statusFilter"
          :options="statusOptions"
          allow-clear
          placeholder="全部状态"
          style="width: 130px"
          @change="reloadMine"
        />
        <!-- 提交动作只在「离职申请」菜单里做，这里只做引导，避免两套表单各改一遍 -->
        <a-button v-if="canApplyResign" @click="$router.push('/my-resign')">
          <template #icon><export-outlined /></template>
          发起离职申请
        </a-button>
        <a-button @click="reload">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </a-space>
    </div>

    <!-- 审批中心实例：待我审批 / 已审批 / 我发起的 / 抄送我 / 我委托的 -->
    <section v-if="isApprovalTab" class="ft-scroll ft-bottom">
        <a-table
          class="ft-table approval-table"
          :class="{
            'approval-table-approved': tab === 'approved',
            'tbl-empty-mode': !approvalLoading && !approvalRows.length
          }"
          :columns="approvalTableColumns"
          :data-source="approvalRows"
          :loading="approvalLoading"
          row-key="id"
          size="middle"
          :custom-row="approvalRowProps"
          :pagination="approvalPagination"
          @change="onApprovalTableChange"
        >
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!approvalLoading" description="暂无审批单" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'approvalType'">
              <a-tag color="blue">{{ record.bizName || approvalBizName(record.bizType) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'title'">
              <div class="title-cell">
                <span class="tt">{{ record.title || record.bizName || '未命名单据' }}</span>
                <span class="sub">
                  {{ record.bizName || record.bizType }}<template v-if="record.bizNo"> · {{ record.bizNo }}</template>
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'applicant'">
              <div class="applicant">
                <a-avatar :size="22" class="av">{{ (record.applicantName || '?').slice(0, 1) }}</a-avatar>
                <span>{{ record.applicantName || '—' }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'progress'">
              <span v-if="record.status === 0" class="progress">
                第 {{ record.currentStep || 1 }} / {{ record.totalStep || 1 }} 步
              </span>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="approvalStatusColor(record.status)">
                {{ record.statusName || approvalStatusText(record.status) }}
              </a-tag>
              <a-tooltip v-if="record.callbackStatus === 3" title="审批已结束，但结果没能回传到业务系统">
                <a-tag color="orange" class="warn-tag">业务未同步</a-tag>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'myApproval'">
              <div class="my-approval">
                <a-tag :color="record.myApprovalStatus === 2 ? 'red' : 'green'">
                  {{ record.myApprovalStatusName || '已审批' }}
                </a-tag>
                <span class="muted">{{ fmtTime(record.myApprovalAt) }}</span>
                <div v-if="record.myApprovalStepName || record.myApprovalOpinion" class="my-approval-sub">
                  <span v-if="record.myApprovalStepName">{{ record.myApprovalStepName }}</span>
                  <a-tooltip v-if="record.myApprovalOpinion" :title="record.myApprovalOpinion">
                    <span>{{ record.myApprovalOpinion }}</span>
                  </a-tooltip>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              <span class="muted">{{ fmtTime(record.createdAt) }}</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small" @click.stop>
                <a-button type="link" size="small" @click="openApprovalDetail(record.id, 'view')">查看</a-button>
                <a-button
                  v-if="tab === 'todo' || record.myTaskId"
                  type="link"
                  size="small"
                  @click="openApprovalDetail(record.id, 'approve')"
                >审批</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
    </section>

    <!-- 待我交接 -->
    <section v-else-if="tab === 'handover'" class="ft-scroll ft-bottom">
        <a-table class="ft-table"
          :class="{ 'tbl-empty-mode': !handoverLoading && !handoverTodo.length }"
          :columns="handoverColumns"
          :data-source="handoverTodo"
          :loading="handoverLoading"
          row-key="id"
          size="middle"
          :pagination="handoverPagination"
          @change="onHandoverTableChange"
        >
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!handoverLoading" description="没有人指定你为交接人" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employee'">
              <div>{{ record.employeeName }}</div>
              <div class="muted cell-sub">{{ record.empNo }} · {{ record.orgName || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'handoverItems'">
              <template v-if="!record.handoverItems || !record.handoverItems.length">
                <span class="muted">
                  {{ record.handoverStatus === 2 ? '本单标记为「无需交接」' : '暂无交接项' }}
                </span>
                <div v-if="record.handover" class="muted hi-note">备注：{{ record.handover }}</div>
              </template>
              <template v-else>
                <div v-for="item in visibleHandoverItems(record)" :key="item.id" class="hi-row">
                  <span class="hi-seq">{{ item.seq }}.</span>
                  <a-tooltip :title="handoverItemTip(item)">
                    <span class="hi-content">{{ item.content }}</span>
                  </a-tooltip>
                  <a-tag :color="item.status === 1 ? 'green' : 'orange'" class="hi-tag">
                    {{ item.status === 1 ? '已确认' : '待确认' }}
                  </a-tag>
                </div>
                <div v-if="record.handoverItems.length > 3" class="muted hi-more">
                  共 {{ record.handoverItems.length }} 项，点「确认交接」查看全部
                </div>
                <div v-if="record.handover" class="muted hi-note">备注：{{ record.handover }}</div>
              </template>
            </template>
            <template v-else-if="column.key === 'progress'">
              <a-tag :color="record.handoverCompleted ? 'green' : 'orange'">
                {{ record.handoverStatusName }}
              </a-tag>
              <div class="muted">{{ record.handoverProgress }}</div>
            </template>
            <template v-else-if="column.key === 'resignDate'">
              <div>{{ record.resignDate }}</div>
              <div class="muted">{{ record.sourceName }}</div>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="record.status === 0" class="muted">待交接确认</div>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small">
                <a
                  v-if="record.approvalInstanceId && (record.status === 0 || record.status === 2)"
                  @click="openApprovalDetail(record.approvalInstanceId)"
                >{{ record.status === 2 ? '审批信息' : '审批详情' }}</a>
                <span v-if="record.status === 0 && record.handoverStatus !== 0" class="muted">已完成</span>
                <a v-else-if="record.status === 0" @click="openHandover(record)">确认交接</a>
                <span v-else-if="!record.approvalInstanceId && record.status !== 0" class="muted">—</span>
              </a-space>
            </template>
          </template>
        </a-table>
    </section>

    <!-- 我的 / 全部申请 -->
    <section v-else class="ft-scroll ft-bottom">
        <a-table class="ft-table"
          :class="{ 'tbl-empty-mode': !mineLoading && !mineRows.length }"
          :columns="mineColumns"
          :data-source="mineRows"
          :loading="mineLoading"
          row-key="id"
          size="middle"
          :pagination="minePagination"
          @change="onMineTableChange"
        >
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!mineLoading" description="暂无申请" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employee'">
              <div>{{ record.employeeName }}</div>
              <div class="muted cell-sub">{{ record.empNo }} · {{ record.orgName || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'source'">
              <a-tag :color="record.source === 'SELF' ? 'geekblue' : 'volcano'">
                {{ record.sourceName }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'resignDate'">
              <div>{{ record.resignDate }}</div>
              <div class="muted">{{ record.createdAt }} 提交</div>
            </template>
            <template v-else-if="column.key === 'handover'">
              <a-tag :color="record.handoverCompleted ? 'green' : 'orange'">
                {{ record.handoverStatusName || '—' }}
              </a-tag>
              <div class="muted">
                {{ record.handoverName || '—' }} · {{ record.handoverProgress }}
              </div>
              <a-tooltip v-if="handoverBrief(record)" :title="handoverBrief(record)">
                <div class="muted hi-brief">{{ handoverBrief(record) }}</div>
              </a-tooltip>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="record.status === 0 && record.handoverStatus === 0" class="muted">
                待 {{ record.handoverName }} 确认交接
              </div>
              <div v-else-if="record.status === 0" class="muted">交接完成后自动发起审批</div>
              <div v-else-if="record.status === 1 || record.status === 2" class="muted">
                {{ record.approverName || '—' }}<span v-if="record.approveNote">：{{ record.approveNote }}</span>
              </div>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space size="small">
                <a
                  v-if="record.approvalInstanceId && (record.status === 0 || record.status === 2)"
                  @click="openApprovalDetail(record.approvalInstanceId)"
                >
                  {{ record.status === 2 ? '审批信息' : '审批详情' }}
                </a>
                <a v-if="record.handoverMine && record.status === 0 && record.handoverStatus === 0"
                   @click="openHandover(record)">确认交接</a>
                <a-popconfirm
                  v-if="record.status === 0 && record.mine"
                  title="撤销后需要重新提交，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancel(record)"
                >
                  <a class="danger">撤销</a>
                </a-popconfirm>
                <span
                  v-if="!(record.approvalInstanceId && record.status === 0)
                    && !(record.status === 0 && record.mine)
                    && !(record.handoverMine && record.handoverStatus === 0)"
                  class="muted"
                >—</span>
              </a-space>
            </template>
          </template>
        </a-table>
    </section>

    <!-- 审批中心实例详情：表单快照 / 流程进度 / 审批人 / 意见 / 我的处理 -->
    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      :mode="approvalDrawerMode"
      @done="onApprovalDone"
    />

    <!-- 确认交接 -->
    <a-modal
      v-model:open="handoverOpen"
      title="确认工作交接"
      width="640px"
      centered
      destroy-on-close
      :footer="null"
    >
      <template v-if="handoverTarget">
        <a-descriptions :column="1" size="small" bordered class="mb12">
          <a-descriptions-item label="离职 / 减员">
            {{ handoverTarget.employeeName }}
            <span class="muted">{{ handoverTarget.empNo }} · {{ handoverTarget.orgName || '—' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="拟离职日期">{{ handoverTarget.resignDate || '——' }}</a-descriptions-item>
          <a-descriptions-item label="原因">{{ handoverTarget.reason || '—' }}</a-descriptions-item>
        </a-descriptions>
        <div class="block-title">交接项目（勾选后点「确认选中」，或一次性全部确认）</div>
        <handover-list
          :items="handoverTarget.handoverItems || []"
          mode="confirm"
          @confirm="doConfirmHandover"
        />
        <a-textarea
          v-model:value="handoverNote"
          :rows="2"
          :maxlength="255"
          placeholder="确认备注 / 遗留问题（可选，会记到已确认的项上）"
          class="mt12"
        />
        <div class="approve-actions mt12">
          <a-button @click="handoverOpen = false">关闭</a-button>
        </div>
      </template>
    </a-modal>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { ExportOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import HandoverList from '@/components/HandoverList.vue'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  cancelResignApply,
  confirmHandover,
  fetchMyHandovers,
  getResignApply,
  pageResignApplies,
  type HandoverItem,
  type ResignApplyItem
} from '@/api/ehr'
import { fetchApprovals, type ApprovalScope } from '@/api/approvals'
import { type ApprovalInstance } from '@/types/approval'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canApprove = computed(() => store.can('approval:approve') || store.can('leave:approve'))
const canApplyResign = computed(() => store.can('resign:apply'))

type TabKey = 'todo' | 'approved' | 'started' | 'cc' | 'delegated' | 'handover' | 'mine'
const APPROVAL_TABS: TabKey[] = ['todo', 'approved', 'started', 'cc', 'delegated']
const SCOPE_BY_TAB: Record<string, ApprovalScope> = {
  todo: 'pending',
  approved: 'approved',
  started: 'mine',
  cc: 'cc',
  delegated: 'delegated'
}
/** 下划线页签（与统一账号中心一致）：审批中心 5 个 + EHR 特有的交接/离职申请 */
const TABS: { key: TabKey; label: string }[] = [
  { key: 'todo', label: '待我审批' },
  { key: 'approved', label: '已审批' },
  { key: 'started', label: '我发起的' },
  { key: 'cc', label: '抄送我' },
  { key: 'delegated', label: '我委托的' },
  { key: 'handover', label: '待我交接' },
  { key: 'mine', label: '离职 / 减员申请' }
]

/** 页签 -> 基本权限码：审批是基本权限，所有角色默认拥有，缺少该码时隐藏页签 */
const TAB_PERM: Record<TabKey, string> = {
  todo: 'approval:todo',
  approved: 'approval:done',
  started: 'approval:started',
  cc: 'approval:cc',
  delegated: 'approval:delegated',
  handover: 'approval:handover',
  mine: 'approval:resign'
}
const visibleTabs = computed(() => TABS.filter((t) => store.can(TAB_PERM[t.key])))

/** 审批权由任务分派决定；默认进「待我审批」，无权限时落到第一个可见页签 */
const tab = ref<TabKey>('todo')
watch(
  visibleTabs,
  (list) => {
    if (list.length && !list.some((t) => t.key === tab.value)) tab.value = list[0].key
  },
  { immediate: true }
)

/* ---------------- 审批中心实例（五视图） ---------------- */
const approvalRows = ref<ApprovalInstance[]>([])
const approvalLoading = ref(false)
/** 「待我审批」角标单独维护：五个页签共用 approvalRows，切页签时不能把它替换成别的列表条数 */
const todoCount = ref(0)

const isApprovalTab = computed(() => APPROVAL_TABS.includes(tab.value))

type ApprovalColumn = { title: string; key: string; width?: number; ellipsis?: boolean }
/** 列结构 / 列宽与统一账号中心审批中心完全一致（合计 1000px）；操作列交给全局 .ft-table sticky 固定 */
const approvalColumns: ApprovalColumn[] = [
  { title: '审批类型', key: 'approvalType', width: 130 },
  { title: '单据', key: 'title', width: 220, ellipsis: true },
  { title: '发起人', key: 'applicant', width: 120 },
  { title: '进度', key: 'progress', width: 110 },
  { title: '状态', key: 'status', width: 140 },
  { title: '提交时间', key: 'createdAt', width: 160 },
  { title: '操作', key: 'action', width: 120 }
]

/** 「已审批」额外显示我这一票的结果、时间、环节与意见（合计 1200px），位置与统一账号中心一致 */
const approvalTableColumns = computed(() => {
  if (tab.value !== 'approved') return approvalColumns
  return [
    ...approvalColumns.slice(0, 4),
    { title: '我的审批', key: 'myApproval', width: 200 },
    ...approvalColumns.slice(4)
  ]
})

const BIZ_NAMES: Record<string, string> = {
  'ehr.onboard': '入职审批',
  'ehr.regularize': '转正审批',
  'ehr.emp_update': '人员信息变更',
  'ehr.resign': '离职 / 减员审批',
  'ehr.leave': '请假审批',
  'ehr.org_leader': '负责人变更审批'
}

function approvalBizName(t?: string) {
  return BIZ_NAMES[t || ''] || t || '审批'
}

function approvalStatusText(s?: number) {
  return ({ 0: '进行中', 1: '已通过', 2: '已驳回', 3: '已撤回', 4: '已终止' } as Record<number, string>)[s ?? -1] || '未知'
}

function fmtTime(s?: string) {
  return s ? String(s).replace('T', ' ').slice(0, 19) : '—'
}

async function loadApprovals() {
  const scope = SCOPE_BY_TAB[tab.value]
  if (!scope) return
  const isTodo = tab.value === 'todo'
  approvalLoading.value = true
  // 切换页签时先清空：五视图共用 approvalRows，不清空会在异步返回前短暂残留上一页签
  // （如「我发起的」）的数据，导致列表先显示旧内容。
  approvalRows.value = []
  try {
    approvalRows.value = (await fetchApprovals(scope)) || []
    // 待办角标只在「待我审批」加载时更新，其它页签的条数不覆盖它
    if (isTodo) todoCount.value = approvalRows.value.length
  } catch (e: any) {
    message.error(e?.message || '加载审批单失败')
    approvalRows.value = []
  } finally {
    approvalLoading.value = false
  }
}

/* ---------- 审批详情抽屉：通过/驳回/转办/加签/撤回都在里面完成 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)
/** view=只读查看（不显示通过/驳回）；approve=带处理按钮 */
const approvalDrawerMode = ref<'view' | 'approve'>('view')

function openApprovalDetail(id: string, mode: 'view' | 'approve' = 'view') {
  approvalInstanceId.value = id
  approvalDrawerMode.value = mode
  approvalDrawerOpen.value = true
}

/** 点行 = 只读查看（与统一账号中心一致）；操作列按钮自行 @click.stop 阻止冒泡 */
function approvalRowProps(record: ApprovalInstance) {
  return {
    style: 'cursor: pointer',
    onClick: () => openApprovalDetail(record.id, 'view')
  }
}

/* ---------------- 待我交接 ---------------- */

const handoverTodo = ref<ResignApplyItem[]>([])
const handoverLoading = ref(false)

const handoverColumns = [
  { title: '离职 / 减员', key: 'employee', width: 160 },
  { title: '交接内容', key: 'handoverItems', width: 285 },
  { title: '交接进度', key: 'progress', width: 105 },
  { title: '拟离职日期', key: 'resignDate', width: 130 },
  { title: '状态', key: 'status', width: 150 },
  { title: '操作', key: 'action', width: 90 }
]

/** 列表里最多铺 3 条交接内容，多的留在弹窗里看全；交接人一进页面就知道要接什么 */
function visibleHandoverItems(row: ResignApplyItem) {
  return (row.handoverItems || []).slice(0, 3)
}

/** 交接项 tooltip：列表里长内容会被省略，这里给全文 + 确认备注/时间 */
function handoverItemTip(item: HandoverItem) {
  const parts = [item.content]
  if (item.note) parts.push(`备注：${item.note}`)
  if (item.confirmedAt) parts.push(`确认于 ${item.confirmedAt}`)
  return parts.join(' ｜ ')
}

/** 申请列表的窄列只放一行摘要，完整清单仍以「确认交接」弹窗为准 */
function handoverBrief(row: ResignApplyItem) {
  const items = row.handoverItems || []
  if (!items.length) {
    // 无需交接的单不显示摘要；其余即使没有清单项也把整体备注带出来
    if (row.handoverStatus === 2) return ''
    return row.handover ? `备注：${row.handover}` : ''
  }
  const head = items.slice(0, 2).map((i) => `${i.seq}. ${i.content}`).join('；')
  return items.length > 2 ? `${head} 等 ${items.length} 项` : head
}

async function loadHandovers() {
  handoverLoading.value = true
  try {
    handoverTodo.value = (await fetchMyHandovers('pending')) || []
  } catch {
    // 没有人指定你为交接人时也是空表，不当成错误提示
    handoverTodo.value = []
  } finally {
    handoverLoading.value = false
  }
}

/* ---------------- 我的申请 ---------------- */

const mineRows = ref<ResignApplyItem[]>([])
const mineTotal = ref(0)
const mineLoading = ref(false)
const minePage = ref(1)
const mineSize = ref(10)
const statusFilter = ref<number | undefined>(undefined)
/** 有审批权的人可以切到「全部」，方便跟进已提交单据 */
const mineScope = computed(() => (canApprove.value || store.can('employee:resign') ? 'all' : 'mine'))

/** 统一走审批中心后：0 = 待交接或审批中，不再有「待人事中心审批」二级状态 */
const statusOptions = [
  { value: 0, label: '待交接 / 审批中' },
  { value: 1, label: '已通过' },
  { value: 2, label: '已驳回' }
]

/** 审批中心 / 待交接接口返回全量，做前端分页；分页条由 ft-bottom 贴到容器底部 */
const approvalPage = ref(1)
const approvalSize = ref(10)
const approvalPagination = computed(() => ({
  current: approvalPage.value,
  pageSize: approvalSize.value,
  total: approvalRows.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))
function onApprovalTableChange(pag: any) {
  approvalPage.value = pag?.current || 1
  approvalSize.value = pag?.pageSize || approvalSize.value
}
const handoverPage = ref(1)
const handoverSize = ref(10)
const handoverPagination = computed(() => ({
  current: handoverPage.value,
  pageSize: handoverSize.value,
  total: handoverTodo.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))
function onHandoverTableChange(pag: any) {
  handoverPage.value = pag?.current || 1
  handoverSize.value = pag?.pageSize || handoverSize.value
}

const minePagination = computed(() => ({
  current: minePage.value,
  pageSize: mineSize.value,
  total: mineTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const mineColumns = [
  { title: '员工', key: 'employee', width: 170 },
  { title: '来源', key: 'source', width: 110 },
  { title: '拟离职日期', key: 'resignDate', width: 150 },
  { title: '交接', key: 'handover', width: 215 },
  { title: '状态 / 审批', key: 'status', width: 190 },
  { title: '操作', key: 'action', width: 150 }
]

async function loadMine() {
  mineLoading.value = true
  try {
    const data = await pageResignApplies({
      scope: mineScope.value,
      status: statusFilter.value,
      page: minePage.value,
      size: mineSize.value
    })
    mineRows.value = data.list || []
    mineTotal.value = data.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    mineLoading.value = false
  }
}

function reloadMine() {
  minePage.value = 1
  loadMine()
}

function onMineTableChange(p: any) {
  minePage.value = p.current
  mineSize.value = p.pageSize
  loadMine()
}

/** 交接 / 离职申请的业务状态色沿用原配色 */
function statusColor(status: number) {
  return status === 0 || status === 4 ? 'orange' : status === 1 ? 'green' : status === 2 ? 'red' : 'default'
}

/** 审批实例状态色与统一账号中心一致：进行中用蓝色 processing */
function approvalStatusColor(s?: number) {
  return ({ 0: 'processing', 1: 'green', 2: 'red', 3: 'default', 4: 'default' } as Record<number, string>)[s ?? -1] || 'default'
}

function reload() {
  if (isApprovalTab.value) loadApprovals()
  else if (tab.value === 'handover') loadHandovers()
  else reloadMine()
}

function onTabChange() {
  approvalPage.value = 1
  handoverPage.value = 1
  reload()
}

/** 抽屉里完成审批动作后：当前 tab、交接、申请列表一起刷新（业务状态由回调同步） */
async function onApprovalDone() {
  await Promise.all([loadApprovals(), loadHandovers(), loadMine()])
}

/* ---------------- 确认交接（业务侧逐项确认，全部完成后自动发起审批中心实例） ---------------- */

const handoverOpen = ref(false)
const handoverTarget = ref<ResignApplyItem | null>(null)
const handoverNote = ref('')

async function openHandover(row: ResignApplyItem) {
  handoverTarget.value = row
  handoverNote.value = ''
  handoverOpen.value = true
  // 列表里的可能不是最新（别人刚确认过），打开时再取一次
  try {
    handoverTarget.value = await getResignApply(row.id)
  } catch {
    /* 用列表里的数据兜底 */
  }
}

async function doConfirmHandover(itemIds: string[]) {
  if (!handoverTarget.value) return
  try {
    const res = await confirmHandover(handoverTarget.value.id, {
      itemIds,
      note: handoverNote.value.trim()
    })
    handoverTarget.value = res
    if (res.handoverCompleted) {
      message.success('交接已全部确认，已发起审批中心流程')
      handoverOpen.value = false
    } else {
      message.success(`已确认，还剩 ${(res.handoverTotal || 0) - (res.handoverDone || 0)} 项`)
    }
    await Promise.all([loadHandovers(), loadMine()])
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  }
}

async function doCancel(row: ResignApplyItem) {
  try {
    await cancelResignApply(row.id)
    message.success('已撤销')
    loadMine()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

onMounted(() => {
  loadApprovals()
  loadHandovers()
  loadMine()
})
</script>

<style scoped>
/* 与统一账号中心审批中心同版式：下划线 tabs + 全宽表格，不用 .panel 边框/说明条 */
.page-root {
  --ft-min-width: 1100px;
  /* 全局 .page-root 带 12px gap，这里收掉，让 tabs 与表格只隔 4px */
  gap: 0;
}
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
.title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.title-cell .tt {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.title-cell .sub {
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.mb12 {
  margin-bottom: 12px;
}

.mt8 {
  margin-top: 8px;
}

.mt12 {
  margin-top: 12px;
}

.danger {
  color: #ff4d4f;
}

.block-title {
  margin: 4px 0 8px;
  font-size: 13px;
  font-weight: 500;
}

.approve-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 交接内容列：逐项清单，长文本省略，hover 通过 tooltip 看全文 */
.hi-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 20px;
  /* 表格是 auto 布局：不设上限的话，nowrap 长文本会把 td 的 min-content 撑到上千像素，
     整列失控、省略也不生效。这里把行宽收住，超长内容交给 tooltip 看全文。 */
  max-width: 340px;
}

.hi-row + .hi-row {
  margin-top: 2px;
}

.hi-seq {
  flex: none;
  color: #8c8c8c;
  font-variant-numeric: tabular-nums;
}

.hi-content {
  /* basis 必须是 0：用 auto 会以长文本宽度为基准，把整列 td 撑开，省略永远不生效 */
  flex: 1 1 0%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hi-tag {
  flex: none;
  margin-inline-end: 0;
  line-height: 18px;
}

.hi-more,
.hi-note,
.hi-brief {
  margin-top: 4px;
  font-size: 12px;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 与统一账号中心一致：列宽合计 1000px（已审批 1200px），表格铺满整宽；
   不再用固定布局 + 末尾透明占位列，表头浅灰与操作列 sticky 由全局 .ft-table 接管。 */
.approval-table {
  --ft-min-width: 1000px;
}
.approval-table-approved {
  --ft-min-width: 1200px;
}
.applicant {
  display: flex;
  align-items: center;
  gap: 8px;
}
.av {
  background: rgba(99, 102, 241, 0.16);
  color: #6366f1;
  font-size: 11px;
  flex: none;
}
.progress {
  font-size: 12.5px;
}
.warn-tag {
  margin-left: 6px;
  font-size: 11px;
}
.my-approval {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}
.my-approval-sub {
  flex: 0 0 100%;
  font-size: 12px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-approval-sub > * + *::before {
  content: ' · ';
}
.muted {
  color: var(--muted);
}
.approval-table :deep(.cell-sub) {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
