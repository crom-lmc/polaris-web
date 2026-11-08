<template>
  <div class="page-container dict-page">
    <div class="page-root">
      <div class="dict-split">
        <!-- 左：字典类型 -->
        <section class="panel">
          <div class="panel-head">
            <span>字典类型</span>
            <a-space :size="8">
              <a-input
                v-model:value="typeKeyword"
                placeholder="搜编码 / 名称"
                allow-clear
                style="width: 150px"
                @press-enter="loadTypes"
              />
              <a-button @click="loadTypes">查询</a-button>
              <a-button v-if="store.can('dict:type:manage')" type="primary" @click="openTypeModal()">
                新建类型
              </a-button>
            </a-space>
          </div>
          <div class="panel-body table-body type-body">
            <a-table
              :columns="typeColumns"
              :data-source="types"
              :loading="typeLoading"
              row-key="id"
              size="small"
              :pagination="false"
              :row-class-name="(r: DictType) => (selected?.id === r.id ? 'row-active' : '')"
              :custom-row="(r: DictType) => ({ onClick: () => selectType(r), class: 'type-row' })"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'code'">
                  <a-tooltip :title="record.code" placement="topLeft">
                    <span class="mono">{{ record.code }}</span>
                  </a-tooltip>
                </template>
                <template v-if="column.key === 'appCode'">
                  <span>{{ record.appCode || '全局' }}</span>
                </template>
                <template v-if="column.key === 'status'">
                  <a-tag :color="record.status === 1 ? 'green' : 'default'">
                    {{ record.status === 1 ? '启用' : '停用' }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'action'">
                  <a-space :size="12">
                    <a v-if="store.can('dict:type:manage')" @click.stop="openTypeModal(record)">编辑</a>
                    <a
                      v-if="store.can('dict:type:manage') && record.builtIn !== 1"
                      class="danger"
                      @click.stop="removeType(record)"
                    >删除</a>
                    <a-tooltip v-else-if="record.builtIn === 1" title="内置类型不允许删除">
                      <span class="muted">内置</span>
                    </a-tooltip>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </section>

        <!-- 右：字典项 -->
        <section class="panel">
          <div class="panel-head">
            <span>
              字典项
              <span v-if="selected" class="muted head-sub">
                · {{ selected.name }}（{{ selected.code }}）
              </span>
            </span>
            <a-space :size="8">
              <a-checkbox v-model:checked="includeDisabled" @change="loadItems">显示停用项</a-checkbox>
              <a-button
                v-if="selected && store.can('dict:item:manage')"
                type="primary"
                :disabled="!selected"
                @click="openItemModal()"
              >新建字典项</a-button>
            </a-space>
          </div>
          <div class="panel-body table-body">
            <a-empty
              v-if="!selected"
              description="在左侧选择一个字典类型，管理它下面的字典项"
              style="margin-top: 80px"
            />
            <a-table
              v-else
              :columns="itemColumns"
              :data-source="items"
              :loading="itemLoading"
              row-key="id"
              size="small"
              :pagination="false"
            >
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'value'">
                  <a-tooltip :title="record.value" placement="topLeft">
                    <span class="mono">{{ record.value }}</span>
                  </a-tooltip>
                </template>
                <template v-if="column.key === 'status'">
                  <a-tag :color="record.status === 1 ? 'green' : 'default'">
                    {{ record.status === 1 ? '启用' : '停用' }}
                  </a-tag>
                </template>
                <template v-if="column.key === 'action'">
                  <a-space :size="12">
                    <a v-if="store.can('dict:item:manage')" @click="openItemModal(record)">编辑</a>
                    <a
                      v-if="store.can('dict:item:manage') && record.builtIn !== 1"
                      class="danger"
                      @click="removeItem(record)"
                    >删除</a>
                    <a-tooltip v-else-if="record.builtIn === 1" title="内置字典项不允许删除">
                      <span class="muted">内置</span>
                    </a-tooltip>
                  </a-space>
                </template>
              </template>
            </a-table>
          </div>
        </section>
      </div>
    </div>

    <!-- 新建/编辑类型 -->
    <a-modal
      v-model:open="typeModal.open"
      :title="typeModal.id ? '编辑字典类型' : '新建字典类型'"
      :confirm-loading="typeModal.saving"
      centered
      destroy-on-close
      @ok="submitType"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="类型编码" required extra="小写字母开头，仅小写字母/数字/点/下划线/中划线，如 ehr.leave_type；保存后不可改">
          <a-input v-model:value="typeModal.form.code" :disabled="!!typeModal.id" placeholder="ehr.leave_type" />
        </a-form-item>
        <a-form-item label="名称" required>
          <a-input v-model:value="typeModal.form.name" placeholder="请假类型" />
        </a-form-item>
        <a-form-item label="归属应用" extra="选择应用后该字典仅本应用可读；留空为全局字典；内置类型的归属应用不可修改">
          <a-select
            v-model:value="typeModal.form.appCode"
            :options="appOptions"
            :disabled="isBuiltInType"
            :loading="appsLoading"
            show-search
            allow-clear
            option-filter-prop="label"
            placeholder="选择应用或留空为全局字典"
          />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="typeModal.form.remark" :rows="2" />
        </a-form-item>
        <a-form-item v-if="typeModal.id" label="状态">
          <a-radio-group v-model:value="typeModal.form.status">
            <a-radio-button :value="1">启用</a-radio-button>
            <a-radio-button :value="0">停用</a-radio-button>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 新建/编辑字典项 -->
    <a-modal
      v-model:open="itemModal.open"
      :title="itemModal.id ? '编辑字典项' : `新建字典项（${selected?.name || ''}）`"
      :confirm-loading="itemModal.saving"
      centered
      destroy-on-close
      @ok="submitItem"
    >
      <a-form layout="vertical" style="margin-top: 12px">
        <a-form-item label="取值" required extra="业务表里存的就是它；保存后不可改">
          <a-input v-model:value="itemModal.form.value" :disabled="!!itemModal.id" placeholder="ANNUAL" />
        </a-form-item>
        <a-form-item label="显示名" required>
          <a-input v-model:value="itemModal.form.label" placeholder="年假" />
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
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import {
  createItem,
  createType,
  deleteItem,
  deleteType,
  listApps,
  listItems,
  listTypes,
  updateItem,
  updateType,
  type DictItem,
  type DictType,
  type AppOption
} from '@/api/settings'
import { useUserStore } from '@/stores/user'

const store = useUserStore()

/* ---------------- 字典类型（左栏） ---------------- */

const types = ref<DictType[]>([])
const typeLoading = ref(false)
const typeKeyword = ref('')
const selected = ref<DictType | null>(null)

const typeColumns = [
  { title: '编码', key: 'code', width: 190 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 110, ellipsis: true },
  { title: '应用', key: 'appCode', width: 80 },
  { title: '项数', key: 'itemCount', width: 60 },
  { title: '状态', key: 'status', width: 70 },
  { title: '操作', key: 'action', width: 110 }
]

async function loadTypes() {
  typeLoading.value = true
  try {
    types.value = await listTypes(typeKeyword.value || undefined)
    if (selected.value) {
      const hit = types.value.find((t) => t.id === selected.value!.id)
      selected.value = hit || null
    }
  } catch (e: any) {
    message.error(e?.message || '加载字典类型失败')
  } finally {
    typeLoading.value = false
  }
}

function selectType(t: DictType) {
  selected.value = t
  loadItems()
}

/* ---------------- 字典项（右栏） ---------------- */

const items = ref<DictItem[]>([])
const itemLoading = ref(false)
const includeDisabled = ref(false)

const itemColumns = [
  { title: '取值', key: 'value', width: 150 },
  { title: '显示名', dataIndex: 'label', key: 'label', width: 130, ellipsis: true },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 70 },
  { title: '状态', key: 'status', width: 80 },
  { title: '备注', key: 'remark' },
  { title: '操作', key: 'action', width: 120 }
]

async function loadItems() {
  if (!selected.value) return
  itemLoading.value = true
  try {
    items.value = await listItems(selected.value.code, includeDisabled.value)
  } catch (e: any) {
    message.error(e?.message || '加载字典项失败')
  } finally {
    itemLoading.value = false
  }
}

/* ---------------- 类型弹窗 ---------------- */

const apps = ref<AppOption[]>([])
const appsLoading = ref(false)
const appOptions = computed(() =>
  apps.value.map((a) => ({ label: `${a.name}（${a.code}）`, value: a.code }))
)

async function loadApps() {
  appsLoading.value = true
  try {
    apps.value = await listApps()
  } catch (e: any) {
    // 拉不到清单不阻塞编辑，仅提示
    message.warning(e?.message || '应用列表加载失败，可稍后重开弹窗')
  } finally {
    appsLoading.value = false
  }
}

const typeModal = reactive({
  open: false,
  saving: false,
  id: '' as string | '',
  form: { code: '', name: '', appCode: '' as string | undefined, remark: '', status: 1 }
})

const isBuiltInType = computed(() => {
  if (!typeModal.id) return false
  return types.value.find((t) => t.id === typeModal.id)?.builtIn === 1
})

function openTypeModal(t?: DictType) {
  typeModal.id = t?.id || ''
  typeModal.form = {
    code: t?.code || '',
    name: t?.name || '',
    appCode: t?.appCode || undefined,
    remark: t?.remark || '',
    status: t?.status ?? 1
  }
  if (!apps.value.length) loadApps()
  typeModal.open = true
}

async function submitType() {
  const f = typeModal.form
  if (!f.code.trim() || !f.name.trim()) {
    message.warning('编码与名称不能为空')
    return
  }
  typeModal.saving = true
  try {
    if (typeModal.id) {
      await updateType(typeModal.id, {
        name: f.name.trim(),
        appCode: f.appCode?.trim() || null,
        remark: f.remark,
        status: f.status
      })
      message.success('字典类型已更新')
    } else {
      await createType({ code: f.code.trim(), name: f.name.trim(), appCode: f.appCode?.trim() || null, remark: f.remark })
      message.success('字典类型已创建')
    }
    typeModal.open = false
    await loadTypes()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    typeModal.saving = false
  }
}

function removeType(t: DictType) {
  Modal.confirm({
    title: `删除字典类型「${t.name}」`,
    content: '仅允许删除没有任何字典项的自定义类型；删除后不可恢复。',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        await deleteType(t.id)
        message.success('已删除')
        if (selected.value?.id === t.id) selected.value = null
        await loadTypes()
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
}

/* ---------------- 字典项弹窗 ---------------- */

const itemModal = reactive({
  open: false,
  saving: false,
  id: '' as string | '',
  form: { value: '', label: '', sort: 0, remark: '', status: 1 }
})

function openItemModal(i?: DictItem) {
  if (!selected.value) return
  itemModal.id = i?.id || ''
  itemModal.form = {
    value: i?.value || '',
    label: i?.label || '',
    sort: i?.sort ?? items.value.length + 1,
    remark: i?.remark || '',
    status: i?.status ?? 1
  }
  itemModal.open = true
}

async function submitItem() {
  if (!selected.value) return
  const f = itemModal.form
  if (!f.value.trim() || !f.label.trim()) {
    message.warning('取值与显示名不能为空')
    return
  }
  itemModal.saving = true
  try {
    if (itemModal.id) {
      await updateItem(itemModal.id, { label: f.label.trim(), sort: f.sort, remark: f.remark, status: f.status })
      message.success('字典项已更新')
    } else {
      await createItem({
        typeCode: selected.value.code,
        value: f.value.trim(),
        label: f.label.trim(),
        sort: f.sort,
        remark: f.remark
      })
      message.success('字典项已创建')
    }
    itemModal.open = false
    await Promise.all([loadItems(), loadTypes()])
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    itemModal.saving = false
  }
}

function removeItem(i: DictItem) {
  Modal.confirm({
    title: `删除字典项「${i.label}」`,
    content: '删除后调用方将查不到这个取值，正在使用它的业务数据会退回兜底文案。确定删除？',
    okText: '删除',
    okButtonProps: { danger: true },
    cancelText: '取消',
    centered: true,
    onOk: async () => {
      try {
        await deleteItem(i.id)
        message.success('已删除')
        await Promise.all([loadItems(), loadTypes()])
      } catch (e: any) {
        message.error(e?.message || '删除失败')
      }
    }
  })
}

onMounted(loadTypes)
</script>

<style scoped>
.dict-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.dict-split {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.dict-split .panel {
  flex: 1;
  min-width: 0;
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

:deep(.type-row) {
  cursor: pointer;
}

:deep(.row-active) td {
  background: rgba(47, 84, 235, 0.08) !important;
}
</style>
