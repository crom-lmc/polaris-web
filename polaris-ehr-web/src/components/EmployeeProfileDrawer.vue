<template>
  <a-drawer
    :open="open"
    :width="780"
    :title="profile?.employee ? `${profile.employee.name} · 人员档案` : '人员档案'"
    destroy-on-close
    @close="emit('update:open', false)"
  >
    <!-- 仅「待关闭账号」显示：从消息中心待办跳进来时，直接在抽屉右上角完成关闭 -->
    <template #extra>
      <a-popconfirm
        v-if="profile?.employee?.status === 55"
        title="关闭后档案置为「已离职」并停用统一账号，确定关闭账号？"
        ok-text="关闭账号"
        cancel-text="取消"
        @confirm="doCloseAccount"
      >
        <a-button danger size="small">关闭账号</a-button>
      </a-popconfirm>
    </template>
    <a-spin :spinning="loading">
      <!-- 基本信息（卡片） -->
      <div class="info-card">
        <div class="card-title">
          基本信息
          <a-tag :color="statusColor(profile?.employee?.status)" class="status-tag">
            {{ statusLabel(profile?.employee?.status, profile?.employee?.statusName) }}
          </a-tag>
        </div>
        <a-descriptions :column="3" size="small" bordered class="info-desc">
          <a-descriptions-item label="工号">{{ profile?.employee?.empNo || '—' }}</a-descriptions-item>
          <a-descriptions-item label="姓名">{{ profile?.employee?.name || '—' }}</a-descriptions-item>
          <a-descriptions-item label="性别">{{ genderText(profile?.employee?.gender) }}</a-descriptions-item>

          <a-descriptions-item label="出生日期">
            {{ profile?.employee?.birthday || '—' }}
            <span v-if="profile?.employee?.age != null" class="muted">（{{ profile.employee.age }} 岁）</span>
          </a-descriptions-item>
          <a-descriptions-item label="民族">{{ profile?.employee?.nationName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="籍贯">{{ profile?.employee?.nativePlace || '—' }}</a-descriptions-item>

          <a-descriptions-item label="身份证号">
            <span class="mono">{{ profile?.employee?.idCard || '—' }}</span>
          </a-descriptions-item>
          <a-descriptions-item label="婚姻状况">{{ profile?.employee?.maritalStatusName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="政治面貌">{{ profile?.employee?.politicalStatusName || '—' }}</a-descriptions-item>

          <a-descriptions-item label="最高学历">{{ profile?.employee?.educationName || '—' }}</a-descriptions-item>
          <a-descriptions-item label="职位">{{ profile?.employee?.position || '—' }}</a-descriptions-item>
          <a-descriptions-item label="入职日期">{{ profile?.employee?.hireDate || '—' }}</a-descriptions-item>
          <a-descriptions-item label="试用期" :span="2">{{ probationSummary }}</a-descriptions-item>

          <a-descriptions-item label="所属组织" :span="2">
            <a-tooltip :title="profile?.employee?.orgPathName">
              <span class="ellipsis">{{ profile?.employee?.orgName || profile?.employee?.orgPathName || '—' }}</span>
            </a-tooltip>
          </a-descriptions-item>
          <a-descriptions-item label="现居住址">
            {{ profile?.employee?.currentAddress || '—' }}
          </a-descriptions-item>

          <a-descriptions-item label="手机号">{{ profile?.employee?.mobile || '—' }}</a-descriptions-item>
          <a-descriptions-item label="邮箱" :span="2">
            <span class="mono">{{ profile?.employee?.email || '—' }}</span>
          </a-descriptions-item>

          <a-descriptions-item label="紧急联系人">{{ profile?.employee?.emergencyContact || '—' }}</a-descriptions-item>
          <a-descriptions-item label="紧急电话">{{ profile?.employee?.emergencyPhone || '—' }}</a-descriptions-item>
          <a-descriptions-item label="登录账号">
            <template v-if="profile?.employee?.accountUsername">
              <a-tag color="green">已开户</a-tag>
              <span class="mono">{{ profile.employee.accountUsername }}</span>
            </template>
            <a-tag v-else color="orange">未开户</a-tag>
          </a-descriptions-item>

          <a-descriptions-item v-if="profile?.employee?.remark" label="备注" :span="3">
            {{ profile.employee.remark }}
          </a-descriptions-item>
        </a-descriptions>
      </div>

      <!-- 四类子档案 -->
      <a-tabs v-model:active-key="activeTab" class="profile-tabs">
        <!-- 银行卡 -->
        <a-tab-pane key="banks" :tab="`银行卡（${profile?.banks?.length || 0}）`">
          <div class="sub-toolbar">
            <span class="muted">「工资卡」标记用于发薪，每张档案至多一张</span>
            <a-button v-if="canEdit" size="small" type="primary" @click="openBankModal()">新增银行卡</a-button>
          </div>
          <a-table
            :columns="bankColumns"
            :data-source="profile?.banks || []"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'bank'">
                {{ record.bankName || record.bank }}
              </template>
              <template v-else-if="column.key === 'accountNo'">
                <span class="mono">{{ record.accountNo }}</span>
              </template>
              <template v-else-if="column.key === 'isPrimary'">
                <a-tag v-if="record.isPrimary === 1" color="gold">工资卡</a-tag>
                <span v-else class="muted">—</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a v-if="canEdit" @click="openBankModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这张卡？" ok-text="删除" cancel-text="取消" @confirm="removeBank(record)">
                    <a v-if="canEdit" class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 教育背景 -->
        <a-tab-pane key="educations" :tab="`教育背景（${profile?.educations?.length || 0}）`">
          <div class="sub-toolbar">
            <span class="muted">按入学时间倒序展示</span>
            <a-button v-if="canEdit" size="small" type="primary" @click="openEduModal()">新增教育经历</a-button>
          </div>
          <a-table
            :columns="eduColumns"
            :data-source="profile?.educations || []"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'school'">
                <b>{{ record.school }}</b>
                <div v-if="record.major" class="muted">{{ record.major }}</div>
              </template>
              <template v-else-if="column.key === 'degree'">{{ record.degreeName || record.degree }}</template>
              <template v-else-if="column.key === 'range'">
                {{ record.startDate || '—' }} ~ {{ record.endDate || '至今' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a v-if="canEdit" @click="openEduModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这段教育经历？" ok-text="删除" cancel-text="取消" @confirm="removeEdu(record)">
                    <a v-if="canEdit" class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 工作经历 -->
        <a-tab-pane key="works" :tab="`工作经历（${profile?.works?.length || 0}）`">
          <div class="sub-toolbar">
            <span class="muted">入职本公司前的工作记录</span>
            <a-button v-if="canEdit" size="small" type="primary" @click="openWorkModal()">新增工作经历</a-button>
          </div>
          <a-table
            :columns="workColumns"
            :data-source="profile?.works || []"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'company'">
                <b>{{ record.company }}</b>
                <div v-if="record.position" class="muted">{{ record.position }}</div>
              </template>
              <template v-else-if="column.key === 'range'">
                {{ record.startDate || '—' }} ~ {{ record.endDate || '至今' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a v-if="canEdit" @click="openWorkModal(record)">编辑</a>
                  <a-popconfirm title="确定删除这段工作经历？" ok-text="删除" cancel-text="取消" @confirm="removeWork(record)">
                    <a v-if="canEdit" class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>

        <!-- 合同（P1-1） -->
        <a-tab-pane v-if="canContractView" key="contracts" tab="合同">
          <EmployeeContractPanel :employee-id="employeeId" :can-manage="canContractManage" />
        </a-tab-pane>

        <!-- 档案附件（P1-1） -->
        <a-tab-pane v-if="canAttachmentView" key="attachments" tab="档案附件">
          <EmployeeAttachmentPanel :employee-id="employeeId" :can-manage="canContractManage || !!canEdit" />
        </a-tab-pane>

        <!-- 家庭成员 -->
        <a-tab-pane key="families" :tab="`家庭成员（${profile?.families?.length || 0}）`">
          <div class="sub-toolbar">
            <span class="muted">仅 HR 可见，用于紧急联系与福利场景</span>
            <a-button v-if="canEdit" size="small" type="primary" @click="openFamilyModal()">新增家庭成员</a-button>
          </div>
          <a-table
            :columns="familyColumns"
            :data-source="profile?.families || []"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'relation'">{{ record.relationName || record.relation }}</template>
              <template v-else-if="column.key === 'name'"><b>{{ record.name }}</b></template>
              <template v-else-if="column.key === 'action'">
                <a-space size="small">
                  <a v-if="canEdit" @click="openFamilyModal(record)">编辑</a>
                  <a-popconfirm title="确定删除该成员？" ok-text="删除" cancel-text="取消" @confirm="removeFamily(record)">
                    <a v-if="canEdit" class="danger">删除</a>
                  </a-popconfirm>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </a-spin>

    <!-- 银行卡编辑 -->
    <a-modal
      v-model:open="bankModal.open"
      :title="bankModal.editing ? '编辑银行卡' : '新增银行卡'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="bankModal.saving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitBank"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="银行" required>
              <a-select v-model:value="bankModal.form.bank" :options="dicts.bank" placeholder="选择银行" show-search option-filter-prop="label" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="是否工资卡">
              <a-switch v-model:checked="bankModal.form.isPrimary" checked-children="工资卡" un-checked-children="普通" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="卡号" required>
              <a-input v-model:value="bankModal.form.accountNo" :maxlength="32" placeholder="8-32 位数字" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="持卡人" required>
              <a-input v-model:value="bankModal.form.holderName" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="开户行/支行">
          <a-input v-model:value="bankModal.form.branch" :maxlength="128" placeholder="如 工行西安高新支行" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="bankModal.form.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 教育背景编辑 -->
    <a-modal
      v-model:open="eduModal.open"
      :title="eduModal.editing ? '编辑教育经历' : '新增教育经历'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="eduModal.saving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitEdu"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="学校" required>
              <a-input v-model:value="eduModal.form.school" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="专业">
              <a-input v-model:value="eduModal.form.major" :maxlength="128" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="学历" required>
              <a-select v-model:value="eduModal.form.degree" :options="dicts.education" placeholder="选择学历" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="起止时间">
              <a-range-picker v-model:value="eduModal.form.range" value-format="YYYY-MM-DD" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-input v-model:value="eduModal.form.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 工作经历编辑 -->
    <a-modal
      v-model:open="workModal.open"
      :title="workModal.editing ? '编辑工作经历' : '新增工作经历'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="workModal.saving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitWork"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="工作单位" required>
              <a-input v-model:value="workModal.form.company" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="职位">
              <a-input v-model:value="workModal.form.position" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="起止时间">
          <a-range-picker v-model:value="workModal.form.range" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
        <a-form-item label="离职原因">
          <a-input v-model:value="workModal.form.leaveReason" :maxlength="255" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="workModal.form.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 家庭成员编辑 -->
    <a-modal
      v-model:open="familyModal.open"
      :title="familyModal.editing ? '编辑家庭成员' : '新增家庭成员'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="familyModal.saving"
      width="520px"
      centered
      destroy-on-close
      @ok="submitFamily"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="关系" required>
              <a-select v-model:value="familyModal.form.relation" :options="dicts.familyRelation" placeholder="选择关系" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="familyModal.form.name" :maxlength="64" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="工作单位">
              <a-input v-model:value="familyModal.form.company" :maxlength="128" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系电话" :validate-status="familyPhoneStatus.status" :help="familyPhoneStatus.help">
              <a-input v-model:value="familyModal.form.phone" :maxlength="11" placeholder="11 位手机号" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="备注">
          <a-input v-model:value="familyModal.form.remark" :maxlength="255" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-drawer>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  addBank,
  addEducation,
  addFamily,
  addWork,
  deleteBank,
  deleteEducation,
  deleteFamily,
  deleteWork,
  bizOptions,
  closeAccountEmployee,
  employeeProfile,
  updateBank,
  updateEducation,
  updateFamily,
  updateWork,
  type BankItem,
  type DictOption,
  type EducationItem,
  type EmployeeProfile,
  type FamilyItem,
  type WorkItem
} from '@/api/ehr'
import { statusColor, statusLabel } from '@/constants/employeeStatus'
import EmployeeContractPanel from './EmployeeContractPanel.vue'
import EmployeeAttachmentPanel from './EmployeeAttachmentPanel.vue'
import { useUserStore } from '@/stores/user'

const props = defineProps<{
  open: boolean
  employeeId?: string
  canEdit?: boolean
}>()

const store = useUserStore()
const canContractView = computed(() => store.can('contract:view'))
const canContractManage = computed(() => store.can('contract:manage'))
const canAttachmentView = computed(() => store.can('contract:view') || store.can('employee:view'))

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  /** 关闭账号成功：父页面刷新列表，保持状态一致 */
  (e: 'closed'): void
}>()

const loading = ref(false)
const profile = ref<EmployeeProfile | null>(null)
const activeTab = ref('banks')

async function load() {
  if (!props.employeeId) return
  loading.value = true
  try {
    profile.value = await employeeProfile(props.employeeId)
  } catch (e: any) {
    message.error(e?.message || '加载档案失败')
  } finally {
    loading.value = false
  }
}

/** 关闭账号：仅「待关闭账号」(55) 可见；成功后档案变「已离职」，服务端会统一置读群发待办 */
async function doCloseAccount() {
  if (!props.employeeId) return
  try {
    await closeAccountEmployee(props.employeeId)
    message.success('账号已关闭，员工状态已更新为已离职')
    await load()
    emit('closed')
  } catch (e: any) {
    message.error(e?.message || '关闭账号失败')
  }
}

watch(
  () => [props.open, props.employeeId],
  ([o]) => {
    if (o) {
      activeTab.value = 'banks'
      load()
    }
  }
)

/* ---------- 字典（懒加载一次） ---------- */
const dicts = reactive<{ bank: DictOption[]; education: DictOption[]; familyRelation: DictOption[] }>({
  bank: [],
  education: [],
  familyRelation: []
})
let dictsLoaded = false
async function loadDicts() {
  if (dictsLoaded) return
  dictsLoaded = true
  const [bank, edu, rel] = await Promise.all([
    bizOptions('bank').catch(() => []),
    bizOptions('education').catch(() => []),
    bizOptions('family_relation').catch(() => [])
  ])
  dicts.bank = bank
  dicts.education = edu
  dicts.familyRelation = rel
}

/* ---------- 子表列定义 ---------- */
const actionCol = { title: '操作', key: 'action', width: 96 }

const bankColumns = computed(() => [
  { title: '银行', key: 'bank', width: 110 },
  { title: '卡号', key: 'accountNo', width: 170 },
  { title: '持卡人', dataIndex: 'holderName', key: 'holderName', width: 90 },
  { title: '开户行', dataIndex: 'branch', key: 'branch' },
  { title: '工资卡', key: 'isPrimary', width: 80 },
  ...(props.canEdit ? [actionCol] : [])
])

const eduColumns = computed(() => [
  { title: '学校 / 专业', key: 'school', width: 220 },
  { title: '学历', key: 'degree', width: 90 },
  { title: '起止时间', key: 'range', width: 180 },
  ...(props.canEdit ? [actionCol] : [])
])

const workColumns = computed(() => [
  { title: '单位 / 职位', key: 'company', width: 220 },
  { title: '起止时间', key: 'range', width: 180 },
  { title: '离职原因', dataIndex: 'leaveReason', key: 'leaveReason' },
  ...(props.canEdit ? [actionCol] : [])
])

const familyColumns = computed(() => [
  { title: '关系', key: 'relation', width: 80 },
  { title: '姓名', dataIndex: 'name', key: 'name', width: 90 },
  { title: '工作单位', dataIndex: 'company', key: 'company' },
  { title: '电话', dataIndex: 'phone', key: 'phone', width: 120 },
  ...(props.canEdit ? [actionCol] : [])
])

function genderText(g?: number) {
  return g === 1 ? '男' : g === 2 ? '女' : '—'
}

/* 试用期：免试用期一句话说明；否则「N 个月，预计 yyyy-MM-dd 转正」（日期由后端按入职日期推导） */
const probationSummary = computed(() => {
  const e = profile.value?.employee
  if (!e) return '—'
  if (e.exemptProbation) return '免试用期（入职即正式员工）'
  if (!e.probationMonths) return '—'
  return `${e.probationMonths} 个月${e.expectedRegularizeDate ? `，预计 ${e.expectedRegularizeDate} 转正` : ''}`
})

const familyPhoneStatus = computed(() => {
  const p = (familyModal.form.phone || '').trim()
  if (!p) return { status: undefined as '' | 'error' | undefined, help: '' }
  return /^1[3-9]\d{9}$/.test(p)
    ? { status: undefined as '' | 'error' | undefined, help: '' }
    : { status: 'error' as const, help: '手机号格式不正确' }
})

/* ---------- 银行卡 ---------- */
const bankModal = reactive<{
  open: boolean
  saving: boolean
  editing: BankItem | null
  form: { bank?: string; accountNo: string; holderName: string; branch: string; isPrimary: boolean; remark: string }
}>({
  open: false,
  saving: false,
  editing: null,
  form: { bank: undefined, accountNo: '', holderName: '', branch: '', isPrimary: false, remark: '' }
})

function openBankModal(row?: BankItem) {
  loadDicts()
  bankModal.editing = row || null
  bankModal.form.bank = row?.bank
  bankModal.form.accountNo = row?.accountNo || ''
  bankModal.form.holderName = row?.holderName || profile.value?.employee?.name || ''
  bankModal.form.branch = row?.branch || ''
  bankModal.form.isPrimary = row?.isPrimary === 1
  bankModal.form.remark = row?.remark || ''
  bankModal.open = true
}

async function submitBank() {
  const f = bankModal.form
  if (!f.bank) return message.warning('请选择银行')
  if (!/^\d{8,32}$/.test((f.accountNo || '').trim())) return message.warning('卡号应为 8-32 位数字')
  if (!f.holderName.trim()) return message.warning('持卡人必填')
  bankModal.saving = true
  const body = {
    bank: f.bank,
    accountNo: f.accountNo.trim(),
    holderName: f.holderName.trim(),
    branch: f.branch.trim(),
    isPrimary: f.isPrimary ? 1 : 0,
    remark: f.remark.trim()
  }
  try {
    if (bankModal.editing) {
      await updateBank(props.employeeId!, bankModal.editing.id, body)
    } else {
      await addBank(props.employeeId!, body)
    }
    message.success('已保存')
    bankModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    bankModal.saving = false
  }
}

async function removeBank(row: BankItem) {
  try {
    await deleteBank(props.employeeId!, row.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ---------- 教育背景 ---------- */
const eduModal = reactive<{
  open: boolean
  saving: boolean
  editing: EducationItem | null
  form: { school: string; major: string; degree?: string; range: [string, string] | undefined; remark: string }
}>({
  open: false,
  saving: false,
  editing: null,
  form: { school: '', major: '', degree: undefined, range: undefined, remark: '' }
})

function openEduModal(row?: EducationItem) {
  loadDicts()
  eduModal.editing = row || null
  eduModal.form.school = row?.school || ''
  eduModal.form.major = row?.major || ''
  eduModal.form.degree = row?.degree
  eduModal.form.range =
    row?.startDate && row?.endDate ? [row.startDate, row.endDate] : row?.startDate ? [row.startDate, ''] : undefined
  eduModal.form.remark = row?.remark || ''
  eduModal.open = true
}

async function submitEdu() {
  const f = eduModal.form
  if (!f.school.trim()) return message.warning('学校必填')
  if (!f.degree) return message.warning('请选择学历')
  if (!f.range?.[0]) return message.warning('请选择在校时间')
  if (f.range[1] && f.range[1] < f.range[0]) return message.warning('毕业日期不能早于入学日期')
  eduModal.saving = true
  const body = {
    school: f.school.trim(),
    major: f.major.trim(),
    degree: f.degree,
    startDate: f.range[0],
    endDate: f.range[1] || null,
    remark: f.remark.trim()
  }
  try {
    if (eduModal.editing) {
      await updateEducation(props.employeeId!, eduModal.editing.id, body)
    } else {
      await addEducation(props.employeeId!, body)
    }
    message.success('已保存')
    eduModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    eduModal.saving = false
  }
}

async function removeEdu(row: EducationItem) {
  try {
    await deleteEducation(props.employeeId!, row.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ---------- 工作经历 ---------- */
const workModal = reactive<{
  open: boolean
  saving: boolean
  editing: WorkItem | null
  form: { company: string; position: string; range: [string, string] | undefined; leaveReason: string; remark: string }
}>({
  open: false,
  saving: false,
  editing: null,
  form: { company: '', position: '', range: undefined, leaveReason: '', remark: '' }
})

function openWorkModal(row?: WorkItem) {
  workModal.editing = row || null
  workModal.form.company = row?.company || ''
  workModal.form.position = row?.position || ''
  workModal.form.range = row?.startDate ? [row.startDate, row.endDate || ''] : undefined
  workModal.form.leaveReason = row?.leaveReason || ''
  workModal.form.remark = row?.remark || ''
  workModal.open = true
}

async function submitWork() {
  const f = workModal.form
  if (!f.company.trim()) return message.warning('工作单位必填')
  if (!f.range?.[0]) return message.warning('请选择工作时间')
  if (f.range[1] && f.range[1] < f.range[0]) return message.warning('结束日期不能早于开始日期')
  workModal.saving = true
  const body = {
    company: f.company.trim(),
    position: f.position.trim(),
    startDate: f.range[0],
    endDate: f.range[1] || null,
    leaveReason: f.leaveReason.trim(),
    remark: f.remark.trim()
  }
  try {
    if (workModal.editing) {
      await updateWork(props.employeeId!, workModal.editing.id, body)
    } else {
      await addWork(props.employeeId!, body)
    }
    message.success('已保存')
    workModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    workModal.saving = false
  }
}

async function removeWork(row: WorkItem) {
  try {
    await deleteWork(props.employeeId!, row.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

/* ---------- 家庭成员 ---------- */
const familyModal = reactive<{
  open: boolean
  saving: boolean
  editing: FamilyItem | null
  form: { relation?: string; name: string; company: string; phone: string; remark: string }
}>({
  open: false,
  saving: false,
  editing: null,
  form: { relation: undefined, name: '', company: '', phone: '', remark: '' }
})

function openFamilyModal(row?: FamilyItem) {
  loadDicts()
  familyModal.editing = row || null
  familyModal.form.relation = row?.relation
  familyModal.form.name = row?.name || ''
  familyModal.form.company = row?.company || ''
  familyModal.form.phone = row?.phone || ''
  familyModal.form.remark = row?.remark || ''
  familyModal.open = true
}

async function submitFamily() {
  const f = familyModal.form
  if (!f.relation) return message.warning('请选择关系')
  if (!f.name.trim()) return message.warning('姓名必填')
  if (f.phone.trim() && !/^1[3-9]\d{9}$/.test(f.phone.trim())) return message.warning('联系电话格式不正确')
  familyModal.saving = true
  const body = {
    relation: f.relation,
    name: f.name.trim(),
    company: f.company.trim(),
    phone: f.phone.trim(),
    remark: f.remark.trim()
  }
  try {
    if (familyModal.editing) {
      await updateFamily(props.employeeId!, familyModal.editing.id, body)
    } else {
      await addFamily(props.employeeId!, body)
    }
    message.success('已保存')
    familyModal.open = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    familyModal.saving = false
  }
}

async function removeFamily(row: FamilyItem) {
  try {
    await deleteFamily(props.employeeId!, row.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}
</script>

<style scoped>
.info-card {
  margin-bottom: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
}

.info-desc :deep(.ant-descriptions-item-label) {
  width: 96px;
}

.profile-tabs :deep(.ant-table) {
  font-size: 13px;
}

.sub-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.muted {
  color: var(--muted);
  font-size: 12px;
}

.danger {
  color: #ff4d4f;
}
</style>
