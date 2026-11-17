<template>
  <div class="page-root ledger-page">
    <section class="ledger-heading">
      <div>
        <div class="ledger-title"><fund-outlined /> 人力台账</div>
        <div class="muted">合同、人员流动与考勤异常的集中分析视图</div>
      </div>
      <a-tag color="green">数据已隔离</a-tag>
    </section>

    <a-alert
      type="info"
      show-icon
      message="汇总、图表和明细均按当前账号的数据权限及筛选条件统计。"
    />

    <section class="panel ledger-workbench">
      <a-tabs v-model:active-key="activeTab" class="ledger-tabs">
        <a-tab-pane v-if="canContract" key="contracts" tab="合同到期台账">
          <div class="filter-bar">
            <a-input
              :value="orgLabel(contractFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('contract')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="contractFilters.expiry" :options="expiryOptions" style="width: 140px" />
            <a-select v-model:value="contractFilters.type" :options="contractTypeOptions" style="width: 130px" />
            <a-input v-model:value="contractFilters.keyword" allow-clear placeholder="员工 / 工号 / 合同编号" style="width: 210px" />
            <a-button @click="resetContractFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in contractMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">近 6 个月合同到期</div>
              <div class="bar-chart">
                <div v-for="item in contractMonthly" :key="item.month" class="bar-item">
                  <div class="bar-value">{{ item.value || '' }}</div>
                  <div class="bar-track"><div class="bar-fill blue" :style="barStyle(item.value, contractMonthMax)"></div></div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">合同类型占比</div>
              <div class="donut-layout">
                <div class="donut" :style="{ background: donutBackground(contractTypeSlices) }">
                  <div class="donut-center"><b>{{ contractData.page.total }}</b><span>份合同</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in contractTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="contractColumns"
            :data-source="filteredContracts"
            :loading="loading.contracts"
            :pagination="tablePagination(contractData.page.total, contractPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 1050 }"
            @change="onContractPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'type'">{{ contractTypeText(record.type) }}</template>
              <template v-else-if="column.key === 'remaining'">
                <span :class="record.remainingDays < 0 ? 'text-danger' : record.remainingDays <= 30 ? 'text-warning' : ''">
                  {{ record.remainingDays < 0 ? `已过期 ${Math.abs(record.remainingDays)} 天` : `${record.remainingDays} 天` }}
                </span>
              </template>
              <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'EXPIRED' ? 'red' : 'green'">{{ record.status === 'EXPIRED' ? '已过期' : '生效中' }}</a-tag></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canMovement" key="movement" tab="人员流动台账">
          <div class="filter-bar">
            <a-range-picker v-model:value="movementFilters.months" picker="month" value-format="YYYY-MM" style="width: 240px" />
            <a-input
              :value="orgLabel(movementFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('movement')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="movementFilters.event" :options="movementEventOptions" style="width: 140px" />
            <a-button @click="resetMovementFilters">重置</a-button>
          </div>

          <div class="metric-grid">
            <div v-for="item in movementMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">月度入职 / 离职趋势</div>
              <div class="grouped-chart">
                <div v-for="item in movementMonthly" :key="item.month" class="grouped-item">
                  <div class="grouped-bars">
                    <div class="group-bar-wrap"><span>{{ item.hires || '' }}</span><div class="group-bar green" :style="barStyle(item.hires, movementMonthMax)"></div></div>
                    <div class="group-bar-wrap"><span>{{ item.resigns || '' }}</span><div class="group-bar orange" :style="barStyle(item.resigns, movementMonthMax)"></div></div>
                  </div>
                  <div class="bar-label">{{ item.month.slice(5) }}月</div>
                </div>
              </div>
              <div class="inline-legend"><span><i class="green-bg"></i>入职</span><span><i class="orange-bg"></i>离职</span></div>
            </div>
            <div class="chart-card">
              <div class="chart-title">组织净增人数</div>
              <div class="horizontal-chart">
                <div v-for="item in movementOrgNet" :key="item.org" class="horizontal-row">
                  <span class="horizontal-label">{{ item.org }}</span>
                  <div class="horizontal-track"><div :class="item.value < 0 ? 'horizontal-bar negative' : 'horizontal-bar'" :style="{ width: `${movementOrgMax ? Math.abs(item.value) / movementOrgMax * 100 : 0}%` }"></div></div>
                  <b :class="item.value < 0 ? 'text-danger' : 'text-success'">{{ item.value > 0 ? '+' : '' }}{{ item.value }}</b>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="movementColumns"
            :data-source="filteredMovement"
            :loading="loading.movement"
            :pagination="tablePagination(movementData.page.total, movementPage)"
            row-key="id"
            size="small"
            :scroll="{ x: 900 }"
            @change="onMovementPageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'event'"><a-tag :color="movementEventColor(record.event)">{{ movementEventText(record.event) }}</a-tag></template>
              <template v-else-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canAttendance" key="attendance" tab="考勤异常台账">
          <div class="filter-bar">
            <a-select v-model:value="attendanceFilters.month" :options="attendanceMonthOptions" style="width: 125px" />
            <a-input
              :value="orgLabel(attendanceFilters.org)"
              readonly
              class="org-picker-input"
              style="width: 170px"
              title="点击选择组织"
              @click="openOrgPicker('attendance')"
            >
              <template #suffix><apartment-outlined /></template>
            </a-input>
            <a-select v-model:value="attendanceFilters.type" :options="attendanceTypeOptions" style="width: 130px" />
            <a-select v-model:value="attendanceFilters.status" :options="attendanceStatusOptions" style="width: 130px" />
            <a-input v-model:value="attendanceFilters.keyword" allow-clear placeholder="员工 / 工号" style="width: 170px" />
            <a-button @click="resetAttendanceFilters">重置</a-button>
          </div>

          <div class="metric-grid five-columns">
            <div v-for="item in attendanceMetrics" :key="item.label" class="metric-card">
              <div class="metric-label">{{ item.label }}</div>
              <div class="metric-value" :class="item.tone">{{ item.value }}</div>
              <div class="muted">{{ item.hint }}</div>
            </div>
          </div>

          <div class="chart-grid">
            <div class="chart-card">
              <div class="chart-title">每日异常记录</div>
              <div class="bar-chart compact">
                <div v-for="item in attendanceDaily" :key="item.date" class="bar-item">
                  <div class="bar-value">{{ item.value || '' }}</div>
                  <div class="bar-track"><div class="bar-fill purple" :style="barStyle(item.value, attendanceDayMax)"></div></div>
                  <div class="bar-label">{{ item.date.slice(5) }}</div>
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-title">异常类型分布</div>
              <div class="donut-layout">
                <div class="donut" :style="{ background: donutBackground(attendanceTypeSlices) }">
                  <div class="donut-center"><b>{{ attendanceData.total }}</b><span>条异常</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in attendanceTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table
            :columns="attendanceColumns"
            :data-source="filteredAttendance"
            :loading="loading.attendance"
            :pagination="tablePagination(attendanceData.page.total, attendancePage)"
            row-key="id"
            size="small"
            :scroll="{ x: 950 }"
            @change="onAttendancePageChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
              <template v-else-if="column.key === 'type'"><a-tag :color="attendanceTypeColor(record.type)">{{ attendanceTypeText(record.type) }}</a-tag></template>
              <template v-else-if="column.key === 'value'">{{ record.type === 'ABSENT' ? `${record.value} 小时` : `${record.value} 分钟` }}</template>
              <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'PENDING' ? 'orange' : record.status === 'NONE' ? 'default' : 'green'">{{ attendanceStatusText(record.status) }}</a-tag></template>
            </template>
          </a-table>
        </a-tab-pane>
      </a-tabs>
    </section>

    <a-modal
      v-model:open="orgPickerOpen"
      title="选择组织"
      :width="440"
      :footer="null"
      centered
    >
      <a-input
        v-model:value="orgKeyword"
        allow-clear
        placeholder="搜索组织名称"
        class="org-search"
      />
      <div class="org-picker-list">
        <button
          type="button"
          class="org-option"
          :class="{ selected: selectedOrgValue === 'ALL' }"
          @click="selectOrg('ALL')"
        >
          <span class="org-option-name"><apartment-outlined />全部组织</span>
          <check-outlined v-if="selectedOrgValue === 'ALL'" class="org-option-check" />
        </button>
        <button
          v-for="org in filteredPickerOrgs"
          :key="org.id"
          type="button"
          class="org-option"
          :class="{ selected: selectedOrgValue === String(org.id) }"
          @click="selectOrg(String(org.id))"
        >
          <span class="org-option-name"><apartment-outlined />{{ org.name }}</span>
          <check-outlined v-if="selectedOrgValue === String(org.id)" class="org-option-check" />
        </button>
      </div>
      <a-empty v-if="!filteredPickerOrgs.length" description="未找到匹配组织" />
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ApartmentOutlined, CheckOutlined, FundOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'
import {
  getAttendanceLedger,
  getContractLedger,
  getMovementLedger,
  type AttendanceLedgerData,
  type ContractLedgerData,
  type LedgerOrgOption,
  type MovementLedgerData
} from '@/api/ehr'

const store = useUserStore()
const canContract = computed(() => store.can('contract:view'))
const canMovement = computed(() => store.can('employee:view'))
const canAttendance = computed(() => store.can('attendance:daily'))
const activeTab = ref(canContract.value ? 'contracts' : canMovement.value ? 'movement' : 'attendance')
const pageSize = 10
const contractPage = ref(1)
const movementPage = ref(1)
const attendancePage = ref(1)
const loading = reactive({ contracts: false, movement: false, attendance: false })
const orgs = ref<LedgerOrgOption[]>([])

const contractTypeOptions = [
  { value: 'ALL', label: '全部类型' }, { value: 'FIXED', label: '固定期限' },
  { value: 'UNFIXED', label: '无固定期限' }, { value: 'INTERN', label: '实习协议' }, { value: 'LABOR', label: '劳务协议' }
]
const expiryOptions = [
  { value: 'ALL', label: '全部到期区间' }, { value: '30', label: '30 天内到期' },
  { value: '60', label: '31–60 天到期' }, { value: '90', label: '61–90 天到期' }, { value: 'EXPIRED', label: '已过期' }
]
const movementEventOptions = [
  { value: 'ALL', label: '全部流动类型' }, { value: 'ONBOARD', label: '入职' },
  { value: 'REGULAR', label: '转正' }, { value: 'RESIGN', label: '离职' }
]
const attendanceTypeOptions = [
  { value: 'ALL', label: '全部异常' }, { value: 'LATE', label: '迟到' }, { value: 'EARLY', label: '早退' },
  { value: 'MISSING', label: '缺卡' }, { value: 'ABSENT', label: '缺勤' }
]
const attendanceStatusOptions = [
  { value: 'ALL', label: '全部状态' }, { value: 'PENDING', label: '待处理' },
  { value: 'DONE', label: '已处理' }, { value: 'NONE', label: '无需处理' }
]
const attendanceMonthOptions = Array.from({ length: 12 }, (_, index) => {
  const value = monthOffset(-index)
  return { value, label: `${value.slice(0, 4)} 年 ${Number(value.slice(5))} 月` }
})

const contractFilters = reactive({ org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' })
const movementFilters = reactive({ months: [monthOffset(-11), monthOffset(0)] as string[], org: 'ALL', event: 'ALL' })
const attendanceFilters = reactive({ month: monthOffset(0), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' })

type OrgPickerTarget = 'contract' | 'movement' | 'attendance'
const orgPickerOpen = ref(false)
const orgKeyword = ref('')
const orgPickerTarget = ref<OrgPickerTarget>('contract')
const selectedOrgValue = computed(() => {
  if (orgPickerTarget.value === 'contract') return contractFilters.org
  if (orgPickerTarget.value === 'movement') return movementFilters.org
  return attendanceFilters.org
})
const filteredPickerOrgs = computed(() => {
  const keyword = orgKeyword.value.trim().toLowerCase()
  if (!keyword) return orgs.value
  return orgs.value.filter(org => org.name.toLowerCase().includes(keyword))
})
function orgLabel(value: string) {
  if (value === 'ALL') return '全部组织'
  return orgs.value.find(org => String(org.id) === value)?.name || '全部组织'
}
function openOrgPicker(target: OrgPickerTarget) {
  orgPickerTarget.value = target
  orgKeyword.value = ''
  orgPickerOpen.value = true
}
function selectOrg(value: string) {
  if (orgPickerTarget.value === 'contract') contractFilters.org = value
  else if (orgPickerTarget.value === 'movement') movementFilters.org = value
  else attendanceFilters.org = value
  orgPickerOpen.value = false
}
const contractData = ref<ContractLedgerData>({
  page: { list: [], total: 0 }, within30: 0, within60: 0, within90: 0, expired: 0, orgs: [], monthly: [], types: []
})
const movementData = ref<MovementLedgerData>({
  page: { list: [], total: 0 }, hires: 0, resigns: 0, net: 0, turnoverRate: 0, orgs: [], monthly: [], orgNet: []
})
const attendanceData = ref<AttendanceLedgerData>({
  page: { list: [], total: 0 }, total: 0, late: 0, early: 0, missing: 0, absent: 0,
  lateMinutes: 0, earlyMinutes: 0, orgs: [], daily: [], types: []
})

const filteredContracts = computed(() => contractData.value.page.list)
const contractMetrics = computed(() => [
  { label: '30 天内到期', value: contractData.value.within30, hint: '优先安排续签', tone: 'text-danger' },
  { label: '31–60 天到期', value: contractData.value.within60, hint: '提前确认意向', tone: 'text-warning' },
  { label: '61–90 天到期', value: contractData.value.within90, hint: '纳入续签计划', tone: 'text-primary' },
  { label: '已过期', value: contractData.value.expired, hint: '需要立即核查', tone: 'text-danger' }
])
const contractMonthly = computed(() => contractData.value.monthly)
const contractMonthMax = computed(() => Math.max(1, ...contractMonthly.value.map(x => x.value)))
const contractTypeSlices = computed(() => contractData.value.types.filter(x => x.value > 0)
  .map((x, index) => ({ name: x.name, value: x.value, color: ['#1677ff', '#13c2c2', '#722ed1', '#faad14'][index % 4] })))
const contractColumns = [
  { title: '员工', key: 'employee', width: 120 }, { title: '组织', dataIndex: 'org', width: 110 },
  { title: '合同编号', dataIndex: 'contractNo', width: 140 }, { title: '类型', key: 'type', width: 100 },
  { title: '开始日期', dataIndex: 'startDate', width: 110 }, { title: '结束日期', dataIndex: 'endDate', width: 110 },
  { title: '剩余天数', key: 'remaining', width: 125 }, { title: '状态', key: 'status', width: 90 }
]
function resetContractFilters() { Object.assign(contractFilters, { org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' }) }
function contractTypeText(type: string) { return ({ FIXED: '固定期限', UNFIXED: '无固定期限', INTERN: '实习协议', LABOR: '劳务协议' } as Record<string, string>)[type] || type }

const filteredMovement = computed(() => movementData.value.page.list)
const movementMetrics = computed(() => [
  { label: '期间入职', value: movementData.value.hires, hint: '新入职员工', tone: 'text-success' },
  { label: '期间离职', value: movementData.value.resigns, hint: '已办理离职', tone: 'text-warning' },
  { label: '净增人数', value: movementData.value.net, hint: '入职减离职', tone: 'text-primary' },
  { label: '离职率', value: `${movementData.value.turnoverRate.toFixed(1)}%`, hint: '按期初与期末平均在职人数', tone: 'text-danger' }
])
const movementMonthly = computed(() => movementData.value.monthly)
const movementMonthMax = computed(() => Math.max(1, ...movementMonthly.value.flatMap(x => [x.hires, x.resigns])))
const movementOrgNet = computed(() => movementData.value.orgNet)
const movementOrgMax = computed(() => Math.max(1, ...movementOrgNet.value.map(x => Math.abs(x.value))))
const movementColumns = [
  { title: '日期', dataIndex: 'date', width: 115 }, { title: '员工', key: 'employee', width: 130 },
  { title: '组织', dataIndex: 'org', width: 120 }, { title: '流动类型', key: 'event', width: 100 }, { title: '说明', dataIndex: 'detail' }
]
function resetMovementFilters() { Object.assign(movementFilters, { months: [monthOffset(-11), monthOffset(0)], org: 'ALL', event: 'ALL' }) }
function movementEventText(event: string) { return ({ ONBOARD: '入职', REGULAR: '转正', RESIGN: '离职' } as Record<string, string>)[event] || event }
function movementEventColor(event: string) { return event === 'ONBOARD' ? 'green' : event === 'RESIGN' ? 'orange' : 'blue' }

const filteredAttendance = computed(() => attendanceData.value.page.list)
const attendanceMetrics = computed(() => [
  { label: '异常记录', value: attendanceData.value.total, hint: '当前筛选范围', tone: 'text-primary' },
  { label: '迟到', value: attendanceData.value.late, hint: `${attendanceData.value.lateMinutes} 分钟`, tone: 'text-warning' },
  { label: '早退', value: attendanceData.value.early, hint: `${attendanceData.value.earlyMinutes} 分钟`, tone: 'text-warning' },
  { label: '缺卡', value: attendanceData.value.missing, hint: '等待补卡核查', tone: 'text-primary' },
  { label: '缺勤', value: attendanceData.value.absent, hint: '按实际缺勤统计', tone: 'text-danger' }
])
const attendanceDaily = computed(() => attendanceData.value.daily)
const attendanceDayMax = computed(() => Math.max(1, ...attendanceDaily.value.map(x => x.value)))
const attendanceTypeSlices = computed(() => attendanceData.value.types.filter(x => x.value > 0)
  .map((x, index) => ({ name: x.name, value: x.value, color: ['#faad14', '#fa8c16', '#1677ff', '#f5222d'][index % 4] })))
const attendanceColumns = [
  { title: '日期', dataIndex: 'date', width: 115 }, { title: '员工', key: 'employee', width: 125 },
  { title: '组织', dataIndex: 'org', width: 115 }, { title: '异常类型', key: 'type', width: 100 },
  { title: '异常时长', key: 'value', width: 110 }, { title: '处理状态', key: 'status', width: 100 }
]
function attendanceTypeText(type: string) { return ({ LATE: '迟到', EARLY: '早退', MISSING: '缺卡', ABSENT: '缺勤' } as Record<string, string>)[type] || type }
function attendanceTypeColor(type: string) { return ({ LATE: 'gold', EARLY: 'orange', MISSING: 'blue', ABSENT: 'red' } as Record<string, string>)[type] || 'default' }
function attendanceStatusText(status: string) { return ({ PENDING: '待处理', DONE: '已处理', NONE: '无需处理' } as Record<string, string>)[status] || status }
function resetAttendanceFilters() { Object.assign(attendanceFilters, { month: monthOffset(0), org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' }) }

async function loadContracts() {
  loading.contracts = true
  try {
    const data = await getContractLedger({
      orgId: contractFilters.org === 'ALL' ? undefined : contractFilters.org,
      expiry: contractFilters.expiry, type: contractFilters.type, keyword: contractFilters.keyword || undefined,
      page: contractPage.value, size: pageSize
    })
    contractData.value = data
    orgs.value = data.orgs
  } finally {
    loading.contracts = false
  }
}
async function loadMovement() {
  loading.movement = true
  try {
    const data = await getMovementLedger({
      fromMonth: movementFilters.months?.[0], toMonth: movementFilters.months?.[1],
      orgId: movementFilters.org === 'ALL' ? undefined : movementFilters.org,
      event: movementFilters.event, page: movementPage.value, size: pageSize
    })
    movementData.value = data
    orgs.value = data.orgs
  } finally {
    loading.movement = false
  }
}
async function loadAttendance() {
  loading.attendance = true
  try {
    const data = await getAttendanceLedger({
      month: attendanceFilters.month,
      orgId: attendanceFilters.org === 'ALL' ? undefined : attendanceFilters.org,
      type: attendanceFilters.type, status: attendanceFilters.status, keyword: attendanceFilters.keyword || undefined,
      page: attendancePage.value, size: pageSize
    })
    attendanceData.value = data
    orgs.value = data.orgs
  } finally {
    loading.attendance = false
  }
}
function loadActiveTab() {
  if (activeTab.value === 'contracts') void loadContracts()
  else if (activeTab.value === 'movement') void loadMovement()
  else if (canAttendance.value) void loadAttendance()
}
function onContractPageChange(pagination: { current?: number }) { contractPage.value = pagination.current || 1; void loadContracts() }
function onMovementPageChange(pagination: { current?: number }) { movementPage.value = pagination.current || 1; void loadMovement() }
function onAttendancePageChange(pagination: { current?: number }) { attendancePage.value = pagination.current || 1; void loadAttendance() }
function tablePagination(total: number, current: number) {
  return { current, pageSize, total, showSizeChanger: false, showTotal: (count: number) => `共 ${count} 条` }
}
function monthOffset(offset: number) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

watch(activeTab, loadActiveTab, { immediate: true })
watch(contractFilters, () => { contractPage.value = 1; if (activeTab.value === 'contracts') void loadContracts() }, { deep: true })
watch(movementFilters, () => { movementPage.value = 1; if (activeTab.value === 'movement') void loadMovement() }, { deep: true })
watch(attendanceFilters, () => { attendancePage.value = 1; if (activeTab.value === 'attendance') void loadAttendance() }, { deep: true })

interface Slice { name: string; value: number; color: string }
function donutBackground(slices: Slice[]) {
  const total = slices.reduce((sum, item) => sum + item.value, 0)
  if (!total) return 'var(--panel-border)'
  let start = 0
  const parts = slices.map(item => {
    const end = start + item.value / total * 360
    const part = `${item.color} ${start}deg ${end}deg`
    start = end
    return part
  })
  return `conic-gradient(${parts.join(',')})`
}
function barStyle(value: number, max: number) { return { height: `${Math.max(value > 0 ? 8 : 0, value / Math.max(max, 1) * 100)}%` } }
</script>

<style scoped>
.ledger-page { flex: none; min-height: 100%; }
.ledger-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ledger-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 20px; font-weight: 600; }
.ledger-workbench { flex: none; }
.ledger-tabs { padding: 0 14px 14px; }
.org-picker-input, .org-picker-input :deep(input) { cursor: pointer; }
.org-search { margin-bottom: 12px; }
.org-picker-list { display: flex; flex-direction: column; gap: 6px; max-height: min(420px, 55vh); overflow-y: auto; }
.org-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 12px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-bg); color: var(--text-base); text-align: left; cursor: pointer; transition: border-color .2s, background .2s; }
.org-option:hover { border-color: #1677ff; background: var(--color-fill-quaternary, #fafafa); }
.org-option.selected { border-color: #1677ff; background: var(--color-primary-bg, #e6f4ff); }
.org-option-name { display: flex; align-items: center; gap: 8px; min-width: 0; overflow-wrap: anywhere; }
.org-option-check { flex: none; color: #1677ff; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding: 12px; border-radius: 8px; background: var(--color-fill-quaternary, #fafafa); }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.metric-grid.five-columns { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.metric-card { padding: 14px 16px; border: 1px solid var(--panel-border); border-radius: 8px; background: var(--panel-bg); }
.metric-label { color: var(--muted); font-size: 12px; }
.metric-value { margin: 3px 0; font-size: 26px; font-weight: 600; line-height: 1.4; }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.chart-card { min-width: 0; min-height: 250px; padding: 16px; border: 1px solid var(--panel-border); border-radius: 8px; }
.chart-title { margin-bottom: 18px; font-weight: 600; }
.bar-chart { display: flex; align-items: flex-end; gap: 14px; height: 205px; padding: 0 8px; overflow-x: auto; overflow-y: hidden; }
.bar-item { display: flex; flex: 1 0 36px; flex-direction: column; align-items: center; height: 100%; min-width: 36px; }
.bar-value { min-height: 18px; color: var(--muted); font-size: 11px; }
.bar-track { display: flex; align-items: flex-end; width: 28px; height: 140px; border-radius: 4px 4px 0 0; overflow: hidden; }
.bar-fill { width: 100%; border-radius: 4px 4px 0 0; transition: height .25s; }
.bar-fill.blue { background: #1677ff; }
.bar-fill.purple { background: #722ed1; }
.bar-label { margin-top: 8px; color: var(--muted); font-size: 12px; white-space: nowrap; }
.donut-layout { display: flex; align-items: center; justify-content: center; gap: 32px; min-height: 180px; }
.donut { display: flex; align-items: center; justify-content: center; width: 136px; height: 136px; flex: none; border-radius: 50%; }
.donut-center { display: flex; align-items: center; justify-content: center; flex-direction: column; width: 82px; height: 82px; border-radius: 50%; background: var(--panel-bg); }
.donut-center b { font-size: 22px; }
.donut-center span { color: var(--muted); font-size: 11px; }
.chart-legend { min-width: 130px; }
.legend-row { display: grid; grid-template-columns: 8px 1fr auto; align-items: center; gap: 8px; margin: 10px 0; font-size: 12px; }
.legend-row i, .inline-legend i { width: 8px; height: 8px; border-radius: 50%; }
.grouped-chart { display: flex; align-items: flex-end; gap: 12px; height: 188px; overflow-x: auto; overflow-y: hidden; }
.grouped-item { display: flex; flex: 1 0 44px; flex-direction: column; align-items: center; height: 100%; }
.grouped-bars { display: flex; align-items: flex-end; justify-content: center; gap: 5px; height: 140px; }
.group-bar-wrap { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; width: 22px; height: 100%; }
.group-bar-wrap span { color: var(--muted); font-size: 10px; }
.group-bar { width: 16px; min-height: 0; border-radius: 3px 3px 0 0; }
.group-bar.green { background: #52c41a; }
.group-bar.orange { background: #fa8c16; }
.inline-legend { display: flex; justify-content: center; gap: 18px; color: var(--muted); font-size: 12px; }
.inline-legend span { display: flex; align-items: center; gap: 6px; }
.green-bg { background: #52c41a; }
.orange-bg { background: #fa8c16; }
.horizontal-chart { padding-top: 8px; }
.horizontal-row { display: grid; grid-template-columns: 72px 1fr 34px; align-items: center; gap: 10px; margin: 20px 0; font-size: 12px; }
.horizontal-label { color: var(--muted); }
.horizontal-track { height: 10px; border-radius: 5px; background: var(--color-fill-quaternary, #f5f5f5); overflow: hidden; }
.horizontal-bar { height: 100%; min-width: 2px; border-radius: 5px; background: #52c41a; }
.horizontal-bar.negative { background: #ff4d4f; }
.text-primary { color: #1677ff; }
.text-success { color: #389e0d; }
.text-warning { color: #d48806; }
.text-danger { color: #cf1322; }
@media (max-width: 1200px) {
  .metric-grid, .metric-grid.five-columns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .chart-grid { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .metric-grid, .metric-grid.five-columns { grid-template-columns: 1fr; }
  .donut-layout { gap: 18px; }
  .bar-chart { gap: 6px; padding: 0; }
  .ledger-tabs { padding: 0 10px 10px; }
}
</style>
