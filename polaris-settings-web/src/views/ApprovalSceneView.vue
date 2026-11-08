<template>
  <a-layout class="page-container as-root">
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

    <a-layout-content class="as-content">
      <div class="as-head">
        <span class="as-crumb">
          业务场景 · {{ rightTitle }}
          <a v-if="selectedApp || selectedScene" class="as-clear" @click="clearSelect">查看全部</a>
        </span>
        <a-input-search
          v-model:value="search"
          placeholder="业务类型 / 业务名称"
          allow-clear
          class="as-search"
          @change="() => {}"
        />
        <a-button v-if="store.can('approval:manage')" type="primary" @click="openScene()">注册场景</a-button>
      </div>

      <a-table
        :columns="sceneColumns"
        :data-source="filteredScenes"
        :loading="sceneLoading"
        row-key="bizType"
        size="small"
        :pagination="false"
        class="as-table"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'bizType'">
            <span class="mono">{{ record.bizType }}</span>
          </template>
          <!-- 绑定关系在模板表的 biz_type 上，服务端关联好再下发 -->
          <template v-if="column.key === 'template'">
            <template v-if="record.templateCode">
              <span>{{ record.templateName || record.templateCode }}</span>
              <span class="muted small">
                （{{ record.templateCode }}<template v-if="record.templateVersion">
                  · v{{ record.templateVersion }}</template>）
              </span>
            </template>
            <a-tag v-else color="orange" class="mini-tag">未绑定</a-tag>
          </template>
          <template v-if="column.key === 'enabled'">
            <a-tag v-if="record.enabled === true" color="green">启用</a-tag>
            <a-tag v-else-if="record.enabled === false" color="default">停用</a-tag>
            <a-tooltip v-else title="该场景还没有配置审批模板，业务方发起时会找不到流程">
              <a-tag color="orange">未绑定</a-tag>
            </a-tooltip>
          </template>
          <template v-if="column.key === 'source'">
            <!-- 场景表没有备注字段，这一列显示来源比留空有用：能看出是业务方上报还是人工注册 -->
            {{ record.source === 'MANUAL' ? '手工维护' : '业务注册' }}
          </template>
          <template v-if="column.key === 'binding'">
            <!-- 数据表真绑定：注册场景时配好，改绑定不影响在途单（发起时冻结快照） -->
            <template v-if="bindingOf(record).length">
              <a-tag
                v-for="t in bindingOf(record)"
                :key="t.table"
                :color="modeOfBinding(t) === 'MAIN_ROW' ? 'blue' : 'default'"
                class="mini-tag"
              >
                {{ t.label || t.table }}{{ modeSuffix(t) }}
              </a-tag>
            </template>
            <span v-else class="muted small">未绑定</span>
          </template>
          <template v-if="column.key === 'action'">
            <a @click="openScene(record)">编辑</a>
          </template>
        </template>
      </a-table>

      <a-empty
        v-if="filteredScenes.length === 0 && !sceneLoading"
        :description="selectedScene ? '该业务场景不存在' : (selectedApp ? '该应用下暂无业务场景' : '暂无业务场景')"
      />
    </a-layout-content>

    <!-- ==================== 场景注册 / 编辑弹窗 ==================== -->
    <a-modal
      v-model:open="sceneOpen"
      :title="sceneEditing ? '编辑业务场景' : '注册业务场景'"
      :width="1000"
      :confirm-loading="savingScene"
      ok-text="保存"
      @ok="saveScene"
    >
      <a-form layout="vertical" class="compact">
        <div class="grid-2">
          <a-form-item label="业务类型 bizType" required>
            <a-input v-model:value="sceneForm.bizType" :disabled="sceneEditing" placeholder="如 ehr.regularize" />
          </a-form-item>
          <a-form-item label="业务名称">
            <a-input v-model:value="sceneForm.bizName" placeholder="如 转正申请" />
          </a-form-item>
          <a-form-item label="所属应用">
            <a-select
              v-model:value="sceneForm.appCode"
              placeholder="选择应用"
              :options="appOptions"
              show-search
              option-filter-prop="label"
              @change="onAppChange"
            />
          </a-form-item>
        </div>
        <a-form-item label="数据绑定（真绑定 · 实时业务库）">
          <SceneTableBindingPanel
            :key="bindingKey"
            v-model="sceneBinding"
            :app-code="sceneForm.appCode"
          />
        </a-form-item>
        <a-form-item>
          <template #label>
            <span>绑定说明 <span class="muted small">（只读）</span></span>
          </template>
          <span class="muted small">
            场景与模板是一对一：模板创建时选择业务类型即完成绑定，这里无需手动绑。
            数据绑定只在发起审批时冻结进单据，之后修改这里不影响在途单据。
          </span>
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
  type AppBrief,
  type BizScene,
  type TableBinding,
  fetchApps,
  listScenes,
  registerScene,
  saveTableBindings
} from '@/api/approval'
import SceneTableBindingPanel from '@/components/SceneTableBindingPanel.vue'
import { useThemeStore } from '@/stores/theme'

interface TreeNode {
  key: string
  title: string
  isLeaf?: boolean
  children?: TreeNode[]
}

const sceneLoading = ref(false)
const scenes = ref<BizScene[]>([])
const apps = ref<AppBrief[]>([])
const theme = useThemeStore()

const selectedApp = ref('')
const selectedAppName = ref('')
const selectedScene = ref('')
const search = ref('')

/** 应用下拉（注册弹窗用） */
const appOptions = computed(() => apps.value.map((a) => ({ value: a.code, label: `${a.name}（${a.code}）` })))

/**
 * 三级树：业务类型（固定根）→ 应用 → 业务场景（叶子）。
 * - 根与应用标题显示名称 + 计数（不展示业务类型编码），保持克制风格；
 * - 应用以「已启用应用」为基准，并兜底 scenes 里出现的应用，避免漏显示；
 * - 叶子是具体业务场景。
 */
const treeData = computed<TreeNode[]>(() => {
  const known = new Map<string, string>() // code -> name
  for (const a of apps.value) known.set(a.code, a.name)
  for (const s of scenes.value) if (s.appCode && !known.has(s.appCode)) known.set(s.appCode, s.appCode)

  const appNodes: TreeNode[] = [...known.entries()].map(([code, name]) => {
    const children = scenes.value
      .filter((s) => s.appCode === code)
      .map<TreeNode>((s) => ({ key: `scene:${s.bizType}`, title: s.bizName || s.bizType, isLeaf: true }))
    children.sort((a, b) => a.title.localeCompare(b.title, 'zh'))
    return { key: `app:${code}`, title: name, count: children.length, children } as TreeNode & { count: number }
  })
  appNodes.sort((a, b) => a.title.localeCompare(b.title, 'zh'))

  return [{ key: 'root', title: '业务类型', children: appNodes }]
})

/* ---------------- 左树统一样式与展开（三个审批菜单共用同一套 class） ---------------- */

/** 层级字重：根 > 应用 > 场景叶子；样式定义在 global.css，三页一致 */
const navTitleClass = (key: string) =>
  key === 'root'
    ? 'approval-nav-title-root'
    : key.startsWith('scene:')
      ? 'approval-nav-title-leaf'
      : 'approval-nav-title-app'

/** 树节点右侧数量（节点数据里带 count；根节点不展示） */
const navCount = (node: any) => (typeof node?.count === 'number' ? node.count : 0)

/**
 * 默认全展开：树数据是异步拉回来的，default-expand-all 只认首次渲染会失效，
 * 改用受控 expandedKeys；数据刷新时只追加新出现的父节点，不覆盖用户手动折叠。
 */
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

/** 当前选中节点对应的 selectedKeys（场景 > 应用 > 根） */
const selectedKey = computed(() => {
  if (selectedScene.value) return `scene:${selectedScene.value}`
  if (selectedApp.value) return `app:${selectedApp.value}`
  return '' // 默认不选中任何节点：右侧展示全部业务场景
})

/** 右侧标题：跟随当前选中（场景名 / 应用名 / 全部） */
const rightTitle = computed(() => {
  if (selectedScene.value) return scenes.value.find((s) => s.bizType === selectedScene.value)?.bizName || selectedScene.value
  if (selectedAppName.value) return selectedAppName.value
  return '全部业务场景'
})

const filteredScenes = computed(() => {
  const kw = search.value.trim().toLowerCase()
  let list = scenes.value
  if (selectedScene.value) list = list.filter((s) => s.bizType === selectedScene.value)
  else if (selectedApp.value) list = list.filter((s) => s.appCode === selectedApp.value)
  if (!kw) return list
  return list.filter((s) => (s.bizType || '').toLowerCase().includes(kw) || (s.bizName || '').toLowerCase().includes(kw))
})

const sceneColumns = [
  { title: '业务类型', key: 'bizType', width: 180 },
  { title: '业务名称', dataIndex: 'bizName', width: 150 },
  { title: '绑定模板', key: 'template', width: 240 },
  { title: '数据绑定', key: 'binding' },
  { title: '状态', key: 'enabled', width: 90 },
  { title: '来源', key: 'source', width: 100 },
  { title: '操作', key: 'action', width: 70 }
]

async function loadScenes() {
  sceneLoading.value = true
  try {
    scenes.value = (await listScenes()) || []
  } catch {
    /* 场景拉不到不挡页面 */
  } finally {
    sceneLoading.value = false
  }
}

async function loadApps() {
  try {
    apps.value = (await fetchApps()) || []
  } catch (e) {
    message.error((e as Error).message || '应用列表加载失败')
  }
}

function onSelect(keys: string[]) {
  const key = keys[0]
  if (!key) return
  if (key.startsWith('scene:')) {
    selectedScene.value = key.slice(6)
    const s = scenes.value.find((x) => x.bizType === selectedScene.value)
    selectedApp.value = s?.appCode || ''
    selectedAppName.value = apps.value.find((a) => a.code === selectedApp.value)?.name || selectedApp.value
  } else if (key.startsWith('app:')) {
    selectedApp.value = key.slice(4)
    selectedAppName.value = apps.value.find((a) => a.code === selectedApp.value)?.name || selectedApp.value
    selectedScene.value = ''
  } else {
    // 根节点：全部业务场景
    selectedApp.value = ''
    selectedAppName.value = ''
    selectedScene.value = ''
  }
  search.value = ''
}

/* ---------------- 场景 ---------------- */

const sceneOpen = ref(false)
const savingScene = ref(false)
const sceneForm = reactive({ bizType: '', bizName: '', appCode: '' })
/** 编辑态：保存时保留只读字段（permHint 等），避免被 registerScene 覆盖成空 */
const sceneEditing = ref(false)
const editSnapshot = ref<BizScene | null>(null)
/** 数据绑定编辑值：注册/编辑时一并提交 */
const sceneBinding = ref<TableBinding | null>(null)
/** 面板重建 key：换应用/换场景时强制重新拉表并回填 */
const bindingKey = ref(0)

/** 场景已保存的数据绑定，用于列表展示 */
type BoundTable = TableBinding['tables'][number]
function modeOfBinding(t: BoundTable) {
  return t.mode || (t.main ? 'MAIN_ROW' : 'FK_LIST')
}
function modeSuffix(t: BoundTable) {
  const m = modeOfBinding(t)
  return m === 'MAIN_ROW' ? '（主体）' : m === 'BIZ_ROW' ? '（本次单据）' : '（子表）'
}

function bindingOf(record: BizScene) {
  if (!record.tableBindings) return [] as TableBinding['tables']
  try {
    const o = JSON.parse(record.tableBindings)
    return (o?.tables || []) as TableBinding['tables']
  } catch {
    return [] as TableBinding['tables']
  }
}

function openScene(record?: BizScene) {
  sceneEditing.value = !!record
  editSnapshot.value = record || null
  Object.assign(sceneForm, {
    bizType: record?.bizType || '',
    bizName: record?.bizName || '',
    appCode: record?.appCode || selectedApp.value
  })
  sceneBinding.value = null
  // 编辑时回填已保存绑定：转成面板需要的结构
  if (record?.tableBindings) {
    try {
      const o = JSON.parse(record.tableBindings)
      if (o && Array.isArray(o.tables)) {
        // 场景级元数据（主体键 / bizId 语义）存在 cfg_biz_scene 列上，不在绑定 JSON 里；
        // 打开编辑时合并进来，面板才能回填，保存时再随绑定一起提交。
        sceneBinding.value = {
          ...(o as TableBinding),
          subjectField: record.subjectField || '',
          bizIdKind: record.bizIdKind || 'SUBJECT'
        }
      }
    } catch {
      /* 坏的绑定 JSON 视作未绑定 */
    }
  }
  bindingKey.value += 1
  sceneOpen.value = true
}

/** 换应用后原绑定表来自旧库，清空重选 */
function onAppChange() {
  sceneBinding.value = null
  bindingKey.value += 1
}

async function saveScene() {
  const bizType = sceneForm.bizType.trim()
  if (!bizType) {
    message.warning('bizType 必填')
    return
  }
  if (!sceneForm.appCode) {
    message.warning('请选择所属应用')
    return
  }
  const bind = sceneBinding.value
  if (bind?.tables?.length) {
    // 定位模式取代旧的 main 布尔值：最多一张 MAIN_ROW，只有 FK_LIST 才必须填外键
    const modeOf = (t: TableBinding['tables'][number]) =>
      t.mode || (t.main ? 'MAIN_ROW' : 'FK_LIST')
    if (bind.tables.filter((t) => modeOf(t) === 'MAIN_ROW').length > 1) {
      message.warning('数据绑定只能有一张主体表（MAIN_ROW）')
      return
    }
    for (const t of bind.tables) {
      if (modeOf(t) === 'FK_LIST' && !t.fk) {
        message.warning(`档案子表「${t.table}」需要填写外键列（如 employee_id）`)
        return
      }
    }
  }
  savingScene.value = true
  try {
    const payload: BizScene = {
      bizType,
      bizName: sceneForm.bizName.trim() || editSnapshot.value?.bizName || bizType,
      appCode: sceneForm.appCode
    }
    // permHint 走覆盖式写入：编辑时把原值带回去，防止被清空
    const hint = editSnapshot.value?.permHint
    if (hint != null) payload.permHint = hint
    await registerScene(payload)
    // 绑定与场景分开存：空 tables 也要提交，表示「该场景不再真绑定」
    if (bind) {
      // appCode 决定去哪个库取数，以当前表单选的应用为准（后端还会再复核一次）
      await saveTableBindings(bizType, { ...bind, appCode: sceneForm.appCode })
    }
    message.success(sceneEditing.value ? '场景已更新' : '场景已注册')
    sceneOpen.value = false
    await loadScenes()
  } catch (e) {
    message.error((e as Error).message)
  } finally {
    savingScene.value = false
  }
}

/** 取消筛选，回到默认的全量视图 */
function clearSelect() {
  selectedApp.value = ''
  selectedAppName.value = ''
  selectedScene.value = ''
  search.value = ''
}

onMounted(async () => {
  // 默认不选中任何节点：右侧展示全部业务场景，点左侧树才逐级过滤
  await Promise.all([loadScenes(), loadApps()])
})
</script>

<style scoped>
.as-root {
  height: 100%;
  background: var(--color-background-primary, #fff);
}
.as-content {
  padding: 16px;
  overflow: auto;
}
.as-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.as-crumb {
  font-weight: 500;
  color: var(--color-text-primary, #333);
}
.as-clear {
  margin-left: 10px;
  font-size: 12px;
  font-weight: 400;
}
.as-search {
  width: 220px;
  margin-left: auto;
}
.as-table {
  background: var(--color-background-primary, #fff);
}
.muted {
  color: var(--color-text-secondary, #888);
}
.small {
  font-size: 12px;
}
.mini-tag {
  transform: scale(0.92);
  transform-origin: left center;
}
.mono {
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 12px;
}
.compact :deep(.ant-form-item) {
  margin-bottom: 10px;
}
.compact :deep(.ant-form-item-label) {
  padding-bottom: 2px;
}
.compact :deep(.ant-form-item-label > label) {
  font-size: 12px;
  color: var(--muted);
}
</style>
