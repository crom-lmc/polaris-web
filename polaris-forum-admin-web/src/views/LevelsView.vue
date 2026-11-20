<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { PlusOutlined, ReloadOutlined, RiseOutlined } from '@ant-design/icons-vue'
import {
  createAdminLevel,
  deleteAdminLevel,
  fetchAdminExperienceRules,
  fetchAdminLevels,
  updateAdminExperienceRule,
  updateAdminLevel,
  type ExperienceRule,
  type ExperienceRuleInput,
  type Level,
  type LevelInput
} from '@/api/forum'
import { confirmAction } from '@/utils/confirm'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'

const levels = ref<Level[]>([])
const store = useUserStore()
const loading = ref(false)
const saving = ref(false)
const open = ref(false)
const editingId = ref<string | null>(null)
const form = reactive<LevelInput>({
  levelNo: 1,
  name: '',
  minExperience: 0,
  color: '#5b67f1',
  icon: '',
  description: '',
  privileges: '',
  sortNo: 0,
  enabled: true
})

const { pagination, pagedSource: pagedLevels, reset: resetPage, onChange: onTableChange } = useTablePagination(levels)
const columns = [
  { title: '等级', key: 'level', width: 200 },
  { title: '等级序号', dataIndex: 'levelNo', width: 96 },
  { title: '经验门槛', dataIndex: 'minExperience', width: 130 },
  { title: '权益', key: 'privileges', width: 260 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'enabled', width: 90 },
  { title: '操作', key: 'action', width: 140 }
]

/** 预览用的启用等级路线 */
const enabledLevels = computed(() => levels.value.filter(level => level.enabled)
  .sort((a, b) => a.levelNo - b.levelNo || a.sortNo - b.sortNo))

onMounted(() => {
  load()
  loadRules()
})

async function load() {
  loading.value = true
  try {
    levels.value = await fetchAdminLevels()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '等级加载失败')
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
  const nextNo = levels.value.length ? Math.max(...levels.value.map(level => level.levelNo)) + 1 : 1
  Object.assign(form, {
    levelNo: nextNo, name: '', minExperience: 0, color: '#5b67f1', icon: '',
    description: '', privileges: '', sortNo: nextNo, enabled: true
  })
  open.value = true
}

function openEdit(level: Level) {
  editingId.value = level.id
  Object.assign(form, {
    levelNo: level.levelNo,
    name: level.name,
    minExperience: level.minExperience,
    color: level.color || '#5b67f1',
    icon: level.icon || '',
    description: level.description || '',
    privileges: level.privileges || '',
    sortNo: level.sortNo ?? 0,
    enabled: level.enabled !== false
  })
  open.value = true
}

async function submit() {
  if (!form.name.trim()) {
    message.warning('请输入等级名称')
    return
  }
  if (!Number.isInteger(form.levelNo) || form.levelNo < 1) {
    message.warning('等级序号必须为正整数')
    return
  }
  if (!Number.isInteger(form.minExperience) || form.minExperience < 0) {
    message.warning('经验门槛不能为负数')
    return
  }
  saving.value = true
  const data: LevelInput = {
    ...form,
    name: form.name.trim(),
    icon: form.icon.trim(),
    description: form.description.trim(),
    privileges: form.privileges.trim()
  }
  try {
    if (editingId.value) {
      await updateAdminLevel(editingId.value, data)
      message.success('等级已保存')
    } else {
      await createAdminLevel(data)
      message.success('等级已创建')
    }
    open.value = false
    await load()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function remove(level: Level) {
  confirmAction({
    title: '删除等级',
    content: `删除“${level.name}”后，对应用户的等级展示会自动按剩余配置重新计算。确认删除吗？`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteAdminLevel(level.id)
        message.success('等级已删除')
        await load()
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '删除失败')
        throw cause
      }
    }
  })
}

/* 经验获取规则：发帖/回复各加多少经验 */
const rules = ref<ExperienceRule[]>([])
const ruleDrafts = reactive<Record<string, number>>({})
const ruleSaving = ref<string | null>(null)

async function loadRules() {
  try {
    rules.value = await fetchAdminExperienceRules()
    rules.value.forEach(rule => { ruleDrafts[rule.ruleKey] = rule.experience })
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '经验规则加载失败')
  }
}

async function saveRule(rule: ExperienceRule) {
  ruleSaving.value = rule.ruleKey
  const experience = ruleDrafts[rule.ruleKey]
  if (!Number.isInteger(experience) || experience < 0) {
    message.warning('经验值不能为负数')
    ruleSaving.value = null
    return
  }
  try {
    const data: ExperienceRuleInput = {
      ruleKey: rule.ruleKey, name: rule.name, experience, sortNo: rule.sortNo, enabled: rule.enabled
    }
    await updateAdminExperienceRule(rule.id, data)
    rule.experience = experience
    message.success(`${rule.name}经验已保存`)
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    ruleSaving.value = null
  }
}
</script>

<template>
  <div class="admin-page levels-page">
    <header class="page-heading level-heading">
      <div>
        <h1>等级晋升路线</h1>
        <p>配置社区等级名称、经验门槛与权益，前台将按此路线展示成长进度。</p>
      </div>
      <a-button v-if="store.can('forum:level:create')" type="primary" @click="openCreate"><PlusOutlined />新建等级</a-button>
    </header>

    <a-card class="exp-rule-card" :bordered="false" title="经验获取规则">
      <p class="exp-rule-tip">设置每种社区行为获得的经验值（经验只增不减，与可消费的积分相互独立）。修改后新产生的行为按新规则计算。</p>
      <div class="exp-rule-grid">
        <div v-for="rule in rules" :key="rule.id" class="exp-rule-editor">
          <div class="exp-rule-name"><b>{{ rule.name }}</b><small>标识：{{ rule.ruleKey }}</small></div>
          <a-input-number v-model:value="ruleDrafts[rule.ruleKey]" :min="0" :precision="0" class="exp-rule-input" addon-after="经验" />
          <a-button v-if="store.can('forum:level:edit')" type="primary" size="small" :loading="ruleSaving === rule.ruleKey" @click="saveRule(rule)">保存</a-button>
        </div>
        <div v-if="!rules.length" class="route-empty">暂无经验规则配置。</div>
      </div>
    </a-card>

    <a-card class="route-preview" :bordered="false" title="晋升路线预览">
      <div class="route-track">
        <div v-for="level in enabledLevels" :key="level.id" class="route-node">
          <span class="route-badge" :style="{ backgroundColor: level.color || '#5b67f1' }"><rise-outlined /></span>
          <b>{{ level.name }}</b>
          <small>Lv.{{ level.levelNo }} · {{ level.minExperience }} 经验</small>
          <span class="route-privilege">{{ level.privileges || '暂无权益说明' }}</span>
        </div>
        <div v-if="!enabledLevels.length" class="route-empty">暂无启用的等级，创建并启用后即可预览晋升路线。</div>
      </div>
    </a-card>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <span class="toolbar-title">等级配置</span>
        <a-button v-if="store.can('forum:level:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
      <div class="table-scroll" :class="{ 'is-empty': !loading && !pagedLevels.length }">
        <a-table :columns="columns" :data-source="pagedLevels" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'level'">
              <div class="level-info">
                <span class="level-badge" :style="{ backgroundColor: record.color || '#5b67f1' }">
                  <rise-outlined v-if="!record.icon" /><span v-else>{{ record.icon }}</span>
                </span>
                <div><strong>{{ record.name }}</strong><div class="secondary-text level-description">{{ record.description || '暂无说明' }}</div></div>
              </div>
            </template>
            <template v-else-if="column.key === 'privileges'"><span class="secondary-text">{{ record.privileges || '-' }}</span></template>
            <template v-else-if="column.key === 'enabled'"><a-tag :color="record.enabled !== false ? 'green' : 'default'">{{ record.enabled !== false ? '启用' : '停用' }}</a-tag></template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:level:edit')" type="link" size="small" @click="openEdit(record)">编辑</a-button>
                <a-button v-if="!record.builtin && store.can('forum:level:delete')" type="link" size="small" danger @click="remove(record)">删除</a-button>
                <span v-if="record.builtin" class="builtin-hint">内置</span>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="open" centered :title="editingId ? '编辑等级' : '新建等级'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" @ok="submit">
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="等级名称" required><a-input v-model:value="form.name" :maxlength="64" placeholder="如：社区达人" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="等级序号" required><a-input-number v-model:value="form.levelNo" :min="1" :precision="0" class="full-width" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="经验门槛" required><a-input-number v-model:value="form.minExperience" :min="0" :precision="0" class="full-width" /><small class="field-hint">达到该累计经验即晋升到此等级</small></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="排序"><a-input-number v-model:value="form.sortNo" :min="0" :precision="0" class="full-width" /></a-form-item></a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="展示颜色"><input v-model="form.color" class="color-input" type="color" aria-label="等级颜色" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="图标文本"><a-input v-model:value="form.icon" :maxlength="64" placeholder="可选，如 ★" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="等级说明"><a-textarea v-model:value="form.description" :maxlength="500" :rows="2" placeholder="简短描述该等级" /></a-form-item>
        <a-form-item label="等级权益"><a-textarea v-model:value="form.privileges" :maxlength="500" :rows="2" placeholder="该等级对应的社区权益" /></a-form-item>
        <a-form-item label="状态"><a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.level-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.exp-rule-card { flex: 0 0 auto; margin-bottom: 16px; }
.exp-rule-tip { color: var(--muted); font-size: 13px; margin: 0 0 14px; }
.exp-rule-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.exp-rule-editor { display: flex; align-items: center; gap: 12px; min-width: 320px; padding: 12px 14px; border: 1px solid var(--panel-border); border-radius: 8px; }
.exp-rule-name { display: flex; flex-direction: column; min-width: 90px; }
.exp-rule-name small { color: var(--muted); font-size: 11px; }
.exp-rule-input { width: 150px; }
.route-preview { flex: 0 0 auto; margin-bottom: 0; }
.route-track { display: flex; flex-wrap: wrap; gap: 12px; }
.route-node { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 116px; max-width: 150px; padding: 12px 8px; border: 1px solid var(--panel-border); border-radius: 8px; text-align: center; }
.route-badge { display: inline-flex; width: 34px; height: 34px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 16px; }
.route-node small { color: var(--muted); }
.route-privilege { color: var(--muted); font-size: 12px; line-height: 16px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.route-empty { color: var(--muted); padding: 12px 4px; }
.table-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 14px 14px 0; }
.toolbar-title { font-weight: 600; }
/* 表头与列内容对齐：表头文字左缘与第一列徽章可见左缘齐平。
   徽章是圆形，实际可见像素比单元格内边距再靠里约 2px，而汉字几乎贴着内边距，
   因此仅靠统一的 10px padding 视觉上仍偏左；这里只对本页表头补偿 2px。
   第一列内容基准与勋章页一致（38px 徽章 + 12px 间距 + min-width 200px），避免容器收缩时再次错位。 */
.levels-page .table-card :deep(.ant-table-thead > tr > th:first-child) { padding-left: 12px !important; }
.levels-page .table-card :deep(.ant-table-thead > tr > th:nth-child(2)),
.levels-page .table-card :deep(.ant-table-tbody > tr > td:nth-child(2)) { padding-left: 10px !important; text-align: left; }
.level-info { display: flex; align-items: center; gap: 12px; min-width: 200px; }
.level-badge { display: inline-flex; flex: 0 0 38px; width: 38px; height: 38px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 15px; overflow: hidden; }
.level-description { max-width: 220px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.color-input { display: block; width: 100%; height: 32px; padding: 2px; border: 1px solid var(--header-border); border-radius: 6px; background: var(--panel-bg); cursor: pointer; }
.full-width { width: 100%; }
.field-hint { color: var(--muted); font-size: 12px; }
.builtin-hint { display: inline-flex; align-items: center; padding: 0 6px; color: var(--muted); font-size: 12px; }
/* 本页内容较多（经验规则 + 20 级预览 + 等级表格），不套用后台「一屏固定、仅表格内滚」的外壳：
   改为页面自身滚动，表格按内容完整展开，避免底部等级配置被压成一行。仅影响本页。 */
.levels-page { display: block; height: 100%; overflow-y: auto; overflow-x: hidden; padding-right: 6px; }
.levels-page .route-preview { margin-bottom: 16px; }
.levels-page .table-card { display: block; }
.levels-page .table-card > :deep(.ant-card-body) { display: block; overflow: visible; }
.levels-page .table-scroll { display: block; overflow: visible; }
.levels-page .table-scroll .ant-table-pagination { position: static; margin: 0; }
/* 预览卡片适当加高，等级名/经验/权益不再挤在扁块里 */
.levels-page .route-node { min-height: 118px; justify-content: center; padding: 16px 10px; }
@media (max-width: 640px) { .level-heading { flex-direction: column; } }
</style>
