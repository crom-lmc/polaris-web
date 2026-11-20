<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined } from '@ant-design/icons-vue'
import { fetchAdminExchanges, issueExchange, shipExchange, type ExchangeRecord } from '@/api/forum'
import { confirmAction } from '@/utils/confirm'
import { useTablePagination } from '@/composables/useTablePagination'
import { useFeatureSwitch } from '@/composables/useFeatureSwitch'

import { useUserStore } from '@/stores/user'
const records = ref<ExchangeRecord[]>([])
const store = useUserStore()
const { exchangeEnabled } = useFeatureSwitch()
const status = ref('')
const trackingNumbers = ref<Record<string, string>>({})
const issueRemarks = ref<Record<string, string>>({})
const loading = ref(false)
const processingId = ref('')
const { pagination, pagedSource: pagedRecords, reset: resetPage, onChange: onTableChange } = useTablePagination(records)
const statusNames: Record<ExchangeRecord['status'], string> = {
  PENDING_ISSUE: '待发放',
  SHIPPING: '物流运输中',
  ISSUED: '已发放'
}
const statusColors: Record<ExchangeRecord['status'], string> = {
  PENDING_ISSUE: 'orange',
  SHIPPING: 'blue',
  ISSUED: 'green'
}
const columns = [
  { title: '兑换用户', key: 'user', width: 150 },
  { title: '礼品', dataIndex: 'giftName', width: 180 },
  { title: '来源', key: 'source', width: 90 },
  { title: '积分', dataIndex: 'points', width: 100 },
  { title: '状态', key: 'status', width: 120 },
  { title: '兑换时间', dataIndex: 'createdAt', width: 170 },
  { title: '发放登记', key: 'issue', width: 430 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    records.value = await fetchAdminExchanges(status.value)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '兑换记录加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  resetPage()
  void load()
}

function ship(record: ExchangeRecord) {
  if (!store.can('forum:exchange:ship')) return
  const trackingNo = trackingNumbers.value[record.id]?.trim() || ''
  if (!trackingNo) {
    message.warning('请输入快递单号')
    return
  }
  confirmAction({
    title: '登记物流信息',
    content: `确认使用快递单号“${trackingNo}”将“${record.giftName}”标记为物流运输中吗？`,
    okText: '确认登记',
    onOk: async () => {
      processingId.value = record.id
      try {
        Object.assign(record, await shipExchange(record.id, trackingNo, issueRemarks.value[record.id]?.trim() || ''))
        message.success('快递单号已登记，状态已更新为物流运输中')
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '物流登记失败')
      } finally {
        processingId.value = ''
      }
    }
  })
}

function issue(record: ExchangeRecord) {
  confirmAction({
    title: '确认线下签收',
    content: `请确认“${record.giftName}”已在线下完成签收。确认后状态将更新为已发放。`,
    okText: '确认签收',
    onOk: async () => {
      processingId.value = record.id
      try {
        Object.assign(record, await issueExchange(record.id, issueRemarks.value[record.id]?.trim() || ''))
        message.success('线下签收已确认，礼品已发放')
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '签收确认失败')
      } finally {
        processingId.value = ''
      }
    }
  })
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading">
      <h1>礼品发放</h1>
      <p>登记快递单号，并在核实线下签收后确认发放；不关联快递公司或物流查询。</p>
    </header>
    <a-alert v-if="!exchangeEnabled" class="feature-off-alert" type="warning" show-icon message="礼品兑换功能当前已关闭" description="论坛前台不再展示兑换入口，本页面发放按钮已全部置灰。如需开启，请到「配置中心 - 埋点管理」修改 forum.exchange.enabled。" />
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-select v-model:value="status" class="filter-select" @change="reload">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="PENDING_ISSUE">待发放</a-select-option>
          <a-select-option value="SHIPPING">物流运输中</a-select-option>
          <a-select-option value="ISSUED">已发放</a-select-option>
        </a-select>
        <a-button v-if="store.can('forum:exchange:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !pagedRecords.length }">
        <a-table :columns="columns" :data-source="pagedRecords" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">{{ record.username || record.accountId }}</template>
            <template v-else-if="column.key === 'source'">
              <a-tag :color="record.source === 'LOTTERY' ? 'purple' : 'blue'">{{ record.source === 'LOTTERY' ? '抽奖' : '兑换' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColors[record.status as ExchangeRecord['status']]">{{ statusNames[record.status as ExchangeRecord['status']] }}</a-tag></template>
            <template v-else-if="column.key === 'issue'">
              <div v-if="record.status === 'PENDING_ISSUE'" class="issue-detail">
                <div class="issue-controls">
                  <a-input v-model:value="trackingNumbers[record.id]" :maxlength="100" placeholder="输入快递单号" :disabled="!exchangeEnabled" @press-enter="ship(record)" />
                  <a-button v-if="store.can('forum:exchange:ship')" type="primary" :disabled="!exchangeEnabled" :loading="processingId === record.id" @click="ship(record)">登记物流</a-button>
                </div>
                <a-input v-model:value="issueRemarks[record.id]" :maxlength="500" placeholder="发放备注（选填）" :disabled="!exchangeEnabled" />
              </div>
              <div v-else-if="record.status === 'SHIPPING'" class="issue-detail">
                <span>快递单号：{{ record.trackingNo }}</span>
                <div class="issue-controls">
                  <a-input v-model:value="issueRemarks[record.id]" :maxlength="500" placeholder="签收备注（选填）" :disabled="!exchangeEnabled" />
                  <a-button v-if="store.can('forum:exchange:issue')" type="primary" :disabled="!exchangeEnabled" :loading="processingId === record.id" @click="issue(record)">确认签收</a-button>
                </div>
                <span class="secondary-text">请线下核实签收后再操作</span>
              </div>
              <div v-else class="issue-detail">
                <span>{{ record.issuedAt || '-' }} · {{ record.issuedByName || '-' }}</span>
                <span v-if="record.trackingNo">快递单号：{{ record.trackingNo }}</span>
                <span class="secondary-text">{{ record.issueRemark || '无备注' }}</span>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.feature-off-alert { margin-bottom: 16px; }
</style>
