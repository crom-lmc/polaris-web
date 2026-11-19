<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, TrophyOutlined } from '@ant-design/icons-vue'
import {
  createBadge,
  fetchBadges,
  offlineBadge,
  publishBadge,
  updateBadge,
  type Badge,
  type BadgeInput,
  type BadgeRuleType,
  type BadgeStatus
} from '@/api/forum'
import { confirmAction } from '@/utils/confirm'
import { useTablePagination } from '@/composables/useTablePagination'

import { useUserStore } from '@/stores/user'
const badges = ref<Badge[]>([])
const store = useUserStore()
const status = ref('')
const loading = ref(false)
const saving = ref(false)
const open = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<BadgeInput>({
  name: '',
  description: '',
  icon: '',
  color: '#2f54eb',
  sortNo: 0,
  ruleType: 'TOTAL_POINTS',
  threshold: 1
})
const ruleNames: Record<BadgeRuleType, string> = {
  TOTAL_POINTS: '累计积分',
  THREAD_COUNT: '有效发帖数',
  COMMENT_COUNT: '有效评论及回复数',
  CHECKIN_DAYS: '累计签到天数',
  LIKES_RECEIVED: '帖子获赞总数'
}
const ruleUnits: Record<BadgeRuleType, string> = {
  TOTAL_POINTS: '分',
  THREAD_COUNT: '篇',
  COMMENT_COUNT: '条',
  CHECKIN_DAYS: '天',
  LIKES_RECEIVED: '次'
}
const ruleOptions = (Object.keys(ruleNames) as BadgeRuleType[]).map((value) => ({ value, label: ruleNames[value] }))
const statusNames: Record<BadgeStatus, string> = { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下线' }
const statusColors: Record<BadgeStatus, string> = { DRAFT: 'default', PUBLISHED: 'green', OFFLINE: 'orange' }
const currentRuleText = computed(() => `${ruleNames[form.ruleType]}达到 ${form.threshold || 0} ${ruleUnits[form.ruleType]}时自动发放`)
const { pagination, pagedSource: pagedBadges, reset: resetPage, onChange: onTableChange } = useTablePagination(badges)
const columns = [
  { title: '勋章', key: 'badge', width: 240 },
  { title: '规则', key: 'rule', width: 230 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '获得人数', key: 'awardedCount', width: 100 },
  { title: '发布时间', key: 'publishedAt', width: 170 },
  { title: '操作', key: 'action', width: 170 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    badges.value = await fetchBadges(status.value)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '勋章加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  resetPage()
  void load()
}

function openCreate() {
  editingId.value = null
  Object.assign(form, { name: '', description: '', icon: '', color: '#2f54eb', sortNo: 0, ruleType: 'TOTAL_POINTS', threshold: 1 })
  open.value = true
}

function openEdit(badge: Badge) {
  editingId.value = badge.id
  Object.assign(form, {
    name: badge.name,
    description: badge.description || '',
    icon: badge.icon || '',
    color: badge.color || '#2f54eb',
    sortNo: badge.sortNo ?? 0,
    ruleType: badge.ruleType,
    threshold: badge.threshold
  })
  open.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('请输入勋章名称')
    return
  }
  if (!Number.isInteger(form.threshold) || form.threshold < 1) {
    message.warning('规则阈值必须为正整数')
    return
  }
  saving.value = true
  const data: BadgeInput = {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    icon: form.icon.trim()
  }
  try {
    if (editingId.value) {
      await updateBadge(editingId.value, data)
      message.success('勋章草稿已保存')
    } else {
      await createBadge(data)
      message.success('勋章草稿已创建')
    }
    open.value = false
    await load()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function publish(badge: Badge) {
  confirmAction({
    title: '发布勋章',
    content: `发布“${badge.name}”后将按当前规则为历史已达标用户补发，且规则不能再修改。确认发布吗？`,
    okText: '发布',
    onOk: async () => {
      try {
        await publishBadge(badge.id)
        message.success('勋章已发布，历史达标用户已完成补发')
        await load()
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '发布失败')
        throw cause
      }
    }
  })
}

function offline(badge: Badge) {
  confirmAction({
    title: '下线勋章',
    content: `下线“${badge.name}”后将停止后续发放，已获得记录仍会保留。确认下线吗？`,
    okText: '下线',
    okType: 'danger',
    onOk: async () => {
      try {
        await offlineBadge(badge.id)
        message.success('勋章已下线')
        await load()
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '下线失败')
        throw cause
      }
    }
  })
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading badge-heading">
      <div>
        <h1>勋章管理</h1>
        <p>配置单指标阈值规则，管理勋章草稿、发布和下线。</p>
      </div>
      <a-button v-if="store.can('forum:badge:create')" type="primary" @click="openCreate"><PlusOutlined />新建勋章</a-button>
    </header>
    <a-alert class="rule-alert" type="info" show-icon message="发布后不可原地修改规则；发布时为历史达标用户补发，下线后停止发放但保留已获得记录。" />
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-select v-model:value="status" class="filter-select" @change="reload">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="DRAFT">草稿</a-select-option>
          <a-select-option value="PUBLISHED">已发布</a-select-option>
          <a-select-option value="OFFLINE">已下线</a-select-option>
        </a-select>
        <a-button v-if="store.can('forum:badge:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !pagedBadges.length }">
        <a-table :columns="columns" :data-source="pagedBadges" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'badge'">
              <div class="badge-info">
                <span class="badge-icon" :style="{ backgroundColor: record.color || '#2f54eb' }">
                  <span v-if="record.icon">{{ record.icon }}</span><TrophyOutlined v-else />
                </span>
                <div><strong>{{ record.name }}</strong><div class="secondary-text badge-description">{{ record.description || '暂无说明' }}</div></div>
              </div>
            </template>
            <template v-else-if="column.key === 'rule'">{{ ruleNames[record.ruleType as BadgeRuleType] }} ≥ {{ record.threshold }} {{ ruleUnits[record.ruleType as BadgeRuleType] }}</template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColors[record.status as BadgeStatus]">{{ statusNames[record.status as BadgeStatus] }}</a-tag></template>
            <template v-else-if="column.key === 'awardedCount'">{{ record.awardedCount ?? 0 }}</template>
            <template v-else-if="column.key === 'publishedAt'">{{ record.publishedAt || '-' }}</template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:badge:edit') && record.status === 'DRAFT'" type="link" size="small" @click="openEdit(record)">编辑</a-button>
                <a-button v-if="store.can('forum:badge:publish') && record.status === 'DRAFT'" type="link" size="small" @click="publish(record)">发布</a-button>
                <a-button v-if="store.can('forum:badge:offline') && record.status === 'PUBLISHED'" type="link" size="small" danger @click="offline(record)">下线</a-button>
                <span v-if="record.status === 'OFFLINE'" class="secondary-text">仅保留记录</span>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="open" centered :title="editingId ? '编辑勋章草稿' : '新建勋章'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" @ok="submit">
      <a-form layout="vertical">
        <a-form-item label="勋章名称" required><a-input v-model:value="form.name" :maxlength="64" placeholder="请输入名称" /></a-form-item>
        <a-form-item label="勋章说明"><a-textarea v-model:value="form.description" :maxlength="500" :rows="3" placeholder="说明勋章意义和获得方式" /></a-form-item>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="图标"><a-input v-model:value="form.icon" :maxlength="64" placeholder="图标文本或标识" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="颜色"><input v-model="form.color" class="color-input" type="color" aria-label="勋章颜色" /></a-form-item></a-col>
          <a-col :span="6"><a-form-item label="排序"><a-input-number v-model:value="form.sortNo" :min="0" class="full-width" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="规则指标" required><a-select v-model:value="form.ruleType" :options="ruleOptions" /></a-form-item>
        <a-form-item label="达标阈值" required><a-input-number v-model:value="form.threshold" :min="1" :precision="0" class="full-width" /></a-form-item>
        <a-alert type="info" show-icon :message="currentRuleText" />
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.badge-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.rule-alert { margin-bottom: 0; }
.badge-info { display: flex; align-items: center; gap: 12px; min-width: 200px; }
.badge-icon { display: inline-flex; flex: 0 0 42px; width: 42px; height: 42px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 18px; overflow: hidden; }
.badge-description { max-width: 240px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.color-input { display: block; width: 100%; height: 32px; padding: 2px; border: 1px solid var(--header-border); border-radius: 6px; background: var(--panel-bg); cursor: pointer; }
.full-width { width: 100%; }
@media (max-width: 640px) { .badge-heading { flex-direction: column; } }
</style>
