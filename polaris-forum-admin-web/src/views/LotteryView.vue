<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  createLotteryPrize,
  deleteLotteryPrize,
  fetchLotteryConfig,
  normalizeLotteryWeights,
  updateLotteryConfig,
  updateLotteryPrize,
  type LotteryConfig,
  type LotteryPrize,
  type LotteryPrizeInput
} from '@/api/forum'
import { confirmAction } from '@/utils/confirm'
import { useUserStore } from '@/stores/user'
import { useFeatureSwitch } from '@/composables/useFeatureSwitch'

const store = useUserStore()
const { lotteryEnabled } = useFeatureSwitch()
const loading = ref(true)
const configSaving = ref(false)
const prizeSaving = ref(false)
const savingPrizeId = ref('')
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
// 赋予与后端一致的默认配置，避免首次渲染/加载失败时 config 为 null 导致模板非空断言抛错白屏
const config = ref<LotteryConfig>({
  mode: 'SQUARE',
  lotteryCost: 50,
  dailyLimit: 3,
  maxPrizes: 8,
  weightTotal: 100,
  prizes: [],
  gifts: []
})
const form = reactive<LotteryPrizeInput>({
  key: '', name: '', points: 0, color: '#eef0ff', weight: 10, sortNo: 0, enabled: true,
  prizeType: 'POINTS', giftId: undefined
})

const enabledCount = computed(() => config.value?.prizes.filter(p => p.enabled).length ?? 0)
const maxPrizes = computed(() => config.value?.maxPrizes ?? 8)
const modeName = computed(() => config.value?.mode === 'WHEEL' ? '转盘' : '方形九宫格')
const weightTotal = computed(() => config.value?.weightTotal ?? 0)
const weightOk = computed(() => weightTotal.value === 100)
const gifts = computed(() => config.value?.gifts ?? [])

function onGiftChange(giftId: string | undefined) {
  const gift = gifts.value.find(item => item.id === giftId)
  if (gift) form.name = gift.name
}

// 礼品图片路径（如 /gifts/mug.svg）是给前台 base '/' 用的；管理端 base 为 /admin/，需补前缀才能取到静态资源
function giftImageSrc(url?: string) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return base + (url.startsWith('/') ? url : '/' + url)
}

async function doNormalize() {
  confirmAction({
    title: '归一化权重',
    content: '将按当前比例把启用奖项的权重调整为合计 100，中奖概率不变。确定继续吗？',
    okText: '归一化',
    onOk: async () => {
      try {
        config.value = await normalizeLotteryWeights()
        message.success('权重已归一化为合计 100')
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '归一化失败')
        throw cause
      }
    }
  })
}

const columns = [
  { title: '奖项', key: 'prize', width: 180 },
  { title: '标识', dataIndex: 'key', width: 120 },
  { title: '类型', key: 'prizeType', width: 80 },
  { title: '奖项内容', key: 'award', width: 180 },
  { title: '权重', dataIndex: 'weight', width: 80 },
  { title: '排序', dataIndex: 'sortNo', width: 80 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 190 }
]

onMounted(load)

async function load() {
  loading.value = true
  try {
    config.value = await fetchLotteryConfig()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '抽奖配置加载失败')
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  if (!config.value) return
  if (!Number.isInteger(config.value.lotteryCost) || config.value.lotteryCost < 1) {
    message.warning('每次消耗积分必须为正整数')
    return
  }
  if (!Number.isInteger(config.value.dailyLimit) || config.value.dailyLimit < 1) {
    message.warning('每日抽奖次数必须为正整数')
    return
  }
  configSaving.value = true
  try {
    config.value = await updateLotteryConfig({
      mode: config.value.mode,
      lotteryCost: config.value.lotteryCost,
      dailyLimit: config.value.dailyLimit
    })
    message.success('抽奖配置已保存')
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
    await load()
  } finally {
    configSaving.value = false
  }
}

function openCreate() {
  if (enabledCount.value >= maxPrizes.value) {
    message.warning(`${modeName.value}最多支持 ${maxPrizes.value} 个启用奖项，请先停用其他奖项`)
    return
  }
  editingId.value = null
  Object.assign(form, {
    key: '', name: '', points: 0, color: '#eef0ff',
    weight: 10, sortNo: config.value?.prizes.length ?? 0, enabled: true,
    prizeType: 'POINTS', giftId: undefined
  })
  modalOpen.value = true
}

function openEdit(prize: LotteryPrize) {
  editingId.value = prize.id
  Object.assign(form, {
    key: prize.key, name: prize.name, points: prize.points, color: prize.color,
    weight: prize.weight, sortNo: prize.sortNo, enabled: prize.enabled,
    prizeType: prize.prizeType || 'POINTS', giftId: prize.giftId
  })
  modalOpen.value = true
}

async function submitPrize() {
  const key = form.key.trim().toLowerCase()
  const name = form.name.trim()
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(key)) {
    message.warning('奖项标识应为 2-32 位小写字母、数字或连字符，且以字母开头')
    return
  }
  if (!name) {
    message.warning('请输入奖项名称')
    return
  }
  const prizeType = form.prizeType || 'POINTS'
  if (prizeType === 'GIFT' && !form.giftId) {
    message.warning('请选择要作为奖项的礼品')
    return
  }
  if (!form.color || !/^#[0-9a-fA-F]{6}$/.test(form.color)) {
    message.warning('请选择有效的展示颜色')
    return
  }
  // 保存前预校验权重合计，避免后端报错后才回滚
  const newWeight = Math.max(0, Math.round(form.weight))
  const old = editingId.value ? config.value.prizes.find(p => p.id === editingId.value) : undefined
  const oldEnabledWeight = old?.enabled ? old.weight : 0
  const nextTotal = weightTotal.value - oldEnabledWeight + (form.enabled ? newWeight : 0)
  if (nextTotal > 100) {
    message.warning(`权重合计不能超过 100（保存后将达到 ${nextTotal}，请先调低其他奖项或点亮「一键归一化」）`)
    return
  }
  prizeSaving.value = true
  const data: LotteryPrizeInput = {
    key, name, points: prizeType === 'GIFT' ? 0 : Math.max(0, Math.round(form.points)), color: form.color,
    weight: Math.max(0, Math.round(form.weight)), sortNo: Math.max(0, Math.round(form.sortNo)),
    enabled: form.enabled, prizeType, giftId: prizeType === 'GIFT' ? form.giftId : undefined
  }
  try {
    if (editingId.value) {
      await updateLotteryPrize(editingId.value, {
        name: data.name, points: data.points, color: data.color, weight: data.weight,
        sortNo: data.sortNo, enabled: data.enabled, prizeType: data.prizeType, giftId: data.giftId
      })
      message.success('奖项已保存')
    } else {
      await createLotteryPrize(data)
      message.success('奖项已新增')
    }
    modalOpen.value = false
    await load()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    prizeSaving.value = false
  }
}

function togglePrize(prize: LotteryPrize) {
  savingPrizeId.value = prize.id
  const enabled = !prize.enabled
  const action = enabled ? '启用' : '停用'
  updateLotteryPrize(prize.id, { enabled })
    .then(() => { message.success(`已${action}奖项`); return load() })
    .catch(cause => message.error(cause instanceof Error ? cause.message : `${action}失败`))
    .finally(() => { savingPrizeId.value = '' })
}

function removePrize(prize: LotteryPrize) {
  confirmAction({
    title: '删除奖项',
    content: `确定删除奖项“${prize.name}”吗？删除后不可恢复，历史抽奖记录不受影响。`,
    okText: '删除',
    okType: 'danger',
    onOk: async () => {
      try {
        await deleteLotteryPrize(prize.id)
        message.success('奖项已删除')
        await load()
      } catch (cause) {
        message.error(cause instanceof Error ? cause.message : '删除失败')
        throw cause
      }
    }
  })
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading lottery-heading">
      <div>
        <h1>抽奖配置</h1>
        <p>设置抽奖形态、消耗与次数，并维护奖项及中奖权重。</p>
      </div>
      <a-button v-if="store.can('forum:lottery:config:view')" @click="load"><ReloadOutlined />刷新</a-button>
    </header>

    <a-alert v-if="!lotteryEnabled" class="feature-off-alert" type="warning" show-icon
      message="积分抽奖功能当前已关闭" description="论坛前台不再展示抽奖入口，本页面配置按钮已全部置灰。如需开启，请到「配置中心 - 埋点管理」修改 forum.lottery.enabled。" />

    <a-card class="config-card" :bordered="false" :loading="loading">
      <div class="config-grid">
        <div class="config-field">
          <label>抽奖形态</label>
          <a-radio-group v-if="store.can('forum:lottery:config:edit')" v-model:value="config!.mode" :disabled="!lotteryEnabled" @change="saveConfig">
            <a-radio-button value="SQUARE">方形九宫格</a-radio-button>
            <a-radio-button value="WHEEL">转盘</a-radio-button>
          </a-radio-group>
          <a-tag v-else color="blue">{{ modeName }}</a-tag>
        </div>
        <div class="config-field">
          <label>每次消耗积分</label>
          <a-input-number v-if="store.can('forum:lottery:config:edit')" v-model:value="config!.lotteryCost" :min="1" :max="100000" :disabled="!lotteryEnabled" />
          <b v-else>{{ config?.lotteryCost }}</b>
        </div>
        <div class="config-field">
          <label>每日抽奖次数</label>
          <a-input-number v-if="store.can('forum:lottery:config:edit')" v-model:value="config!.dailyLimit" :min="1" :max="1000" :disabled="!lotteryEnabled" />
          <b v-else>{{ config?.dailyLimit }}</b>
        </div>
        <div class="config-field config-action">
          <a-button v-if="store.can('forum:lottery:config:edit')" type="primary" :loading="configSaving" :disabled="!lotteryEnabled" @click="saveConfig">保存配置</a-button>
        </div>
      </div>
      <a-alert class="capacity-alert" type="info" show-icon
        :message="`当前为${modeName}，最多启用 ${maxPrizes} 个奖项，已启用 ${enabledCount} 个。切换形态前请先停用超出上限的奖项。`" />
    </a-card>

    <a-card class="table-card" :bordered="false">
      <div class="table-toolbar">
        <div class="toolbar-title">
          <strong>奖项列表</strong>
          <span class="weight-total" :class="{ ok: weightOk, bad: !weightOk }">权重合计 {{ weightTotal }} / 100<span v-if="!weightOk">（需为 100）</span></span>
        </div>
        <a-space :size="8">
          <a-button v-if="store.can('forum:lottery:config:edit') && !weightOk" size="small" :disabled="!lotteryEnabled" @click="doNormalize">一键归一化</a-button>
          <a-button v-if="store.can('forum:lottery:config:edit')" type="primary" size="small" :disabled="!lotteryEnabled" @click="openCreate"><PlusOutlined />新增奖项</a-button>
        </a-space>
      </div>
      <div class="table-scroll">
        <a-table :columns="columns" :data-source="config?.prizes ?? []" :loading="loading" row-key="id" size="middle" :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'prize'">
              <div class="prize-info">
                <img v-if="record.prizeType === 'GIFT' && record.giftImageUrl" :src="giftImageSrc(record.giftImageUrl)" class="prize-color" alt="" />
                <span v-else class="prize-color" :style="{ backgroundColor: record.color || '#eef0ff' }" />
                <strong>{{ record.name }}</strong>
              </div>
            </template>
            <template v-else-if="column.key === 'prizeType'">
              <a-tag :color="record.prizeType === 'GIFT' ? 'purple' : 'blue'">{{ record.prizeType === 'GIFT' ? '礼品' : '积分' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'award'">
              <span v-if="record.prizeType === 'GIFT'">{{ record.giftName || '礼品' }}<span v-if="record.giftStock !== undefined" class="gift-stock">（库存 {{ record.giftStock }}）</span></span>
              <span v-else>{{ record.points }} 积分</span>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="record.enabled ? 'green' : 'default'">{{ record.enabled ? '启用中' : '已停用' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="4">
                <a-button v-if="store.can('forum:lottery:config:edit')" type="link" size="small" :disabled="!lotteryEnabled" @click="openEdit(record)"><EditOutlined />编辑</a-button>
                <a-button v-if="store.can('forum:lottery:config:edit')" type="link" size="small" :disabled="!lotteryEnabled" :loading="savingPrizeId === record.id" @click="togglePrize(record)">{{ record.enabled ? '停用' : '启用' }}</a-button>
                <a-button v-if="store.can('forum:lottery:config:edit')" type="link" size="small" :disabled="!lotteryEnabled" danger @click="removePrize(record)"><DeleteOutlined />删除</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="modalOpen" centered :title="editingId ? '编辑奖项' : '新增奖项'" ok-text="保存" cancel-text="取消" :confirm-loading="prizeSaving" :ok-button-props="{ disabled: !lotteryEnabled }" @ok="submitPrize">
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="奖项标识" required>
              <a-input v-model:value="form.key" :disabled="!!editingId" :maxlength="32" placeholder="如 points10" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="奖项名称" required><a-input v-model:value="form.name" :maxlength="80" placeholder="如 10 积分" /></a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="24">
            <a-form-item label="奖项类型">
              <a-radio-group v-model:value="form.prizeType">
                <a-radio-button value="POINTS">积分</a-radio-button>
                <a-radio-button value="GIFT">礼品</a-radio-button>
              </a-radio-group>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row v-if="form.prizeType === 'GIFT'" :gutter="12">
          <a-col :span="24">
            <a-form-item label="选择礼品" required>
              <a-select v-model:value="form.giftId" placeholder="从兑换礼品中选择" show-search option-filter-prop="label" @change="onGiftChange">
                <a-select-option v-for="gift in gifts" :key="gift.id" :value="gift.id" :label="gift.name">
                  {{ gift.name }} · {{ gift.points }} 积分 · 库存 {{ gift.stock }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col v-if="form.prizeType !== 'GIFT'" :span="6">
            <a-form-item label="中奖积分">
              <a-input-number v-model:value="form.points" :min="0" :max="1000000" class="full-width" />
            </a-form-item>
          </a-col>
          <a-col :span="form.prizeType === 'GIFT' ? 8 : 6"><a-form-item label="权重"><a-input-number v-model:value="form.weight" :min="0" :max="100" class="full-width" /></a-form-item></a-col>
          <a-col :span="form.prizeType === 'GIFT' ? 8 : 6"><a-form-item label="排序"><a-input-number v-model:value="form.sortNo" :min="0" :max="9999" class="full-width" /></a-form-item></a-col>
          <a-col :span="form.prizeType === 'GIFT' ? 8 : 6">
            <a-form-item label="展示颜色"><input v-model="form.color" class="color-input" type="color" aria-label="奖项颜色" /></a-form-item>
          </a-col>
        </a-row>
        <a-alert type="info" show-icon message="权重越大中奖概率越高；选择「礼品」类型后可从兑换礼品中选择，中奖直接发放礼品并计入兑换记录。中奖积分为 0 表示“谢谢参与”类奖项。" />
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.lottery-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.feature-off-alert { margin-bottom: 16px; }
.config-card { margin-bottom: 16px; }
.config-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; align-items: end; }
.config-field { display: flex; flex-direction: column; gap: 8px; }
.config-field label { color: var(--muted); font-size: 12px; }
.config-field b { font-size: 16px; }
.config-action { align-items: flex-end; }
.capacity-alert { margin-top: 16px; }
/* 左内边距与 .table-scroll 单元格保持 10px 基准，让“奖项列表”标题与表头“奖项”/首列色块左缘对齐 */
.table-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 10px 0; margin-bottom: 12px; }
.toolbar-title { display: flex; align-items: center; gap: 12px; }
.weight-total { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
.weight-total.ok { color: #389e0d; background: #f6ffed; }
.weight-total.bad { color: #cf1322; background: #fff1f0; }
.prize-info { display: flex; align-items: center; gap: 12px; min-width: 200px; }
.prize-color { display: inline-block; flex: 0 0 22px; width: 22px; height: 22px; border: 1px solid var(--header-border); border-radius: 5px; object-fit: cover; }
.gift-stock { color: var(--muted); font-size: 12px; }
.action-group { flex-wrap: nowrap; }
.color-input { display: block; width: 100%; height: 32px; padding: 2px; border: 1px solid var(--header-border); border-radius: 6px; background: var(--panel-bg); cursor: pointer; }
.full-width { width: 100%; }
@media (max-width: 900px) { .config-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 640px) { .lottery-heading { flex-direction: column; } .config-grid { grid-template-columns: 1fr; } }
</style>
