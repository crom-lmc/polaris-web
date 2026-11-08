<template>
  <div class="account-page">
    <!-- 左侧组织树：账号本身不存组织，按组织过滤由后端借 EHR 员工档案反查。
         版式与 EHR「组织架构」页保持一致：标题栏 + 展开/收起全部 + 彩色类型标签 + 直属在职人数 -->
    <aside class="org-panel">
      <div class="panel-head">
        <span>组织架构</span>
        <span class="panel-tools">
          <a-button size="small" type="link" @click="expandAllOrgs">展开全部</a-button>
          <a-button size="small" type="link" @click="collapseAllOrgs">收起全部</a-button>
        </span>
      </div>
      <div class="org-tools">
        <a-button
          type="link"
          size="small"
          :class="{ 'org-all-active': !selectedOrgId }"
          @click="selectAllOrgs"
        >
          全部账号
        </a-button>
        <a-input-search
          v-model:value="orgKeyword"
          placeholder="搜索组织"
          allow-clear
          size="small"
        />
      </div>
      <div class="org-tree-body">
        <a-spin :spinning="orgLoading">
          <a-tree
            v-if="orgTreeData.length"
            class="account-org-tree"
            :tree-data="orgTreeData"
            :selected-keys="selectedKeys"
            :expanded-keys="expandedKeys"
            block-node
            @select="onOrgSelect"
            @expand="onOrgExpand"
          >
            <template #title="data">
              <span class="node-title">
                <a-tag :color="typeColor(metaOf(data).type)" class="node-tag">
                  {{ metaOf(data).typeName || typeLabel(metaOf(data).type) }}
                </a-tag>
                <span class="node-name" :class="{ 'is-off': metaOf(data).status === 2 }">
                  {{ metaOf(data).name }}
                </span>
                <span v-if="metaOf(data).employeeCount" class="node-count">
                  {{ metaOf(data).employeeCount }}人
                </span>
              </span>
            </template>
          </a-tree>
          <a-empty v-else :description="orgLoading ? ' ' : '暂无组织数据'" />
        </a-spin>
      </div>
    </aside>

    <section class="table-panel ft-scroll ft-bottom">
    <div class="toolbar ft-head">
      <a-input-search
        v-model:value="keyword"
        placeholder="登录名 / 昵称 / 邮箱"
        style="width: 280px"
        allow-clear
        @search="handleSearch"
      />
      <a-button @click="load">刷新</a-button>
      <a-tag v-if="selectedOrgName" color="blue" closable @close="selectAllOrgs">
        组织：{{ selectedOrgName }}
      </a-tag>
      <!-- 新增入口关闭：账号由 EHR 建档时自动开户（登录名=邮箱、初始密码随机），
           管理端只做查询与授权。若要手工开户，先在 EHR 建人。 -->
    </div>

    <a-alert v-if="errorMsg" :message="errorMsg" type="warning" show-icon style="margin-bottom: 12px" />

    <a-table
      class="account-table ft-table"
      :columns="columns"
      :data-source="records"
      :loading="loading"
      row-key="id"
      :pagination="pagination"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'username'">
          <div class="name-cell">
            <span class="name">{{ record.username }}</span>
            <span class="sub">{{ record.nickname || '-' }}</span>
          </div>
        </template>

        <template v-else-if="column.key === 'roles'">
          <a-tag v-for="r in record.roles || []" :key="r" :color="r === 'SUPER_ADMIN' ? 'blue' : 'default'">
            {{ r }}
          </a-tag>
          <span v-if="!(record.roles || []).length" class="muted">未分配</span>
        </template>

        <template v-else-if="column.key === 'status'">
          <a-tag :color="statusMeta[record.status]?.color">
            {{ statusMeta[record.status]?.text || record.status }}
          </a-tag>
        </template>

        <template v-else-if="column.key === 'lastLoginAt'">
          {{ record.lastLoginAt || '-' }}
        </template>

        <template v-else-if="column.key === 'action'">
          <!-- 收紧到 EHR 模块纯链接的紧凑度：link 按钮自带横向 padding，叠加默认 8px space 会显得很散 -->
          <a-space :size="4" class="row-actions">
            <a-button v-if="store.can('account:edit')" type="link" size="small" @click="openEdit(record)">
              编辑
            </a-button>

            <!-- 角色授权：决定这个账号在业务系统里能做什么（独立入口，不用进编辑弹窗） -->
            <a-button
              v-if="store.can('account:edit')"
              type="link"
              size="small"
              @click="openRoles(record)"
            >
              角色
            </a-button>

            <!-- 应用授权：决定这个账号能进哪些业务系统 -->
            <a-button
              v-if="store.can('account:app:assign')"
              type="link"
              size="small"
              @click="openApps(record)"
            >
              应用
            </a-button>

            <template v-if="record.status === 3">
              <a-button
                v-if="store.can('account:unlock')"
                type="link"
                size="small"
                @click="askUnlock(record)"
              >
                解锁
              </a-button>
            </template>
            <template v-else-if="record.status === 1">
              <a-button
                v-if="store.can('account:disable')"
                type="link"
                size="small"
                danger
                @click="askDisable(record)"
              >
                禁用
              </a-button>
            </template>
            <template v-else>
              <a-button
                v-if="store.can('account:enable')"
                type="link"
                size="small"
                @click="askEnable(record)"
              >
                启用
              </a-button>
            </template>

            <a-button
              v-if="store.can('account:resetPassword')"
              type="link"
              size="small"
              @click="openResetPwd(record)"
            >
              重置密码
            </a-button>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 新建 / 编辑账户 -->
    <a-modal
      centered
      v-model:open="editOpen"
      title="编辑账户"
      :confirm-loading="submitting"
      @ok="submitEdit"
    >
      <a-form ref="editFormRef" :model="editForm" layout="vertical">
        <a-form-item
          label="登录名"
          name="username"
          :rules="[{ pattern: /^[a-zA-Z0-9_]{3,32}$/, message: '3-32 位字母/数字/下划线' }]"
        >
          <a-input v-model:value="editForm.username" disabled />
        </a-form-item>

        <a-form-item label="昵称" name="nickname">
          <a-input v-model:value="editForm.nickname" />
        </a-form-item>

        <a-form-item
          label="邮箱"
          name="email"
          :rules="[{ type: 'email', message: '邮箱格式不正确' }]"
        >
          <a-input v-model:value="editForm.email" placeholder="选填，用于邮箱验证码登录" />
        </a-form-item>

        <a-form-item label="手机号" name="phone">
          <a-input v-model:value="editForm.phone" placeholder="选填" />
        </a-form-item>

        <a-form-item label="角色" name="roleIds">
          <a-select
            v-model:value="editForm.roleIds"
            mode="multiple"
            :options="roleSelectOptions"
            placeholder="选择角色"
          />
          <div class="muted role-tip">
            角色按应用分组；授予业务应用的角色时会自动开通该应用的访问权限。
          </div>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 角色授权 -->
    <a-modal
      centered
      v-model:open="rolesOpen"
      :title="`「${rolesTarget?.username || ''}」的角色授权`"
      :confirm-loading="submitting"
      width="640"
      @ok="submitRoles"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        message="角色决定这个账号能看哪些菜单、能做哪些操作；授予业务应用的角色会自动开通该应用的访问权限。保存为全量覆盖。"
      />
      <a-form layout="vertical">
        <a-form-item label="角色">
          <a-select
            v-model:value="roleForm.roleIds"
            mode="multiple"
            :options="roleSelectOptions"
            option-filter-prop="label"
            show-search
            placeholder="按应用分组选择角色"
          />
        </a-form-item>
      </a-form>
      <div class="muted">
        当前已授予：{{ (rolesTarget?.roles || []).join('、') || '未分配' }}
      </div>
    </a-modal>

    <!-- 重置密码 -->
    <a-modal
      centered
      v-model:open="pwdOpen"
      title="重置密码"
      :confirm-loading="submitting"
      @ok="submitResetPwd"
    >
      <a-form :model="pwdForm" layout="vertical">
        <a-form-item
          label="新密码"
          name="newPassword"
          :rules="[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' }
          ]"
        >
          <a-input-password v-model:value="pwdForm.newPassword" />
        </a-form-item>
        <a-form-item>
          <a-checkbox v-model:checked="pwdForm.forceChange">要求下次登录时修改密码</a-checkbox>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 可访问应用 -->
    <a-drawer
      v-model:open="appsOpen"
      :title="`「${appsTarget?.username || ''}」可访问的应用`"
      width="420"
    >
      <a-alert
        type="info"
        show-icon
        style="margin-bottom: 12px"
        message="只有被勾选的应用才能通过单点登录进入；超级管理员默认拥有全部应用"
      />

      <a-spin :spinning="appsLoading">
        <a-checkbox-group v-model:value="checkedAppIds" style="display: flex; flex-direction: column; gap: 10px">
          <a-checkbox v-for="app in allApps" :key="app.id" :value="app.id">
            <div class="app-row">
              <span class="app-name">{{ app.name }}</span>
              <span class="app-code">{{ app.code }}</span>
            </div>
          </a-checkbox>
        </a-checkbox-group>
        <a-empty v-if="!allApps.length" description="还没有注册任何应用" />
      </a-spin>

      <template #footer>
        <a-space>
          <a-button @click="appsOpen = false">取消</a-button>
          <a-button v-if="store.can('account:app:assign')" type="primary" :loading="appsSaving" @click="saveApps">保存</a-button>
        </a-space>
      </template>
    </a-drawer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { fetchApprovalOrgTree, type ApprovalOrgNode } from '@/api/approvals'
import {
  disableAccount,
  enableAccount,
  fetchAccountAppIds,
  fetchAccounts,
  grantAccountApps,
  resetAccountPassword,
  unlockAccount,
  updateAccount
} from '@/api/accounts'
import { fetchEnabledApplications, fetchRoles } from '@/api/apps'
import { useUserStore } from '@/stores/user'
import type { AccountVO, ApplicationVO, RoleVO } from '@/types'
import { message } from 'ant-design-vue'
import { confirmAction } from '@/utils/confirm'

const store = useUserStore()

// 必须与后端 com.laimengchao.sso.common.enums.AccountStatus 对齐：
//   1 正常 / 2 已禁用 / 3 已锁定(LOCKED) / 4 未激活(INACTIVE)
// 此前 3/4 被写反，导致「已锁定」账号被误显示为「未激活」，且解锁按钮永远不出现。
const statusMeta: Record<number, { text: string; color: string }> = {
  1: { text: '正常', color: 'green' },
  2: { text: '已禁用', color: 'red' },
  3: { text: '已锁定', color: 'volcano' },
  4: { text: '未激活', color: 'orange' }
}

const columns = [
  { title: '账户', key: 'username', width: 180 },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '角色', key: 'roles', width: 200 },
  { title: '状态', key: 'status', width: 100 },
  { title: '最近登录', key: 'lastLoginAt', width: 170 },
  { title: '操作', key: 'action', width: 300 }
]

const records = ref<AccountVO[]>([])
const loading = ref(false)
const keyword = ref('')
const errorMsg = ref('')
const total = ref(0)
const current = ref(1)
const pageSize = ref(10)
const roles = ref<RoleVO[]>([])
/** 角色分组标题用的应用名（只有已启用的应用才有角色） */
const appOptions = ref<ApplicationVO[]>([])

const pagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (t: number) => `共 ${t} 条`
}))

const editOpen = ref(false)
const submitting = ref(false)
const editing = ref<AccountVO | null>(null)
const editFormRef = ref()
const editForm = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
  roleIds: [] as string[]
})

const rolesOpen = ref(false)
const rolesTarget = ref<AccountVO | null>(null)
const roleForm = reactive({ roleIds: [] as string[] })

const pwdOpen = ref(false)
const pwdTarget = ref<AccountVO | null>(null)
const pwdForm = reactive({ newPassword: '', forceChange: true })

const appsOpen = ref(false)
const appsLoading = ref(false)
const appsSaving = ref(false)
const appsTarget = ref<AccountVO | null>(null)
const allApps = ref<ApplicationVO[]>([])
const checkedAppIds = ref<string[]>([])

// ---------------- 左侧组织树 ----------------
const orgNodes = ref<ApprovalOrgNode[]>([])
const orgLoading = ref(false)
const orgKeyword = ref('')

/** 组织类型彩色标签，与 EHR「组织架构」页的 TYPE_META 逐项对齐 */
const TYPE_META: Record<string, { label: string; color: string }> = {
  GROUP: { label: '集团', color: 'magenta' },
  COMPANY: { label: '子公司', color: 'blue' },
  DEPARTMENT: { label: '部门', color: 'green' },
  PROJECT: { label: '项目', color: 'orange' },
  SUB_PROJECT: { label: '子项目', color: 'purple' }
}
function typeColor(code?: string) {
  return (code && TYPE_META[code]?.color) || 'default'
}
function typeLabel(code?: string) {
  return (code && TYPE_META[code]?.label) || code || ''
}

const orgNodeMap = computed(() => new Map(orgNodes.value.map((n) => [n.id, n])))

interface TreeNodeMeta {
  type: string
  typeName: string
  name: string
  status: number
  employeeCount: number
}

/**
 * a-tree 的 #title 在不同 antd 版本里传的是 raw / dataRef / 摊平后的字段，形态不稳。
 * 用一定存在的 key 反查扁平节点最稳；raw 只作为兜底，避免升级后树变成空白标签。
 */
function metaOf(data: any): TreeNodeMeta {
  const raw = data?.raw || {}
  const node = orgNodeMap.value.get(String(data?.key ?? ''))
  return {
    type: raw.type || node?.type || '',
    typeName: raw.typeName || node?.typeName || '',
    name: raw.name || node?.name || String(data?.title ?? ''),
    status: Number(raw.status ?? node?.status ?? 1),
    employeeCount: Number(raw.employeeCount ?? node?.employeeCount ?? 0)
  }
}
/** 空串 = 全部账号；选中组织时只查该组织及下级 */
const selectedOrgId = ref('')
const expandedKeys = ref<string[]>([])

interface OrgTreeNode {
  key: string
  title: string
  children?: OrgTreeNode[]
}

/** 后端下发的是扁平节点（id/parentId），a-tree 只认 key/title/children，这里组树 */
const orgTreeData = computed<OrgTreeNode[]>(() => {
  const kw = orgKeyword.value.trim().toLowerCase()
  const map = new Map<string, OrgTreeNode>()
  const roots: OrgTreeNode[] = []
  for (const n of orgNodes.value) {
    map.set(n.id, { key: n.id, title: n.name || '未命名', children: [] })
  }
  for (const n of orgNodes.value) {
    const item = map.get(n.id)!
    const parent = n.parentId ? map.get(n.parentId) : undefined
    if (parent) parent.children!.push(item)
    else roots.push(item)
  }
  const clean = (list: OrgTreeNode[]): OrgTreeNode[] =>
    list.map((x) => ({
      key: x.key,
      title: x.title,
      children: x.children?.length ? clean(x.children) : undefined
    }))
  const tree = clean(roots)
  if (!kw) return tree
  // 搜索时保留命中节点及其祖先，否则子组织会变成孤立的根节点
  const keep = (node: OrgTreeNode): boolean => {
    const kids = (node.children || []).filter(keep)
    node.children = kids.length ? kids : undefined
    return node.title.toLowerCase().includes(kw) || kids.length > 0
  }
  return tree.filter(keep)
})

const selectedKeys = computed(() => (selectedOrgId.value ? [selectedOrgId.value] : []))
const selectedOrgName = computed(
  () => orgNodes.value.find((n) => n.id === selectedOrgId.value)?.name || ''
)

watch(orgKeyword, () => {
  // 搜索结果只保留命中节点及祖先，全部展开才看得见；清空后仍回到默认「全部展开」
  expandedKeys.value = orgNodes.value.map((n) => n.id)
})

async function loadOrgTree() {
  orgLoading.value = true
  try {
    const res = await fetchApprovalOrgTree()
    orgNodes.value = res.data || []
    // 默认全部展开，与 EHR 组织架构页一致；树面板自己有滚动条，不挤右侧表格
    expandedKeys.value = orgNodes.value.map((n) => n.id)
  } catch {
    // 组织服务不可用时树为空，但账号列表仍可正常使用（不按组织过滤）
    orgNodes.value = []
  } finally {
    orgLoading.value = false
  }
}

function expandAllOrgs() {
  expandedKeys.value = orgNodes.value.map((n) => n.id)
}

function collapseAllOrgs() {
  expandedKeys.value = []
}

function onOrgSelect(keys: (string | number)[]) {
  selectedOrgId.value = keys.length ? String(keys[0]) : ''
  current.value = 1
  load()
}

function onOrgExpand(keys: (string | number)[]) {
  expandedKeys.value = keys.map(String)
}

function selectAllOrgs() {
  selectedOrgId.value = ''
  current.value = 1
  load()
}

onMounted(async () => {
  await Promise.all([load(), loadRoles(), loadOrgTree()])
})

async function loadRoles() {
  try {
    const res = await fetchRoles()
    roles.value = res.data || []
  } catch {
    roles.value = []
  }
  try {
    const res = await fetchEnabledApplications()
    appOptions.value = res.data || []
  } catch {
    appOptions.value = []
  }
}

/** 角色是全局的，不再按应用分组：账户可以直接选到跨应用的组合角色 */
const roleSelectOptions = computed(() => [
  {
    label: '全部角色',
    options: roles.value.map((r) => ({ label: `${r.name}（${r.code}）`, value: r.id }))
  }
])

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetchAccounts({
      page: current.value,
      size: pageSize.value,
      keyword: keyword.value || undefined,
      orgId: selectedOrgId.value || undefined
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

/** 角色 code -> id（后端列表返回 code，编辑表单要 id） */
function roleIdsOfRoles(codes: string[]): string[] {
  return (codes || [])
    .map((code) => roles.value.find((r) => r.code === code)?.id)
    .filter((id): id is string => typeof id === 'string')
}

function openEdit(record: AccountVO) {
  editing.value = record
  Object.assign(editForm, {
    username: record.username,
    nickname: record.nickname || '',
    email: record.email || '',
    phone: record.phone || '',
    roleIds: roleIdsOfRoles(record.roles || [])
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
    if (!editing.value) {
      editOpen.value = false
      return
    }
    await updateAccount(editing.value.id, {
      nickname: editForm.nickname,
      email: editForm.email,
      phone: editForm.phone,
      roleIds: editForm.roleIds
    })
    message.success('已保存')
    editOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

/** 角色授权入口：不动账号基本信息，只改 roleIds（接口是全量覆盖） */
function openRoles(record: AccountVO) {
  rolesTarget.value = record
  roleForm.roleIds = roleIdsOfRoles(record.roles || [])
  rolesOpen.value = true
}

async function submitRoles() {
  if (!rolesTarget.value) return
  submitting.value = true
  try {
    // 只带角色：后端 update 对未传字段不动，避免把昵称/邮箱冲成 null
    await updateAccount(rolesTarget.value.id, { roleIds: roleForm.roleIds })
    message.success('角色已更新')
    rolesOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    submitting.value = false
  }
}

function openResetPwd(record: AccountVO) {
  pwdTarget.value = record
  pwdForm.newPassword = ''
  pwdForm.forceChange = true
  pwdOpen.value = true
}

async function submitResetPwd() {
  if (!pwdTarget.value) return
  if (!pwdForm.newPassword || pwdForm.newPassword.length < 8) {
    message.warning('密码至少 8 位')
    return
  }
  submitting.value = true
  try {
    await resetAccountPassword(pwdTarget.value.id, pwdForm.newPassword, pwdForm.forceChange)
    message.success('密码已重置')
    pwdOpen.value = false
  } catch (e: any) {
    message.error(e?.message || '重置失败')
  } finally {
    submitting.value = false
  }
}

// 二次确认：把危险/状态变更操作统一收敛到 Modal.confirm 对话框
function askUnlock(record: AccountVO) {
  confirmAction({
    title: '解锁账号',
    content: '解锁后该账号可正常登录，确认吗？',
    okText: '解锁',
    onOk: () => unlock(record)
  })
}

function askDisable(record: AccountVO) {
  confirmAction({
    title: '禁用账号',
    content: '禁用后该账号将无法登录，确认吗？',
    okText: '禁用',
    okType: 'danger',
    onOk: () => setStatus(record, 2)
  })
}

function askEnable(record: AccountVO) {
  confirmAction({
    title: '启用账号',
    content: '启用后该账号可正常登录，确认吗？',
    okText: '启用',
    onOk: () => setStatus(record, 1)
  })
}

async function setStatus(record: AccountVO, status: number) {
  try {
    if (status === 1) {
      await enableAccount(record.id)
    } else {
      await disableAccount(record.id)
    }
    message.success('已更新')
    await load()
  } catch (e: any) {
    message.error(e?.message || '操作失败')
  }
}

async function unlock(record: AccountVO) {
  try {
    await unlockAccount(record.id)
    message.success('已解锁')
    await load()
  } catch (e: any) {
    message.error(e?.message || '解锁失败')
  }
}

// ---------------- 可访问应用 ----------------

async function openApps(record: AccountVO) {
  appsTarget.value = record
  appsOpen.value = true
  appsLoading.value = true
  checkedAppIds.value = []
  try {
    const [appsRes, idsRes] = await Promise.all([
      fetchEnabledApplications(),
      fetchAccountAppIds(record.id)
    ])
    allApps.value = appsRes.data || []
    checkedAppIds.value = idsRes.data || []
  } catch (e: any) {
    message.error(e?.message || '加载应用失败')
  } finally {
    appsLoading.value = false
  }
}

async function saveApps() {
  if (!appsTarget.value) return
  appsSaving.value = true
  try {
    await grantAccountApps(appsTarget.value.id, checkedAppIds.value)
    message.success('已保存，该账号下次登录（或刷新令牌）后生效')
    appsOpen.value = false
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    appsSaving.value = false
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

.role-tip {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.name-cell {
  display: flex;
  flex-direction: column;
}

.name-cell .name {
  font-weight: 600;
}

.name-cell .sub,
.muted {
  font-size: 12px;
  color: var(--muted);
}

.app-row {
  display: flex;
  flex-direction: column;
}

.app-name {
  font-weight: 500;
}

.app-code {
  font-size: 12px;
  color: var(--muted);
}

/*
 * 左侧组织树 + 右侧表格：整页高度受控，两侧各自滚动。
 * 顶栏 64 + 内容区上下 padding 16*2 = 96，剩余即本页可用高度。
 * 把 .table-panel 设成唯一滚动容器后，分页条（sticky bottom）与操作列（sticky right）
 * 才有明确的滚动祖先——与 11-05 在 EHR 用 .panel-body 承载是同一套路。
 */
.account-page {
  display: flex;
  gap: 16px;
  align-items: stretch;
  height: calc(100vh - 96px);
  /* 顶栏高度若因主题 token 变化，用父容器实际高度兜底，避免出现二层页面滚动 */
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
}

.org-panel {
  flex: 0 0 340px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--header-border);
  border-radius: 8px;
  background: var(--header-bg);
  overflow: hidden;
}

.panel-head {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--header-border);
  font-weight: 600;
  font-size: 13px;
}

.panel-tools {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-weight: 400;
}

.org-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-subtle);
}

.org-tools :deep(.ant-input-search) {
  flex: 1 1 0%;
  min-width: 0;
}

.org-all-active {
  font-weight: 600;
}

.org-tree-body {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
  padding: 8px 6px;
}

/* a-spin 会插一层 wrapper，别让它把树体滚动容器的高度链打断 */
.org-tree-body :deep(.ant-spin-nested-loading),
.org-tree-body :deep(.ant-spin-container) {
  min-height: 100%;
}

/* 节点版式逐项对齐 EHR「组织架构」页：彩色类型标签 + 名称 + 直属在职人数 */
.node-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.node-tag {
  margin-inline-end: 0;
  transform: scale(0.9);
  transform-origin: left center;
}

.node-name {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name.is-off {
  color: var(--muted);
  text-decoration: line-through;
}

.node-count {
  font-size: 11px;
  color: var(--muted);
}

/* 左侧组织树 + 右侧表格：固定方案统一走 global.css 的 ft-scroll / ft-bottom / ft-table。
   这里保留横向 flex 布局下的右侧栏尺寸，只按列宽给表格一个最小宽度。 */
.table-panel {
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.account-page {
  /* 列宽下限：窄窗口下产生横向滚动，操作列 sticky 才有意义 */
  --ft-min-width: 980px;
}

/*
 * EHR 模块操作列是纯 <a> 链接（无内边距），这里保留 link 按钮的 danger / 权限判断能力，
 * 但把按钮自带横向 padding 收掉，配合 :size="4" 让文字间距落到 8~12px，不再显得散。
 */
.row-actions :deep(.ant-btn-link) {
  padding: 0 4px;
}
</style>
