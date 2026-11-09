<template>
  <div class="page-root">
    <div class="toolbar">
      <div class="toolbar-left">
        <a-radio-group v-model:value="scope" button-style="solid" @change="reload">
          <a-radio-button value="mine">我的加班</a-radio-button>
          <a-radio-button v-if="canTeam" value="team">团队加班</a-radio-button>
          <a-radio-button v-if="canTeam" value="all">全部加班</a-radio-button>
        </a-radio-group>
        <a-date-picker
          v-model:value="month"
          picker="month"
          value-format="YYYY-MM"
          placeholder="全部月份"
          allow-clear
          style="width: 140px"
          @change="reload"
        />
        <a-button @click="reload">
          <template #icon><reload-outlined /></template>
          刷新
        </a-button>
      </div>
      <div class="toolbar-right">
        <a-button v-if="canExportAttendance" :loading="attendanceExporting" @click="doExportAttendance">
          <template #icon><download-outlined /></template>
          导出月度考勤
        </a-button>
        <a-button type="primary" @click="openApply">
          <template #icon><plus-outlined /></template>
          提交加班
        </a-button>
      </div>
    </div>

    <section class="panel ft-grow">
      <div class="panel-head">
        <span>{{ scope === 'mine' ? '我的加班记录' : '加班记录' }}</span>
        <span class="muted">加班审批通过后按 1 小时 = 1 小时折算调休额度；审批动作在「审批中心」处理</span>
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
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!loading" description="暂无加班记录" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employee'">
              <div>{{ record.employeeName || '—' }}</div>
              <div class="muted cell-sub">{{ record.createdAt }}</div>
            </template>
            <template v-else-if="column.key === 'workDate'">
              <div>{{ record.workDate }}</div>
              <div class="muted cell-sub">{{ record.typeName }}</div>
            </template>
            <template v-else-if="column.key === 'hours'">
              <b>{{ record.hours }}</b> 小时
            </template>
            <template v-else-if="column.key === 'reason'">
              <span class="reason-text">{{ record.reason || '—' }}</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="statusColor(record.status)">{{ record.statusName }}</a-tag>
              <div v-if="record.approveNote" class="muted cell-sub">{{ record.approveNote }}</div>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-popconfirm
                v-if="record.status === 0 && record.mine"
                title="撤销后需要重新提交，确定撤销？"
                ok-text="撤销"
                cancel-text="取消"
                @confirm="doCancel(record)"
              >
                <a class="danger">撤销</a>
              </a-popconfirm>
              <span v-else class="muted">—</span>
            </template>
          </template>
        </a-table>
      </div>
    </section>

    <section class="panel month-panel">
      <div class="panel-head">
        <span>月度考勤汇总</span>
        <span class="muted">
          {{ canConfirm ? '按工作日历与已通过的请假/加班计算，确认后锁定' : '数据由系统按工作日历与已通过的请假/加班计算' }}
        </span>
      </div>
      <div class="panel-body table-body ft-scroll ft-bottom month-body">
        <a-table
          class="ft-table"
          :columns="monthColumns"
          :data-source="monthRows"
          :loading="monthLoading"
          row-key="employeeId"
          size="middle"
          :pagination="false"
        >
          <template #emptyText>
            <div class="tbl-empty"><a-empty v-if="!monthLoading" description="暂无汇总数据" /></div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'employee'">{{ record.employeeName || '—' }}</template>
            <template v-else-if="column.key === 'confirmed'">
              <a-tag :color="record.confirmed === 1 ? 'green' : 'default'">
                {{ record.confirmed === 1 ? '已确认' : '未确认' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-button
                v-if="canConfirm && record.confirmed !== 1"
                size="small"
                type="link"
                @click="doConfirm(record)"
              >确认</a-button>
              <span v-else class="muted">—</span>
            </template>
          </template>
        </a-table>
      </div>
    </section>

    <a-modal
      v-model:open="applyOpen"
      title="提交加班"
      :confirm-loading="saving"
      ok-text="提交审批"
      cancel-text="取消"
      width="520px"
      centered
      destroy-on-close
      @ok="submitApply"
    >
      <a-form layout="vertical">
        <a-form-item label="加班日期" required>
          <a-date-picker
            v-model:value="form.workDate"
            value-format="YYYY-MM-DD"
            style="width: 100%"
            :disabled-date="disabledFuture"
          />
        </a-form-item>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="加班时长（小时）" required>
              <a-input-number v-model:value="form.hours" :min="0.5" :max="24" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="加班类型" required>
              <a-select v-model:value="form.type" :options="typeOptions" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="加班事由">
          <a-textarea v-model:value="form.reason" :rows="3" :maxlength="200" show-count />
        </a-form-item>
        <a-alert
          v-if="overLimitHint"
          type="info"
          show-icon
          message="当月累计加班将超过 8 小时，需直属主管通过后再由人力资源中心终审"
        />
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  cancelOvertime,
  confirmAttendanceMonthly,
  exportAttendanceXlsx,
  listAttendanceMonthly,
  listOvertimes,
  submitOvertime,
  type AttendanceMonthItem,
  type OvertimeItem
} from '@/api/ehr'
import { useUserStore } from '@/stores/user'
import dayjs, { type Dayjs } from 'dayjs'

const store = useUserStore()
const canTeam = computed(() => store.can('overtime:approve'))
const canConfirm = computed(() => store.can('overtime:approve'))

const scope = ref<'mine' | 'team' | 'all'>('mine')
const month = ref<string>('')
const loading = ref(false)
const rows = ref<OvertimeItem[]>([])
const total = ref(0)
const page = ref(1)
const size = ref(20)

const columns = [
  { title: '员工', key: 'employee', width: 150 },
  { title: '加班日期', key: 'workDate', width: 160 },
  { title: '时长', key: 'hours', width: 110 },
  { title: '事由', key: 'reason' },
  { title: '状态', key: 'status', width: 150 },
  { title: '操作', key: 'action', width: 90 }
]

const pagination = computed(() => ({
  current: page.value,
  pageSize: size.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

function onTableChange(p: any) {
  page.value = p.current || 1
  size.value = p.pageSize || 20
  reload()
}

async function reload() {
  loading.value = true
  try {
    const res = await listOvertimes({
      scope: scope.value,
      month: month.value || undefined,
      page: page.value,
      size: size.value
    })
    rows.value = res.list || []
    total.value = res.total || 0
  } catch (e: any) {
    message.error(e?.message || '加载加班记录失败')
  } finally {
    loading.value = false
  }
}

watch(scope, () => {
  page.value = 1
  reload()
})

/* ---------- 提交 ---------- */
const applyOpen = ref(false)
const saving = ref(false)
const form = reactive({
  workDate: dayjs().format('YYYY-MM-DD'),
  hours: 2,
  type: 'NORMAL',
  reason: ''
})

const typeOptions = [
  { value: 'NORMAL', label: '工作日加班' },
  { value: 'HOLIDAY', label: '节假日加班' },
  { value: 'RESTDAY', label: '休息日加班' }
]

const overLimitHint = computed(() => {
  if (form.type === 'HOLIDAY') return true
  const sameMonth = rows.value
    .filter((r) => r.status === 1 && r.mine && r.workDate?.slice(0, 7) === form.workDate?.slice(0, 7))
    .reduce((s, r) => s + Number(r.hours || 0), 0)
  return sameMonth + Number(form.hours || 0) > 8
})

function disabledFuture(d: Dayjs) {
  return d.isAfter(dayjs(), 'day')
}

function openApply() {
  Object.assign(form, {
    workDate: dayjs().format('YYYY-MM-DD'),
    hours: 2,
    type: 'NORMAL',
    reason: ''
  })
  applyOpen.value = true
}

async function submitApply() {
  if (!form.workDate) {
    message.warning('请选择加班日期')
    return
  }
  if (!form.hours || form.hours <= 0) {
    message.warning('请填写加班时长')
    return
  }
  saving.value = true
  try {
    await submitOvertime({
      workDate: form.workDate,
      hours: Number(form.hours),
      type: form.type,
      reason: form.reason
    })
    message.success('加班审批已提交，请在审批中心跟进')
    applyOpen.value = false
    scope.value = 'mine'
    page.value = 1
    await reload()
  } catch (e: any) {
    message.error(e?.message || '提交失败')
  } finally {
    saving.value = false
  }
}

async function doCancel(record: OvertimeItem) {
  try {
    await cancelOvertime(record.id)
    message.success('已撤销')
    await reload()
  } catch (e: any) {
    message.error(e?.message || '撤销失败')
  }
}

function statusColor(status: number) {
  switch (status) {
    case 0:
      return 'blue'
    case 1:
      return 'green'
    case 2:
      return 'red'
    default:
      return 'default'
  }
}

/* ---------- 月度汇总 ---------- */
const monthRows = ref<AttendanceMonthItem[]>([])
const monthLoading = ref(false)
const summaryMonth = ref(dayjs().format('YYYY-MM'))

const monthColumns = [
  { title: '员工', key: 'employee', width: 160 },
  { title: '应出勤', dataIndex: 'shouldDays', width: 100 },
  { title: '实际出勤', dataIndex: 'actualDays', width: 100 },
  { title: '请假天数', dataIndex: 'leaveDays', width: 100 },
  { title: '加班小时', dataIndex: 'overtimeHours', width: 110 },
  { title: '缺勤天数', dataIndex: 'absentDays', width: 100 },
  { title: '状态', key: 'confirmed', width: 100 },
  { title: '操作', key: 'action', width: 90 }
]

async function loadMonthly() {
  monthLoading.value = true
  try {
    monthRows.value = await listAttendanceMonthly(summaryMonth.value)
  } catch (e: any) {
    message.error(e?.message || '加载月度汇总失败')
  } finally {
    monthLoading.value = false
  }
}

async function doConfirm(record: AttendanceMonthItem) {
  try {
    await confirmAttendanceMonthly(summaryMonth.value, record.employeeId)
    message.success('已确认并锁定')
    await loadMonthly()
  } catch (e: any) {
    message.error(e?.message || '确认失败')
  }
}

/* ---------- 导出月度考勤（xlsx） ---------- */
const canExportAttendance = computed(() => store.can('overtime:view'))
const attendanceExporting = ref(false)

async function doExportAttendance() {
  attendanceExporting.value = true
  try {
    const res: any = await exportAttendanceXlsx(summaryMonth.value)
    const blob = new Blob([res.data])
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `月度考勤-${summaryMonth.value}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    message.success('考勤导出已开始')
  } catch (e: any) {
    message.error(e?.message || '导出失败')
  } finally {
    attendanceExporting.value = false
  }
}

watch([summaryMonth, canConfirm], () => loadMonthly(), { immediate: true })
reload()
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: nowrap;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  white-space: nowrap;
}
/* 加班记录与月度汇总各占剩余高度的一半 */
.month-panel {
  flex: 1 1 0;
  min-height: 0;
}
.month-body {
  overflow: auto;
}
.cell-sub {
  font-size: 12px;
}
.reason-text {
  display: inline-block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
