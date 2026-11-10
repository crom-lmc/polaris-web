<template>
  <div class="page-container embed-page">
    <div class="page-root embed-layout">
      <!-- 左侧树：埋点分组 → 应用 → 模块，点击过滤右侧列表（与消息配置同构） -->
      <aside class="panel module-tree">
        <div class="panel-body tree-body">
          <a-tree
            v-if="rows.length"
            class="approval-nav-tree"
            :tree-data="treeData"
            :selected-keys="selectedKey ? [selectedKey] : []"
            :expanded-keys="expandedKeys"
            block-node
            @select="onSelect"
            @expand="onExpand"
          >
            <template #title="node">
              <span class="approval-nav-node">
                <span :class="['approval-nav-name', navTitleClass(String(node.key))]">{{ node.title }}</span>
                <span v-if="navCount(node)" class="approval-nav-count">{{ navCount(node) }}</span>
              </span>
            </template>
          </a-tree>
          <a-empty v-else :image-style="{ height: '40px' }" description="暂无埋点" />
        </div>
      </aside>

      <section class="panel embed-main">
        <div class="panel-head">
          <span>埋点管理</span>
          <a-space :size="8">
            <a-input
              v-model:value="keyword"
              placeholder="搜 key / 描述 / 模块"
              allow-clear
              style="width: 220px"
              @press-enter="load"
            />
            <a-button @click="load">查询</a-button>
          </a-space>
        </div>

        <div class="panel-body table-body">
          <a-table
            :columns="columns"
            :data-source="filteredRows"
            :loading="loading"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'code'">
                <span class="mono">{{ record.code }}</span>
              </template>
              <template v-else-if="column.key === 'appCode'">
                {{ record.appCode ? appNameOf(record.appCode) : '通用' }}
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="12">
                  <a v-if="canManage" @click="openEdit(record)">编辑</a>
                  <a @click="openView(record)">查看</a>
                  <a @click="openHistory(record)">历史记录</a>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <!-- 查看 / 编辑：埋点与页面绑定，不支持在配置中心新增 -->
    <a-drawer
      v-model:open="drawerOpen"
      :title="drawerMode === 'history' ? '查看历史记录' : drawerMode === 'edit' ? '编辑埋点' : '查看埋点'"
      width="640"
      destroy-on-close
    >
      <template v-if="current">
        <a-descriptions :column="1" size="small" bordered class="meta">
          <a-descriptions-item label="Key"><span class="mono">{{ current.code }}</span></a-descriptions-item>
          <a-descriptions-item label="所属应用">{{ current.appCode ? appNameOf(current.appCode) : '通用' }}</a-descriptions-item>
          <a-descriptions-item label="模块">{{ current.module || '-' }}</a-descriptions-item>
          <a-descriptions-item label="描述">
            <a-input v-if="drawerMode === 'edit'" v-model:value="form.name" placeholder="埋点用途说明" />
            <span v-else>{{ current.name }}</span>
          </a-descriptions-item>
        </a-descriptions>

        <!-- 试用期提醒收件人：部门多选 + 人员多选 + 直属主管复选 -->
        <template v-if="drawerMode !== 'view' && isReceiver">
          <a-divider orientation="left">收件人维护</a-divider>
          <a-form layout="vertical">
            <a-form-item label="按部门（含所有下级）">
              <a-tree-select
                v-model:value="orgIds"
                :tree-data="orgTreeData"
                tree-checkable
                allow-clear
                show-search
                tree-node-filter-prop="title"
                :loading="receiverLoading"
                :disabled="isHistory"
                placeholder="可多选部门，保存后展开为部门内已开户在职员工"
                max-tag-count="responsive"
                @change="syncReceiverJson"
              />
            </a-form-item>
            <a-form-item label="按人（账号）">
              <a-select
                v-model:value="accountIds"
                mode="multiple"
                show-search
                allow-clear
                option-filter-prop="label"
                :options="employeeOptions"
                :loading="receiverLoading"
                :disabled="isHistory"
                placeholder="可搜姓名 / 工号，可多选"
                @change="syncReceiverJson"
              />
            </a-form-item>
            <a-form-item>
              <a-checkbox v-model:checked="directSupervisor" :disabled="isHistory" @change="syncReceiverJson">
                同时发送给员工的直属主管
              </a-checkbox>
            </a-form-item>
          </a-form>
        </template>

        <!-- 新开账户默认授权角色：角色编码多选 -->
        <template v-if="drawerMode !== 'view' && isRoles">
          <a-divider orientation="left">默认授权角色</a-divider>
          <a-form layout="vertical">
            <a-form-item label="角色编码（可输入后回车新增）">
              <a-select
                v-model:value="roleCodes"
                mode="tags"
                allow-clear
                :options="roleOptions"
                :disabled="isHistory"
                placeholder="如 EMPLOYEE_SELF"
                @change="syncRolesJson"
              />
            </a-form-item>
          </a-form>
        </template>

        <!-- 结构化维护的埋点（收件人/默认角色）不再展示原始 JSON，避免两处冲突 -->
        <template v-if="!isStructured">
          <div class="value-head">
            <span>Value（JSON）</span>
            <a-button v-if="drawerMode === 'edit'" size="small" @click="formatValue">格式化</a-button>
          </div>
          <a-textarea
            v-if="drawerMode === 'edit'"
            v-model:value="form.value"
            class="json-input mono"
            :rows="12"
            spellcheck="false"
            @blur="onValueBlur"
          />
          <pre v-else class="json-block">{{ pretty(form.value) }}</pre>
        </template>
      </template>

      <template v-if="drawerMode === 'edit'" #footer>
        <div class="drawer-actions">
          <a-button @click="drawerOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" @click="submit">保存</a-button>
        </div>
      </template>
    </a-drawer>

    <!-- 历史记录 -->
    <a-drawer v-model:open="historyOpen" title="历史记录" width="760" destroy-on-close>
      <div class="history-body">
        <div v-if="historyLoading || historyRows.length" class="history-table">
          <a-table
            :columns="historyColumns"
            :data-source="pagedHistoryRows"
            :loading="historyLoading"
            row-key="id"
            size="small"
            :pagination="false"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'createdAt'">{{ formatTime(record.createdAt) }}</template>
              <template v-else-if="column.key === 'action'">
                <a @click="openHistoryValue(record)">查看</a>
              </template>
            </template>
          </a-table>
        </div>
        <div v-else class="history-empty">
          <a-empty description="暂无数据" />
        </div>
        <div v-if="historyRows.length" class="history-pager">
          <a-pagination
            v-model:current="historyPage"
            size="small"
            :page-size="HISTORY_PAGE_SIZE"
            :total="historyRows.length"
            show-less-items
          />
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { fetchApps, fetchRoles, type AppBrief, type RoleBrief } from '@/api/approval'
import {
  fetchEmbedPointHistories,
  fetchEmbedReceiverEmployees,
  fetchEmbedReceiverOrgs,
  listEmbedPoints,
  updateEmbedPoint,
  type EmbedPoint,
  type EmbedPointHistory,
  type EmbedReceiverEmployee,
  type EmbedReceiverOrg
} from '@/api/embed'

/** 试用期超期提醒收件人：结构化维护 */
const RECEIVER_KEY = 'ehr.probation.reminder.receivers'
/** 新开账户默认授权角色：结构化维护 */
const ROLE_KEY = 'ehr.account.default-roles'
const COMMON_APP = '__common__'

const store = useUserStore()
const canManage = computed(() => store.can('embed:manage'))

const columns = [
  { title: 'Key', key: 'code', width: 300, ellipsis: true },
  { title: '模块', dataIndex: 'module', key: 'module', width: 140, ellipsis: true },
  { title: '所属应用', key: 'appCode', width: 120, ellipsis: true },
  { title: '描述', dataIndex: 'name', key: 'name', width: 240, ellipsis: true },
  { title: '操作', key: 'action', width: 190 }
]

const historyColumns = [
  { title: '保存时间', key: 'createdAt', width: 170 },
  { title: '操作人', dataIndex: 'operatedName', key: 'operatedName', width: 120, ellipsis: true },
  { title: '操作', key: 'action', width: 100 }
]

const rows = ref<EmbedPoint[]>([])
const apps = ref<AppBrief[]>([])
const loading = ref(false)
const keyword = ref('')

/* ---------------- 左侧树 ---------------- */

interface TreeNode {
  key: string
  title: string
  isLeaf?: boolean
  children?: TreeNode[]
  count?: number
}

const selectedApp = ref('')
const selectedModule = ref('')

const appNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const a of apps.value) map.set(a.code, a.name)
  return map
})

function appNameOf(code: string) {
  return appNameMap.value.get(code) || code
}

const appKeyOf = (r: EmbedPoint) => r.appCode || COMMON_APP

const treeData = computed<TreeNode[]>(() => {
  // 与「消息配置」一致：业务模块 → 应用（含暂无埋点的应用）→ 模块，并固定保留「通用」
  const known = new Map<string, string>()
  for (const a of apps.value) known.set(a.code, a.name)
  known.set(COMMON_APP, '通用')

  const appNodes: TreeNode[] = []
  for (const [code, name] of known.entries()) {
    const list = rows.value.filter((r) => appKeyOf(r) === code)
    const modules = new Map<string, number>()
    for (const r of list) {
      const mod = r.module || '未分类'
      modules.set(mod, (modules.get(mod) || 0) + 1)
    }
    const children: TreeNode[] = [...modules.entries()].map(([mod, count]) => ({
      key: `module:${code}::${mod}`,
      title: mod,
      count,
      isLeaf: true
    }))
    children.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
    appNodes.push({ key: `app:${code}`, title: name, count: list.length, children })
  }
  appNodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'))

  return [{ key: 'root', title: '业务模块', children: appNodes }]
})

const navTitleClass = (key: string) =>
  key === 'root'
    ? 'approval-nav-title-root'
    : key.startsWith('module:')
      ? 'approval-nav-title-leaf'
      : 'approval-nav-title-app'

const navCount = (node: any) => (typeof node?.count === 'number' ? node.count : 0)

const expandedKeys = ref<string[]>([])
watch(
  treeData,
  (nodes) => {
    const parents: string[] = []
    const walk = (list: TreeNode[]) =>
      list.forEach((n) => {
        if (n.children?.length) {
          parents.push(n.key)
          walk(n.children)
        }
      })
    walk(nodes)
    const known = new Set(expandedKeys.value)
    const added = parents.filter((k) => !known.has(k))
    if (added.length) expandedKeys.value = [...expandedKeys.value, ...added]
  },
  { immediate: true }
)

function onExpand(keys: (string | number)[]) {
  expandedKeys.value = keys.map(String)
}

const selectedKey = computed(() => {
  if (selectedModule.value) return `module:${selectedApp.value}::${selectedModule.value}`
  if (selectedApp.value) return `app:${selectedApp.value}`
  return 'root'
})

function onSelect(keys: (string | number)[]) {
  const key = String(keys[0] || 'root')
  if (key === 'root' || !key) {
    selectedApp.value = ''
    selectedModule.value = ''
  } else if (key.startsWith('app:')) {
    selectedApp.value = key.slice(4)
    selectedModule.value = ''
  } else {
    const rest = key.slice(7)
    const sep = rest.indexOf('::')
    selectedApp.value = rest.slice(0, sep)
    selectedModule.value = rest.slice(sep + 2)
  }
}

const filteredRows = computed(() => {
  let list = rows.value
  if (selectedApp.value) list = list.filter((r) => appKeyOf(r) === selectedApp.value)
  if (selectedModule.value) list = list.filter((r) => (r.module || '未分类') === selectedModule.value)
  return list
})

/* ---------------- 新增 / 查看 / 编辑 ---------------- */

const drawerOpen = ref(false)
const drawerMode = ref<'view' | 'edit' | 'history'>('view')
const current = ref<EmbedPoint | null>(null)
const saving = ref(false)
const form = reactive({ name: '', value: '' })

/** 当前维护的 key */
const currentCode = computed(() => current.value?.code || '')
const isReceiver = computed(() => currentCode.value === RECEIVER_KEY)
const isRoles = computed(() => currentCode.value === ROLE_KEY)
/** 历史快照：复用编辑抽屉的展示结构，但所有控件只读 */
const isHistory = computed(() => drawerMode.value === 'history')
/** 结构化维护的埋点不再展示原始 JSON 输入框 */
const isStructured = computed(() => isReceiver.value || isRoles.value)

/* 结构化编辑：部门 / 人员 / 直属主管，改动后回写 JSON 文本 */
const orgIds = ref<string[]>([])
const accountIds = ref<string[]>([])
const directSupervisor = ref(true)
const roleCodes = ref<string[]>([])
/** 全量角色，默认授权角色下拉可选所有角色（仍支持 tags 手动输入） */
const roles = ref<RoleBrief[]>([])
const receiverLoading = ref(false)
const employees = ref<EmbedReceiverEmployee[]>([])
const orgTreeData = ref<Array<{ title: string; value: string; children?: any[] }>>([])

const employeeOptions = computed(() =>
  employees.value.map((e) => ({ value: e.id, label: `${e.name}${e.empNo ? `（${e.empNo}）` : ''}` }))
)

const roleOptions = computed(() =>
  roles.value.map((r) => ({
    value: r.code,
    label: r.appCode ? `${r.name}（${r.code} · ${r.appCode}）` : `${r.name}（${r.code}）`
  }))
)

async function loadRoles() {
  try {
    roles.value = (await fetchRoles()) || []
  } catch (e) {
    message.error((e as Error).message || '角色列表加载失败')
  }
}

/** 扁平组织节点组树；叶子不带 children 键，避免显示展开箭头 */
function buildOrgTree(list: EmbedReceiverOrg[]) {
  const map = new Map<string, { title: string; value: string; children?: any[] }>()
  list.forEach((n) => map.set(n.id, { title: n.name, value: n.id, children: [] }))
  const roots: Array<{ title: string; value: string; children?: any[] }> = []
  for (const n of list) {
    const node = map.get(n.id)!
    const parent = n.parentId ? map.get(n.parentId) : undefined
    if (parent) parent.children!.push(node)
    else roots.push(node)
  }
  const walk = (ns: Array<{ children?: any[] }>) =>
    ns.forEach((x) => {
      if (x.children?.length) walk(x.children)
      else delete x.children
    })
  walk(roots)
  return roots
}

async function loadReceivers() {
  receiverLoading.value = true
  try {
    const [emps, orgs] = await Promise.all([fetchEmbedReceiverEmployees(), fetchEmbedReceiverOrgs()])
    employees.value = emps || []
    orgTreeData.value = buildOrgTree(orgs || [])
  } catch {
    // 选人数据加载失败不阻塞维护；保存时仍是合法 JSON
    employees.value = []
    orgTreeData.value = []
  } finally {
    receiverLoading.value = false
  }
}

function parseJson(raw?: string): any {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** JSON → 结构化控件（编辑回显、手动改 JSON 后失焦同步） */
function applyStructured(code: string, raw: string) {
  const obj = parseJson(raw) || {}
  if (code === RECEIVER_KEY) {
    orgIds.value = Array.isArray(obj.orgIds) ? obj.orgIds.map(String) : []
    accountIds.value = Array.isArray(obj.accountIds) ? obj.accountIds.map(String) : []
    directSupervisor.value = obj.directSupervisor !== false
  } else if (code === ROLE_KEY) {
    roleCodes.value = Array.isArray(obj.roleCodes) ? obj.roleCodes.map(String) : []
  }
}

function syncReceiverJson() {
  form.value = JSON.stringify(
    { orgIds: orgIds.value, accountIds: accountIds.value, directSupervisor: directSupervisor.value },
    null,
    2
  )
}

function syncRolesJson() {
  form.value = JSON.stringify({ roleCodes: roleCodes.value }, null, 2)
}

function onValueBlur() {
  if (!currentCode.value) return
  if (!parseJson(form.value)) {
    message.warning('当前内容不是合法 JSON，结构化选项未同步')
    return
  }
  applyStructured(currentCode.value, form.value)
}

function formatValue() {
  const obj = parseJson(form.value)
  if (obj === null) {
    message.error('埋点值必须是合法 JSON')
    return
  }
  form.value = JSON.stringify(obj, null, 2)
}

function openView(record: EmbedPoint) {
  current.value = record
  drawerMode.value = 'view'
  form.value = pretty(record.value)
  drawerOpen.value = true
}

function openEdit(record: EmbedPoint) {
  current.value = record
  drawerMode.value = 'edit'
  form.name = record.name
  form.value = pretty(record.value)
  applyStructured(record.code, record.value)
  drawerOpen.value = true
}

async function submit() {
  if (!current.value) return
  const obj = parseJson(form.value)
  if (obj === null) {
    message.error('埋点值必须是合法 JSON')
    return
  }
  saving.value = true
  try {
    // 编辑只允许改描述与 value，key / 应用 / 模块保持只读
    await updateEmbedPoint(current.value.id, { name: form.name, value: form.value })
    message.success('已保存')
    drawerOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------------- 历史记录 ---------------- */

const historyOpen = ref(false)
const historyLoading = ref(false)
const historyRows = ref<EmbedPointHistory[]>([])
const HISTORY_PAGE_SIZE = 10
const historyPage = ref(1)
/** 分页放在抽屉底部固定展示，表格只渲染当前页 */
const pagedHistoryRows = computed(() =>
  historyRows.value.slice((historyPage.value - 1) * HISTORY_PAGE_SIZE, historyPage.value * HISTORY_PAGE_SIZE)
)

async function openHistory(record: EmbedPoint) {
  current.value = record
  historyPage.value = 1
  historyOpen.value = true
  historyLoading.value = true
  try {
    historyRows.value = await fetchEmbedPointHistories(record.id)
  } catch (e: any) {
    historyRows.value = []
    message.error(e?.message || '历史记录加载失败')
  } finally {
    historyLoading.value = false
  }
}

/* ---------------- 展示工具 ---------------- */

/** 历史快照：带出当时的配置值，按编辑页结构只读展示 */
function openHistoryValue(record: EmbedPointHistory) {
  form.value = pretty(record.value)
  applyStructured(current.value?.code || '', record.value)
  historyOpen.value = false
  drawerMode.value = 'history'
  drawerOpen.value = true
}

function pretty(raw?: string) {
  const obj = parseJson(raw)
  return obj === null ? raw || '' : JSON.stringify(obj, null, 2)
}

function formatTime(v?: string) {
  if (!v) return '-'
  return v.replace('T', ' ').slice(0, 19)
}

/* ---------------- 加载 ---------------- */

onMounted(async () => {
  await Promise.all([load(), loadApps(), loadReceivers(), loadRoles()])
})

async function loadApps() {
  try {
    apps.value = await fetchApps()
  } catch {
    apps.value = []
  }
}

async function load() {
  loading.value = true
  try {
    rows.value = await listEmbedPoints(keyword.value || undefined)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* 左树 + 右表：与消息配置同一套外壳尺寸，保证两页视觉一致 */
.embed-page {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.embed-layout {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.module-tree {
  flex: 0 0 260px;
}

.embed-main :deep(.panel-head) {
  height: 52px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

.tree-body {
  overflow-y: auto;
  overflow-x: hidden;
}

.embed-main {
  flex: 1;
  min-width: 0;
}

/* 历史抽屉：表格占满剩余高度，分页固定在最下方 */
.history-body {
  height: calc(100vh - 104px);
  display: flex;
  flex-direction: column;
}

.history-table {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* 无历史数据时让空状态撑满抽屉高度并居中 */
.history-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.history-pager {
  flex: none;
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.mono {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
}

.meta {
  margin-bottom: 16px;
}

.value-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 16px 0 8px;
  font-size: 13px;
  font-weight: 600;
}

.json-input {
  font-size: 12px;
  line-height: 1.6;
}

.json-block {
  margin: 0;
  padding: 12px;
  max-height: 55vh;
  overflow: auto;
  background: var(--code-bg, #fafafa);
  border: 1px solid var(--border-color, #f0f0f0);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

.drawer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
