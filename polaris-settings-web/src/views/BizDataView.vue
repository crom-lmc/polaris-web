<template>
  <div class="page-container biz-page">
    <div class="page-root">
      <section class="panel ft-grow">
        <div class="panel-head">
          <span>
            {{ selected?.name || '主数据' }}
            <span v-if="selected" class="muted head-sub">· {{ selected.type }}</span>
            <span v-if="selected?.remark" class="muted head-sub">· {{ selected.remark }}</span>
          </span>
          <a-space :size="8">
            <a-checkbox v-model:checked="includeDisabled" @change="loadItems">显示停用项</a-checkbox>
            <a-button
              v-if="store.can('biz:manage')"
              type="primary"
              @click="openItemModal()"
            >新建数据项</a-button>
          </a-space>
        </div>
        <div class="panel-body table-body ft-scroll ft-bottom">
          <a-table class="ft-table"
            :columns="itemColumns"
            :data-source="items"
            :loading="itemLoading"
            row-key="id"
            size="small"
            :pagination="pagination"
            @change="onTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'code'">
                <a-tooltip :title="record.code" placement="topLeft">
                  <span class="mono">{{ record.code }}</span>
                </a-tooltip>
              </template>
              <template v-if="column.key === 'status'">
                <a-tag :color="record.status === 1 ? 'green' : 'default'">
                  {{ record.status === 1 ? '启用' : '停用' }}
                </a-tag>
              </template>
              <template v-if="column.key === 'action'">
                <a-space :size="12">
                  <a v-if="store.can('biz:manage')" @click="openItemModal(record)">编辑</a>
                  <a
                    v-if="store.can('biz:manage') && record.builtIn !== 1"
                    class="danger"
                    @click="removeItem(record)"
                  >删除</a>
                  <a-tooltip v-else-if="record.builtIn === 1" title="内置数据项不允许删除">
                    <span class="muted">内置</span>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <!-- 新建/编辑数据项 -->
    <a-modal
      v-model:open="itemModal.open"
      :title="itemModal.id ? '编辑数据项' : `新建数据项（${selected?.name || ''}）`"
      :confirm-loading="itemModal.saving"
      centered
      destroy-on-close
      @ok="submitItem"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="取值编码" required extra="字母开头，仅字母/数字/下划线/中划线；业务表里存的就是它，保存后不可改">
          <a-input v-model:value="itemModal.form.code" :disabled="!!itemModal.id" placeholder="icbc" />
        </a-form-item>
        <a-form-item label="展示名" required>
          <a-input v-model:value="itemModal.form.name" placeholder="工商银行" />
        </a-form-item>
        <a-form-item v-if="type === 'position'" label="类别" required>
          <a-select
            v-model:value="itemModal.form.category"
            :options="positionCategories"
            placeholder="选择类别（管理类 / 技术类）"
          />
        </a-form-item>
        <a-form-item label="排序" extra="数字小的排前面">
          <a-input-number v-model:value="itemModal.form.sort" :min="0" style="width: 120px" />
        </a-form-item>
        <a-form-item label="备注">
          <a-input v-model:value="itemModal.form.remark" />
        </a-form-item>
        <a-form-item v-if="itemModal.id" label="状态">
          <a-radio-group v-model:value="itemModal.form.status">
            <a-radio-button :value="1">启用</a-radio-button>
            <a-radio-button :value="0">停用</a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useRoute, useRouter } from 'vue-router'
import {
  createBizItem,
  deleteBizItem,
  listBizCategories,
  listBizItems,
  updateBizItem,
  type BizCategory,
  type BizItem
} from '@/api/settings'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const store = useUserStore()

/* ---------------- 类别（来自路由参数 + 类别元信息） ---------------- */

const type = computed(() => String(route.params.type || ''))

const categories = ref<BizCategory[]>([])
const selected = computed(() => categories.value.find((c) => c.type === type.value) || null)

async function loadCategories() {
  try {
    categories.value = await listBizCategories()
    // 路由上的类别不存在（后端注册表变更/手输 URL）→ 落到第一个有效类别
    if (categories.value.length && !selected.value) {
      router.replace(`/biz-data/${categories.value[0].type}`)
    }
  } catch (e: any) {
    message.error(e?.message || '加载主数据类别失败')
  }
}

/* ---------------- 数据项 ---------------- */

const items = ref<BizItem[]>([])
const itemLoading = ref(false)
const includeDisabled = ref(false)

/** 主数据项接口返回全量，做前端分页；分页条由 ft-bottom 贴到容器底部 */
const page = ref(1)
const pageSize = ref(10)
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: items.value.length,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))
function onTableChange(pag: any) {
  page.value = pag?.current || 1
  pageSize.value = pag?.pageSize || pageSize.value
}

const itemColumns = computed(() => {
  const cols: any[] = [
    { title: '取值编码', key: 'code', width: 150 },
    { title: '展示名', dataIndex: 'name', key: 'name', width: 150, ellipsis: true }
  ]
  // 类别/职务族/等级列仅职位主数据有值
  if (type.value === 'position') {
    cols.push(
      { title: '类别', dataIndex: 'category', key: 'category', width: 90, customRender: ({ text }: any) => text || '—' },
      { title: '职务族', dataIndex: 'jobFamilyName', key: 'jobFamilyName', width: 130, customRender: ({ text }: any) => text || '—' },
      {
        title: '等级',
        key: 'level',
        width: 90,
        customRender: ({ record }: any) =>
          record.levelName ? `${record.levelName}（${record.series}${record.levelNo}）` : '—'
      }
    )
  }
  cols.push(
    { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
    { title: '状态', key: 'status', width: 80 },
    { title: '备注', key: 'remark' },
    { title: '操作', key: 'action', width: 120 }
  )
  return cols
})

async function loadItems() {
  if (!type.value) return
  page.value = 1
  itemLoading.value = true
  try {
    items.value = await listBizItems(type.value, includeDisabled.value)
  } catch (e: any) {
    message.error(e?.message || '加载数据项失败')
  } finally {
    itemLoading.value = false
  }
}

// 立即执行一次，保证首屏默认类别（如银行）也能加载；切换类别时同样触发
watch(type, loadItems, { immediate: true })

/* ---------------- 数据项弹窗 ---------------- */

/** 职位类别固定两类（管理类 / 技术类） */
const positionCategories = [
  { value: '管理类', label: '管理类' },
  { value: '技术类', label: '技术类' }
]

const itemModal = reactive({
  open: false,
  saving: false,
  id: '' as string | '',
  form: { code: '', name: '', sort: 0, remark: '', status: 1, category: '' }
})

function openItemModal(i?: BizItem) {
  itemModal.id = i?.id || ''
  itemModal.form = {
    code: i?.code || '',
    name: i?.name || '',
    sort: i?.sort ?? items.value.length + 1,
    remark: i?.remark || '',
    status: i?.status ?? 1,
    category: i?.category || ''
  }
  itemModal.open = true
}

async function submitItem() {
  if (!type.value) return
  const f = itemModal.form
  if (!f.code.trim() || !f.name.trim()) {
    message.warning('取值编码与展示名不能为空')
    return
  }
  // 职位必须选择类别
  if (type.value === 'position' && !f.category) {
    message.warning('职位必须选择类别（管理类 / 技术类）')
    return
  }
  itemModal.saving = true
  const category = type.value === 'position' ? f.category || undefined : undefined
  try {
    if (itemModal.id) {
      await updateBizItem(type.value, itemModal.id, {
        name: f.name.trim(),
        sort: f.sort,
        remark: f.remark,
        status: f.status,
        category
      })
      message.success('数据项已更新')
    } else {
      await createBizItem(type.value, {
        code: f.code.trim(),
        name: f.name.trim(),
        sort: f.sort,
        remark: f.remark,
        category
      })
      message.success('数据项已创建')
    }
    itemModal.open = false
    await loadItems()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    itemModal.saving = false
  }
}

function removeItem(i: BizItem) {
  Modal.confirm({
    title: `删除数据项「${i.name}」`,
    content: '删除后调用方将查不到这个编码，正在使用它的业务数据会退回兜底文案。确定删除？',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        await deleteBizItem(type.value, i.id)
        message.success('已删除')
        await loadItems()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
}

onMounted(loadCategories)
</script>

<style scoped>
.biz-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.head-sub {
  font-weight: 400;
}

.mono {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
}

.danger {
  color: #cf1322;
}
</style>
