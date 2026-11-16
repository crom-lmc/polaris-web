<template>
  <div class="page-root ledger-page">
    <section class="ledger-heading">
      <div>
        <div class="ledger-title"><fund-outlined /> 人力台账</div>
        <div class="muted">合同、人员流动与考勤异常的集中分析视图</div>
      </div>
      <a-tag color="blue">静态原型</a-tag>
    </section>

    <a-alert
      type="info"
      show-icon
      message="当前展示模拟数据，仅用于页面方案演示；正式接口接入后，将由后端按当前账号的组织数据权限返回。"
    />

    <section class="panel ledger-workbench">
      <a-tabs v-model:active-key="activeTab" class="ledger-tabs">
        <a-tab-pane v-if="canContract" key="contracts" tab="合同到期台账">
          <div class="filter-bar">
            <a-select v-model:value="contractFilters.org" :options="orgOptions" style="width: 150px" />
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
                  <div class="donut-center"><b>{{ filteredContracts.length }}</b><span>份合同</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in contractTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table :columns="contractColumns" :data-source="filteredContracts" row-key="id" size="small" :pagination="pagination" :scroll="{ x: 1050 }">
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
            <a-select v-model:value="movementFilters.org" :options="orgOptions" style="width: 150px" />
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

          <a-table :columns="movementColumns" :data-source="filteredMovement" row-key="id" size="small" :pagination="pagination" :scroll="{ x: 900 }">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'event'"><a-tag :color="movementEventColor(record.event)">{{ movementEventText(record.event) }}</a-tag></template>
              <template v-else-if="column.key === 'employee'"><b>{{ record.name }}</b><div class="muted">{{ record.empNo }}</div></template>
            </template>
          </a-table>
        </a-tab-pane>

        <a-tab-pane v-if="canAttendance" key="attendance" tab="考勤异常台账">
          <div class="filter-bar">
            <a-select v-model:value="attendanceFilters.month" :options="attendanceMonthOptions" style="width: 125px" />
            <a-select v-model:value="attendanceFilters.org" :options="orgOptions" style="width: 150px" />
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
                  <div class="donut-center"><b>{{ filteredAttendance.length }}</b><span>条异常</span></div>
                </div>
                <div class="chart-legend">
                  <div v-for="item in attendanceTypeSlices" :key="item.name" class="legend-row">
                    <i :style="{ background: item.color }"></i><span>{{ item.name }}</span><b>{{ item.value }}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <a-table :columns="attendanceColumns" :data-source="filteredAttendance" row-key="id" size="small" :pagination="pagination" :scroll="{ x: 950 }">
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
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { FundOutlined } from '@ant-design/icons-vue'
import { useUserStore } from '@/stores/user'

const store = useUserStore()
const canContract = computed(() => store.can('contract:view'))
const canMovement = computed(() => store.can('employee:view'))
const canAttendance = computed(() => store.can('attendance:daily'))
const activeTab = ref(canContract.value ? 'contracts' : canMovement.value ? 'movement' : 'attendance')
const pagination = { pageSize: 6, showSizeChanger: false, showTotal: (total: number) => `共 ${total} 条` }

const orgOptions = [
  { value: 'ALL', label: '全部组织' }, { value: '研发中心', label: '研发中心' },
  { value: '产品中心', label: '产品中心' }, { value: '运营中心', label: '运营中心' }, { value: '职能中心', label: '职能中心' }
]
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
const attendanceMonthOptions = [{ value: '2026-11', label: '2026 年 11 月' }, { value: '2026-10', label: '2026 年 10 月' }]

interface ContractRow { id: number; name: string; empNo: string; org: string; contractNo: string; type: string; startDate: string; endDate: string; remainingDays: number; status: string }
const contracts = ref<ContractRow[]>([
  { id: 1, name: '陈明', empNo: 'XC0012', org: '研发中心', contractNo: 'HT-2023-012', type: 'FIXED', startDate: '2023-11-20', endDate: '2026-11-20', remainingDays: 4, status: 'ACTIVE' },
  { id: 2, name: '周洁', empNo: 'XC0028', org: '产品中心', contractNo: 'HT-2023-028', type: 'FIXED', startDate: '2023-11-30', endDate: '2026-11-30', remainingDays: 14, status: 'ACTIVE' },
  { id: 3, name: '吴迪', empNo: 'XC0036', org: '运营中心', contractNo: 'HT-2024-036', type: 'FIXED', startDate: '2024-12-08', endDate: '2026-12-08', remainingDays: 22, status: 'ACTIVE' },
  { id: 4, name: '许华', empNo: 'XC0006', org: '职能中心', contractNo: 'HT-2024-006', type: 'FIXED', startDate: '2024-12-16', endDate: '2026-12-16', remainingDays: 30, status: 'ACTIVE' },
  { id: 5, name: '王浩然', empNo: 'XC0009', org: '研发中心', contractNo: 'HT-2024-009', type: 'FIXED', startDate: '2024-12-28', endDate: '2026-12-28', remainingDays: 42, status: 'ACTIVE' },
  { id: 6, name: '林悦', empNo: 'XC0041', org: '产品中心', contractNo: 'HT-2025-041', type: 'FIXED', startDate: '2025-01-10', endDate: '2027-01-10', remainingDays: 55, status: 'ACTIVE' },
  { id: 7, name: '赵雷', empNo: 'XC0031', org: '运营中心', contractNo: 'HT-2025-031', type: 'LABOR', startDate: '2025-01-25', endDate: '2027-01-25', remainingDays: 70, status: 'ACTIVE' },
  { id: 8, name: '孙倩', empNo: 'XC0048', org: '职能中心', contractNo: 'HT-2025-048', type: 'FIXED', startDate: '2025-02-12', endDate: '2027-02-12', remainingDays: 88, status: 'ACTIVE' },
  { id: 9, name: '郑宇', empNo: 'XC0052', org: '研发中心', contractNo: 'HT-2026-052', type: 'INTERN', startDate: '2026-03-01', endDate: '2027-03-01', remainingDays: 105, status: 'ACTIVE' },
  { id: 10, name: '钱宁', empNo: 'XC0018', org: '产品中心', contractNo: 'HT-2022-018', type: 'UNFIXED', startDate: '2022-05-01', endDate: '2027-04-30', remainingDays: 165, status: 'ACTIVE' },
  { id: 11, name: '冯佳', empNo: 'XC0021', org: '运营中心', contractNo: 'HT-2023-021', type: 'FIXED', startDate: '2023-10-15', endDate: '2026-10-15', remainingDays: -32, status: 'EXPIRED' },
  { id: 12, name: '蒋鹏', empNo: 'XC0033', org: '研发中心', contractNo: 'HT-2023-033', type: 'FIXED', startDate: '2023-10-28', endDate: '2026-10-28', remainingDays: -19, status: 'EXPIRED' }
])
const contractFilters = reactive({ org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' })
const filteredContracts = computed(() => contracts.value.filter(row =>
  (contractFilters.org === 'ALL' || row.org === contractFilters.org) &&
  (contractFilters.type === 'ALL' || row.type === contractFilters.type) &&
  (contractFilters.expiry === 'ALL' || (contractFilters.expiry === 'EXPIRED' ? row.remainingDays < 0 : row.remainingDays >= 0 && row.remainingDays <= Number(contractFilters.expiry) && (contractFilters.expiry === '30' || row.remainingDays > Number(contractFilters.expiry) - 30))) &&
  (!contractFilters.keyword || `${row.name}${row.empNo}${row.contractNo}`.toLowerCase().includes(contractFilters.keyword.toLowerCase()))
))
const contractMetrics = computed(() => [
  { label: '30 天内到期', value: filteredContracts.value.filter(x => x.remainingDays >= 0 && x.remainingDays <= 30).length, hint: '优先安排续签', tone: 'text-danger' },
  { label: '31–60 天到期', value: filteredContracts.value.filter(x => x.remainingDays > 30 && x.remainingDays <= 60).length, hint: '提前确认意向', tone: 'text-warning' },
  { label: '61–90 天到期', value: filteredContracts.value.filter(x => x.remainingDays > 60 && x.remainingDays <= 90).length, hint: '纳入续签计划', tone: 'text-primary' },
  { label: '已过期', value: filteredContracts.value.filter(x => x.remainingDays < 0).length, hint: '需要立即核查', tone: 'text-danger' }
])
const contractMonthNames = ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05']
const contractMonthly = computed(() => contractMonthNames.map(month => ({ month, value: filteredContracts.value.filter(x => x.endDate.startsWith(month)).length })))
const contractMonthMax = computed(() => Math.max(1, ...contractMonthly.value.map(x => x.value)))
const contractTypeSlices = computed(() => slicesFor(filteredContracts.value.map(x => contractTypeText(x.type)), ['#1677ff', '#13c2c2', '#722ed1', '#faad14']))
const contractColumns = [
  { title: '员工', key: 'employee', width: 120 }, { title: '组织', dataIndex: 'org', width: 110 },
  { title: '合同编号', dataIndex: 'contractNo', width: 140 }, { title: '类型', key: 'type', width: 100 },
  { title: '开始日期', dataIndex: 'startDate', width: 110 }, { title: '结束日期', dataIndex: 'endDate', width: 110 },
  { title: '剩余天数', key: 'remaining', width: 125 }, { title: '状态', key: 'status', width: 90 }
]
function resetContractFilters() { Object.assign(contractFilters, { org: 'ALL', expiry: 'ALL', type: 'ALL', keyword: '' }) }
function contractTypeText(type: string) { return ({ FIXED: '固定期限', UNFIXED: '无固定期限', INTERN: '实习协议', LABOR: '劳务协议' } as Record<string, string>)[type] || type }

interface MovementRow { id: number; date: string; name: string; empNo: string; org: string; event: string; detail: string }
const movementRows = ref<MovementRow[]>([
  { id: 1, date: '2026-11-15', name: '沈溪', empNo: 'XC0062', org: '研发中心', event: 'ONBOARD', detail: '高级前端工程师入职' },
  { id: 2, date: '2026-11-12', name: '陈明', empNo: 'XC0012', org: '研发中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 3, date: '2026-11-08', name: '冯佳', empNo: 'XC0021', org: '运营中心', event: 'RESIGN', detail: '个人原因离职' },
  { id: 4, date: '2026-10-26', name: '罗欣', empNo: 'XC0061', org: '产品中心', event: 'ONBOARD', detail: '产品经理入职' },
  { id: 5, date: '2026-10-18', name: '郑宇', empNo: 'XC0052', org: '研发中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 6, date: '2026-10-09', name: '蒋鹏', empNo: 'XC0033', org: '研发中心', event: 'RESIGN', detail: '合同到期离职' },
  { id: 7, date: '2026-09-22', name: '唐笑', empNo: 'XC0060', org: '职能中心', event: 'ONBOARD', detail: '招聘专员入职' },
  { id: 8, date: '2026-09-16', name: '许华', empNo: 'XC0006', org: '职能中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 9, date: '2026-09-05', name: '高翔', empNo: 'XC0044', org: '运营中心', event: 'RESIGN', detail: '个人原因离职' },
  { id: 10, date: '2026-08-28', name: '林悦', empNo: 'XC0041', org: '产品中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 11, date: '2026-08-19', name: '杜航', empNo: 'XC0059', org: '研发中心', event: 'ONBOARD', detail: '后端工程师入职' },
  { id: 12, date: '2026-08-11', name: '韩梅', empNo: 'XC0039', org: '职能中心', event: 'RESIGN', detail: '个人原因离职' },
  { id: 13, date: '2026-07-24', name: '孙倩', empNo: 'XC0048', org: '职能中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 14, date: '2026-07-17', name: '周洁', empNo: 'XC0028', org: '产品中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 15, date: '2026-07-08', name: '吴迪', empNo: 'XC0036', org: '运营中心', event: 'RESIGN', detail: '组织调整离职' },
  { id: 16, date: '2026-06-20', name: '王浩然', empNo: 'XC0009', org: '研发中心', event: 'REGULAR', detail: '试用期转正' },
  { id: 17, date: '2026-06-15', name: '赵雷', empNo: 'XC0031', org: '运营中心', event: 'ONBOARD', detail: '运营主管入职' },
  { id: 18, date: '2026-06-03', name: '钱宁', empNo: 'XC0018', org: '产品中心', event: 'RESIGN', detail: '个人原因离职' }
])
const movementFilters = reactive({ months: ['2026-06', '2026-11'] as string[], org: 'ALL', event: 'ALL' })
const filteredMovement = computed(() => movementRows.value.filter(row =>
  (!movementFilters.months?.length || (row.date >= `${movementFilters.months[0]}-01` && row.date <= `${movementFilters.months[1]}-31`)) &&
  (movementFilters.org === 'ALL' || row.org === movementFilters.org) &&
  (movementFilters.event === 'ALL' || row.event === movementFilters.event)
))
const movementHires = computed(() => filteredMovement.value.filter(x => x.event === 'ONBOARD').length)
const movementResigns = computed(() => filteredMovement.value.filter(x => x.event === 'RESIGN').length)
const movementMetrics = computed(() => [
  { label: '期间入职', value: movementHires.value, hint: '新入职员工', tone: 'text-success' },
  { label: '期间离职', value: movementResigns.value, hint: '已办理离职', tone: 'text-warning' },
  { label: '净增人数', value: movementHires.value - movementResigns.value, hint: '入职减离职', tone: 'text-primary' },
  { label: '模拟离职率', value: `${(movementResigns.value / 18 * 100).toFixed(1)}%`, hint: '按平均在职 18 人', tone: 'text-danger' }
])
const movementMonths = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
const movementMonthly = computed(() => movementMonths.map(month => ({ month, hires: filteredMovement.value.filter(x => x.date.startsWith(month) && x.event === 'ONBOARD').length, resigns: filteredMovement.value.filter(x => x.date.startsWith(month) && x.event === 'RESIGN').length })))
const movementMonthMax = computed(() => Math.max(1, ...movementMonthly.value.flatMap(x => [x.hires, x.resigns])))
const movementOrgNet = computed(() => orgOptions.slice(1).map(org => ({ org: org.value, value: filteredMovement.value.filter(x => x.org === org.value && x.event === 'ONBOARD').length - filteredMovement.value.filter(x => x.org === org.value && x.event === 'RESIGN').length })))
const movementOrgMax = computed(() => Math.max(1, ...movementOrgNet.value.map(x => Math.abs(x.value))))
const movementColumns = [
  { title: '日期', dataIndex: 'date', width: 115 }, { title: '员工', key: 'employee', width: 130 },
  { title: '组织', dataIndex: 'org', width: 120 }, { title: '流动类型', key: 'event', width: 100 }, { title: '说明', dataIndex: 'detail' }
]
function resetMovementFilters() { Object.assign(movementFilters, { months: ['2026-06', '2026-11'], org: 'ALL', event: 'ALL' }) }
function movementEventText(event: string) { return ({ ONBOARD: '入职', REGULAR: '转正', RESIGN: '离职' } as Record<string, string>)[event] || event }
function movementEventColor(event: string) { return event === 'ONBOARD' ? 'green' : event === 'RESIGN' ? 'orange' : 'blue' }

interface AttendanceRow { id: number; date: string; name: string; empNo: string; org: string; type: string; value: number; status: string }
const attendanceRows = ref<AttendanceRow[]>([
  { id: 1, date: '2026-11-15', name: '陈明', empNo: 'XC0012', org: '研发中心', type: 'LATE', value: 12, status: 'NONE' },
  { id: 2, date: '2026-11-15', name: '周洁', empNo: 'XC0028', org: '产品中心', type: 'MISSING', value: 0, status: 'PENDING' },
  { id: 3, date: '2026-11-14', name: '吴迪', empNo: 'XC0036', org: '运营中心', type: 'EARLY', value: 18, status: 'NONE' },
  { id: 4, date: '2026-11-14', name: '王浩然', empNo: 'XC0009', org: '研发中心', type: 'LATE', value: 8, status: 'NONE' },
  { id: 5, date: '2026-11-13', name: '许华', empNo: 'XC0006', org: '职能中心', type: 'MISSING', value: 0, status: 'DONE' },
  { id: 6, date: '2026-11-13', name: '林悦', empNo: 'XC0041', org: '产品中心', type: 'ABSENT', value: 2.5, status: 'PENDING' },
  { id: 7, date: '2026-11-12', name: '赵雷', empNo: 'XC0031', org: '运营中心', type: 'LATE', value: 25, status: 'NONE' },
  { id: 8, date: '2026-11-12', name: '孙倩', empNo: 'XC0048', org: '职能中心', type: 'EARLY', value: 10, status: 'NONE' },
  { id: 9, date: '2026-11-11', name: '郑宇', empNo: 'XC0052', org: '研发中心', type: 'MISSING', value: 0, status: 'PENDING' },
  { id: 10, date: '2026-11-11', name: '钱宁', empNo: 'XC0018', org: '产品中心', type: 'LATE', value: 6, status: 'NONE' },
  { id: 11, date: '2026-11-10', name: '冯佳', empNo: 'XC0021', org: '运营中心', type: 'ABSENT', value: 4, status: 'DONE' },
  { id: 12, date: '2026-11-10', name: '蒋鹏', empNo: 'XC0033', org: '研发中心', type: 'LATE', value: 16, status: 'NONE' },
  { id: 13, date: '2026-11-09', name: '陈明', empNo: 'XC0012', org: '研发中心', type: 'MISSING', value: 0, status: 'DONE' },
  { id: 14, date: '2026-11-09', name: '周洁', empNo: 'XC0028', org: '产品中心', type: 'EARLY', value: 22, status: 'PENDING' }
])
const attendanceFilters = reactive({ month: '2026-11', org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' })
const filteredAttendance = computed(() => attendanceRows.value.filter(row =>
  row.date.startsWith(attendanceFilters.month) && (attendanceFilters.org === 'ALL' || row.org === attendanceFilters.org) &&
  (attendanceFilters.type === 'ALL' || row.type === attendanceFilters.type) &&
  (attendanceFilters.status === 'ALL' || row.status === attendanceFilters.status) &&
  (!attendanceFilters.keyword || `${row.name}${row.empNo}`.toLowerCase().includes(attendanceFilters.keyword.toLowerCase()))
))
const attendanceMetrics = computed(() => [
  { label: '异常记录', value: filteredAttendance.value.length, hint: '当前筛选范围', tone: 'text-primary' },
  { label: '迟到', value: attendanceCount('LATE'), hint: `${attendanceMinutes('LATE')} 分钟`, tone: 'text-warning' },
  { label: '早退', value: attendanceCount('EARLY'), hint: `${attendanceMinutes('EARLY')} 分钟`, tone: 'text-warning' },
  { label: '缺卡', value: attendanceCount('MISSING'), hint: '等待补卡核查', tone: 'text-primary' },
  { label: '缺勤', value: attendanceCount('ABSENT'), hint: '按实际缺勤统计', tone: 'text-danger' }
])
const attendanceDays = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']
const attendanceDaily = computed(() => attendanceDays.map(date => ({ date, value: filteredAttendance.value.filter(x => x.date === date).length })))
const attendanceDayMax = computed(() => Math.max(1, ...attendanceDaily.value.map(x => x.value)))
const attendanceTypeSlices = computed(() => slicesFor(filteredAttendance.value.map(x => attendanceTypeText(x.type)), ['#faad14', '#fa8c16', '#1677ff', '#f5222d']))
const attendanceColumns = [
  { title: '日期', dataIndex: 'date', width: 115 }, { title: '员工', key: 'employee', width: 125 },
  { title: '组织', dataIndex: 'org', width: 115 }, { title: '异常类型', key: 'type', width: 100 },
  { title: '异常时长', key: 'value', width: 110 }, { title: '处理状态', key: 'status', width: 100 }
]
function attendanceCount(type: string) { return filteredAttendance.value.filter(x => x.type === type).length }
function attendanceMinutes(type: string) { return filteredAttendance.value.filter(x => x.type === type).reduce((sum, x) => sum + x.value, 0) }
function attendanceTypeText(type: string) { return ({ LATE: '迟到', EARLY: '早退', MISSING: '缺卡', ABSENT: '缺勤' } as Record<string, string>)[type] || type }
function attendanceTypeColor(type: string) { return ({ LATE: 'gold', EARLY: 'orange', MISSING: 'blue', ABSENT: 'red' } as Record<string, string>)[type] || 'default' }
function attendanceStatusText(status: string) { return ({ PENDING: '待处理', DONE: '已处理', NONE: '无需处理' } as Record<string, string>)[status] || status }
function resetAttendanceFilters() { Object.assign(attendanceFilters, { month: '2026-11', org: 'ALL', type: 'ALL', status: 'ALL', keyword: '' }) }

interface Slice { name: string; value: number; color: string }
function slicesFor(names: string[], colors: string[]): Slice[] {
  const counts = new Map<string, number>()
  names.forEach(name => counts.set(name, (counts.get(name) || 0) + 1))
  return Array.from(counts.entries()).map(([name, value], index) => ({ name, value, color: colors[index % colors.length] }))
}
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
.ledger-page { min-height: 100%; }
.ledger-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.ledger-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 20px; font-weight: 600; }
.ledger-workbench { flex: 1; }
.ledger-tabs { padding: 0 14px 14px; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 14px; padding: 12px; border-radius: 8px; background: var(--color-fill-quaternary, #fafafa); }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.metric-grid.five-columns { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.metric-card { padding: 14px 16px; border: 1px solid var(--panel-border); border-radius: 8px; background: var(--panel-bg); }
.metric-label { color: var(--muted); font-size: 12px; }
.metric-value { margin: 3px 0; font-size: 26px; font-weight: 600; line-height: 1.4; }
.chart-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.chart-card { min-width: 0; min-height: 250px; padding: 16px; border: 1px solid var(--panel-border); border-radius: 8px; }
.chart-title { margin-bottom: 18px; font-weight: 600; }
.bar-chart { display: flex; align-items: flex-end; gap: 14px; height: 185px; padding: 0 8px; }
.bar-item { display: flex; flex: 1; flex-direction: column; align-items: center; height: 100%; min-width: 32px; }
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
.grouped-chart { display: flex; align-items: flex-end; gap: 12px; height: 170px; }
.grouped-item { display: flex; flex: 1; flex-direction: column; align-items: center; height: 100%; }
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
