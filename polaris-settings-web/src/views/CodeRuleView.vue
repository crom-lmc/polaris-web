<template>
  <div class="page-container code-page">
    <div class="page-root">
      <section class="panel">
        <div class="panel-head">
          <span>
            单号配置
            <span class="muted head-sub">业务方生成数据前调 /internal/code-rules/next 取号；审批单号由发起审批时自动生成</span>
          </span>
          <a-space :size="8">
            <a-input
              v-model:value="keyword"
              placeholder="搜表名 / 应用 / 前缀"
              allow-clear
              style="width: 220px"
              @press-enter="load"
            />
            <a-button @click="load">查询</a-button>
            <a-button v-if="canManage" type="primary" @click="openCreate">新增规则</a-button>
            <a-button v-if="canManage" :disabled="!selectedRule" @click="openAdjust">调整流水号</a-button>
          </a-space>
        </div>

        <div class="panel-body table-body">
          <a-table
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            row-key="id"
            :row-selection="rowSelection"
            :custom-row="onRowClick"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'index'">{{ index + 1 }}</template>
              <template v-else-if="column.key === 'appCode'">
                {{ appNameOf(record.appCode) }}
              </template>
              <template v-else-if="column.key === 'remark'">
                {{ remarkOf(record) }}
              </template>
              <template v-else-if="column.key === 'separatorChar'">
                {{ record.separatorChar || '（空）' }}
              </template>
              <template v-else-if="column.key === 'padZero'">
                {{ record.padZero === 1 ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'resetMonthly'">
                {{ record.resetMonthly === 1 ? '是' : '否' }}
              </template>
              <template v-else-if="column.key === 'lastNo'">
                <span v-if="record.lastNo">{{ record.lastNo }}</span>
                <span v-else class="muted">未生成</span>
                <span v-if="record.lastPeriod" class="muted last-period">（{{ record.lastPeriod }}）</span>
              </template>
              <template v-else-if="column.key === 'action'">
                <a v-if="canManage" @click="openEdit(record)">编辑</a>
                <span v-else class="muted">-</span>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? '编辑单号规则' : '新增单号规则'"
      :confirm-loading="saving"
      width="640px"
      centered
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="应用" name="appCode" :rules="[{ required: true, message: '请选择应用' }]">
              <a-select
                v-model:value="form.appCode"
                placeholder="选择应用"
                show-search
                option-filter-prop="label"
                :options="appOptions"
                :disabled="!!editing"
                @change="onAppChange"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="数据库表名" name="tableName" :rules="[{ required: true, message: '请选择数据库表名' }]">
              <a-select
                v-model:value="form.tableName"
                placeholder="选择表"
                show-search
                option-filter-prop="label"
                :loading="tableLoading"
                :options="tableOptions"
                :disabled="!!editing"
              />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="前缀" name="prefix">
              <a-input v-model:value="form.prefix" placeholder="如 SP" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="分隔符" name="separatorChar">
              <a-input v-model:value="form.separatorChar" placeholder="如 -" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="长度（流水号位数）" name="seqLength">
              <a-input-number v-model:value="form.seqLength" :min="1" :max="12" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="起始流水号" name="startNo">
              <a-input-number v-model:value="form.startNo" :min="1" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="日期格式" name="dateFormat">
          <a-select v-model:value="form.dateFormat" :options="dateFormatOptions" />
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="是否补 0">
              <a-switch v-model:checked="padZeroChecked" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="是否按月重置">
              <a-switch v-model:checked="resetMonthlyChecked" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="表达式格式（自动生成，不可修改）">
          <a-input :value="exprDisplay" disabled />
        </a-form-item>

        <a-form-item label="编号示例">
          <span class="sample-no">{{ sampleNo }}</span>
          <span class="muted sample-tip">按起始流水号预览，实际按当前流水号递增</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="adjustOpen"
      title="调整流水号"
      :confirm-loading="adjusting"
      width="460px"
      centered
      ok-text="确定调整"
      @ok="submitAdjust"
    >
      <a-form layout="vertical">
        <a-form-item label="业务表名">
          <a-input :value="selectedRule?.tableName || ''" disabled />
        </a-form-item>
        <a-form-item label="当前流水号">
          <a-input :value="adjustCurrent ? String(adjustCurrent) : '未生成'" disabled />
        </a-form-item>
        <a-form-item label="下一个流水号" required>
          <a-input-number v-model:value="adjustNextValue" :min="adjustMin" style="width: 100%" />
          <div class="muted adjust-tip">只能往后调整，最小可调整为 {{ adjustMin }}</div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import {
  fetchApps,
  fetchEntityApps,
  fetchEntityTables,
  type AppBrief,
  type EntityTableMeta
} from '@/api/approval'
import {
  adjustNextNo,
  createCodeRule,
  listCodeRules,
  updateCodeRule,
  type CodeRule
} from '@/api/codeRule'

const store = useUserStore()
const canManage = computed(() => store.can('code:manage'))

const columns = [
  { title: '序号', key: 'index', width: 60 },
  { title: '应用', key: 'appCode', width: 110, ellipsis: true },
  { title: '数据库表名', dataIndex: 'tableName', key: 'tableName', width: 170, ellipsis: true },
  { title: '备注', key: 'remark', width: 150, ellipsis: true },
  { title: '前缀', dataIndex: 'prefix', key: 'prefix', width: 80 },
  { title: '分隔符', key: 'separatorChar', width: 80, align: 'center' as const },
  { title: '长度', dataIndex: 'seqLength', key: 'seqLength', width: 70, align: 'center' as const },
  { title: '补 0', key: 'padZero', width: 70, align: 'center' as const },
  { title: '按月重置', key: 'resetMonthly', width: 90, align: 'center' as const },
  { title: '起始流水号', dataIndex: 'startNo', key: 'startNo', width: 100, align: 'center' as const },
  { title: '日期格式', dataIndex: 'dateFormat', key: 'dateFormat', width: 130 },
  { title: '表达式格式', dataIndex: 'exprFormat', key: 'exprFormat', ellipsis: true },
  { title: '当前流水号', key: 'lastNo', width: 130 },
  { title: '操作', key: 'action', width: 100 }
]

const rows = ref<CodeRule[]>([])
const loading = ref(false)
const keyword = ref('')

/* ---------------- 应用 / 表下拉 ---------------- */

const apps = ref<AppBrief[]>([])
const entityApps = ref<Record<string, string>>({})
const tables = ref<EntityTableMeta[]>([])
const tableLoading = ref(false)

const appNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const a of apps.value) map.set(a.code, a.name)
  return map
})

function appNameOf(code: string) {
  if (!code) return '通用'
  return appNameMap.value.get(code) || code
}

/* ---------------- 备注：读库表注释，说明这条规则对应哪个业务 ---------------- */

/** 表名 → 业务说明（取数据库表注释，简洁一句话） */
const remarkMap = ref<Record<string, string>>({})

/** 少数表没开实体元数据，注释读不到时兜底 */
const REMARK_FALLBACK: Record<string, string> = {
  appr_instance: '审批实例'
}

/** 表注释常带补充说明（如「录用Offer（审批通过后自动生成待入职档案）」），括号前一句就够用 */
function briefComment(comment: string) {
  return (comment || '').split(/[（(]/)[0].trim() || comment
}

async function loadRemarks() {
  const codes = Array.from(new Set(rows.value.map((r) => r.appCode).filter(Boolean)))
  const map: Record<string, string> = {}
  await Promise.all(
    codes.map(async (code) => {
      try {
        const list = await fetchEntityTables(code)
        for (const t of list) {
          if (t.comment) map[t.table] = briefComment(t.comment)
        }
      } catch {
        // 单个应用元数据读不到就跳过，该应用的备注留空
      }
    })
  )
  remarkMap.value = map
}

function remarkOf(record: CodeRule) {
  return remarkMap.value[record.tableName] || REMARK_FALLBACK[record.tableName] || '—'
}

/** 只保留「已开通实体元数据」的应用，避免选了表读不出来 */
const appOptions = computed(() => {
  const readable = Object.keys(entityApps.value || {})
  const list = apps.value.filter((a) => !readable.length || readable.includes(a.code))
  return list.map((a) => ({ value: a.code, label: `${a.name}（${a.code}）` }))
})

const tableOptions = computed(() =>
  tables.value.map((t) => ({ value: t.table, label: t.comment ? `${t.table}（${t.comment}）` : t.table }))
)

const dateFormatOptions = [
  { value: 'yyyyMMdd', label: 'yyyyMMdd（20261108）' },
  { value: 'yyMMdd', label: 'yyMMdd（261108）' },
  { value: 'yyyy', label: 'yyyy（2026）' },
  { value: 'yyyyMM', label: 'yyyyMM（202611）' }
]

type FormState = {
  appCode: string
  tableName: string
  prefix: string
  separatorChar: string
  seqLength: number
  padZero: number
  resetMonthly: number
  startNo: number
  dateFormat: string
}

const DEFAULT_FORM: FormState = {
  appCode: 'settings',
  tableName: '',
  prefix: '',
  separatorChar: '',
  seqLength: 4,
  padZero: 1,
  resetMonthly: 0,
  startNo: 1,
  dateFormat: 'yyyyMMdd'
}

const form = reactive<FormState>({ ...DEFAULT_FORM })
const padZeroChecked = ref(true)
const resetMonthlyChecked = ref(false)

/* ---------------- 表达式 / 编号示例（前端只读预览） ---------------- */

const exprDisplay = computed(() => {
  const parts: string[] = []
  if (form.prefix) parts.push('{prefix}')
  parts.push('{date}', '{seq}')
  return parts.join(form.separatorChar || '')
})

/** 按所选日期格式渲染今天，仅用于示例展示 */
const dateSample = computed(() => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  const y = String(d.getFullYear())
  const m = p(d.getMonth() + 1)
  const day = p(d.getDate())
  switch (form.dateFormat) {
    case 'yyyy-MM-dd':
      return `${y}-${m}-${day}`
    case 'yyyyMM':
      return `${y}${m}`
    case 'yyyy-MM':
      return `${y}-${m}`
    case 'yyyy':
      return y
    case 'yyyyMMddHHmmss':
      return `${y}${m}${day}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    default:
      return `${y}${m}${day}`
  }
})

const seqSample = computed(() => {
  const seq = String(form.startNo || 1)
  const len = form.seqLength || 0
  return padZeroChecked.value && len > seq.length ? seq.padStart(len, '0') : seq
})

const sampleNo = computed(() => {
  const parts: string[] = []
  if (form.prefix) parts.push(form.prefix)
  parts.push(dateSample.value, seqSample.value)
  return parts.join(form.separatorChar || '')
})

/* ---------------- 加载 ---------------- */

onMounted(async () => {
  await Promise.all([load(), loadApps()])
})

async function loadApps() {
  try {
    const [list, readable] = await Promise.all([fetchApps(), fetchEntityApps()])
    apps.value = list
    entityApps.value = readable || {}
  } catch {
    apps.value = []
    entityApps.value = {}
  }
}

async function load() {
  loading.value = true
  try {
    rows.value = await listCodeRules(keyword.value || undefined)
    void loadRemarks()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadTables(appCode: string) {
  tables.value = []
  if (!appCode) return
  tableLoading.value = true
  try {
    tables.value = await fetchEntityTables(appCode)
  } catch (e: any) {
    message.error(e?.message || '读取数据库表失败')
  } finally {
    tableLoading.value = false
  }
}

async function onAppChange(code: string) {
  form.tableName = ''
  await loadTables(code)
}

/* ---------------- 弹窗 ---------------- */

const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<CodeRule | null>(null)
const formRef = ref()

function openCreate() {
  editing.value = null
  Object.assign(form, DEFAULT_FORM)
  padZeroChecked.value = true
  resetMonthlyChecked.value = false
  modalOpen.value = true
  loadTables(form.appCode)
}

async function openEdit(record: CodeRule) {
  editing.value = record
  Object.assign(form, {
    appCode: record.appCode || 'settings',
    tableName: record.tableName,
    prefix: record.prefix || '',
    separatorChar: record.separatorChar || '',
    seqLength: record.seqLength || 4,
    padZero: record.padZero === 1 ? 1 : 0,
    resetMonthly: record.resetMonthly === 1 ? 1 : 0,
    startNo: record.startNo || 1,
    dateFormat: record.dateFormat || 'yyyyMMdd'
  })
  padZeroChecked.value = record.padZero === 1
  resetMonthlyChecked.value = record.resetMonthly === 1
  modalOpen.value = true
  await loadTables(form.appCode)
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      padZero: padZeroChecked.value ? 1 : 0,
      resetMonthly: resetMonthlyChecked.value ? 1 : 0
    }
    if (editing.value) {
      await updateCodeRule(editing.value.id, payload)
      message.success('已保存')
    } else {
      await createCodeRule(payload)
      message.success('已创建')
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------------- 行选择 / 调整流水号 ---------------- */

/** 单号规则按表唯一，用单选行；选中后「调整流水号」直接带出该规则 */
const selectedRowKeys = ref<string[]>([])
const selectedRule = computed(() => rows.value.find((r) => r.id === selectedRowKeys.value[0]))

const rowSelection = computed(() => ({
  type: 'radio' as const,
  selectedRowKeys: selectedRowKeys.value,
  onChange: (keys: (string | number)[]) => {
    selectedRowKeys.value = keys.map((k) => String(k))
  }
}))

/** 点整行也能选中，避免只能点小圆点 */
function onRowClick(record: CodeRule) {
  return {
    onClick: () => {
      selectedRowKeys.value = [record.id]
    }
  }
}

const adjustOpen = ref(false)
const adjusting = ref(false)
const adjustNextValue = ref<number>()

const adjustCurrent = computed(() => selectedRule.value?.lastNo || 0)

/** 只能往后调：已有流水号时下一个最小是 current+1，没有则从起始流水号开始 */
const adjustMin = computed(() => {
  const rule = selectedRule.value
  if (!rule) return 1
  const current = rule.lastNo || 0
  return current > 0 ? current + 1 : rule.startNo || 1
})

function openAdjust() {
  if (!selectedRule.value) {
    message.warning('请先选择一条单号规则')
    return
  }
  adjustNextValue.value = adjustMin.value
  adjustOpen.value = true
}

async function submitAdjust() {
  const rule = selectedRule.value
  if (!rule) {
    message.warning('请先选择一条单号规则')
    return
  }
  if (!adjustNextValue.value) {
    message.warning('请输入下一个流水号')
    return
  }
  if (adjustNextValue.value < adjustMin.value) {
    message.warning(`只能往后调整，不能小于 ${adjustMin.value}`)
    return
  }
  adjusting.value = true
  try {
    await adjustNextNo(rule.id, adjustNextValue.value)
    message.success('已调整')
    adjustOpen.value = false
    await load()
    selectedRowKeys.value = [rule.id]
  } catch (e: any) {
    message.error(e?.message || '调整失败')
  } finally {
    adjusting.value = false
  }
}
</script>

<style scoped>
.code-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.head-sub {
  margin-left: 8px;
  font-weight: 400;
}

.panel {
  flex: 1;
  min-height: 0;
}

.table-body {
  overflow: auto;
}

.adjust-tip {
  margin-top: 4px;
  font-size: 12px;
}

.last-period {
  margin-left: 4px;
}

.sample-no {
  font-family: Consolas, Menlo, monospace;
  font-size: 14px;
  font-weight: 600;
}

.sample-tip {
  margin-left: 8px;
  font-size: 12px;
}
</style>
