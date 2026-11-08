<template>
  <div class="ft-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="登录名"
        style="width: 220px"
        allow-clear
        @search="handleSearch"
      />
      <a-select
        v-model:value="loginType"
        style="width: 140px"
        :options="typeOptions"
        @change="handleSearch"
      />
      <a-button @click="load">刷新</a-button>
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <section class="ft-scroll ft-bottom">
      <a-table
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'result'">
            <a-tag :color="record.result === 'success' ? 'green' : 'red'">
              {{ record.result === 'success' ? '成功' : '失败' }}
            </a-tag>
          </template>

          <template v-else-if="column.key === 'loginType'">
            {{ typeLabel(record.loginType) }}
          </template>

          <template v-else-if="column.key === 'failReason'">
            <span class="muted">{{ record.failReason || '-' }}</span>
          </template>

          <template v-else-if="column.key === 'userAgent'">
            <a-tooltip :title="record.userAgent">
              <span class="ua">{{ shortUa(record.userAgent) }}</span>
            </a-tooltip>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchLoginLogs } from '@/api/accounts'
import type { LoginLog } from '@/types'

const columns = [
  { title: '登录名', dataIndex: 'username', key: 'username', width: 160 },
  { title: '方式', key: 'loginType', width: 100 },
  { title: '结果', key: 'result', width: 90 },
  { title: '失败原因', key: 'failReason', width: 180 },
  { title: 'IP', dataIndex: 'clientIp', key: 'clientIp', width: 140 },
  { title: '客户端', key: 'userAgent' },
  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 }
]

const typeOptions = [
  { label: '全部方式', value: '' },
  { label: '密码', value: 'password' },
  { label: '邮箱验证码', value: 'email' },
  { label: '微信', value: 'wechat' }
]

const records = ref<LoginLog[]>([])
const loading = ref(false)
const errorMsg = ref('')
const keyword = ref('')
const loginType = ref('')
const total = ref(0)
const current = ref(1)
const pageSize = ref(20)

const pagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

onMounted(load)

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchLoginLogs({
      page: current.value,
      size: pageSize.value,
      keyword: keyword.value || undefined,
      loginType: loginType.value || undefined
    })
    records.value = res.data?.records || []
    total.value = res.data?.total || 0
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  current.value = 1
  load()
}

function handleTableChange(pag: any) {
  current.value = pag.current
  pageSize.value = pag.pageSize
  load()
}

function typeLabel(t: string) {
  return { password: '密码', email: '邮箱验证码', wechat: '微信' }[t] || t || '-'
}

function shortUa(ua?: string) {
  if (!ua) return '-'
  return ua.length > 48 ? `${ua.slice(0, 48)}…` : ua
}
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.muted {
  color: var(--muted);
}

.ua {
  font-size: 12px;
  color: #5c6370;
}
</style>
