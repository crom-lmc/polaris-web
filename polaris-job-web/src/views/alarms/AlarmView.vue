<script setup lang="ts">
/** 报警配置：全局通知渠道开关、报警规则 CRUD、报警流水 */
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import {
  createAlarmRule,
  deleteAlarmRule,
  listAlarmChannels,
  listAlarmRecords,
  listAlarmRules,
  saveAlarmChannels,
  updateAlarmRule,
  type AlarmChannel,
  type AlarmReceiverUser,
  type AlarmRecord,
  type AlarmRule,
  type AlarmRuleSaveRequest
} from '@/api/alarm'
import { listJobs, type JobInfo } from '@/api/job'
import { useUserStore } from '@/stores/user'
import { APP_CODES, appLabel } from '@/utils/apps'
import { formatDateTime } from '@/utils/format'
import OrgReceiverPicker from '@/components/OrgReceiverPicker.vue'

const user = useUserStore()

/* ---------------- 全局通知渠道 ---------------- */
const channels = ref<AlarmChannel[]>([])
const channelLoading = ref(false)

const channelLabel: Record<string, string> = { SITE: '站内消息', EMAIL: '邮件' }
const channelDesc: Record<string, string> = {
  SITE: '复用消息中心 NoticeApi，报到人账号的站内信',
  EMAIL: '通过配置中心已配置的 SMTP 发送，需接收人账号绑定邮箱'
}

function channelOf(code: string) {
  return channels.value.find((item) => item.channel === code)
}

async function loadChannels() {
  channels.value = await listAlarmChannels()
}

async function onToggleChannel(code: string, checked: boolean) {
  channelLoading.value = true
  try {
    await saveAlarmChannels([{ channel: code, enabled: checked ? 1 : 0 }])
    message.success(`${channelLabel[code]}已${checked ? '开启' : '关闭'}`)
    await loadChannels()
  } finally {
    channelLoading.value = false
  }
}

/* ---------------- 报警规则 ---------------- */
const ruleLoading = ref(false)
const rules = ref<AlarmRule[]>([])
const ruleTotal = ref(0)
const rulePage = ref(1)
const rulePageSize = ref(10)
const rulePagination = computed(() => ({
  current: rulePage.value,
  pageSize: rulePageSize.value,
  total: ruleTotal.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`
}))

const ruleColumns = [
  { title: '规则名称', key: 'name', width: 160 },
  { title: '适用范围', key: 'scope', width: 180 },
  { title: '触发条件', key: 'condition', width: 150 },
  { title: '通知渠道', key: 'channels', width: 130 },
  { title: '接收人', key: 'receivers', width: 150 },
  { title: '静默期', key: 'silence', width: 90 },
  { title: '状态', key: 'status', width: 80 },
  { title: '操作', key: 'action', width: 140 }
]

const jobOptions = ref<JobInfo[]>([])

async function loadRules() {
  ruleLoading.value = true
  try {
    const result = await listAlarmRules({ page: rulePage.value, size: rulePageSize.value })
    rules.value = result.records
    ruleTotal.value = result.total
  } finally {
    ruleLoading.value = false
  }
}

function onRuleTableChange(pager: { current?: number }) {
  rulePage.value = pager.current || 1
  loadRules()
}

function scopeText(rule: AlarmRule) {
  if (rule.scopeType === 'ALL') return '全部任务'
  if (rule.scopeType === 'APP') return `应用：${appLabel(rule.scopeValue)}`
  const job = jobOptions.value.find((item) => item.id === rule.scopeValue)
  return `任务：${job ? job.name : rule.scopeValue}`
}

const conditionText: Record<string, string> = {
  FAIL: '执行失败',
  TIMEOUT: '执行超时',
  CONSECUTIVE_FAIL: '连续失败'
}

function conditionLabel(rule: AlarmRule) {
  const text = conditionText[rule.triggerCondition] || rule.triggerCondition
  return rule.triggerCondition === 'CONSECUTIVE_FAIL' ? `${text} ${rule.threshold} 次` : text
}

function channelsText(channels: string) {
  return (channels || '')
    .split(',')
    .filter(Boolean)
    .map((item) => channelLabel[item.trim()] || item)
    .join('、')
}

/* ---------------- 规则编辑 ---------------- */
const drawerOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)

const form = reactive<AlarmRuleSaveRequest>({
  name: '',
  scopeType: 'ALL',
  scopeValue: '',
  triggerCondition: 'FAIL',
  threshold: 3,
  channels: 'SITE',
  accountIds: '',
  silenceMinutes: 60,
  status: 1
})

const channelValues = ref<string[]>(['SITE'])
const receiverAccounts = ref<string[]>([])
const receiverUsers = ref<AlarmReceiverUser[]>([])
const receiverPickerOpen = ref(false)

const receiverOptions = computed(() => {
  const users = new Map(receiverUsers.value.map((item) => [item.id, item]))
  return receiverAccounts.value.map((id) => {
    const account = users.get(id)
    return {
      value: id,
      label: account ? `${account.name}${account.empNo ? `（${account.empNo}）` : ''}` : `账号 ${id}`
    }
  })
})

function splitAccountIds(value?: string) {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function onReceiverAccountsChange(values: string[]) {
  receiverAccounts.value = [...new Set(values.flatMap((value) => splitAccountIds(value)))]
}

function onReceiverConfirm(users: AlarmReceiverUser[]) {
  const merged = new Map(receiverUsers.value.map((item) => [item.id, item]))
  for (const item of users) merged.set(item.id, item)
  receiverUsers.value = [...merged.values()]
  receiverAccounts.value = [...new Set([...receiverAccounts.value, ...users.map((item) => item.id)])]
}

function resetForm() {
  form.name = ''
  form.scopeType = 'ALL'
  form.scopeValue = ''
  form.triggerCondition = 'FAIL'
  form.threshold = 3
  form.accountIds = ''
  form.silenceMinutes = 60
  form.status = 1
  channelValues.value = ['SITE']
  receiverAccounts.value = []
  receiverUsers.value = []
}

function openCreate() {
  editingId.value = null
  resetForm()
  drawerOpen.value = true
}

function openEdit(rule: AlarmRule) {
  editingId.value = rule.id
  form.name = rule.name
  form.scopeType = rule.scopeType
  form.scopeValue = rule.scopeValue || ''
  form.triggerCondition = rule.triggerCondition
  form.threshold = rule.threshold || 3
  form.accountIds = rule.accountIds || ''
  form.silenceMinutes = rule.silenceMinutes ?? 60
  form.status = rule.status
  channelValues.value = (rule.channels || 'SITE').split(',').filter(Boolean)
  receiverAccounts.value = splitAccountIds(rule.accountIds)
  receiverUsers.value = []
  drawerOpen.value = true
}

async function submitRule() {
  if (!form.name.trim()) {
    message.warning('请填写规则名称')
    return
  }
  if (form.scopeType !== 'ALL' && !form.scopeValue) {
    message.warning(form.scopeType === 'JOB' ? '请选择任务' : '请选择应用')
    return
  }
  if (channelValues.value.length === 0) {
    message.warning('请至少选择一个通知渠道')
    return
  }
  saving.value = true
  try {
    const payload: AlarmRuleSaveRequest = {
      ...form,
      scopeValue: form.scopeType === 'ALL' ? '' : form.scopeValue,
      accountIds: [...new Set(receiverAccounts.value.flatMap((item) => splitAccountIds(item)))].join(','),
      channels: channelValues.value.join(','),
      threshold: form.triggerCondition === 'CONSECUTIVE_FAIL' ? form.threshold : 1
    }
    if (editingId.value) {
      await updateAlarmRule(editingId.value, payload)
    } else {
      await createAlarmRule(payload)
    }
    message.success(editingId.value ? '规则已更新' : '规则已创建')
    drawerOpen.value = false
    await loadRules()
  } finally {
    saving.value = false
  }
}

async function removeRule(rule: AlarmRule) {
  await deleteAlarmRule(rule.id)
  message.success('规则已删除')
  if (rules.value.length === 1 && rulePage.value > 1) {
    rulePage.value -= 1
  }
  await loadRules()
}

/* ---------------- 报警流水 ---------------- */
const recordLoading = ref(false)
const records = ref<AlarmRecord[]>([])
const recordTotal = ref(0)
const recordPage = ref(1)
const recordPageSize = ref(10)
const recordPagination = computed(() => ({
  current: recordPage.value,
  pageSize: recordPageSize.value,
  total: recordTotal.value,
  showSizeChanger: false,
  showTotal: (t: number) => `共 ${t} 条`
}))

const recordColumns = [
  { title: '时间', key: 'time', width: 160 },
  { title: '任务', key: 'job', width: 200 },
  { title: '事件', key: 'event', width: 90 },
  { title: '渠道', key: 'channel', width: 120 },
  { title: '接收人', key: 'receivers', width: 140 },
  { title: '内容', key: 'content' },
  { title: '发送结果', key: 'status', width: 100 }
]

async function loadRecords() {
  recordLoading.value = true
  try {
    const result = await listAlarmRecords({ page: recordPage.value, size: recordPageSize.value })
    records.value = result.records
    recordTotal.value = result.total
  } finally {
    recordLoading.value = false
  }
}

function onRecordTableChange(pager: { current?: number }) {
  recordPage.value = pager.current || 1
  loadRecords()
}

async function loadJobs() {
  const result = await listJobs({ page: 1, size: 200 })
  jobOptions.value = result.records
}

onMounted(async () => {
  await Promise.all([loadChannels(), loadRules(), loadRecords(), loadJobs()])
})
</script>

<template>
  <section class="view">
    <a-card :bordered="false" title="全局通知渠道">
      <a-row :gutter="24">
        <a-col v-for="code in ['SITE', 'EMAIL']" :key="code" :xs="24" :md="12">
          <div class="channel-item">
            <div class="channel-head">
              <span class="channel-name">{{ channelLabel[code] }}</span>
              <a-switch
                :checked="channelOf(code)?.enabled === 1"
                :loading="channelLoading"
                :disabled="!user.hasPerm('job:manage')"
                @change="(checked: boolean) => onToggleChannel(code, checked)"
              />
            </div>
            <div class="text-secondary">{{ channelDesc[code] }}</div>
            <div class="text-secondary">
              当前状态：{{ channelOf(code)?.enabled === 1 ? '已开启' : '未开启' }}
            </div>
          </div>
        </a-col>
      </a-row>
      <a-alert
        type="info"
        show-icon
        style="margin-top: 16px"
        message="同一任务 + 同一失败原因，静默期内只发一次；恢复后发送一条「已恢复」通知。"
      />
    </a-card>

    <a-card :bordered="false" title="报警规则">
      <template #extra>
        <a-space>
          <a-tag>优先级：任务级 &gt; 应用级 &gt; 全局</a-tag>
          <a-button v-if="user.hasPerm('job:manage')" type="primary" @click="openCreate">新建规则</a-button>
        </a-space>
      </template>
      <a-table
        row-key="id"
        size="middle"
        :loading="ruleLoading"
        :columns="ruleColumns"
        :data-source="rules"
        :pagination="rulePagination"
        :scroll="{ x: 1080 }"
        @change="onRuleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">{{ record.name || '—' }}</template>
          <template v-else-if="column.key === 'scope'">{{ scopeText(record) }}</template>
          <template v-else-if="column.key === 'condition'">{{ conditionLabel(record) }}</template>
          <template v-else-if="column.key === 'channels'">{{ channelsText(record.channels) }}</template>
          <template v-else-if="column.key === 'receivers'">
            {{ record.accountIds || '—' }}
          </template>
          <template v-else-if="column.key === 'silence'">
            {{ record.silenceMinutes }} 分钟
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'default'">
              {{ record.status === 1 ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-space>
              <a-button v-if="user.hasPerm('job:manage')" type="link" size="small" @click="openEdit(record)">
                编辑
              </a-button>
              <a-popconfirm
                v-if="user.hasPerm('job:manage')"
                title="确认删除该报警规则？"
                ok-text="删除"
                cancel-text="取消"
                @confirm="removeRule(record)"
              >
                <a-button type="link" size="small" danger>删除</a-button>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="还没有报警规则，点击右上角「新建规则」开始配置" />
        </template>
      </a-table>
    </a-card>

    <a-card :bordered="false" title="报警流水">
      <a-table
        row-key="id"
        size="middle"
        :loading="recordLoading"
        :columns="recordColumns"
        :data-source="records"
        :pagination="recordPagination"
        :scroll="{ x: 1000 }"
        @change="onRecordTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'time'">{{ formatDateTime(record.sentAt || record.createdAt) }}</template>
          <template v-else-if="column.key === 'job'">
            {{ record.jobName || record.jobId }}<a-tag v-if="record.appCode">{{ appLabel(record.appCode) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'event'">
            <a-tag :color="record.event === 'RECOVER' ? 'green' : 'red'">
              {{ record.event === 'RECOVER' ? '已恢复' : '失败' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'channel'">{{ channelsText(record.channel) }}</template>
          <template v-else-if="column.key === 'receivers'">{{ record.receivers || '—' }}</template>
          <template v-else-if="column.key === 'content'">{{ record.content || '—' }}</template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="record.status === 1 ? 'green' : 'orange'">
              {{ record.status === 1 ? '发送成功' : '发送失败' }}
            </a-tag>
          </template>
        </template>
        <template #emptyText>
          <a-empty description="暂无报警记录" />
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:open="drawerOpen" :title="editingId ? '编辑报警规则' : '新建报警规则'" width="480">
      <a-form layout="vertical">
        <a-form-item label="规则名称" required>
          <a-input v-model:value="form.name" placeholder="如：核心任务失败通知" :maxlength="64" />
        </a-form-item>

        <a-form-item label="适用范围" required>
          <a-radio-group v-model:value="form.scopeType" @change="form.scopeValue = ''">
            <a-radio value="ALL">全局</a-radio>
            <a-radio value="APP">按应用</a-radio>
            <a-radio value="JOB">按任务</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item v-if="form.scopeType === 'APP'" label="应用" required>
          <a-select v-model:value="form.scopeValue" placeholder="选择应用">
            <a-select-option v-for="code in APP_CODES" :key="code" :value="code">
              {{ appLabel(code) }}
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item v-if="form.scopeType === 'JOB'" label="任务" required>
          <a-select
            v-model:value="form.scopeValue"
            placeholder="选择任务"
            show-search
            option-filter-prop="label"
          >
            <a-select-option
              v-for="job in jobOptions"
              :key="job.id"
              :value="job.id"
              :label="`${job.name}（${appLabel(job.appCode)}）`"
            >
              {{ job.name }}（{{ appLabel(job.appCode) }}）
            </a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item label="触发条件" required>
          <a-select v-model:value="form.triggerCondition">
            <a-select-option value="FAIL">执行失败（含超时）</a-select-option>
            <a-select-option value="TIMEOUT">仅执行超时/不可达</a-select-option>
            <a-select-option value="CONSECUTIVE_FAIL">连续失败达到次数</a-select-option>
          </a-select>
        </a-form-item>

        <a-form-item v-if="form.triggerCondition === 'CONSECUTIVE_FAIL'" label="连续失败次数">
          <a-input-number v-model:value="form.threshold" :min="1" :max="99" style="width: 160px" />
        </a-form-item>

        <a-form-item label="通知渠道" required>
          <a-checkbox-group v-model:value="channelValues">
            <a-checkbox value="SITE">站内消息</a-checkbox>
            <a-checkbox value="EMAIL">邮件</a-checkbox>
          </a-checkbox-group>
        </a-form-item>

        <a-form-item label="接收人账号">
          <div class="receiver-input">
            <a-select
              v-model:value="receiverAccounts"
              mode="tags"
              show-search
              allow-clear
              option-filter-prop="label"
              :options="receiverOptions"
              :token-separators="[',']"
              max-tag-count="responsive"
              @change="onReceiverAccountsChange"
              placeholder="输入账号 ID，或从组织选择"
            />
            <a-button @click="receiverPickerOpen = true">从组织选择</a-button>
          </div>
          <div class="text-secondary" style="margin-top: 4px">
            多个账号用英文逗号分隔；接收人需在账号中心存在
          </div>
        </a-form-item>

        <a-form-item label="静默期（分钟）">
          <a-input-number v-model:value="form.silenceMinutes" :min="0" :max="10080" style="width: 160px" />
          <span class="text-secondary" style="margin-left: 8px">0 表示不去重</span>
        </a-form-item>

        <a-form-item label="状态">
          <a-switch :checked="form.status === 1" @change="(checked: boolean) => (form.status = checked ? 1 : 0)" />
        </a-form-item>
      </a-form>

      <template #footer>
        <a-space>
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submitRule">保存</a-button>
        </a-space>
      </template>
    </a-drawer>

    <OrgReceiverPicker v-model:open="receiverPickerOpen" @confirm="onReceiverConfirm" />
  </section>
</template>

<style scoped>
.channel-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
}

.channel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.channel-name {
  font-weight: 500;
}

.receiver-input {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.receiver-input :deep(.ant-select) {
  flex: 1;
  min-width: 0;
}

.receiver-input :deep(.ant-btn) {
  flex: 0 0 auto;
}
</style>
