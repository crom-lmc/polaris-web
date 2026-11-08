<template>
  <div class="ft-page">
    <div class="toolbar ft-head">
      <a-select
        v-model:value="selectedApp"
        style="width: 220px"
        :options="appOptions"
        @change="load"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('permission:create')" type="primary" @click="openCreate">
        新建权限
      </a-button>
      <a-button v-if="store.can('permission:create')" @click="openImport">批量导入</a-button>
      <a-button @click="toggleExpand">{{ expandedAll ? '收起全部' : '展开全部' }}</a-button>
      <span class="hint">
        权限点按应用分域：统一账号中心（<code>sso</code>）是平台自身，业务应用用自己的 code。
        不同应用可以定义同名权限码（各自的 <code>article:list</code> 互不影响）。
      </span>
    </div>

    <a-alert
      v-if="errorMsg"
      :message="errorMsg"
      type="warning"
      show-icon
      style="margin-bottom: 12px"
    />

    <a-alert
      type="info"
      show-icon
      style="margin-bottom: 12px"
      message="内置权限（被后端接口注解直接引用）不能删除、不能改码，只能改名、排序和备注。业务应用的权限点不受此限制。"
    />

    <section class="ft-scroll">
    <a-table
      class="perm-table ft-table"
      :columns="columns"
      :data-source="treeData"
      :loading="loading"
      row-key="id"
      :pagination="false"
      :expanded-row-keys="expandedKeys"
      @expand="handleExpand"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span class="name-cell">
            <a-tooltip :title="record.name" placement="topLeft">
              <span>{{ record.name }}</span>
            </a-tooltip>
          </span>
        </template>

        <template v-else-if="column.key === 'appCode'">
          <a-tag :color="record.appCode === 'sso' ? 'blue' : 'green'">
            {{ appLabel(record.appCode) }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'code'">
          <span class="mono">{{ record.code }}</span>
        </template>

        <template v-else-if="column.key === 'type'">
          <a-tag :color="record.type === 1 ? 'purple' : 'default'">
            {{ record.typeDesc || (record.type === 1 ? '菜单' : '按钮') }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'sort'">
          <span class="muted">{{ record.sort ?? 0 }}</span>
        </template>

        <template v-else-if="column.key === 'remark'">
          <span class="muted">{{ record.remark || '-' }}</span>
        </template>

        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button
              v-if="store.can('permission:edit')"
              type="link"
              size="small"
              @click="openEdit(record)"
            >
              编辑
            </a-button>
            <a-tooltip v-if="record.builtin" title="内置权限不可删除">
              <a-button type="link" size="small" disabled>删除</a-button>
            </a-tooltip>
            <a-button
              v-else-if="store.can('permission:delete')"
              type="link"
              size="small"
              danger
              @click="askRemove(record)"
            >
              删除
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>
    </section>

    <!-- 新建 / 编辑权限 -->
    <a-modal
      centered
      v-model:open="editOpen"
      :title="editing ? '编辑权限' : '新建权限'"
      :confirm-loading="submitting"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-form-item
          label="所属应用"
          name="appCode"
          :rules="[{ required: true, message: '请选择所属应用' }]"
        >
          <a-select
            v-model:value="editForm.appCode"
            :options="appOptions.filter((o) => o.value)"
            :disabled="!!editing"
            @change="onAppChange"
          />
          <div v-if="editing" class="field-tip">
            所属应用不可修改——迁移会让已授权的角色指向另一个应用的按钮
          </div>
          <div v-else class="field-tip">
            业务应用的按钮码请用它的应用编码，避免与平台权限混在一起
          </div>
        </a-form-item>

        <a-form-item
          label="权限码"
          name="code"
          :rules="[
            { required: !editing, message: '请输入权限码' },
            { pattern: /^[a-z][a-z0-9:_-]{1,63}$/, message: '小写字母开头，可含小写字母/数字/冒号/下划线/中划线' }
          ]"
        >
          <a-input
            v-model:value="editForm.code"
            :disabled="!!editing"
            placeholder="如 report:export"
          />
          <div v-if="editing?.builtin" class="field-tip">
            内置权限码被后端接口注解引用，不可修改
          </div>
        </a-form-item>

        <a-form-item label="权限名称" name="name" :rules="[{ required: true, message: '请输入权限名称' }]">
          <a-input v-model:value="editForm.name" placeholder="如 导出报表" />
        </a-form-item>

        <a-form-item label="类型" name="type" :rules="[{ required: true, message: '请选择类型' }]">
          <a-radio-group v-model:value="editForm.type">
            <a-radio :value="2">按钮（操作级）</a-radio>
            <a-radio :value="1">菜单（页面级，可作分组节点）</a-radio>
          </a-radio-group>
        </a-form-item>

        <a-form-item label="上级菜单" name="parentId">
          <a-select
            v-model:value="editForm.parentId"
            :options="parentOptions"
            placeholder="不选则为顶级"
            allow-clear
          />
          <div class="field-tip">只有「菜单」类型可以作为上级，且必须与当前权限同属一个应用。</div>
        </a-form-item>

        <a-form-item label="排序" name="sort">
          <a-input-number v-model:value="editForm.sort" :min="0" :max="9999" style="width: 140px" />
        </a-form-item>

        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="editForm.remark" :rows="2" placeholder="选填" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 批量导入：接入新应用时一次性灌入按钮码清单 -->
    <a-modal
      centered
      v-model:open="importOpen"
      title="批量导入权限点"
      width="720px"
      :confirm-loading="importing"
      @ok="submitImport"
    >
      <a-form layout="vertical">
        <a-form-item label="目标应用" required>
          <a-select
            v-model:value="importApp"
            :options="appOptions.filter((o) => o.value)"
            placeholder="选择要导入到哪个应用"
          />
          <div class="field-tip">
            导入是幂等的：已存在的权限码只刷新名称/排序/上级，不会重复创建，也不会清掉角色已有授权。
          </div>
        </a-form-item>
        <a-form-item label="权限点清单（JSON 数组）" required>
          <a-textarea
            v-model:value="importJson"
            :rows="12"
            class="mono"
            placeholder='[
  { "code": "blog", "name": "博客", "type": 1, "sort": 1 },
  { "code": "article:list", "name": "查看文章", "type": 2, "parentCode": "blog", "sort": 1 },
  { "code": "article:publish", "name": "发布文章", "type": 2, "parentCode": "blog", "sort": 2 }
]'
          />
          <div class="field-tip">
            <code>type</code>：1=菜单 2=按钮；<code>parentCode</code> 写上级菜单的 code（同应用内），
            不用填 ID。导入后到「角色管理」勾选即可授权。
          </div>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  createPermission,
  deletePermission,
  fetchPermissionTree,
  importAppPermissions,
  updatePermission
} from '@/api/rbac'
import { fetchApplications } from '@/api/apps'
import { useUserStore } from '@/stores/user'
import type { ApplicationVO, PermissionVO } from '@/types'
import { message } from 'ant-design-vue'
import { confirmAction } from '@/utils/confirm'

const store = useUserStore()

const columns = [
  // 权限名称：加宽到 300；超出部分由 .name-cell 的 CSS 截断为「…」，hover 出气泡看全文
  { title: '权限名称', dataIndex: 'name', key: 'name', width: 300, className: 'col-name' },
  { title: '所属应用', key: 'appCode', width: 140 },
  { title: '权限码', key: 'code', width: 220 },
  { title: '类型', key: 'type', width: 90 },
  { title: '排序', key: 'sort', width: 70 },
  { title: '备注', key: 'remark' },
  { title: '操作', key: 'action', width: 150 }
]

const treeData = ref<PermissionVO[]>([])
const flat = ref<PermissionVO[]>([])
const apps = ref<ApplicationVO[]>([])
const selectedApp = ref<string>('sso')
const loading = ref(false)
const errorMsg = ref('')
const expandedKeys = ref<string[]>([])
const expandedAll = ref(true)

const editOpen = ref(false)
const submitting = ref(false)
const editing = ref<PermissionVO | null>(null)
const editFormRef = ref()
const editForm = reactive({
  appCode: 'sso',
  code: '',
  name: '',
  type: 2,
  parentId: undefined as string | undefined,
  sort: 0,
  remark: ''
})

const importOpen = ref(false)
const importing = ref(false)
const importApp = ref<string>('')
const importJson = ref('')

/**
 * 应用下拉：空串是「全部应用」。平台权限域（app_code=sso）统一显示为「统一账号中心」——
 * 它和内置应用 sso-center 是同一件事的两种存在，界面上只保留一个入口；
 * sso-center 本身没有权限点，也从下拉里隐藏，避免出现两个「统一账号中心」。
 */
const appOptions = computed(() => [
  { label: '全部应用', value: '' },
  { label: '统一账号中心（sso）', value: 'sso' },
  ...apps.value
    .filter((a) => a.code !== 'sso-center')
    .map((a) => ({ label: `${a.name}（${a.code}）`, value: a.code }))
])

function appLabel(code?: string) {
  if (!code || code === 'sso' || code === 'sso-center') return '统一账号中心'
  return apps.value.find((a) => a.code === code)?.name || code
}

/** 可作上级的节点：同应用 + 菜单类型 + 排除自己及后代（防环） */
const parentOptions = computed(() => {
  const banned = new Set<string>()
  if (editing.value) {
    banned.add(editing.value.id)
    collectDescendants(editing.value, banned)
  }
  const app = editing.value?.appCode || editForm.appCode
  return flat.value
    .filter((p) => p.type === 1 && !banned.has(p.id) && (p.appCode || 'sso') === app)
    .map((p) => ({ label: `${p.name}（${p.code}）`, value: p.id }))
})

onMounted(async () => {
  await loadApps()
  await load()
})

async function loadApps() {
  if (!store.can('app:list')) return
  try {
    const res = await fetchApplications()
    apps.value = res.data || []
  } catch {
    // 没有应用查看权限时只显示平台自身，不影响权限管理
  }
}

function collectDescendants(node: PermissionVO, into: Set<string>) {
  node.children?.forEach((c) => {
    into.add(c.id)
    collectDescendants(c, into)
  })
}

function flatten(nodes: PermissionVO[], out: PermissionVO[] = []): PermissionVO[] {
  nodes.forEach((n) => {
    out.push(n)
    if (n.children?.length) flatten(n.children, out)
  })
  return out
}

function allMenuIds(nodes: PermissionVO[], out: string[] = []): string[] {
  nodes.forEach((n) => {
    if (n.children?.length) {
      out.push(n.id)
      allMenuIds(n.children, out)
    }
  })
  return out
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchPermissionTree(selectedApp.value || undefined)
    treeData.value = res.data || []
    flat.value = flatten(treeData.value)
    expandedKeys.value = expandedAll.value ? allMenuIds(treeData.value) : []
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

function toggleExpand() {
  expandedAll.value = !expandedAll.value
  expandedKeys.value = expandedAll.value ? allMenuIds(treeData.value) : []
}

function handleExpand(open: boolean, record: PermissionVO) {
  if (open) {
    if (!expandedKeys.value.includes(record.id)) expandedKeys.value = [...expandedKeys.value, record.id]
  } else {
    expandedKeys.value = expandedKeys.value.filter((k) => k !== record.id)
  }
}

/** 切换应用时清掉已选的上级，避免把父节点指到别的应用去 */
function onAppChange() {
  editForm.parentId = undefined
}

function openCreate() {
  editing.value = null
  Object.assign(editForm, {
    appCode: selectedApp.value || 'sso',
    code: '',
    name: '',
    type: 2,
    parentId: undefined,
    sort: 0,
    remark: ''
  })
  editOpen.value = true
}

function openEdit(record: PermissionVO) {
  editing.value = record
  Object.assign(editForm, {
    appCode: record.appCode || 'sso',
    code: record.code,
    name: record.name,
    type: record.type ?? 2,
    parentId: record.parentId && record.parentId !== '0' ? record.parentId : undefined,
    sort: record.sort ?? 0,
    remark: record.remark || ''
  })
  editOpen.value = true
}

async function submitEdit() {
  try {
    await editFormRef.value?.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const payload = {
      name: editForm.name,
      type: editForm.type,
      parentId: editForm.parentId ?? '0',
      sort: editForm.sort ?? 0,
      remark: editForm.remark
    }
    if (editing.value) {
      // 内置码不可改，干脆不传 code，让后端当作「未修改」
      await updatePermission(editing.value.id, editing.value.builtin ? payload : { ...payload, code: editForm.code })
      message.success('已保存')
    } else {
      await createPermission({ ...payload, code: editForm.code, appCode: editForm.appCode })
      message.success('已创建，去「角色管理」把它授予相应角色')
    }
    editOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function openImport() {
  importApp.value = selectedApp.value || 'sso'
  importJson.value = ''
  importOpen.value = true
}

async function submitImport() {
  if (!importApp.value) {
    message.warning('请选择目标应用')
    return
  }
  let items: any[]
  try {
    items = JSON.parse(importJson.value)
  } catch {
    message.error('JSON 格式有误，请检查括号与逗号')
    return
  }
  if (!Array.isArray(items) || items.length === 0) {
    message.error('请提供非空的权限点数组')
    return
  }
  importing.value = true
  try {
    const res = await importAppPermissions(importApp.value, items)
    const d = res.data
    message.success(`导入完成：新建 ${d?.created ?? 0} 条，更新 ${d?.updated ?? 0} 条`)
    importOpen.value = false
    selectedApp.value = importApp.value
    await load()
  } catch (e: any) {
    message.error(e?.message || '导入失败')
  } finally {
    importing.value = false
  }
}

// 二次确认：删除操作统一收敛到 Modal.confirm 对话框
function askRemove(record: PermissionVO) {
  confirmAction({
    title: '删除权限',
    content: `确定删除权限「${record.name}」吗？删除后引用它的角色会失去该权限。`,
    okText: '删除',
    okType: 'danger',
    onOk: () => remove(record)
  })
}

async function remove(record: PermissionVO) {
  try {
    await deletePermission(record.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
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

.hint {
  font-size: 12px;
  color: var(--muted);
  flex: 1 1 320px;
}

.hint code,
.field-tip code {
  background: var(--code-bg);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.name {
  font-weight: 500;
}

:deep(.col-name) {
  font-weight: 500;
}

.name-cell {
  display: block;
  max-width: 100%;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  vertical-align: bottom;
}

/* 固定列宽：权限名称等列锁定宽度，备注列自动吃掉剩余宽度，表格撑满卡片且不出现横向滚动。
   AntD 在普通（非 scroll）模式下会给 table 写内联 table-layout:auto，这里用 !important 压过它。 */
.perm-table :deep(table) {
  table-layout: fixed !important;
  width: 100% !important;
}

.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.muted {
  font-size: 12px;
  color: var(--muted);
}

.field-tip {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}
</style>
