<template>
  <div class="page-container notice-page">
    <div class="page-root notice-layout">
      <!-- 左侧模块树：全部 → 各业务模块，点击过滤右侧配置列表 -->
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
          <a-empty v-else :image-style="{ height: '40px' }" description="暂无配置" />
        </div>
      </aside>

      <section class="panel notice-main">
        <div class="panel-head">
          <span>
            待办 / 消息配置
            <span class="muted head-sub">
              <template v-if="currentLabel">{{ currentLabel }} · </template>运营维护模板，业务按事件编码触发
            </span>
          </span>
          <a-space :size="8">
            <a-input
              v-model:value="keyword"
              placeholder="搜模块 / 描述 / 事件编码"
              allow-clear
              style="width: 220px"
              @press-enter="load"
            />
            <a-button @click="load">查询</a-button>
            <a-button v-if="canManage" type="primary" @click="openCreate">新增配置</a-button>
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
            <template #bodyCell="{ column, record, index }">
              <template v-if="column.key === 'index'">
                {{ index + 1 }}
              </template>
              <template v-else-if="column.key === 'module'">
                {{ record.module || '-' }}
              </template>
              <template v-else-if="column.key === 'content'">
                <span class="tpl-title">{{ record.titleTpl || '-' }}</span>
                <span v-if="record.contentTpl" class="cell-sub">{{ record.contentTpl }}</span>
              </template>
              <template v-else-if="column.key === 'appCode'">
                {{ record.appCode ? appNameOf(record.appCode) : '通用' }}
              </template>
              <template v-else-if="column.key === 'todo'">
                <a-switch
                  size="small"
                  :checked="record.channel === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchChannel(record, 1, v)"
                />
              </template>
              <template v-else-if="column.key === 'msg'">
                <a-switch
                  size="small"
                  :checked="record.channel === 2"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchChannel(record, 2, v)"
                />
              </template>
              <template v-else-if="column.key === 'email'">
                <a-switch
                  size="small"
                  :checked="record.email === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchEmail(record, v)"
                />
              </template>
              <template v-else-if="column.key === 'enabled'">
                <a-switch
                  size="small"
                  :checked="record.enabled === 1"
                  :disabled="!canManage"
                  @change="(v: boolean) => switchEnabled(record, v)"
                />
              </template>
              <template v-else-if="column.key === 'action'">
                <a-space :size="12">
                  <a v-if="canManage" @click="openEdit(record)">编辑</a>
                  <a v-if="canManage && record.builtIn !== 1" class="danger" @click="remove(record)">删除</a>
                  <a-tooltip v-else-if="record.builtIn === 1" title="内置配置不可删除，停用即可">
                    <span class="muted">内置</span>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </div>
      </section>
    </div>

    <a-modal
      v-model:open="modalOpen"
      :title="editing ? '编辑消息配置' : '新增消息配置'"
      :confirm-loading="saving"
      width="620px"
      centered
      @ok="submit"
    >
      <a-form ref="formRef" :model="form" layout="vertical">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item
              label="事件编码"
              name="code"
              :rules="[
                { required: true, message: '请输入事件编码' },
                { pattern: /^[a-z][a-z0-9._-]{1,63}$/, message: '小写字母开头，仅小写字母/数字/点/下划线/中划线' }
              ]"
            >
              <a-input v-model:value="form.code" :disabled="!!editing" placeholder="如 approval.approved" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="模块" name="module">
              <a-input v-model:value="form.module" placeholder="如 审批中心" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="归属应用" name="appCode">
              <a-select
                v-model:value="form.appCode"
                placeholder="不选=通用"
                allow-clear
                show-search
                option-filter-prop="label"
                :options="appOptions"
              />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="配置描述" name="name" :rules="[{ required: true, message: '请输入配置描述' }]">
              <a-input v-model:value="form.name" placeholder="如 审批通过通知发起人" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="标题模板" name="titleTpl">
          <a-input v-model:value="form.titleTpl" placeholder="如 审批已通过：{bizName}" />
        </a-form-item>

        <a-form-item label="内容模板" name="contentTpl">
          <a-textarea v-model:value="form.contentTpl" :rows="3" placeholder="如 你发起的「{title}」已审批通过。" />
        </a-form-item>

        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 16px"
          message="模板变量由调用方传入，未传的变量渲染为空。可用变量：{bizName} {title} {bizNo} {applicantName} {opinion}"
        />

        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="站内方式（二选一）">
              <a-radio-group v-model:value="form.channel">
                <a-radio :value="1">Web 待办</a-radio>
                <a-radio :value="2">Web 消息</a-radio>
              </a-radio-group>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="同时发邮件">
              <a-switch v-model:checked="emailChecked" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="启用">
              <a-switch v-model:checked="enabledChecked" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="指定接收人">
          <a-select
            v-model:value="receiverAccounts"
            mode="multiple"
            show-search
            allow-clear
            option-filter-prop="label"
            :options="employeeOptions"
            :loading="receiverLoading"
            placeholder="可搜姓名 / 工号，可多选"
          />
        </a-form-item>

        <a-form-item label="指定接收部门（含下级）">
          <a-tree-select
            v-model:value="receiverOrgs"
            :tree-data="orgTreeData"
            tree-checkable
            allow-clear
            show-search
            tree-node-filter-prop="title"
            :loading="receiverLoading"
            placeholder="可与接收人混合配置"
            max-tag-count="responsive"
          />
        </a-form-item>

        <a-alert
          type="info"
          show-icon
          style="margin-bottom: 4px"
          message="接收人与接收部门可混合配置；两者都不配置时，由业务方触发待办/消息时自行决定发给谁。"
        />
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useUserStore } from '@/stores/user'
import { fetchApps, type AppBrief } from '@/api/approval'
import {
  createNoticeRule,
  deleteNoticeRule,
  fetchReceiverEmployees,
  fetchReceiverOrgs,
  listNoticeRules,
  updateNoticeRule,
  type NoticeRule,
  type ReceiverEmployee,
  type ReceiverOrgNode
} from '@/api/notice'

const store = useUserStore()
const canManage = computed(() => store.can('notice:manage'))

const columns = [
  { title: '序号', key: 'index', width: 60 },
  { title: '模块', key: 'module', width: 110, ellipsis: true },
  { title: '描述', dataIndex: 'name', key: 'name', ellipsis: true },
  { title: '推送内容', key: 'content' },
  { title: 'Web 待办', key: 'todo', width: 90, align: 'center' as const },
  { title: 'Web 消息', key: 'msg', width: 90, align: 'center' as const },
  { title: '邮件', key: 'email', width: 70, align: 'center' as const },
  { title: '应用', key: 'appCode', width: 110, ellipsis: true },
  { title: '启用', key: 'enabled', width: 70, align: 'center' as const },
  { title: '操作', key: 'action', width: 110 }
]

const rows = ref<NoticeRule[]>([])
const apps = ref<AppBrief[]>([])
const loading = ref(false)
const keyword = ref('')

/* ---------------- 左侧树：业务模块 → 应用 → 模块（参考审批配置的业务类型树） ---------------- */

interface TreeNode {
  key: string
  title: string
  isLeaf?: boolean
  children?: TreeNode[]
}

const selectedApp = ref('')
const selectedModule = ref('')

/** 应用编码 → 中文名，树与表格列共用 */
const appNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const a of apps.value) map.set(a.code, a.name)
  return map
})

function appNameOf(code: string) {
  return appNameMap.value.get(code) || code
}

const appOptions = computed(() => apps.value.map((a) => ({ value: a.code, label: `${a.name}（${a.code}）` })))

/**
 * 三级树：业务模块（固定根）→ 应用（名称+计数）→ 模块（叶子）。
 * 规则没填应用时归到「通用」，避免出现空节点。
 */
const COMMON_APP = '__common__'

/** 规则的归属应用键：空应用统一归一成「通用」，过滤和树共用同一套键 */
const appKeyOf = (r: NoticeRule) => r.appCode || COMMON_APP

const treeData = computed<TreeNode[]>(() => {
  const known = new Map<string, string>() // key -> name
  for (const a of apps.value) known.set(a.code, a.name)
  for (const r of rows.value) {
    const key = appKeyOf(r)
    if (!known.has(key)) known.set(key, key === COMMON_APP ? '通用' : key)
  }

  const appNodes: TreeNode[] = []
  for (const [code, name] of known.entries()) {
    const list = rows.value.filter((r) => appKeyOf(r) === code)
    if (!list.length) {
      appNodes.push({ key: `app:${code}`, title: name, count: 0, children: [] } as TreeNode & { count: number })
      continue
    }
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
    appNodes.push({ key: `app:${code}`, title: name, count: list.length, children } as TreeNode & { count: number })
  }
  appNodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'))

  return [{ key: 'root', title: '业务模块', children: appNodes }]
})

/** 层级字重：根 > 应用 > 模块叶子（class 定义在 global.css，与审批配置三页一致） */
const navTitleClass = (key: string) =>
  key === 'root'
    ? 'approval-nav-title-root'
    : key.startsWith('module:')
      ? 'approval-nav-title-leaf'
      : 'approval-nav-title-app'

/** 树节点右侧数量（节点数据里带 count；根节点不展示） */
const navCount = (node: any) => (typeof node?.count === 'number' ? node.count : 0)

/** 默认全展开：树数据异步回来，default-expand-all 会失效，用受控 expandedKeys */
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

const currentLabel = computed(() => {
  if (selectedModule.value) return `模块：${selectedModule.value}`
  if (selectedApp.value) {
    return `应用：${selectedApp.value === COMMON_APP ? '通用' : appNameOf(selectedApp.value)}`
  }
  return ''
})

const filteredRows = computed(() => {
  let list = rows.value
  if (selectedApp.value) list = list.filter((r) => appKeyOf(r) === selectedApp.value)
  if (selectedModule.value) list = list.filter((r) => (r.module || '未分类') === selectedModule.value)
  return list
})

const modalOpen = ref(false)
const saving = ref(false)
const editing = ref<NoticeRule | null>(null)
const formRef = ref()
const form = reactive({
  code: '',
  appCode: '',
  module: '',
  name: '',
  titleTpl: '',
  contentTpl: '',
  channel: 2
})
const emailChecked = ref(false)
const enabledChecked = ref(true)

/* ---------------- 指定接收人 / 接收部门（存规则，业务方触发时解析） ---------------- */

const receiverAccounts = ref<string[]>([])
const receiverOrgs = ref<string[]>([])
const receiverLoading = ref(false)
const employees = ref<ReceiverEmployee[]>([])
const orgTreeData = ref<Array<{ title: string; value: string; children?: any[] }>>([])

const employeeOptions = computed(() =>
  employees.value.map((e) => ({ value: e.id, label: `${e.name}${e.empNo ? `（${e.empNo}）` : ''}` }))
)

/** 扁平组织节点组树；叶子不带 children 键，避免显示展开箭头 */
function buildOrgTree(list: ReceiverOrgNode[]) {
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
    const [emps, orgs] = await Promise.all([fetchReceiverEmployees(), fetchReceiverOrgs()])
    employees.value = emps || []
    orgTreeData.value = buildOrgTree(orgs || [])
  } catch {
    // 选人数据加载失败不阻塞规则维护；留空即可，业务方会兜底
    employees.value = []
    orgTreeData.value = []
  } finally {
    receiverLoading.value = false
  }
}

/** 逗号分隔串 → 字符串数组（编辑回显用） */
function splitIds(csv?: string) {
  return (csv || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

onMounted(async () => {
  await Promise.all([load(), loadApps(), loadReceivers()])
})

/** 应用清单用于树分组和「归属应用」下拉；失败不影响主流程，按编码兜底 */
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
    rows.value = await listNoticeRules(keyword.value || undefined)
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  // 在某个应用/模块下新建时默认带入当前选中的应用，减少重复选择
  Object.assign(form, {
    code: '',
    appCode: selectedApp.value === COMMON_APP ? '' : selectedApp.value,
    module: selectedModule.value,
    name: '',
    titleTpl: '',
    contentTpl: '',
    channel: 2
  })
  emailChecked.value = false
  enabledChecked.value = true
  receiverAccounts.value = []
  receiverOrgs.value = []
  modalOpen.value = true
}

function openEdit(record: NoticeRule) {
  editing.value = record
  Object.assign(form, {
    code: record.code,
    appCode: record.appCode || '',
    module: record.module || '',
    name: record.name,
    titleTpl: record.titleTpl || '',
    contentTpl: record.contentTpl || '',
    channel: record.channel === 1 ? 1 : 2
  })
  emailChecked.value = record.email === 1
  enabledChecked.value = record.enabled === 1
  receiverAccounts.value = splitIds(record.receiverAccountIds)
  receiverOrgs.value = splitIds(record.receiverOrgIds)
  modalOpen.value = true
}

async function submit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    const payload = {
      ...form,
      email: emailChecked.value ? 1 : 0,
      enabled: enabledChecked.value ? 1 : 0,
      receiverAccountIds: receiverAccounts.value.join(','),
      receiverOrgIds: receiverOrgs.value.join(',')
    }
    if (editing.value) {
      await updateNoticeRule(editing.value.id, payload)
      message.success('已保存')
    } else {
      await createNoticeRule(payload)
      message.success('已创建')
    }
    modalOpen.value = false
    await load()
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

// 站内待办与站内消息互斥（channel 单值）：
// 打开一个就把另一个关掉；把当前打开的那个关掉，则自动打开另一个，保证始终有一个通道。
// 所以无论点哪个、点开还是点关，结果都是 channel 变成「被点那个的反面或它自己」，永远有且仅有一个。
async function switchChannel(record: NoticeRule, target: number, checked: boolean) {
  const next = checked ? target : target === 1 ? 2 : 1
  await patch(record, { channel: next })
  message.success(`已切换为站内${next === 1 ? '待办' : '消息'}`)
}

async function switchEmail(record: NoticeRule, checked: boolean) {
  await patch(record, { email: checked ? 1 : 0 })
}

async function switchEnabled(record: NoticeRule, checked: boolean) {
  await patch(record, { enabled: checked ? 1 : 0 })
}

async function patch(record: NoticeRule, payload: Record<string, unknown>) {
  try {
    const updated = await updateNoticeRule(record.id, payload)
    Object.assign(record, updated)
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  }
}

function remove(record: NoticeRule) {
  Modal.confirm({
    title: '删除消息配置',
    content: `删除「${record.name}」后，业务再按 ${record.code} 触发将不会发送任何通知，确定吗？`,
    okText: '删除',
    okType: 'danger',
    centered: true,
    onOk: async () => {
      await deleteNoticeRule(record.id)
      message.success('已删除')
      await load()
    }
  })
}
</script>

<style scoped>
/* 页面内左右布局：左模块树 + 右配置列表。
   .page-root 全局是 flex-direction: column，这里必须显式改回 row，否则树会横在上面。
   外壳要给受控高度（同字典管理页），否则没数据时卡片会缩成内容高。 */
.notice-page {
  height: 100%;
  /* 外层 .content 已有 16px 内边距，height:100% 必须按 border-box 算，
     否则内容高 = 100% + 上下各 16px，会多出一条竖向滚动条 */
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.notice-layout {
  display: flex;
  flex-direction: row;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.module-tree {
  flex: 0 0 260px;
}

/* 左右两个卡片头固定同高：右侧头里有 32px 的输入/按钮，左侧只有文字，
   不压平会出现两条分隔线高低错开 */
.module-tree :deep(.panel-head),
.notice-main :deep(.panel-head) {
  height: 52px;
  padding-top: 0;
  padding-bottom: 0;
  box-sizing: border-box;
}

/* 树在面板内部滚动，面板本身撑满整列高度；名称超长走省略号，不出横向滚动条 */
.tree-body {
  overflow-y: auto;
  overflow-x: hidden;
}

.notice-main {
  flex: 1;
  min-width: 0;
}

.head-sub {
  margin-left: 8px;
  font-weight: 400;
}

.tpl-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.danger {
  color: #ff4d4f;
}
</style>
