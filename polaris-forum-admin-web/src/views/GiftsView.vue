<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  createAdminGift,
  fetchAdminGifts,
  fetchAdminLevels,
  fetchGiftCategories,
  updateAdminGift,
  type DictOption,
  type Gift,
  type GiftInput,
  type Level
} from '@/api/forum'
import { useTablePagination } from '@/composables/useTablePagination'
import { useUserStore } from '@/stores/user'
import { useFeatureSwitch } from '@/composables/useFeatureSwitch'

const store = useUserStore()
const { exchangeEnabled } = useFeatureSwitch()
const gifts = ref<Gift[]>([])
const loading = ref(false)
const saving = ref(false)
const open = ref(false)
const editingId = ref<string | null>(null)
const keyword = ref('')
const status = ref('')
const form = reactive<GiftInput>({
  name: '', category: '', description: '', points: 100, stock: 10, icon: 'gift',
  imageUrl: '', minLevel: 1, status: 1
})
// 分类下拉来自配置中心字典 forum.gift_category，不再硬编码
const categoryOptions = ref<DictOption[]>([])
// 兑换等级下限下拉来自社区等级配置，维护等级后自动同步
const levelOptions = ref<Level[]>([])
async function loadLevels() {
  try {
    levelOptions.value = await fetchAdminLevels()
  } catch {
    levelOptions.value = []
  }
}
function levelLabel(no: number) {
  const found = levelOptions.value.find((item) => item.levelNo === no)
  return found ? `Lv.${no} ${found.name}` : `Lv.${no}`
}
async function loadCategories() {
  try {
    categoryOptions.value = await fetchGiftCategories()
  } catch {
    categoryOptions.value = []
    message.warning('礼品分类字典加载失败，请检查配置中心字典 forum.gift_category')
  }
}
// 先按搜索/状态过滤，再交给统一分页组件切片（分页必须基于过滤后的全量结果）
const filteredSource = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return gifts.value.filter((gift) => {
    if (status.value && String(gift.status ?? 1) !== status.value) return false
    if (q && !gift.name.toLowerCase().includes(q) && !gift.category.toLowerCase().includes(q)) return false
    return true
  })
})
const { pagination, pagedSource: pagedGifts, reset: resetPage, onChange: onTableChange } = useTablePagination(filteredSource)
watch([keyword, status], () => resetPage())
const columns = [
  { title: '礼品', key: 'gift', width: 260 },
  { title: '分类', dataIndex: 'category', width: 90 },
  { title: '所需积分', dataIndex: 'points', width: 100 },
  { title: '兑换等级', key: 'minLevel', width: 130 },
  { title: '库存', key: 'stock', width: 90 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 120 }
]

onMounted(() => {
  void load()
  void loadCategories()
  void loadLevels()
})

async function load() {
  loading.value = true
  try {
    gifts.value = await fetchAdminGifts()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '礼品加载失败')
  } finally {
    loading.value = false
  }
}

function reload() {
  resetPage()
  void load()
}

// 礼品图片是前台静态路径（如 /gifts/mug.svg），管理端 base 为 /admin/，需补前缀才能取到
function giftImageSrc(url?: string) {
  if (!url) return ''
  if (/^https?:\/\//.test(url)) return url
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  return base + (url.startsWith('/') ? url : '/' + url)
}

function openCreate() {
  editingId.value = null
  Object.assign(form, {
    name: '', category: categoryOptions.value[0]?.value || '', description: '', points: 100, stock: 10,
    icon: 'gift', imageUrl: '', minLevel: 1, status: 1
  })
  open.value = true
}

function openEdit(gift: Gift) {
  editingId.value = gift.id
  Object.assign(form, {
    name: gift.name,
    category: gift.category,
    description: gift.description || '',
    points: gift.points ?? 0,
    stock: gift.stock ?? 0,
    icon: gift.icon || 'gift',
    imageUrl: gift.imageUrl || '',
    minLevel: gift.minLevel ?? 1,
    status: gift.status ?? 1
  })
  open.value = true
}

async function submit() {
  const name = form.name.trim()
  if (!name) {
    message.warning('请输入礼品名称')
    return
  }
  if (!form.category.trim()) {
    message.warning('请输入礼品分类')
    return
  }
  if (!Number.isInteger(form.points) || form.points < 0) {
    message.warning('所需积分必须为非负整数')
    return
  }
  if (!Number.isInteger(form.stock) || form.stock < 0) {
    message.warning('库存必须为非负整数')
    return
  }
  const maxLevel = levelOptions.value.at(-1)?.levelNo ?? 20
  const minLevel = Number(form.minLevel)
  if (!Number.isInteger(minLevel) || minLevel < 1 || minLevel > maxLevel) {
    message.warning('兑换等级须在 1-' + maxLevel + ' 之间')
    return
  }
  saving.value = true
  const data: GiftInput = {
    name,
    category: form.category.trim(),
    description: form.description.trim(),
    points: form.points,
    stock: form.stock,
    icon: form.icon.trim() || 'gift',
    imageUrl: (form.imageUrl || '').trim(),
    minLevel,
    status: form.status
  }
  try {
    if (editingId.value) {
      await updateAdminGift(editingId.value, data)
      message.success('礼品已保存')
    } else {
      await createAdminGift(data)
      message.success('礼品已创建')
    }
    open.value = false
    await load()
  } catch (cause) {
    message.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-page">
    <header class="page-heading gift-heading">
      <div>
        <h1>礼品管理</h1>
        <p>维护可兑换礼品的信息与库存；库存可随时增加或减少，前台兑换与抽奖发礼品都会实时扣减。</p>
      </div>
      <a-button v-if="store.can('forum:gift:edit')" type="primary" :disabled="!exchangeEnabled" @click="openCreate"><PlusOutlined />新增礼品</a-button>
    </header>
    <a-alert v-if="!exchangeEnabled" class="feature-off-alert" type="warning" show-icon message="礼品兑换功能当前已关闭" description="论坛前台不再展示兑换入口，本页面配置按钮已全部置灰。如需开启，请到「配置中心 - 埋点管理」修改 forum.exchange.enabled。" />
    <a-alert class="stock-alert" type="info" show-icon message="库存为 0 的礼品前台会显示「已兑完」并从抽奖盘面自动过滤；下架礼品不参与兑换与抽奖。修改库存后立即生效，无需重启。" />
    <a-card class="filter-card" :bordered="false">
      <div class="filters">
        <a-input v-model:value="keyword" class="filter-input" :maxlength="50" placeholder="搜索礼品名称/分类" allow-clear />
        <a-select v-model:value="status" class="filter-select">
          <a-select-option value="">全部状态</a-select-option>
          <a-select-option value="1">上架中</a-select-option>
          <a-select-option value="0">已下架</a-select-option>
        </a-select>
        <a-button v-if="store.can('forum:gift:view')" @click="reload"><ReloadOutlined />刷新</a-button>
      </div>
    </a-card>
    <a-card class="table-card" :bordered="false">
      <div class="table-scroll" :class="{ 'is-empty': !loading && !pagedGifts.length }">
        <a-table :columns="columns" :data-source="pagedGifts" :loading="loading" :pagination="pagination" row-key="id" size="middle" @change="onTableChange">
          <template #emptyText>
            <a-empty v-if="!loading" class="table-empty" description="暂无数据" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'gift'">
              <div class="gift-info">
                <img v-if="record.imageUrl" :src="giftImageSrc(record.imageUrl)" class="gift-thumb" alt="" />
                <span v-else class="gift-thumb placeholder">{{ record.icon || '礼' }}</span>
                <div><strong>{{ record.name }}</strong><div class="secondary-text gift-description">{{ record.description || '暂无说明' }}</div></div>
              </div>
            </template>
            <template v-else-if="column.key === 'stock'">
              <span :class="['stock-value', { low: (record.stock ?? 0) <= 0 }]">{{ record.stock ?? 0 }}</span>
            </template>
            <template v-else-if="column.key === 'minLevel'">
              <a-tag :color="(record.minLevel ?? 1) > 1 ? 'purple' : 'default'">{{ levelLabel(record.minLevel ?? 1) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="(record.status ?? 1) === 1 ? 'green' : 'default'">{{ (record.status ?? 1) === 1 ? '上架中' : '已下架' }}</a-tag>
            </template>
            <template v-else-if="column.key === 'action'">
              <a-space class="action-group" :size="0">
                <a-button v-if="store.can('forum:gift:edit')" type="link" size="small" :disabled="!exchangeEnabled" @click="openEdit(record)"><EditOutlined />编辑</a-button>
              </a-space>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <a-modal v-model:open="open" centered :title="editingId ? '编辑礼品' : '新增礼品'" ok-text="保存" cancel-text="取消" :confirm-loading="saving" :ok-button-props="{ disabled: !exchangeEnabled }" @ok="submit">
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="14"><a-form-item label="礼品名称" required><a-input v-model:value="form.name" :maxlength="100" placeholder="请输入礼品名称" /></a-form-item></a-col>
          <a-col :span="10">
            <a-form-item label="分类" required>
              <a-select v-model:value="form.category" placeholder="选择或输入分类" allow-clear show-search>
                <a-select-option v-for="item in categoryOptions" :key="item.value" :value="item.value">{{ item.label }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="礼品说明"><a-textarea v-model:value="form.description" :maxlength="300" :rows="2" placeholder="礼品描述，展示在前台兑换页" /></a-form-item>
        <a-row :gutter="12">
          <a-col :span="8"><a-form-item label="所需积分" required><a-input-number v-model:value="form.points" :min="0" :max="100000000" class="full-width" /></a-form-item></a-col>
          <a-col :span="8"><a-form-item label="库存" required><a-input-number v-model:value="form.stock" :min="0" :max="100000000" class="full-width" /></a-form-item></a-col>
          <a-col :span="8">
            <a-form-item label="兑换等级下限">
              <a-select v-model:value="form.minLevel">
                <a-select-option v-for="level in levelOptions" :key="level.levelNo" :value="level.levelNo">Lv.{{ level.levelNo }} {{ level.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="状态">
              <a-select v-model:value="form.status">
                <a-select-option :value="1">上架</a-select-option>
                <a-select-option :value="0">下架</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12"><a-form-item label="图片地址"><a-input v-model:value="form.imageUrl" placeholder="如 /gifts/mug.svg，留空则用图标占位" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="图标标识"><a-input v-model:value="form.icon" :maxlength="32" placeholder="如 coffee，无图片时展示" /></a-form-item></a-col>
        </a-row>
        <a-alert type="info" show-icon message="兑换等级下限对应社区等级，未达到该等级的用户无法兑换；图片支持站内路径（/gifts/xxx.svg）或 http(s) 外链。" />
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.gift-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.feature-off-alert { margin-bottom: 16px; }
.stock-alert { margin-bottom: 16px; }
.gift-info { display: flex; align-items: center; gap: 12px; min-width: 200px; }
.gift-thumb { width: 42px; height: 42px; flex: 0 0 42px; border-radius: 8px; object-fit: cover; border: 1px solid var(--header-border); }
.gift-thumb.placeholder { display: inline-flex; align-items: center; justify-content: center; background: var(--soft); color: var(--muted); font-size: 13px; }
.gift-description { max-width: 240px; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stock-value { font-weight: 600; }
.stock-value.low { color: #cf1322; }
.full-width { width: 100%; }
@media (max-width: 640px) { .gift-heading { flex-direction: column; } }
</style>
