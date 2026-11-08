<template>
  <div class="role-page ft-page">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="角色编码 / 名称"
        style="width: 220px"
        allow-clear
        @search="handleSearch"
      />
      <a-button @click="load">刷新</a-button>
      <a-button v-if="store.can('role:create')" type="primary" @click="openCreate">新建角色</a-button>
      <span class="hint">
        角色是全局的：一个角色可以同时勾选多个应用的权限点（如人事专员可同时拥有 EHR 与其他系统的权限）。
        改完授权后，用户需重新登录或刷新令牌才生效。
      </span>
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <section class="table-panel ft-scroll ft-bottom">
      <a-table
        class="role-table ft-table"
        :columns="columns"
        :data-source="records"
        :loading="loading"
        row-key="id"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'code'">
            <span class="mono">{{ record.code }}</span>
            <a-tag v-if="record.builtin" color="blue" style="margin-left: 6px">内置</a-tag>
          </template>

          <template v-else-if="column.key === 'permCount'">
            <a-tag :color="(record.permissionIds || []).length ? 'green' : 'default'">
              {{ (record.permissionIds || []).length }} 项
            </a-tag>
          </template>

          <template v-else-if="column.key === 'accountCount'">
            <span :class="{ muted: !record.accountCount }">{{ record.accountCount || 0 }}</span>
          </template>

          <template v-else-if="column.key === 'createdAt'">
            {{ record.createdAt || '-' }}
          </template>

          <template v-else-if="column.key === 'action'">
            <div class="row-actions">
              <a-button v-if="store.can('role:assign')" type="link" size="small" @click="openAssign(record)">
                授权
              </a-button>
              <a-button v-if="canAssignUsers" type="link" size="small" @click="openUsers(record)">
                分配用户
              </a-button>
              <a-button v-if="store.can('role:edit')" type="link" size="small" @click="openEdit(record)">
                编辑
              </a-button>
              <a-button
                v-if="store.can('role:delete') && !record.builtin"
                type="link"
                size="small"
                danger
                @click="askDelete(record)"
              >
                删除
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </section>

    <!-- 新建 / 编辑角色 -->
    <a-modal
      centered
      v-model:open="editOpen"
      :title="editing ? '编辑角色' : '新建角色'"
      :confirm-loading="submitting"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-form-item
          label="角色编码"
          name="code"
          :rules="[
            { required: !editing, message: '请输入角色编码' },
            { pattern: /^[A-Za-z][A-Za-z0-9_]{1,63}$/, message: '字母开头，仅字母/数字/下划线，2-64 位' }
          ]"
        >
          <a-input v-model:value="editForm.code" :disabled="!!editing" placeholder="如 ARTICLE_EDITOR" />
        </a-form-item>

        <a-form-item label="角色名称" name="name" :rules="[{ required: true, message: '请输入角色名称' }]">
          <a-input v-model:value="editForm.name" placeholder="如 文章编辑" />
        </a-form-item>

        <a-form-item label="备注" name="remark">
          <a-textarea v-model:value="editForm.remark" :rows="2" placeholder="选填，说明这个角色能做什么" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 权限授权 -->
    <a-drawer v-model:open="assignOpen" :title="`「${assignTarget?.name || ''}」的权限`" width="520">
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        :message="`「${assignTarget?.name || ''}」可勾选任意应用的权限点，保存后持有该角色的账户重新登录即生效。`"
      />

      <div class="assign-tools">
        <a-space>
          <a-button size="small" @click="checkAll">全选</a-button>
          <a-button size="small" @click="clearAll">清空</a-button>
          <a-button size="small" @click="toggleExpand">
            {{ expandAll ? '收起' : '展开' }}
          </a-button>
        </a-space>
        <span class="muted">{{ checkedLeafCount }} / {{ allLeafIds.length }} 个按钮</span>
      </div>

      <a-spin :spinning="assignLoading">
        <a-tree
          v-if="treeData.length"
          v-model:checked-keys="checkedKeys"
          v-model:expanded-keys="expandedKeys"
          :tree-data="treeData"
          checkable
          :selectable="false"
          :default-expand-all="false"
        />
        <a-empty v-else description="还没有任何权限点" />
      </a-spin>

      <template #footer>
        <a-space>
          <a-button @click="assignOpen = false">取消</a-button>
          <a-button type="primary" :loading="assignSaving" @click="saveAssign">保存</a-button>
        </a-space>
      </template>
    </a-drawer>

    <!-- 批量分配用户：左侧按组织选人，右侧是该角色已有的人员 -->
    <RoleUserTransferModal v-model:open="userOpen" :role="userTarget" @saved="load" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  assignRolePermissions,
  createRole,
  deleteRole,
  fetchPermissionTree,
  fetchRolePage,
  updateRole
} from '@/api/rbac'
import { fetchApplications } from '@/api/apps'
import { useUserStore } from '@/stores/user'
import type { ApplicationVO, PermissionVO, RoleVO } from '@/types'
import { message } from 'ant-design-vue'
import { confirmAction } from '@/utils/confirm'
import RoleUserTransferModal from './components/RoleUserTransferModal.vue'

const store = useUserStore()

/** 分配用户要读全量账号、写账号角色，读/写权限都得有，避免按钮可见但保存必 403 */
const canAssignUsers = computed(
  () => store.can('role:assign') && store.can('account:list') && store.can('account:edit')
)
const userOpen = ref(false)
const userTarget = ref<RoleVO | null>(null)

function openUsers(record: RoleVO) {
  userTarget.value = record
  userOpen.value = true
}

const columns = [
  { title: '角色编码', key: 'code', width: 190 },
  { title: '名称', dataIndex: 'name', key: 'name', width: 150, ellipsis: true },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
  { title: '权限', key: 'permCount', width: 90 },
  { title: '账户数', key: 'accountCount', width: 90 },
  { title: '创建时间', key: 'createdAt', width: 170 },
  { title: '操作', key: 'action', width: 270 }
]

const records = ref<RoleVO[]>([])
const loading = ref(false)
const keyword = ref('')
const errorMsg = ref('')
const total = ref(0)
const current = ref(1)
const pageSize = ref(10)

const pagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const editOpen = ref(false)
const submitting = ref(false)
const editing = ref<RoleVO | null>(null)
const editFormRef = ref()
const editForm = reactive({ code: '', name: '', remark: '' })

const assignOpen = ref(false)
const assignLoading = ref(false)
const assignSaving = ref(false)
const assignTarget = ref<RoleVO | null>(null)
const permissionTree = ref<PermissionVO[]>([])
const apps = ref<ApplicationVO[]>([])
const treeData = ref<any[]>([])
/** 勾选键：真实权限点是雪花ID字符串，业务应用的虚拟分组节点是 'app:' 前缀 */
const checkedKeys = ref<string[]>([])
const expandedKeys = ref<string[]>([])
const expandAll = ref(false)
const allLeafIds = ref<string[]>([])

onMounted(async () => {
  await load()
  await loadApps()
})

/** 授权抽屉用它把 appCode 显示成应用名；没有应用查看权限时退回显示 code */
async function loadApps() {
  if (!store.can('app:list')) return
  try {
    const res = await fetchApplications()
    apps.value = res.data || []
  } catch {
    // 忽略：只影响分组标题的显示
  }
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchRolePage({
      page: current.value,
      size: pageSize.value,
      keyword: keyword.value || undefined
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

function openCreate() {
  editing.value = null
  Object.assign(editForm, { code: '', name: '', remark: '' })
  editOpen.value = true
}

function openEdit(record: RoleVO) {
  editing.value = record
  Object.assign(editForm, {
    code: record.code,
    name: record.name,
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
    if (editing.value) {
      // 不带 permissionIds：本次只改基本信息，权限走授权抽屉，避免误清空
      await updateRole(editing.value.id, {
        name: editForm.name,
        remark: editForm.remark
      })
      message.success('已保存')
    } else {
      await createRole({
        code: editForm.code,
        name: editForm.name,
        remark: editForm.remark
      })
      message.success('已创建，接着给它分配权限')
    }
    editOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

// 二次确认：删除操作统一收敛到 Modal.confirm 对话框
function askDelete(record: RoleVO) {
  confirmAction({
    title: '删除角色',
    content: '删除后该角色的权限关联一并清除，确认吗？',
    okText: '删除',
    okType: 'danger',
    onOk: () => remove(record)
  })
}

async function remove(record: RoleVO) {
  try {
    await deleteRole(record.id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error(e?.message || '删除失败')
  }
}

// ---------------- 权限授权 ----------------

/**
 * 全量权限树只拉一次：角色可跨应用授权，不再按应用分别缓存。
 * 虚拟分组节点 key 为 'app:' 前缀，只用于展示，不落库。
 */
const ALL_APPS = 'ALL'
const permCache = new Map<string, PermissionVO[]>()

function nodeOf(n: PermissionVO, leafOut: string[]): any {
  const hasChildren = !!(n.children && n.children.length)
  if (!hasChildren) {
    leafOut.push(n.id)
  }
  return {
    key: n.id,
    title: `${n.name}（${n.code}）`,
    children: hasChildren ? n.children!.map((c) => nodeOf(c, leafOut)) : undefined
  }
}

/** 全量权限树按应用包一层分组节点（key=app:xxx 为虚拟节点，不落库），一个角色可跨应用勾选 */
function buildAssignTree(list: PermissionVO[]) {
  const groups = new Map<string, PermissionVO[]>()
  list.forEach((n) => {
    const app = n.appCode || 'sso'
    if (!groups.has(app)) groups.set(app, [])
    groups.get(app)!.push(n)
  })
  const leaves: string[] = []
  const data = [...groups.keys()]
    .sort((a, b) => (a === 'sso' ? -1 : b === 'sso' ? 1 : a.localeCompare(b)))
    .map((app) => ({
      key: `app:${app}`,
      title: `${appLabel(app)}（${app}）`,
      children: groups.get(app)!.map((n) => nodeOf(n, leaves))
    }))
  return { data, leaves }
}

function appLabel(code: string) {
  // 平台权限域（sso）与内置应用 sso-center 统一显示为「统一账号中心」，避免两个平台条目
  if (code === 'sso' || code === 'sso-center') return '统一账号中心'
  return apps.value.find((a) => a.code === code)?.name || code
}

function collectMenus(nodes: PermissionVO[], out: string[] = []): string[] {
  nodes.forEach((n) => {
    out.push(n.id)
    if (n.children?.length) collectMenus(n.children, out)
  })
  return out
}

/** id -> parentId，用于把勾选的按钮向上补全父菜单 */
const parentMap = ref<Map<string, string>>(new Map())

function buildParentMap(nodes: PermissionVO[], parentId = '') {
  nodes.forEach((n) => {
    parentMap.value.set(n.id, parentId)
    if (n.children?.length) buildParentMap(n.children, n.id)
  })
}

/** 兼容历史勾选数据里可能残留的虚拟分组 key（app:xxx）：不落库、不计数 */
function isVirtual(key: string): boolean {
  return String(key).startsWith('app:')
}

const checkedLeafCount = computed(
  () => checkedKeys.value.filter((k) => !isVirtual(k)).length
)

async function openAssign(record: RoleVO) {
  assignTarget.value = record
  assignOpen.value = true
  assignLoading.value = true
  try {
    // 角色是全局的：加载全部应用的权限树，按应用分组展示，可直接跨应用勾选
    let tree = permCache.get(ALL_APPS)
    if (!tree) {
      const res = await fetchPermissionTree()
      tree = res.data || []
      permCache.set(ALL_APPS, tree)
    }
    permissionTree.value = tree

    const { data, leaves } = buildAssignTree(tree)
    treeData.value = data
    allLeafIds.value = leaves
    parentMap.value = new Map()
    buildParentMap(tree)

    // 只回填叶子节点：级联模式下给父节点会出现「勾父自动勾全部子」的错误状态
    const leafSet = new Set(leaves)
    checkedKeys.value = (record.permissionIds || []).filter((id) => leafSet.has(id))
    expandedKeys.value = expandAll.value ? data.map((n) => n.key) : []
  } catch (e: any) {
    message.error(e?.message || '加载权限树失败')
  } finally {
    assignLoading.value = false
  }
}

function checkAll() {
  checkedKeys.value = [...allLeafIds.value]
}

function clearAll() {
  checkedKeys.value = []
}

/** 展开/收起直接改 expandedKeys：只翻标记位的话，当前树的展开状态不会跟着变 */
function toggleExpand() {
  expandAll.value = !expandAll.value
  expandedKeys.value = expandAll.value
    ? [...treeData.value.map((n) => n.key), ...collectMenus(permissionTree.value)]
    : []
}

/** 勾选的按钮 + 其所有祖先菜单，才是最终要保存的权限集合；虚拟应用节点不落库 */
function withAncestors(checked: string[]): string[] {
  const ids = checked.filter((k) => !isVirtual(k))
  const set = new Set<string>(ids)
  ids.forEach((id) => {
    let cur = parentMap.value.get(id) || ''
    let guard = 0
    while (cur && guard++ < 32) {
      set.add(cur)
      cur = parentMap.value.get(cur) || ''
    }
  })
  return [...set]
}

async function saveAssign() {
  if (!assignTarget.value) return
  assignSaving.value = true
  try {
    await assignRolePermissions(assignTarget.value.id, withAncestors(checkedKeys.value))
    message.success('已保存，持有该角色的账户下次登录后生效')
    assignOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    assignSaving.value = false
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
  flex: 0 0 auto;
}

.hint {
  font-size: 12px;
  color: var(--muted);
  flex: 1 1 320px;
}

.mono {
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.muted {
  font-size: 12px;
  color: var(--muted);
}

.assign-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

/* 操作列 4 个按钮：a-space 在窄列会收缩导致文字竖排，改用不换行的 flex 容器，
   并把 link 按钮的左右 padding 收紧，保证一行放得下。 */
.row-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
}
.row-actions :deep(.ant-btn-link) {
  padding: 0 4px;
}
:deep(.ant-table-tbody > tr > td:last-child) {
  white-space: nowrap;
}

/* 固定方案统一走 global.css 的 ft-page / ft-scroll / ft-bottom / ft-table；
   这里只按列宽给表格一个最小宽度，窄窗口才有横向滚动让操作列 sticky 生效。 */
.role-page {
  --ft-min-width: 1260px;
}
</style>
