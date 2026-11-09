<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-radio-group v-model:value="mode" button-style="solid" @change="onModeChange">
          <a-radio-button value="board">候选人看板</a-radio-button>
          <a-radio-button value="offers">Offer 列表</a-radio-button>
        </a-radio-group>
        <a-input-search
          v-model:value="keyword"
          placeholder="姓名 / 手机号 / 职位"
          allow-clear
          style="width: 240px"
          @search="onSearch"
        />
      </div>
      <div class="toolbar-right">
        <template v-if="mode === 'offers'">
          <a-select
            v-model:value="offerStatus"
            allow-clear
            placeholder="全部状态"
            style="width: 130px"
            :options="offerStatusOptions"
            @change="loadOffers"
          />
        </template>
        <template v-if="canManage">
          <a-button @click="openOfferModal()">发起 Offer</a-button>
          <a-button type="primary" @click="openCandidateModal()">
            <plus-outlined />新建候选人
          </a-button>
        </template>
      </div>
    </div>

    <div class="panel ft-grow">
      <div class="panel-head">
        <span>{{ mode === 'board' ? '候选人看板' : '录用 Offer' }}</span>
        <span class="muted">
          {{ mode === 'board' ? `共 ${candidateTotal} 位候选人` : `共 ${offerTotal} 条 Offer` }}
        </span>
      </div>

      <div v-if="mode === 'board'" class="panel-body board-body">
        <a-spin :spinning="candidateLoading">
          <div class="board">
            <div v-for="col in stages" :key="col.key" class="kb-col">
              <div class="kb-col-head">
                <span class="dot" :class="col.dot"></span>
                <span>{{ col.label }}</span>
                <span class="cnt">{{ grouped[col.key]?.length || 0 }}</span>
              </div>
              <div class="kb-list">
                <div v-for="c in grouped[col.key] || []" :key="c.id" class="kb-card">
                  <div class="kb-card-top">
                    <span class="kb-name">{{ c.name }}</span>
                    <a-tag :color="sourceColor(c.source)">{{ sourceText(c.source) }}</a-tag>
                  </div>
                  <div class="kb-line">{{ c.position }}<span v-if="c.orgPath" class="muted"> · {{ c.orgPath }}</span></div>
                  <div class="muted kb-line">
                    {{ c.mobile || '未填手机号' }}<span v-if="c.ownerName"> · {{ c.ownerName }}</span>
                  </div>
                  <div v-if="c.remark" class="muted kb-remark" :title="c.remark">{{ c.remark }}</div>
                  <div v-if="c.hasActiveOffer" class="kb-offer">
                    <a-tag :color="offerStatusColor(c.offerStatus)">{{ offerStatusText(c.offerStatus) }}</a-tag>
                  </div>
                  <div v-if="canManage" class="kb-actions">
                    <a class="act" @click="openCandidateModal(c)">编辑</a>
                    <a v-if="c.stage === 'RESUME'" class="act" @click="advanceToInterview(c)">到面试</a>
                    <a
                      v-if="c.stage !== 'REJECTED' && !c.hasActiveOffer"
                      class="act"
                      @click="openOfferModal(c)"
                    >发起 Offer</a>
                    <a-popconfirm
                      v-if="c.stage === 'REJECTED'"
                      title="恢复该候选人到面试中？"
                      ok-text="恢复"
                      cancel-text="取消"
                      @confirm="restoreCandidate(c)"
                    >
                      <a class="act">恢复</a>
                    </a-popconfirm>
                    <a-popconfirm
                      v-else
                      title="淘汰后不可再发起 Offer，确定淘汰？"
                      ok-text="淘汰"
                      cancel-text="取消"
                      @confirm="eliminateCandidate(c)"
                    >
                      <a class="act danger">淘汰</a>
                    </a-popconfirm>
                  </div>
                </div>
                <div v-if="!(grouped[col.key] || []).length" class="kb-empty">暂无候选人</div>
              </div>
            </div>
          </div>
        </a-spin>
      </div>

      <div v-else class="panel-body table-body">
        <a-table
          size="middle"
          row-key="id"
          :columns="offerColumns"
          :data-source="offers"
          :loading="offerLoading"
          :pagination="offerPagination"
          @change="onOfferTableChange"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'candidate'">
              <div>{{ record.candidateName }}</div>
              <div class="muted cell-sub">{{ record.candidateMobile || '—' }}</div>
            </template>
            <template v-else-if="column.key === 'salary'">
              <span>¥{{ money(record.salary) }}</span>
            </template>
            <template v-else-if="column.key === 'org'">
              <span class="muted">{{ record.orgPath || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="offerStatusColor(record.status)">{{ offerStatusText(record.status) }}</a-tag>
              <div v-if="record.remark" class="muted cell-sub" :title="record.remark">{{ record.remark }}</div>
            </template>
            <template v-else-if="column.key === 'archive'">
              <template v-if="record.employeeId">
                <a-tag color="green">已建档</a-tag>
                <div class="muted cell-sub">{{ record.employeeName }} · 待入职</div>
              </template>
              <span v-else class="muted">—</span>
            </template>
            <template v-else-if="column.key === 'action'">
              <div class="row-actions">
                <a v-if="briefIdForOffer(record)" class="act" @click="openApprovalDetail(briefIdForOffer(record)!)">
                  审批详情
                </a>
                <a-popconfirm
                  v-if="record.status === 'APPROVING' && canManage"
                  title="撤销后审批流程立即终止，确定撤销？"
                  ok-text="撤销"
                  cancel-text="取消"
                  @confirm="doCancelOffer(record)"
                >
                  <a class="act danger">撤销</a>
                </a-popconfirm>
                <a
                  v-if="record.status === 'APPROVED' && !record.employeeId && canManage"
                  class="act"
                  @click="doConvert(record)"
                >转建档</a>
                <span v-if="record.status === 'REJECTED' && canManage" class="muted">已结束</span>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </div>

    <!-- 候选人新增/编辑 -->
    <a-modal
      v-model:open="candidateModalOpen"
      :title="candidateForm.id ? '编辑候选人' : '新建候选人'"
      :width="640"
      :confirm-loading="candidateSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="saveCandidate"
    >
      <a-form ref="candidateFormRef" :model="candidateForm" :rules="candidateRules" :label-col="{ span: 5 }">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="姓名" name="name">
              <a-input v-model:value="candidateForm.name" placeholder="候选人姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" name="mobile">
              <a-input v-model:value="candidateForm.mobile" placeholder="手机号" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="应聘职位" name="position">
              <a-input v-model:value="candidateForm.position" placeholder="如：Java 工程师" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="来源" name="source">
              <a-select v-model:value="candidateForm.source" :options="sourceOptions" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="用人部门" name="orgId" :label-col="{ span: 5 }">
              <a-tree-select
                v-model:value="candidateForm.orgId"
                :tree-data="orgOptions"
                show-search
                tree-node-filter-prop="title"
                placeholder="选择用人部门"
                style="width: 100%"
                allow-clear
              />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="邮箱" name="email" :label-col="{ span: 5 }">
              <a-input v-model:value="candidateForm.email" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="备注" name="remark" :label-col="{ span: 5 }">
              <a-textarea v-model:value="candidateForm.remark" :rows="2" placeholder="面试评价、期望薪资等" />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>
    </a-modal>

    <!-- 发起录用 Offer -->
    <a-modal
      v-model:open="offerModalOpen"
      title="发起录用 Offer"
      :width="640"
      :confirm-loading="offerSaving"
      ok-text="提交审批"
      cancel-text="取消"
      @ok="saveOffer"
    >
      <a-alert
        type="info"
        show-icon
        banner
        style="margin-bottom: 14px"
        message="提交后进入审批中心：用人部门 → 人力资源中心；月薪超过档位线时增加总经理终审。审批通过自动生成待入职档案。"
      />
      <a-form ref="offerFormRef" :model="offerForm" :rules="offerRules" :label-col="{ span: 5 }">
        <a-form-item label="候选人" name="candidateId">
          <a-select
            v-model:value="offerForm.candidateId"
            show-search
            option-filter-prop="label"
            placeholder="选择候选人"
            :options="offerCandidateOptions"
            :disabled="!!offerForm.lockedCandidate"
            @change="onOfferCandidateChange"
          />
        </a-form-item>
        <a-form-item label="录用职位" name="position">
          <a-input v-model:value="offerForm.position" placeholder="录用职位" />
        </a-form-item>
        <a-form-item label="月薪(元)" name="salary">
          <a-input-number v-model:value="offerForm.salary" :min="1" :step="500" style="width: 100%" />
        </a-form-item>
        <a-form-item label="预计入职" name="expectedOnboardDate">
          <a-date-picker
            v-model:value="offerForm.expectedOnboardDate"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="录用部门" name="orgId">
          <a-tree-select
            v-model:value="offerForm.orgId"
            :tree-data="orgOptions"
            show-search
            tree-node-filter-prop="title"
            placeholder="选择录用部门"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="offerForm.remark" :rows="2" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <approval-detail-drawer
      v-model:open="approvalDrawerOpen"
      :instance-id="approvalInstanceId"
      @done="loadOffers"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import {
  cancelRecruitOffer,
  convertRecruitOffer,
  createRecruitCandidate,
  createRecruitOffer,
  eliminateRecruitCandidate,
  listRecruitCandidates,
  listRecruitOffers,
  orgTree,
  restoreRecruitCandidate,
  updateRecruitCandidate,
  type OrgNode,
  type RecruitCandidate,
  type RecruitOffer
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import ApprovalDetailDrawer from '@/components/ApprovalDetailDrawer.vue'
import {
  briefsForRow,
  buildBizRefs,
  fetchLatestApprovals,
  type ApprovalBrief
} from '@/api/approvals'

const store = useUserStore()
const canManage = computed(() => store.can('recruit:manage'))

type Mode = 'board' | 'offers'
const mode = ref<Mode>('board')
const keyword = ref('')
const candidateLoading = ref(false)
const offerLoading = ref(false)
const candidateRows = ref<RecruitCandidate[]>([])
const candidateTotal = ref(0)
const offers = ref<RecruitOffer[]>([])
const offerTotal = ref(0)
const offerPage = ref(1)
const offerPageSize = ref(10)
const offerStatus = ref<string | undefined>(undefined)

const stages = [
  { key: 'RESUME', label: '简历筛选', dot: 'dot-resume' },
  { key: 'INTERVIEW', label: '面试中', dot: 'dot-interview' },
  { key: 'OFFER', label: 'Offer 中', dot: 'dot-offer' },
  { key: 'REJECTED', label: '已淘汰', dot: 'dot-rejected' }
]

const grouped = computed<Record<string, RecruitCandidate[]>>(() => {
  const m: Record<string, RecruitCandidate[]> = {}
  for (const s of stages) m[s.key] = []
  for (const c of candidateRows.value) {
    if (!m[c.stage]) m[c.stage] = []
    m[c.stage].push(c)
  }
  return m
})

const sourceOptions = [
  { value: 'REFERRAL', label: '内推' },
  { value: 'HEADHUNTER', label: '猎头' },
  { value: 'WEBSITE', label: '官网' },
  { value: 'JOB_BOARD', label: '招聘网站' },
  { value: 'OTHER', label: '其他' }
]

const offerStatusOptions = [
  { value: 'APPROVING', label: '审批中' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回/撤销' }
]

const offerColumns = [
  { title: '候选人', key: 'candidate', width: 160 },
  { title: '录用职位', dataIndex: 'position', key: 'position', width: 160 },
  { title: '月薪', key: 'salary', width: 120 },
  { title: '预计入职', dataIndex: 'expectedOnboardDate', key: 'date', width: 120 },
  { title: '录用部门', key: 'org', width: 220 },
  { title: '状态', key: 'status', width: 180 },
  { title: '档案', key: 'archive', width: 150 },
  { title: '操作', key: 'action', width: 190 }
]

const offerPagination = computed(() => ({
  current: offerPage.value,
  pageSize: offerPageSize.value,
  total: offerTotal.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

/* ---------- 组织树 ---------- */
interface OrgOption {
  value: string
  title: string
  children?: OrgOption[]
}
const orgOptions = ref<OrgOption[]>([])

function toOrgOptions(nodes: OrgNode[]): OrgOption[] {
  return nodes.map((n) => ({
    value: n.id,
    title: n.name,
    children: n.children?.length ? toOrgOptions(n.children) : undefined
  }))
}

async function loadOrgs() {
  try {
    orgOptions.value = toOrgOptions((await orgTree()) || [])
  } catch {
    orgOptions.value = []
  }
}

/* ---------- 列表 ---------- */
async function loadCandidates() {
  candidateLoading.value = true
  try {
    const data = await listRecruitCandidates({
      keyword: keyword.value || undefined,
      page: 1,
      size: 500
    })
    candidateRows.value = data.list || []
    candidateTotal.value = data.total || 0
  } finally {
    candidateLoading.value = false
  }
}

const approvalBriefs = ref<ApprovalBrief[]>([])

async function loadOffers() {
  offerLoading.value = true
  try {
    const data = await listRecruitOffers({
      status: offerStatus.value,
      keyword: keyword.value || undefined,
      page: offerPage.value,
      size: offerPageSize.value
    })
    offers.value = data.list || []
    offerTotal.value = data.total || 0
    const refs = buildBizRefs(offers.value.map((o) => o.id), [
      'ehr.recruit.offer',
      'ehr.recruit.offer.senior'
    ])
    approvalBriefs.value = refs.length ? await fetchLatestApprovals(refs).catch(() => []) : []
  } finally {
    offerLoading.value = false
  }
}

function onModeChange() {
  if (mode.value === 'offers') loadOffers()
  else loadCandidates()
}

function onSearch() {
  if (mode.value === 'board') loadCandidates()
  else {
    offerPage.value = 1
    loadOffers()
  }
}

function onOfferTableChange(p: { current?: number; pageSize?: number }) {
  offerPage.value = p.current || 1
  offerPageSize.value = p.pageSize || 10
  loadOffers()
}

function briefIdForOffer(o: RecruitOffer) {
  const list = briefsForRow(approvalBriefs.value, o.id)
  return list.length ? list[0].id : null
}

/* ---------- 展示辅助 ---------- */
function sourceText(source?: string) {
  return sourceOptions.find((o) => o.value === source)?.label || '其他'
}
function sourceColor(source?: string) {
  if (source === 'REFERRAL') return 'blue'
  if (source === 'HEADHUNTER') return 'purple'
  return 'default'
}
function offerStatusText(status?: string) {
  if (status === 'APPROVING') return '审批中'
  if (status === 'APPROVED') return '已通过'
  if (status === 'REJECTED') return '已驳回/撤销'
  return '草稿'
}
function offerStatusColor(status?: string) {
  if (status === 'APPROVING') return 'processing'
  if (status === 'APPROVED') return 'green'
  if (status === 'REJECTED') return 'default'
  return 'default'
}
function money(v?: string) {
  if (!v) return '0'
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/* ---------- 候选人表单 ---------- */
const candidateModalOpen = ref(false)
const candidateSaving = ref(false)
const candidateFormRef = ref<any>()
const candidateForm = reactive({
  id: '',
  name: '',
  mobile: '',
  email: '',
  source: 'OTHER',
  position: '',
  orgId: undefined as string | undefined,
  remark: ''
})
const candidateRules = {
  name: [{ required: true, message: '请输入候选人姓名', trigger: 'blur' }],
  position: [{ required: true, message: '请输入应聘职位', trigger: 'blur' }],
  orgId: [{ required: true, message: '请选择用人部门', trigger: 'change' }]
}

function openCandidateModal(c?: RecruitCandidate) {
  candidateForm.id = c?.id || ''
  candidateForm.name = c?.name || ''
  candidateForm.mobile = c?.mobile || ''
  candidateForm.email = c?.email || ''
  candidateForm.source = c?.source || 'OTHER'
  candidateForm.position = c?.position || ''
  candidateForm.orgId = c?.orgId
  candidateForm.remark = c?.remark || ''
  candidateModalOpen.value = true
}

async function saveCandidate() {
  try {
    await candidateFormRef.value?.validate()
  } catch {
    return
  }
  candidateSaving.value = true
  try {
    const body = {
      name: candidateForm.name.trim(),
      mobile: candidateForm.mobile.trim() || undefined,
      email: candidateForm.email.trim() || undefined,
      source: candidateForm.source,
      position: candidateForm.position.trim(),
      orgId: candidateForm.orgId,
      remark: candidateForm.remark.trim() || undefined
    }
    if (candidateForm.id) {
      await updateRecruitCandidate(candidateForm.id, body)
      message.success('候选人已更新')
    } else {
      await createRecruitCandidate(body)
      message.success('候选人已创建')
    }
    candidateModalOpen.value = false
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    candidateSaving.value = false
  }
}

async function advanceToInterview(c: RecruitCandidate) {
  try {
    await updateRecruitCandidate(c.id, {
      name: c.name,
      mobile: c.mobile,
      email: c.email,
      source: c.source,
      position: c.position,
      orgId: c.orgId,
      remark: c.remark,
      stage: 'INTERVIEW'
    })
    message.success('已推进到面试中')
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function eliminateCandidate(c: RecruitCandidate) {
  try {
    await eliminateRecruitCandidate(c.id)
    message.success('已淘汰')
    loadCandidates()
    if (mode.value === 'offers') loadOffers()
  } catch (e: any) {
    message.error(e?.message || '淘汰失败')
  }
}

async function restoreCandidate(c: RecruitCandidate) {
  try {
    await restoreRecruitCandidate(c.id)
    message.success('已恢复到面试中')
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '恢复失败')
  }
}

/* ---------- Offer 表单 ---------- */
const offerModalOpen = ref(false)
const offerSaving = ref(false)
const offerFormRef = ref<any>()
const offerForm = reactive({
  candidateId: undefined as string | undefined,
  lockedCandidate: false,
  position: '',
  salary: 0 as number | null,
  expectedOnboardDate: '' as string | undefined,
  orgId: undefined as string | undefined,
  remark: ''
})
const offerRules = {
  candidateId: [{ required: true, message: '请选择候选人', trigger: 'change' }],
  position: [{ required: true, message: '请输入录用职位', trigger: 'blur' }],
  salary: [{ required: true, message: '请输入月薪', trigger: 'change' }],
  expectedOnboardDate: [{ required: true, message: '请选择预计入职日期', trigger: 'change' }],
  orgId: [{ required: true, message: '请选择录用部门', trigger: 'change' }]
}

const offerCandidateOptions = computed(() =>
  candidateRows.value
    .filter((c) => c.stage !== 'REJECTED' && !c.hasActiveOffer)
    .map((c) => ({
      value: c.id,
      label: `${c.name}（${c.position}）`,
      candidate: c
    }))
)

function openOfferModal(c?: RecruitCandidate) {
  offerForm.candidateId = c?.id
  offerForm.lockedCandidate = !!c
  offerForm.position = c?.position || ''
  offerForm.salary = 0
  offerForm.expectedOnboardDate = undefined
  offerForm.orgId = c?.orgId
  offerForm.remark = ''
  offerModalOpen.value = true
}

function onOfferCandidateChange(value: string) {
  const c = candidateRows.value.find((x) => x.id === value)
  if (!c) return
  offerForm.position = c.position
  offerForm.orgId = c.orgId
}

async function saveOffer() {
  try {
    await offerFormRef.value?.validate()
  } catch {
    return
  }
  if (!offerForm.candidateId || !offerForm.orgId || !offerForm.expectedOnboardDate) return
  offerSaving.value = true
  try {
    await createRecruitOffer({
      candidateId: offerForm.candidateId,
      position: offerForm.position.trim(),
      salary: Number(offerForm.salary || 0),
      expectedOnboardDate: offerForm.expectedOnboardDate,
      orgId: offerForm.orgId,
      remark: offerForm.remark.trim() || undefined
    })
    message.success('已提交录用审批')
    offerModalOpen.value = false
    loadCandidates()
    await loadOffers()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    offerSaving.value = false
  }
}

async function doCancelOffer(o: RecruitOffer) {
  try {
    await cancelRecruitOffer(o.id)
    message.success('已撤销')
    loadOffers()
    loadCandidates()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

async function doConvert(o: RecruitOffer) {
  try {
    await convertRecruitOffer(o.id)
    message.success('已生成待入职档案')
    loadOffers()
  } catch (e: any) {
    message.error(e?.message || '转建档失败')
  }
}

/* ---------- 审批详情 ---------- */
const approvalDrawerOpen = ref(false)
const approvalInstanceId = ref<string | null>(null)

function openApprovalDetail(id: string) {
  approvalInstanceId.value = id
  approvalDrawerOpen.value = true
}

onMounted(async () => {
  await loadOrgs()
  await Promise.all([loadCandidates().catch(() => {}), loadOffers().catch(() => {})])
  if (!canManage.value) mode.value = 'offers'
})
</script>

<style scoped>
.page-root {
  --ft-min-width: 1100px;
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
.panel-body.table-body {
  padding: 0;
}
.board-body {
  padding: 12px;
}
.board {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  min-height: 100%;
}
.kb-col {
  display: flex;
  flex-direction: column;
  min-height: 220px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--toolbar-bg);
  min-width: 0;
}
.kb-col-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--panel-border);
}
.kb-col-head .cnt {
  margin-left: auto;
  font-weight: 400;
  color: var(--muted);
  font-size: 12px;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
}
.dot-resume {
  background: #8c8c8c;
}
.dot-interview {
  background: #1677ff;
}
.dot-offer {
  background: #52c41a;
}
.dot-rejected {
  background: #bfbfbf;
}
.kb-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  overflow: auto;
}
.kb-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 7px;
  background: var(--panel-bg);
}
.kb-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kb-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-line {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-remark {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.kb-offer {
  margin-top: 2px;
}
.kb-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
}
.kb-actions .act {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 7px;
  border-radius: 5px;
  font-size: 12px;
  line-height: 1;
  transition: background-color 0.15s;
}
.kb-actions .act:hover {
  background: var(--code-bg);
}
.kb-actions .act.danger:hover {
  background: rgba(255, 77, 79, 0.1);
}
.kb-empty {
  padding: 16px 8px;
  text-align: center;
  color: var(--muted);
  font-size: 12px;
}
:deep(.ant-table-tbody > tr > td:last-child) {
  white-space: nowrap;
}
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  white-space: nowrap;
}
.row-actions .act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 26px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 13px;
  line-height: 1;
  transition: background-color 0.15s;
}
.row-actions .act:hover {
  background: var(--code-bg);
}
.row-actions .act.danger:hover {
  background: rgba(255, 77, 79, 0.1);
}
@media (max-width: 1200px) {
  .board {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}
</style>
