<template>
  <a-modal
    :open="open"
    :title="`分配用户 · ${role?.name || ''}`"
    :width="1000"
    centered
    :mask-closable="false"
    :confirm-loading="saving"
    :ok-button-props="{ disabled: loading || !role }"
    :ok-text="`保存（${selected.length} 人）`"
    cancel-text="取消"
    @ok="save"
    @cancel="close"
  >
    <div v-if="loading" class="loading-tip"><a-spin size="small" /> 正在加载人员数据…</div>
    <template v-else>
      <div class="transfer">
        <!-- 三栏统一结构：标题 → 搜索框 → 列表，顶部严格对齐 -->
        <!-- 左：组织结构 -->
        <section class="pane org-pane">
          <div class="pane-head">
            <span class="pane-title">组织结构</span>
          </div>
          <a-input v-model:value="orgKeyword" size="small" placeholder="搜索组织" allow-clear>
            <template #prefix><search-outlined /></template>
          </a-input>
          <div class="scroll org-scroll">
            <a-tree
              v-if="orgTreeData.length"
              :tree-data="orgTreeData"
              :expanded-keys="expandedKeys"
              :selected-keys="selectedOrgId ? [selectedOrgId] : []"
              block-node
              @select="onSelectOrg"
              @expand="onExpand"
            >
              <template #title="{ title: name, disabled }">
                <span :class="{ 'org-disabled': disabled }" :title="name">{{ name }}</span>
              </template>
            </a-tree>
            <a-empty v-else :image="simpleImg" description="暂无组织" class="empty" />
          </div>
        </section>

        <!-- 中左：该组织及其下级成员 -->
        <section class="pane member-pane">
          <div class="pane-head">
            <span class="pane-title member-title" :title="selectedOrgName">
              可选人员 · {{ selectedOrgName }}
            </span>
            <a-button type="link" size="small" :disabled="!selectableLeft.length" @click="checkAllLeft">
              全选（含下级）
            </a-button>
          </div>
          <a-input v-model:value="leftKeyword" size="small" placeholder="搜索姓名 / 工号" allow-clear />
          <div class="scroll user-scroll">
            <!-- 不用 a-spin 包列表：它会多插两层 div，打断 flex 高度链导致整个弹窗被撑高 -->
            <div v-if="usersLoading" class="inner-loading"><a-spin size="small" /></div>
            <template v-else-if="filteredLeft.length">
              <div
                v-for="u in filteredLeft"
                :key="u.id"
                class="user-row"
                :class="{ picked: isSelected(u.id) }"
              >
                <a-checkbox
                  :checked="leftChecked.includes(u.id)"
                  :disabled="isSelected(u.id)"
                  @change="(e: any) => toggleLeft(u.id, !!e.target.checked)"
                >
                  <span class="uname">{{ u.name }}</span>
                  <span class="muted sub" :title="u.login ? `登录名：${u.login}` : u.sub">{{ u.sub }}</span>
                </a-checkbox>
                <a-tag v-if="isSelected(u.id)" color="green" class="mini-tag">已分配</a-tag>
              </div>
            </template>
            <a-empty
              v-else
              :image="simpleImg"
              :description="selectedOrgId ? '该组织下没有可选成员' : '选择左侧组织查看成员'"
              class="empty"
            />
          </div>
        </section>

        <!-- 穿梭按钮 -->
        <div class="shuttle">
          <a-button type="primary" size="small" :disabled="!addableCount" @click="addSelected">
            添加 {{ addableCount }} 人 <right-outlined />
          </a-button>
          <a-button size="small" :disabled="!removableCount" @click="removeSelected">
            <left-outlined /> 移除 {{ removableCount }} 人
          </a-button>
        </div>

        <!-- 右：已分配（打开时回填该角色现有人员） -->
        <section class="pane right-pane">
          <div class="pane-head">
            <span class="pane-title">已分配人员 · {{ selected.length }}</span>
            <a-button type="link" size="small" :disabled="!selectableRight.length" @click="checkAllRight">
              全选
            </a-button>
          </div>
          <a-input v-model:value="rightKeyword" size="small" placeholder="搜索姓名 / 工号" allow-clear />
          <div class="scroll right-scroll">
            <template v-if="filteredRight.length">
              <div v-for="u in filteredRight" :key="u.id" class="user-row">
                <a-checkbox
                  :checked="rightChecked.includes(u.id)"
                  :disabled="isProtected(u.id)"
                  @change="(e: any) => toggleRight(u.id, !!e.target.checked)"
                >
                  <span class="uname">{{ u.name }}</span>
                  <span class="muted sub" :title="u.login ? `登录名：${u.login}` : u.sub">{{ u.sub }}</span>
                </a-checkbox>
                <a-tag v-if="isNew(u.id)" color="blue" class="mini-tag">待新增</a-tag>
                <a-tag v-else-if="isProtected(u.id)" color="orange" class="mini-tag">内置保护</a-tag>
              </div>
            </template>
            <a-empty v-else :image="simpleImg" description="暂无人员" class="empty" />
          </div>
        </section>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span>原有 {{ originalIds.size }} 人</span>
          <span class="add">新增 {{ addedCount }} 人</span>
          <span class="del">移除 {{ removedCount }} 人</span>
          <span class="muted">保存后以右侧名单为准，仅提交有差异的账号</span>
        </div>
        <div class="summary-tips">
          可跨组织多次勾选，一次添加 · 打开时显示当前已有该角色的人员
        </div>
      </div>
    </template>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Empty, message } from 'ant-design-vue'
import { LeftOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { fetchApprovalOrgTree, fetchApprovalOrgUsers } from '@/api/approvals'
import type { ApprovalOrgNode, ApprovalOrgUser } from '@/api/approvals'
import { fetchAccounts, updateAccount } from '@/api/accounts'
import { fetchRoles } from '@/api/rbac'
import type { AccountVO, RoleVO } from '@/types'

/**
 * 角色 → 批量分配用户。
 *
 * 数据口径：账号中心不存组织归属与工号，左侧组织树/成员走审批中心代理（EHR 反查，
 * 只列已开户未离职的员工，id 就是账号 ID）；右侧初始名单来自 /api/accounts 的
 * roles 编码数组。账号接口只给登录名（有的是邮箱、有的是工号），直接显示会两种口径混排，
 * 所以弹窗打开时并发遍历全部组织建立「账号 ID → EHR 姓名 + 工号」索引，左右统一显示工号。
 * 写操作走现有的「账号覆盖式更新角色」接口按差量提交——
 * 这样不用新增/重启后端，且沿用 linkRoles 里「授角色顺带开通应用」的一致性逻辑。
 */
const props = defineProps<{ open: boolean; role: RoleVO | null }>()
const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'saved'): void
}>()

const simpleImg = Empty.PRESENTED_IMAGE_SIMPLE

interface PickUser {
  /** 账号 ID（字符串，雪花值不能走 number） */
  id: string
  name: string
  /** 副标题统一为 EHR 工号；账号没有员工档案（内置/离职）时为 — */
  sub: string
  /** 登录名：仅用于悬停提示与搜索兜底，不参与主显示 */
  login?: string
}
interface TreeNode {
  key: string
  title: string
  disabled?: boolean
  children?: TreeNode[]
}

/**
 * 账号 ID → EHR 档案（姓名 + 工号）索引，以及组织 ID → 直属成员缓存。
 * sso 作用域令牌访问不了 EHR 后台接口（403「仅限 EHR 后台令牌」），工号只能走审批中心
 * 已有的「按组织取直属成员」代理；弹窗打开时一次性并发遍历全部组织建立索引。
 * 组件常驻，索引跨多次打开复用；页面刷新后自动重建。
 */
const empIndex = new Map<string, PickUser>()
const orgUsersIndex = new Map<string, PickUser[]>()
let empIndexLoaded = false

function toPickUser(u: ApprovalOrgUser): PickUser {
  return { id: u.id, name: u.name, sub: u.empNo || '—' }
}

async function loadEmployeeIndex(orgs: ApprovalOrgNode[]) {
  if (empIndexLoaded) return
  const ids = orgs.map((n) => n.id)
  // 分批并发：几十个组织一次打出去会挤占网关连接，实测 8 并发全量遍历约 0.1s
  for (let i = 0; i < ids.length; i += 8) {
    const batch = ids.slice(i, i + 8)
    const results = await Promise.allSettled(batch.map((id) => fetchApprovalOrgUsers(id)))
    results.forEach((r, j) => {
      const list = r.status === 'fulfilled' ? r.value.data || [] : []
      const users = list.map(toPickUser)
      orgUsersIndex.set(batch[j], users)
      for (const u of users) empIndex.set(u.id, u)
    })
  }
  // 全失败时下次打开再试，避免一次网络抖动让工号永久缺失
  empIndexLoaded = empIndex.size > 0
}

const loading = ref(false)
const saving = ref(false)
const usersLoading = ref(false)

const orgNodes = ref<ApprovalOrgNode[]>([])
const orgKeyword = ref('')
const expandedKeys = ref<string[]>([])
const selectedOrgId = ref('')
const orgUsers = ref<PickUser[]>([])
/** 所有已加载过的组织成员，跨组织勾选后仍能按 id 找到人 */
const userMap = ref<Map<string, PickUser>>(new Map())
const leftKeyword = ref('')
const leftChecked = ref<string[]>([])

const rightKeyword = ref('')
const rightChecked = ref<string[]>([])
const selected = ref<PickUser[]>([])
/** 打开弹窗时已拥有该角色的账号；用来算差量与「待新增」标签 */
const originalIds = ref<Set<string>>(new Set())
/** 内置超管账号不允许被从 SUPER_ADMIN 角色里移走，避免把平台锁死 */
const protectedIds = ref<Set<string>>(new Set())

const accounts = ref<AccountVO[]>([])
const accountsById = ref<Map<string, AccountVO>>(new Map())
const roleIdByCode = ref<Map<string, string>>(new Map())

const selectedIds = computed(() => new Set(selected.value.map((u) => u.id)))
const selectedOrgName = computed(
  () => orgNodes.value.find((n) => n.id === selectedOrgId.value)?.name || '未选择组织'
)

/** 扁平组织列表 → 树；搜索时保留命中节点及祖先链 */
const orgTreeData = computed<TreeNode[]>(() => {
  const kw = orgKeyword.value.trim().toLowerCase()
  const byParent = new Map<string, ApprovalOrgNode[]>()
  for (const n of orgNodes.value) {
    const p = n.parentId || '0'
    const list = byParent.get(p) || []
    list.push(n)
    byParent.set(p, list)
  }
  const build = (parentId: string): TreeNode[] => {
    const out: TreeNode[] = []
    for (const n of byParent.get(parentId) || []) {
      const children = build(n.id)
      const selfHit = !kw || n.name.toLowerCase().includes(kw)
      const childHit = children.length > 0
      if (kw && !selfHit && !childHit) continue
      const t: TreeNode = { key: n.id, title: n.name, disabled: n.status === 2 }
      if (childHit) t.children = children
      out.push(t)
    }
    return out
  }
  return build('0')
})

/** 主显示统一是工号；登录名仅作搜索兜底，方便按邮箱找那些内置账号 */
function matchUser(u: PickUser, kw: string) {
  return !kw || `${u.name} ${u.sub} ${u.login || ''}`.toLowerCase().includes(kw)
}
const filteredLeft = computed(() => {
  const kw = leftKeyword.value.trim().toLowerCase()
  return kw ? orgUsers.value.filter((u) => matchUser(u, kw)) : orgUsers.value
})
const selectableLeft = computed(() => filteredLeft.value.filter((u) => !isSelected(u.id)))
const filteredRight = computed(() => {
  const kw = rightKeyword.value.trim().toLowerCase()
  return kw ? selected.value.filter((u) => matchUser(u, kw)) : selected.value
})
/** 右侧可勾选人员：内置保护账号不可移出，全选时也要跳过 */
const selectableRight = computed(() => filteredRight.value.filter((u) => !isProtected(u.id)))
const addableCount = computed(
  () => leftChecked.value.filter((id) => !selectedIds.value.has(id) && userMap.value.has(id)).length
)
const removableCount = computed(() => rightChecked.value.filter((id) => !isProtected(id)).length)
const addedCount = computed(() => selected.value.filter((u) => !originalIds.value.has(u.id)).length)
const removedCount = computed(
  () => [...originalIds.value].filter((id) => !selectedIds.value.has(id) && !isProtected(id)).length
)

function isSelected(id: string) {
  return selectedIds.value.has(id)
}
function isNew(id: string) {
  return !originalIds.value.has(id)
}
function isProtected(id: string) {
  return protectedIds.value.has(id)
}

/** 分页拉全量账号：右侧回显要按角色编码过滤，不能只取当前页 */
async function loadAllAccounts(): Promise<AccountVO[]> {
  const out: AccountVO[] = []
  const size = 200
  let page = 1
  for (;;) {
    const res = await fetchAccounts({ page, size })
    const rows = res.data?.records || []
    out.push(...rows)
    const total = res.data?.total || 0
    if (!rows.length || out.length >= total || page >= 20) break
    page++
  }
  return out
}

function pickFromAccount(a: AccountVO): PickUser {
  // 有 EHR 档案就用真实姓名 + 工号；没有档案的内置/离职账号不再混显登录名
  return (
    empIndex.get(a.id) || {
      id: a.id,
      name: a.nickname || a.username,
      sub: '—',
      login: a.username,
    }
  )
}

function reset() {
  orgNodes.value = []
  orgKeyword.value = ''
  expandedKeys.value = []
  selectedOrgId.value = ''
  orgUsers.value = []
  userMap.value = new Map()
  leftKeyword.value = ''
  leftChecked.value = []
  rightKeyword.value = ''
  rightChecked.value = []
  selected.value = []
  originalIds.value = new Set()
  protectedIds.value = new Set()
  accounts.value = []
  accountsById.value = new Map()
  roleIdByCode.value = new Map()
}

async function init() {
  if (!props.role) return
  reset()
  loading.value = true
  try {
    const [treeRes, rolesRes] = await Promise.all([fetchApprovalOrgTree(), fetchRoles()])
    orgNodes.value = treeRes.data || []
    // 默认只展开根节点：组织有几十个，全展开会把一屏塞满反而不好找人
    expandedKeys.value = orgNodes.value
      .filter((n) => !n.parentId || String(n.parentId) === '0')
      .map((n) => n.id)
    roleIdByCode.value = new Map((rolesRes.data || []).map((r) => [r.code, r.id]))

    // 先建立工号索引，右侧回填才不会「邮箱 / 工号」两种口径混排
    await loadEmployeeIndex(orgNodes.value)
    accounts.value = await loadAllAccounts()
    accountsById.value = new Map(accounts.value.map((a) => [a.id, a]))
    // 登录名补进索引：主显示仍是工号，但按邮箱搜索、悬停看登录名都可用
    for (const a of accounts.value) {
      const p = empIndex.get(a.id)
      if (p) p.login = a.username
    }
    const code = props.role.code
    originalIds.value = new Set(
      accounts.value.filter((a) => (a.roles || []).includes(code)).map((a) => a.id)
    )
    selected.value = [...originalIds.value]
      .map((id) => accountsById.value.get(id))
      .filter((a): a is AccountVO => !!a)
      .map(pickFromAccount)
    // 内置超管角色：admin 账号必须留在名单里，否则平台会失去唯一超管
    protectedIds.value =
      code === 'SUPER_ADMIN'
        ? new Set(accounts.value.filter((a) => a.username === 'admin').map((a) => a.id))
        : new Set()
  } catch (e: any) {
    message.error(e?.message || '加载人员数据失败')
  } finally {
    loading.value = false
  }
}

function onExpand(keys: (string | number)[]) {
  expandedKeys.value = keys.map(String)
}

/**
 * 选中组织及其全部下级组织的 ID。
 * 选「集团」时只列直属成员没有意义，要能一次看到整棵子树的人。
 */
function subtreeOrgIds(orgId: string): string[] {
  const children = new Map<string, string[]>()
  for (const n of orgNodes.value) {
    const p = n.parentId || '0'
    const list = children.get(p) || []
    list.push(n.id)
    children.set(p, list)
  }
  const ids: string[] = [orgId]
  for (let i = 0; i < ids.length; i++) {
    for (const c of children.get(ids[i]) || []) ids.push(c)
  }
  return ids
}

async function onSelectOrg(keys: (string | number)[]) {
  const id = keys.length ? String(keys[0]) : ''
  selectedOrgId.value = id
  orgUsers.value = []
  if (!id) return
  // 索引已预加载过全部组织，切组织一般不再发请求；注意不能清 leftChecked（要跨组织累计勾选）
  const ids = subtreeOrgIds(id)
  const missing = ids.filter((oid) => !orgUsersIndex.has(oid))
  if (missing.length) {
    usersLoading.value = true
    try {
      for (let i = 0; i < missing.length; i += 8) {
        const batch = missing.slice(i, i + 8)
        const results = await Promise.allSettled(batch.map((oid) => fetchApprovalOrgUsers(oid)))
        results.forEach((r, j) => {
          const users = (r.status === 'fulfilled' ? r.value.data || [] : []).map(toPickUser)
          orgUsersIndex.set(batch[j], users)
          for (const u of users) empIndex.set(u.id, u)
        })
      }
    } catch (e: any) {
      message.error(e?.message || '成员加载失败')
    } finally {
      usersLoading.value = false
    }
  }
  const merged: PickUser[] = []
  const seen = new Set<string>()
  for (const oid of ids) {
    for (const u of orgUsersIndex.get(oid) || []) {
      if (seen.has(u.id)) continue
      seen.add(u.id)
      merged.push(u)
    }
  }
  orgUsers.value = merged
  for (const p of merged) userMap.value.set(p.id, p)
}

function toggleLeft(id: string, checked: boolean) {
  const set = new Set(leftChecked.value)
  checked ? set.add(id) : set.delete(id)
  leftChecked.value = [...set]
}
function toggleRight(id: string, checked: boolean) {
  const set = new Set(rightChecked.value)
  checked ? set.add(id) : set.delete(id)
  rightChecked.value = [...set]
}

function checkAllLeft() {
  const set = new Set(leftChecked.value)
  selectableLeft.value.forEach((u) => set.add(u.id))
  leftChecked.value = [...set]
}

/** 右侧全选：勾选当前搜索结果里可移除的人员，配合「移除 N 人」批量操作 */
function checkAllRight() {
  const set = new Set(rightChecked.value)
  selectableRight.value.forEach((u) => set.add(u.id))
  rightChecked.value = [...set]
}

function addSelected() {
  const already = selectedIds.value
  const add = leftChecked.value
    .filter((id) => !already.has(id))
    .map((id) => userMap.value.get(id) || empIndex.get(id))
    .filter((u): u is PickUser => !!u)
  selected.value = [...selected.value, ...add]
  leftChecked.value = []
}

function removeSelected() {
  const drop = new Set(rightChecked.value.filter((id) => !isProtected(id)))
  selected.value = selected.value.filter((u) => !drop.has(u.id))
  rightChecked.value = []
}

/**
 * 保存：以右侧名单为准，只提交「新增/移除」的账号。
 * 账号更新接口是覆盖式的，所以每个账号都要带上它原有的全部角色 ID，
 * 绝不能只传当前这一个角色（否则会把它别的角色清空）。
 */
async function save() {
  const role = props.role
  if (!role || saving.value) return
  const target = selectedIds.value
  const toAdd = [...target].filter((id) => !originalIds.value.has(id))
  const toRemove = [...originalIds.value].filter((id) => !target.has(id) && !isProtected(id))
  if ([...originalIds.value].some((id) => !target.has(id) && isProtected(id))) {
    message.error('内置超级管理员账号不能移出该角色')
    return
  }
  if (!toAdd.length && !toRemove.length) {
    message.info('名单没有变化')
    close()
    return
  }

  const changes: { id: string; roleIds: string[] }[] = []
  for (const id of [...toAdd, ...toRemove]) {
    const acc = accountsById.value.get(id)
    if (!acc) {
      message.error('有账号已不存在，请刷新后重试')
      return
    }
    const current: string[] = []
    for (const code of acc.roles || []) {
      const rid = roleIdByCode.value.get(code)
      if (!rid) {
        message.error(`账号「${acc.username}」的角色 ${code} 无法解析，已中止以避免误清角色`)
        return
      }
      current.push(rid)
    }
    const next = toAdd.includes(id)
      ? [...new Set([...current, role.id])]
      : current.filter((r) => r !== role.id)
    changes.push({ id, roleIds: next })
  }

  saving.value = true
  let ok = 0
  let failed = 0
  // 小批并发：每个账号是独立的一行，互不冲突，又避免一次打出上百个请求
  for (let i = 0; i < changes.length; i += 5) {
    const batch = changes.slice(i, i + 5)
    const results = await Promise.allSettled(
      batch.map((c) => updateAccount(c.id, { roleIds: c.roleIds }))
    )
    results.forEach((r) => (r.status === 'fulfilled' ? ok++ : failed++))
  }
  saving.value = false

  emit('saved')
  if (failed) {
    message.error(`已更新 ${ok} 个账号，${failed} 个失败，名单已按最新结果重新载入，请重试`)
    await init()
  } else {
    message.success(`已为 ${ok} 个账号更新角色，重新登录后生效`)
    close()
  }
}

function close() {
  emit('update:open', false)
}

watch(
  () => props.open,
  (o) => {
    if (o) init()
  }
)
</script>

<style scoped>
.loading-tip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 390px;
  font-size: 13px;
  color: var(--muted);
}
/* 固定高度很关键：组织树有几十个节点，靠内容撑高会把弹窗底部（含保存按钮）顶出视口 */
.transfer {
  display: flex;
  gap: 10px;
  height: 390px;
}
.pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  height: 100%;
}
.org-pane {
  flex: 0 0 300px;
}
.member-pane {
  flex: 1 1 0%;
}
.right-pane {
  flex: 0 0 280px;
}
/* 三栏的标题 / 搜索框 / 列表分别同高，顶部严格对齐 */
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 24px;
  min-height: 24px;
}
.pane-title {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-base);
}
.member-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pane-head :deep(.ant-btn) {
  flex: none;
}
.scroll {
  flex: 1 1 0%;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 6px;
}
.inner-loading {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}
.user-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
}
.user-row:hover {
  background: var(--code-bg);
}
.user-row.picked {
  opacity: 0.6;
}
.user-row :deep(.ant-checkbox-wrapper) {
  flex: 1 1 auto;
  min-width: 0;
  display: inline-flex;
  align-items: center;
}
.user-row :deep(.ant-checkbox-wrapper > span:last-child) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uname {
  color: var(--text-base);
}
.sub {
  margin-left: 8px;
  font-size: 12px;
}
.mini-tag {
  flex: none;
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
}
.shuttle {
  flex: 0 0 96px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  gap: 10px;
}
.shuttle :deep(.ant-btn) {
  font-size: 12px;
  padding: 0 6px;
}
.summary {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
  font-size: 12px;
  color: var(--text-base);
}
.summary-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.summary-row .muted {
  margin-left: auto;
}
.summary-tips {
  margin-top: 6px;
  color: var(--muted);
  font-size: 12px;
}
.add {
  color: #16a34a;
}
.del {
  color: #dc2626;
}
.muted {
  color: var(--muted);
  font-size: 12px;
}
.org-disabled {
  opacity: 0.45;
}
/* 组织名普遍十几个字，折成两三行会把一屏塞满；栏宽 300 时可完整显示，超长仍单行省略 + hover 看全名 */
.org-scroll :deep(.ant-tree-title) {
  display: inline-block;
  max-width: 236px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
.empty {
  margin-top: 56px;
}
</style>
