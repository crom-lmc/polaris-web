<template>
  <a-layout class="page-container bp-root">
    <a-layout-sider width="300" class="approval-nav-sider" :theme="theme.mode === 'dark' ? 'dark' : 'light'">
      <a-tree
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
      <a-empty v-if="!treeData.length" :image-style="{ height: '40px' }" description="暂无业务类型" />
    </a-layout-sider>

    <a-layout-content class="bp-content">
      <div class="bp-head">
        <span class="bp-crumb">
          业务点 · {{ crumbText }}
          <a v-if="selectedBizType || selectedAppCode" class="bp-clear" @click="clearSelect">查看全部</a>
        </span>
        <a-input-search
          v-model:value="search"
          placeholder="名称 / 编码 / 业务类型"
          allow-clear
          class="bp-search"
        />
        <a-button v-if="store.can('biz:manage')" type="primary" :disabled="!bizTypeOptions.length" @click="openCreate">
          新增业务点
        </a-button>
      </div>

      <a-table
        :columns="columns"
        :data-source="filteredPoints"
        :row-key="(r: any) => `${r.bizType}::${r.code}`"
        size="small"
        :pagination="false"
        class="bp-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'index'">{{ record.__i }}</template>
          <template v-else-if="column.key === 'name'">
            <span>{{ record.name }}</span>
            <a-tag v-if="refHits(record).length" color="default" class="ref-tag">已引用</a-tag>
          </template>
          <template v-else-if="column.key === 'code'">
            <span class="mono">{{ record.code || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'dataType'">
            <a-tag v-if="record.dataType" :color="typeMeta(record.dataType).color" class="type-tag">
              {{ typeMeta(record.dataType).label }}
            </a-tag>
            <a-tooltip v-else title="升级前的老业务点没写类型，分支条件暂不限制判断符；点编辑补一个类型">
              <a-tag>未指定</a-tag>
            </a-tooltip>
          </template>
          <template v-else-if="column.key === 'bizType'">
            <span>{{ record.bizName }}</span>
          </template>
          <template v-else-if="column.key === 'remark'">
            <span class="muted">{{ record.remark || '—' }}</span>
          </template>
          <template v-else-if="column.key === 'action'">
            <a-button v-if="store.can('biz:manage')" type="link" size="small" @click="openEdit(record)">编辑</a-button>
            <!-- 被引用的业务点不能删：按钮置灰并说明被谁引用；disabled 按钮不触发鼠标事件，
                 所以 tooltip 挂在外层 span 上 -->
            <a-tooltip v-if="refHits(record).length">
              <template #title>
                <!-- tooltip 内容被 teleport 到 body，样式内联避免 scoped CSS 丢失 -->
                <div style="max-width: 340px; line-height: 1.7; font-size: 12px">
                  <div style="font-weight: 600; margin-bottom: 2px">该业务点已被引用，不能删除</div>
                  <div v-for="(h, i) in refHits(record).slice(0, 5)" :key="i">· {{ h }}</div>
                  <div v-if="refHits(record).length > 5">· 等共 {{ refHits(record).length }} 处</div>
                </div>
              </template>
              <span class="bp-del-disabled">
                <a-button type="link" size="small" disabled>删除</a-button>
              </span>
            </a-tooltip>
            <a-popconfirm v-else title="删除该业务点？" @confirm="remove(record)">
              <a-button v-if="store.can('biz:manage')" type="link" size="small" danger>删除</a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>

      <a-empty
        v-if="filteredPoints.length === 0"
        :description="search ? '没有匹配的业务点' : '暂无业务点，点击右上角新增'"
      />
    </a-layout-content>

    <a-modal
      v-model:open="modalOpen"
      :title="editingCode ? '编辑业务点' : '新增业务点'"
      :confirm-loading="saving"
      @ok="save"
      @cancel="modalOpen = false"
      width="520"
    >
      <a-form layout="vertical" class="bp-form">
        <a-form-item label="所属业务类型" required>
          <a-select
            v-model:value="form.bizType"
            :disabled="!!editingCode"
            :options="bizTypeOptions"
            placeholder="选择业务类型"
            show-search
            option-filter-prop="label"
          />
        </a-form-item>
        <a-form-item label="业务点名称" required>
          <a-input v-model:value="form.name" placeholder="如 请假天数" :maxlength="40" />
        </a-form-item>
        <a-form-item label="业务点编码" required>
          <a-input
            v-model:value="form.code"
            placeholder="SpEL 变量名，如 leaveDays"
            :disabled="!!editingCode"
            :maxlength="40"
          />
          <div class="muted small">同业务类型内唯一，仅字母/数字/下划线，且以字母或下划线开头；分支条件中用此编码引用。</div>
        </a-form-item>
        <a-form-item label="数据类型" required>
          <a-select
            v-model:value="form.dataType"
            :options="typeOptions"
            placeholder="选择数据类型，决定分支条件可用的判断符"
          />
          <div class="muted small">
            {{ form.dataType ? typeMeta(form.dataType).hint : '数字只能比大小；字符串可判包含；日期比先后；人员/组织判断是不是；字典值只做等于/不等于。' }}
          </div>
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model:value="form.remark" :rows="2" :maxlength="120" />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-layout>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user'
const store = useUserStore()
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  listTemplates,
  listScenes,
  registerScene,
  fetchBizPointRefs,
  type ApprovalTemplate,
  type BizScene,
  type BusinessPoint,
  type AppBrief
} from '@/api/approval'
import { BIZ_POINT_TYPES, pointType, type BizPointType } from '@/utils/bizpoint'
import { useThemeStore } from '@/stores/theme'

interface TreeNode {
  key: string
  title: string
  isLeaf?: boolean
  children?: TreeNode[]
}

/** 二级节点：业务类型按所属应用分组 */
interface AppGroup {
  appCode: string
  appName: string
  items: { bizType: string; bizName: string }[]
}

/** 带归属的全量业务点行：业务点存放在各业务场景的 formSchema 里 */
interface PointRow extends BusinessPoint {
  bizType: string
  bizName: string
  appCode: string
}

const typeOptions = BIZ_POINT_TYPES.map((t) => ({ value: t.value, label: t.label }))
const typeMeta = (t?: string) =>
  BIZ_POINT_TYPES.find((x) => x.value === t) || { value: '', label: '未指定', color: 'default', hint: '' }
const theme = useThemeStore()

const templates = ref<ApprovalTemplate[]>([])
const scenes = ref<BizScene[]>([])
const apps = ref<AppBrief[]>([])

/** 三级导航：root「业务类型」→ app:«应用» → biz:«业务类型» */
const selectedKey = ref('root')
const selectedAppCode = ref('')
const selectedBizType = ref('')
const selectedBizName = ref('')
const expandedKeys = ref<string[]>([])
const search = ref('')

const points = ref<PointRow[]>([])

/** 业务点引用表：key = `${bizType}::${code}`（与列表 rowKey 一致）；命中项禁止删除 */
const pointRefs = ref<Record<string, string[]>>({})

const refKey = (p: { bizType: string; code: string }) => `${p.bizType}::${p.code}`
function refHits(p: { bizType: string; code: string }): string[] {
  return pointRefs.value[refKey(p)] || []
}

/** 引用信息拉不到时不阻塞页面：置灰判断退化成「无引用」，后端 registerScene 仍会硬拦截 */
async function loadRefs() {
  try {
    pointRefs.value = await fetchBizPointRefs()
  } catch {
    pointRefs.value = {}
  }
}

/** 业务类型索引：bizType -> {bizName, appCode}，合并模板与场景，模板优先 */
const bizIndex = computed(() => {
  const map = new Map<string, { bizName: string; appCode: string }>()
  const put = (bizType: string, bizName: string, appCode: string) => {
    if (!map.has(bizType)) map.set(bizType, { bizName: bizName || bizType, appCode: appCode || 'other' })
  }
  for (const t of templates.value) put(t.bizType, t.bizName || '', t.appCode || '')
  for (const s of scenes.value) put(s.bizType, s.bizName || '', s.appCode || '')
  return map
})

const appNameOf = (code: string) => {
  if (!code || code === 'other') return '未归属应用'
  return apps.value.find((a) => a.code === code)?.name || code
}
const multiApp = computed(() => new Set([...bizIndex.value.values()].map((v) => v.appCode)).size > 1)

/** 二级分组：bizIndex 按 appCode 归并，应用按业务类型数量倒序（主应用在前），组内按名称排 */
const appGroups = computed<AppGroup[]>(() => {
  const map = new Map<string, AppGroup>()
  for (const [bizType, v] of bizIndex.value.entries()) {
    const code = v.appCode || 'other'
    if (!map.has(code)) map.set(code, { appCode: code, appName: appNameOf(code), items: [] })
    map.get(code)!.items.push({ bizType, bizName: v.bizName })
  }
  for (const g of map.values()) g.items.sort((a, b) => a.bizName.localeCompare(b.bizName, 'zh'))
  return [...map.values()].sort(
    (a, b) => b.items.length - a.items.length || a.appName.localeCompare(b.appName, 'zh')
  )
})

/** 三级树：1 业务类型（全部） → 2 所属应用 → 3 具体审批场景（业务类型） */
const treeData = computed<TreeNode[]>(() => {
  const children: TreeNode[] = appGroups.value.map((g) => ({
    key: `app:${g.appCode}`,
    title: g.appName,
    count: g.items.length,
    children: g.items.map((i) => ({ key: `biz:${i.bizType}`, title: i.bizName, isLeaf: true }))
  }) as TreeNode & { count: number })
  return children.length ? [{ key: 'root', title: '业务类型', children }] : []
})

/* ---------------- 左树统一样式与展开（三个审批菜单共用同一套 class） ---------------- */

/** 层级字重：根 > 应用 > 业务场景叶子；样式定义在 global.css，三页一致 */
const navTitleClass = (key: string) =>
  key === 'root'
    ? 'approval-nav-title-root'
    : key.startsWith('app:')
      ? 'approval-nav-title-app'
      : 'approval-nav-title-leaf'

/** 树节点右侧数量（节点数据里带 count；根节点不展示） */
const navCount = (node: any) => (typeof node?.count === 'number' ? node.count : 0)

/**
 * 默认全展开：树数据异步加载，default-expand-all 只认首次渲染会失效；
 * 受控 expandedKeys 只追加新出现的父节点，不覆盖用户手动折叠。
 */
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

/** 面包屑：选中应用显示应用名，选中场景显示「应用 / 场景」 */
const crumbText = computed(() => {
  if (selectedBizType.value) {
    const app = selectedAppCode.value ? appNameOf(selectedAppCode.value) : ''
    return app ? `${app} / ${selectedBizName.value}` : selectedBizName.value
  }
  if (selectedAppCode.value) return appNameOf(selectedAppCode.value)
  return '全部'
})

/** 新增弹窗里的「所属业务类型」下拉；选中应用分组时只列该应用下的场景，避免跨应用建点 */
const bizTypeOptions = computed(() => {
  const inApp =
    selectedAppCode.value && !selectedBizType.value
      ? appGroups.value.find((g) => g.appCode === selectedAppCode.value)?.items.map((i) => i.bizType)
      : null
  return [...bizIndex.value.entries()]
    .filter(([code]) => !inApp || inApp.includes(code))
    .map(([code, v]) => ({
      value: code,
      label: multiApp.value ? `${v.bizName} · ${appNameOf(v.appCode)}` : v.bizName
    }))
})

function parsePoints(scene?: BizScene): BusinessPoint[] {
  if (!scene?.formSchema) return []
  try {
    const arr = JSON.parse(scene.formSchema)
    return Array.isArray(arr) ? (arr as BusinessPoint[]) : []
  } catch {
    return []
  }
}

/** 全量业务点：遍历所有业务场景的 formSchema，打上归属。进来默认不过滤、展示全部。 */
function rebuildPoints() {
  const rows: PointRow[] = []
  for (const s of scenes.value) {
    const info = bizIndex.value.get(s.bizType)
    for (const p of parsePoints(s)) {
      rows.push({
        // 原样保留未知字段（sample 等），只在保存时覆盖 code/name/dataType/remark
        ...p,
        code: p.code,
        name: p.name,
        // 老数据 type=number|text|date|enum，统一折算成 dataType
        dataType: pointType(p) || undefined,
        remark: p.remark || '',
        bizType: s.bizType,
        bizName: info?.bizName || s.bizName || s.bizType,
        appCode: s.appCode || info?.appCode || ''
      })
    }
  }
  points.value = rows
}

/** 选中应用节点时，右侧展示该应用下全部业务类型的业务点 */
const selectedAppBizTypes = computed(() => {
  if (!selectedAppCode.value) return null
  return new Set(
    [...bizIndex.value.entries()]
      .filter(([, v]) => (v.appCode || 'other') === selectedAppCode.value)
      .map(([bizType]) => bizType)
  )
})

const filteredPoints = computed(() => {
  const kw = search.value.trim()
  let list = points.value
  if (selectedBizType.value) list = list.filter((p) => p.bizType === selectedBizType.value)
  else if (selectedAppBizTypes.value) {
    const set = selectedAppBizTypes.value
    list = list.filter((p) => set.has(p.bizType))
  }
  if (kw) list = list.filter((p) => p.name.includes(kw) || p.code.includes(kw) || p.bizName.includes(kw))
  return list.map((p, i) => ({ ...p, __i: i + 1 }))
})

const columns = [
  { title: '序号', key: 'index', width: 64 },
  { title: '业务点名称', dataIndex: 'name', key: 'name' },
  { title: '业务点编码', dataIndex: 'code', key: 'code', width: 180 },
  { title: '数据类型', key: 'dataType', width: 110 },
  { title: '业务类型', key: 'bizType', width: 180 },
  { title: '备注', key: 'remark' },
  { title: '操作', key: 'action', width: 120 }
]

function onSelect(keys: (string | number)[]) {
  // 再次点击已选中节点会取消选中（keys 为空），统一回到根节点 = 全量
  const key = String(keys[0] || 'root')
  selectedKey.value = key
  selectedAppCode.value = ''
  selectedBizType.value = ''
  selectedBizName.value = ''
  search.value = ''
  if (key === 'root') return
  if (key.startsWith('app:')) {
    selectedAppCode.value = key.slice(4)
    return
  }
  if (key.startsWith('biz:')) {
    selectedBizType.value = key.slice(4)
    const info = bizIndex.value.get(selectedBizType.value)
    selectedAppCode.value = info?.appCode || 'other'
    selectedBizName.value = info?.bizName || selectedBizType.value
  }
}

/** 取消筛选，回到根节点全量视图 */
function clearSelect() {
  onSelect(['root'])
}

/**
 * 只写目标业务类型的 formSchema；fieldSchema 是审批详情页字段池（FORM/ENTITY/DERIVED/SYSTEM），
 * 由审批页面配置管理，这里绝不能覆盖。registerScene 会整列 upsert，故原样回传现有值。
 */
async function persist(bizType: string) {
  if (!bizType) return
  const info = bizIndex.value.get(bizType)
  const existing = scenes.value.find((s) => s.bizType === bizType)
  const list = points.value
    .filter((p) => p.bizType === bizType)
    .map((p) => {
      // 丢掉列表用的归属字段与老字段 type；其余（sample 等）原样回写，不做有损覆盖
      const { bizType: _b, bizName: _n, appCode: _a, type: _t, ...rest } = p as PointRow & { type?: string }
      return { ...rest, code: p.code, name: p.name, dataType: p.dataType || '', remark: p.remark || '' }
    })
  const body: BizScene = {
    bizType,
    bizName: info?.bizName || existing?.bizName || bizType,
    appCode: existing?.appCode || info?.appCode || '',
    formSchema: JSON.stringify(list),
    fieldSchema: existing?.fieldSchema || ''
  }
  await registerScene(body)
  scenes.value = await listScenes()
  rebuildPoints()
  await loadRefs()
}

const modalOpen = ref(false)
const saving = ref(false)
const editingCode = ref('')
const editingBizType = ref('')
const form = reactive({ code: '', name: '', remark: '', bizType: '', dataType: '' as BizPointType | '' })

function resetForm() {
  form.code = ''
  form.name = ''
  form.remark = ''
  form.bizType = ''
  form.dataType = ''
}

function openCreate() {
  editingCode.value = ''
  editingBizType.value = ''
  resetForm()
  // 选中应用分组且组内只有一个场景（如内容中心）时直接预选，省掉一次必选下拉
  form.bizType =
    selectedBizType.value || (bizTypeOptions.value.length === 1 ? bizTypeOptions.value[0].value : '')
  modalOpen.value = true
}

function openEdit(record: PointRow) {
  editingCode.value = record.code
  editingBizType.value = record.bizType
  Object.assign(form, {
    code: record.code,
    name: record.name,
    remark: record.remark || '',
    bizType: record.bizType,
    dataType: pointType(record) || ''
  })
  modalOpen.value = true
}

function save() {
  const targetBiz = editingCode.value ? editingBizType.value : form.bizType
  if (!targetBiz) {
    message.warning('请选择所属业务类型')
    return
  }
  if (!form.name.trim()) {
    message.warning('请填写业务点名称')
    return
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(form.code)) {
    message.warning('编码格式：字母/下划线开头，仅含字母数字下划线')
    return
  }
  if (!form.dataType) {
    message.warning('请选择数据类型：分支条件能选的判断符由它决定')
    return
  }
  const dup = points.value.some(
    (p) =>
      p.bizType === targetBiz &&
      p.code === form.code &&
      !(editingCode.value && p.bizType === editingBizType.value && p.code === editingCode.value)
  )
  if (dup) {
    message.warning(`编码 ${form.code} 已存在`)
    return
  }
  const info = bizIndex.value.get(targetBiz)
  const idx = points.value.findIndex(
    (p) => p.bizType === editingBizType.value && p.code === editingCode.value
  )
  const next: PointRow = idx >= 0
    ? {
        ...points.value[idx],
        name: form.name.trim(),
        dataType: form.dataType,
        remark: (form.remark || '').trim()
      }
    : {
        code: form.code,
        name: form.name.trim(),
        dataType: form.dataType,
        remark: (form.remark || '').trim(),
        bizType: targetBiz,
        bizName: info?.bizName || targetBiz,
        appCode: info?.appCode || ''
      }
  if (idx >= 0) points.value[idx] = next
  else points.value.push(next)
  saving.value = true
  persist(targetBiz)
    .then(() => {
      message.success('已保存')
      modalOpen.value = false
    })
    .catch((e) => message.error('保存失败：' + ((e as any)?.message || e)))
    .finally(() => (saving.value = false))
}

function remove(record: PointRow) {
  const hits = refHits(record)
  if (hits.length) {
    message.warning('该业务点已被引用，不能删除：' + hits[0])
    return
  }
  // 后端拒绝时（例如引用信息还没加载回来）要把本地列表恢复，避免出现「界面删了、库里还在」
  const snapshot = points.value.slice()
  points.value = points.value.filter((p) => !(p.bizType === record.bizType && p.code === record.code))
  persist(record.bizType)
    .then(() => message.success('已删除'))
    .catch((e) => {
      points.value = snapshot
      message.error('删除失败：' + ((e as any)?.message || e))
    })
}

onMounted(async () => {
  try {
    const [t, s, a] = await Promise.all([listTemplates(), listScenes(), fetchAppsSafe()])
    templates.value = t
    scenes.value = s
    apps.value = a
    rebuildPoints()
    await loadRefs()
  } catch (e) {
    message.error('加载失败：' + ((e as any)?.message || e))
  }
})

async function fetchAppsSafe(): Promise<AppBrief[]> {
  try {
    const { fetchApps } = await import('@/api/approval')
    return await fetchApps()
  } catch {
    return []
  }
}
</script>

<style scoped>
.bp-root {
  height: 100%;
  background: var(--color-background-primary, #fff);
}
.bp-content {
  padding: 16px;
  overflow: auto;
}
.bp-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.bp-crumb {
  font-weight: 500;
  color: var(--color-text-primary, #333);
}
.bp-clear {
  margin-left: 10px;
  font-size: 12px;
  font-weight: 400;
}
.bp-search {
  width: 220px;
  margin-left: auto;
}
.bp-table {
  background: var(--color-background-primary, #fff);
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--color-text-secondary, #666);
}
/* 「已引用」小标记：不抢列表视觉，但要让人一眼看出为什么删不了 */
.ref-tag {
  margin-left: 6px;
  font-size: 11px;
  line-height: 16px;
  padding: 0 4px;
}
/* disabled 按钮自身不派发鼠标事件，tooltip 挂在外层 span */
.bp-del-disabled {
  display: inline-block;
  cursor: not-allowed;
}
.muted {
  color: var(--color-text-secondary, #888);
}
.small {
  font-size: 12px;
}
</style>
