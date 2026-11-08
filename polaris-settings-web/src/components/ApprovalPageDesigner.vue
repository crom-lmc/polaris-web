<template>
  <div class="apd">
    <a-alert
      class="apd-alert"
      type="info"
      show-icon
      :message="`审批弹窗的信息区由这里决定：字段来源 FORM=提交时冻结的快照 / ENTITY=实时读业务方 / DERIVED=实时算派生值 / SYSTEM=系统字段 / TABLE=实时数据表（表绑定在「业务场景」页注册场景时配置）。点左侧字段池 → 加入中间分组，选中字段后在右侧改属性。`"
    />

    <div class="apd-body">
      <!-- ============ 左：字段池 ============ -->
      <aside class="apd-pool">
        <a-input-search
          v-model:value="poolKeyword"
          size="small"
          placeholder="搜索字段"
          class="apd-pool-search"
        />
        <div class="pool-tools">
          <span class="pool-tools-tip">{{ poolKeyword.trim() ? '搜索时自动展开' : '点击分组标题展开/收起' }}</span>
          <a @click="setAllGroups(true)">展开全部</a>
          <a @click="setAllGroups(false)">收起全部</a>
        </div>
        <!-- 选中画布里的表格块后，左侧 ＋ 变成「加入表格列」 -->
        <div v-if="activeTableField" class="pool-context">
          正在编辑表格「{{ activeTableField.label || activeTableField.key }}」<br />
          点 ＋ 把字段加入该表格的<b>列</b>
          <a class="pool-context-exit" @click="exitTableContext">退出</a>
        </div>
        <div class="apd-pool-scroll">
          <template v-for="grp in groupedPool" :key="grp.id">
            <div
              class="pool-group-title"
              :class="{ 'table-group': grp.source === 'TABLE' }"
              :title="`${isGroupOpen(grp) ? '收起' : '展开'} · 共 ${grp.items.length} 个字段`"
              @click="toggleGroup(grp)"
            >
              <span class="pool-group-caret">{{ isGroupOpen(grp) ? '▾' : '▸' }}</span>
              <span class="pool-group-label">{{ grp.label }}</span>
              <span class="pool-group-count">{{ grp.items.length }}</span>
            </div>
            <template v-if="isGroupOpen(grp)">
              <a-tooltip
                v-for="f in grp.items"
                :key="f.code"
                placement="right"
              >
                <template #title>
                  <div class="tt-name">{{ f.name }}</div>
                  <div class="tt-code mono">{{ f.code }}</div>
                  <div class="tt-hint">
                    {{ activeTableField
                      ? `点击 ＋ 加入「${activeTableField.label || activeTableField.key}」的列`
                      : (isUsed(f.code) ? '已在画布中使用' : '点击 ＋ 加入画布') }}
                  </div>
                </template>
                <div
                  class="pool-item"
                  :class="{ used: activeTableField ? isColumnUsed(f.code) : isUsed(f.code) }"
                  @click="addField(f)"
                >
                  <div class="pool-item-main">
                    <span class="pool-name">{{ fieldDisplayName(f) }}</span>
                  </div>
                  <span class="pool-add">{{ activeTableField ? '＋列' : '＋' }}</span>
                </div>
              </a-tooltip>
            </template>
          </template>

          <div class="pool-group-title static">自定义字段</div>
          <div class="pool-custom">
            <a-input v-model:value="customKey" size="small" placeholder="字段 key（英文）" />
            <a-input v-model:value="customName" size="small" placeholder="显示名" />
            <a-button size="small" block @click="addCustom">加入画布</a-button>
          </div>
        </div>
      </aside>

      <!-- ============ 中：画布 ============ -->
      <main class="apd-canvas" @click.self="selectPage">
        <div v-if="!editModel.sections.length" class="apd-empty">
          还没有分组，点右下「＋ 添加分组」开始编排
        </div>

        <section
          v-for="(sec, si) in editModel.sections"
          :key="si"
          class="apd-section"
          :class="{ active: sel.kind === 'section' && sel.si === si }"
          @click.stop="selectSection(si)"
        >
          <div class="sec-head">
            <a-input
              v-model:value="sec.title"
              size="small"
              placeholder="分组标题（可空）"
              class="sec-title"
            />
            <span class="sec-meta">
              <span class="mini-label">列</span>
              <a-input-number v-model:value="sec.columns" :min="1" :max="3" size="small" />
              <a-checkbox v-model:checked="sec.emphasis">强调</a-checkbox>
              <a-checkbox v-model:checked="sec.collapsible">可折叠</a-checkbox>
              <a class="danger" @click.stop="removeSection(si)">删除分组</a>
            </span>
          </div>
          <div class="sec-fields" :style="{ gridTemplateColumns: `repeat(${sec.columns || 1}, minmax(0, 1fr))` }">
            <template v-for="(f, fi) in sec.fields" :key="fi">
              <!-- 表格控件：占满分组整行，列由用户从左侧字段池点 ＋ 选入 -->
              <div
                v-if="f.format === 'table'"
                class="table-block"
                :class="{ active: sel.kind === 'field' && sel.si === si && sel.fi === fi }"
                @click.stop="selectField(si, fi)"
              >
                <div class="tb-head">
                  <span class="tb-icon">▦</span>
                  <span class="tb-title">表格：{{ f.label || f.key }}</span>
                  <span class="tb-count">{{ (f.tableColumns || []).length }} 列</span>
                  <span class="fc-fmt">table</span>
                  <a class="tb-del danger" @click.stop="removeField(si, fi)">移除</a>
                </div>
                <div v-if="(f.tableColumns || []).length" class="tb-cols">
                  <span
                    v-for="(c, ci) in f.tableColumns"
                    :key="c.key"
                    class="tb-col"
                    :title="c.key"
                  >
                    {{ c.label || c.key }}
                    <a class="tb-col-x" @click.stop="removeTableColumn(f, ci)">×</a>
                  </span>
                </div>
                <div v-else class="tb-empty">还没有列 · 从左侧字段池点 ＋ 把字段加入表格列</div>
                <div class="tb-key mono">{{ f.key }}</div>
              </div>
              <!-- 普通单值字段卡片 -->
              <div
                v-else
                class="field-card"
                :class="{ active: sel.kind === 'field' && sel.si === si && sel.fi === fi }"
                :style="spanStyle(f, sec.columns || 1)"
                @click.stop="selectField(si, fi)"
              >
                <div class="fc-top">
                  <span class="fc-label">{{ f.label || f.key }}</span>
                  <span class="fc-fmt">{{ f.format }}</span>
                </div>
                <div class="fc-key mono">{{ f.key }}</div>
                <a class="fc-del danger" @click.stop="removeField(si, fi)">移除</a>
              </div>
            </template>
            <div class="field-add" @click.stop="selectSection(si)">＋ 点左侧字段池加入</div>
          </div>
        </section>

        <a-button class="add-sec" block @click="addSection">＋ 添加分组</a-button>
        <a-button class="add-sec add-table" block @click="addTable">＋ 添加表格</a-button>
      </main>

      <!-- ============ 右：属性面板 ============ -->
      <aside class="apd-prop">
        <!-- 字段属性 -->
        <template v-if="sel.kind === 'field' && currentField">
          <div class="prop-title">字段属性</div>
          <a-form layout="vertical" class="compact">
            <a-form-item label="显示名 label">
              <a-input v-model:value="currentField.label" placeholder="如 所属组织" />
            </a-form-item>
            <a-form-item label="字段 key">
              <span class="mono prop-key">{{ currentField.key }}</span>
            </a-form-item>
            <a-form-item label="来源 source">
              <a-select v-model:value="currentField.source" size="small">
                <a-select-option value="FORM">FORM · 冻结快照</a-select-option>
                <a-select-option value="ENTITY">ENTITY · 实时业务方</a-select-option>
                <a-select-option value="DERIVED">DERIVED · 派生函数</a-select-option>
                <a-select-option value="SYSTEM">SYSTEM · 系统字段</a-select-option>
                <a-select-option value="TABLE">TABLE · 实时数据表</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item v-if="currentField.source === 'ENTITY' || currentField.source === 'SYSTEM'" label="取值路径 path">
              <a-input v-model:value="currentField.path" placeholder="如 employee.orgPath / instance.applicantName" />
            </a-form-item>
            <a-form-item v-if="currentField.source === 'DERIVED'" label="派生表达式 expr">
              <a-input v-model:value="currentField.expr" placeholder="如 ehr.probationSummary(employee.id)" />
            </a-form-item>
            <a-form-item label="格式 format">
              <a-select v-model:value="currentField.format" size="small">
                <a-select-option v-for="fmt in formatOptions" :key="fmt" :value="fmt">
                  {{ fmt === 'table' ? 'table · 一对多子表（整行表格）' : fmt }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <!-- 表格控件：切换数据源表、编辑已选列（tableColumns 会写进页面配置） -->
            <a-form-item v-if="currentField.format === 'table'" label="数据源表（values 里的行数组）">
              <a-select v-model:value="currentField.key" size="small" @change="onTableSourceChange">
                <a-select-option v-for="t in tableSources" :key="t.name" :value="t.name">
                  {{ t.label }} · {{ t.name }}
                </a-select-option>
              </a-select>
              <div class="prop-muted">按外键反查多行渲染成表格；切换数据源后需重新选列。</div>
            </a-form-item>
            <a-form-item v-if="currentField.format === 'table'" label="表格列（左侧 ＋ 逐列加入）">
              <div class="prop-col-list">
                <div v-for="(c, ci) in (currentField.tableColumns || [])" :key="c.key" class="prop-col-row">
                  <span class="mono prop-col-key" :title="c.key">{{ c.key }}</span>
                  <a-input v-model:value="c.label" size="small" placeholder="列标题" />
                  <a class="danger prop-col-del" @click="removeTableColumn(currentField, ci)">×</a>
                </div>
                <div v-if="!(currentField.tableColumns || []).length" class="prop-muted">
                  还没有列，从左侧字段池点 ＋ 加入
                </div>
              </div>
              <a-button size="small" block @click="addAllTableColumns(currentField)">＋ 添加该表全部列</a-button>
            </a-form-item>
            <a-form-item v-if="currentField.format !== 'table'" label="占宽 span（网格占位 1~3）">
              <a-input-number v-model:value="currentField.span" :min="1" :max="3" size="small" />
            </a-form-item>
            <a-form-item label="显隐条件 visibleWhen">
              <a-input v-model:value="currentField.visibleWhen" placeholder="如 days > 3（空 = 总显示）" />
            </a-form-item>
            <a-form-item label="字段权限 perm">
              <a-input v-model:value="currentField.perm" placeholder="如 ehr:employee:salary（空 = 不限制）" />
            </a-form-item>
            <a-form-item label="空值占位 emptyText">
              <a-input v-model:value="currentField.emptyText" placeholder="默认 —" />
            </a-form-item>
            <a-checkbox v-model:checked="currentField.emphasis">强调显示（浅底加粗）</a-checkbox>
            <a-button class="prop-del" block danger @click="removeField(sel.si!, sel.fi!)">从画布移除</a-button>
          </a-form>
        </template>

        <!-- 分组属性 -->
        <template v-else-if="sel.kind === 'section' && currentSection">
          <div class="prop-title">分组属性</div>
          <a-form layout="vertical" class="compact">
            <a-form-item label="分组标题">
              <a-input v-model:value="currentSection.title" placeholder="如 申请内容" />
            </a-form-item>
            <a-form-item label="列数（1~3）">
              <a-input-number v-model:value="currentSection.columns" :min="1" :max="3" size="small" />
            </a-form-item>
            <a-checkbox v-model:checked="currentSection.emphasis">强调分组</a-checkbox>
            <br />
            <a-checkbox v-model:checked="currentSection.collapsible">默认折叠（次要内容）</a-checkbox>
            <a-button class="prop-del" block danger @click="removeSection(sel.si!)">删除该分组</a-button>
          </a-form>
        </template>

        <!-- 页面级属性 -->
        <template v-else>
          <div class="prop-title">页面属性</div>
          <a-form layout="vertical" class="compact">
            <a-form-item label="弹窗宽度">
              <a-select v-model:value="editModel.width" size="small">
                <a-select-option value="S">S · 640</a-select-option>
                <a-select-option value="M">M · 820</a-select-option>
                <a-select-option value="L">L · 1080</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="标题模板 titleTpl">
              <a-input v-model:value="editModel.titleTpl" placeholder="如 {bizName} · {applicantName}" />
            </a-form-item>
            <a-form-item label="底部提示 tipExpr">
              <a-input v-model:value="editModel.tipExpr" placeholder="按步骤给提示语（空 = 无）" />
            </a-form-item>
            <a-form-item label="审批动作 actions">
              <div class="actions-edit">
                <a-checkbox
                  v-for="a in allActions"
                  :key="a"
                  :checked="editModel.actions.includes(a)"
                  @change="(e: any) => toggleAction(a, e.target.checked)"
                >{{ actionLabel(a) }}</a-checkbox>
              </div>
            </a-form-item>
            <a-alert type="warning" :show-icon="false" class="prop-hint">
              选中画布里的字段或分组，即可在此编辑其属性。
            </a-alert>
          </a-form>
        </template>
      </aside>
    </div>

    <!-- ============ 高级：源码 JSON ============ -->
    <a-collapse v-model:activeKey="rawActive" class="apd-raw">
      <a-collapse-panel key="raw" header="高级 · 源码 JSON（等同旧版文本框，可手改后「应用」）">
        <a-space :size="8" style="margin-bottom: 8px">
          <a-button size="small" @click="formatRaw">格式化</a-button>
          <a-button size="small" type="primary" @click="applyRaw">应用修改</a-button>
          <span v-if="rawErr" class="expr-tip err">{{ rawErr }}</span>
          <span v-else-if="rawOk" class="expr-tip">已应用，JSON 合法</span>
        </a-space>
        <a-textarea v-model:value="rawText" :rows="12" class="mono" @input="onRawInput" />
      </a-collapse-panel>
    </a-collapse>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'

/* ============================ 类型 ============================ */
/**
 * 表格控件的一列。<b>会写进页面配置 JSON</b>——用户选了哪些列属于版式决策，必须持久化。
 * key 是物理列名（渲染时取 row[key]），code 是来源字段池的完整「表名.列名」便于回显。
 */
export interface DesignerTableColumn {
  key: string
  label: string
  code?: string
}
export interface DesignerField {
  key: string
  label?: string
  source?: string
  path?: string
  expr?: string
  format?: string
  span?: number
  emphasis?: boolean
  visibleWhen?: string
  perm?: string
  emptyText?: string
  link?: unknown
  /** format='table' 时：用户从字段池逐列选入的列；空数组=运行时按真实数据推导全部列 */
  tableColumns?: DesignerTableColumn[]
}
export interface DesignerSection {
  key: string
  title?: string
  columns: number
  emphasis?: boolean
  collapsible?: boolean
  fields: DesignerField[]
}
export interface DesignerConfig {
  renderMode?: string
  width?: string
  titleTpl?: string
  tipExpr?: string
  sections: DesignerSection[]
  actions: string[]
}

interface PoolItem {
  code: string
  name: string
  source?: string
  format?: string
  /** TABLE 来源时：所属表名（如 ehr_employee） */
  table?: string
  /** TABLE 来源时：表的中文名（如 人员信息表），来自场景的表绑定 label */
  tableLabel?: string
  /** TABLE 来源时该表的角色：MAIN=主体表（单行）/ SUB=子表（行数组，可作「添加表格」的数据源） */
  tableKind?: 'MAIN' | 'SUB'
}

const props = defineProps<{
  modelValue: string
  fieldPool: PoolItem[]
  bizName?: string
}>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

/* ============================ 解析 / 序列化 ============================ */
const formatOptions = [
  'text', 'date', 'datetime', 'money', 'enum',
  'tag', 'tags', 'progress', 'duration', 'link', 'richText', 'json',
  'table' // 表格控件：画布里占满整行，列由用户从字段池逐列选入
]
const allActions = ['APPROVE', 'REJECT', 'TRANSFER', 'ADD_SIGN', 'VIEW_LOG']
const actionLabel = (a: string) =>
  ({ APPROVE: '通过', REJECT: '驳回', TRANSFER: '转办', ADD_SIGN: '加签', VIEW_LOG: '查看流水' } as Record<string, string>)[a] || a

function defaultConfig(): DesignerConfig {
  return {
    renderMode: 'SECTIONS',
    width: 'M',
    titleTpl: '',
    tipExpr: '',
    sections: [{ key: 'summary', title: '', columns: 3, emphasis: true, fields: [] }],
    actions: ['APPROVE', 'REJECT']
  }
}

function parseModel(raw: string): DesignerConfig {
  if (!raw || !raw.trim()) return defaultConfig()
  try {
    const o = JSON.parse(raw)
    const cfg: DesignerConfig = {
      renderMode: o.renderMode || 'SECTIONS',
      width: o.width || 'M',
      titleTpl: o.titleTpl || '',
      tipExpr: o.tipExpr || '',
      sections: Array.isArray(o.sections) ? o.sections : [],
      actions: Array.isArray(o.actions) ? o.actions : []
    }
    if (!cfg.sections.length) cfg.sections = defaultConfig().sections
    // 规整每个 section / field 的缺省值
    for (const s of cfg.sections) {
      s.columns = s.columns || 3
      s.fields = Array.isArray(s.fields) ? s.fields : []
      for (const f of s.fields) {
        if (!f.format) f.format = 'text'
        if (!f.source) f.source = 'FORM'
        if (f.format === 'table' && !Array.isArray(f.tableColumns)) f.tableColumns = []
      }
    }
    return cfg
  } catch {
    // 解析失败不阻塞：退回默认，原始文本仍可在高级 JSON 里看到
    return defaultConfig()
  }
}

const editModel = reactive<DesignerConfig>(defaultConfig())

/** 同步标志：外部 modelValue 变化（如打开新模板）或本组件反向解析时，避免回环 emit */
const syncing = ref(false)

function commit() {
  if (syncing.value) return
  emit('update:modelValue', JSON.stringify(editModel, null, 2))
}

function loadFromProp() {
  syncing.value = true
  const m = parseModel(props.modelValue)
  Object.assign(editModel, m)
  rawText.value = props.modelValue || JSON.stringify(editModel, null, 2)
  rawDirty.value = false
  syncing.value = false
}

watch(
  () => props.modelValue,
  () => {
    if (!rawDirty.value) loadFromProp()
  }
)
// 任何可视化编辑都触发序列化
watch(editModel, () => commit(), { deep: true })

/* ============================ 选中态 ============================ */
interface Sel {
  kind: 'page' | 'section' | 'field'
  si?: number
  fi?: number
}
/**
 * 必须声明在所有依赖它的 computed / watch 之前：script setup 是顺序执行的，
 * 一旦有 immediate watch 或同步求值的 computed 提前读 sel.value 就会撞 TDZ，
 * 整个设计器挂载失败（表现为「点击页面配置没反应」）。
 */
const sel = ref<Sel>({ kind: 'page' })

/* ============================ 字段池 ============================ */
const poolKeyword = ref('')
const customKey = ref('')
const customName = ref('')

const groupedPool = computed(() => {
  const k = poolKeyword.value.trim().toLowerCase()
  const match = (p: PoolItem) =>
    !k || p.name.toLowerCase().includes(k) || p.code.toLowerCase().includes(k)

  interface Grp {
    id: string
    source: string
    label: string
    items: PoolItem[]
  }
  const groups: Grp[] = []

  // 固定分组（非 TABLE 来源）
  const fixed: { source: string; label: string }[] = [
    { source: 'FORM', label: '表单快照 FORM' },
    { source: 'ENTITY', label: '实体实时 ENTITY' },
    { source: 'DERIVED', label: '派生 DERIVED' },
    { source: 'SYSTEM', label: '系统 SYSTEM' }
  ]
  const fixedMap = new Map<string, Grp>()
  for (const f of fixed) {
    const g: Grp = { id: `src:${f.source}`, source: f.source, label: f.label, items: [] }
    fixedMap.set(f.source, g)
    groups.push(g)
  }

  // TABLE：按「绑定的表」拆成多个子组（顺序按绑定出现顺序），中文名来自场景表绑定的 label
  const tableMap = new Map<string, Grp>()
  for (const p of props.fieldPool || []) {
    const src = (p.source || 'FORM').toUpperCase()
    if (src !== 'TABLE') {
      const g = fixedMap.get(src) || fixedMap.get('FORM')!
      if (match(p)) g.items.push(p)
      continue
    }
    // 表名：优先用显式 table 字段，否则从 code 解析（主表=表名.列名，子表=表名）
    const tname = p.table || (p.code.includes('.') ? p.code.split('.')[0] : p.code)
    const tlabel = p.tableLabel || tname
    let g = tableMap.get(tname)
    if (!g) {
      g = { id: `tbl:${tname}`, source: 'TABLE', label: `${tlabel} · ${tname}`, items: [] }
      tableMap.set(tname, g)
      groups.push(g)
    }
    if (match(p)) g.items.push(p)
  }

  return groups.filter((g) => g.items.length)
})

/* ---------- 字段池分组收起 ----------
 * 逐列展开后一张业务表就有 20+ 列，全平铺会把字段池撑得没法用。
 * 默认只收起 TABLE 分组（字段最多的那批），FORM/ENTITY/DERIVED/SYSTEM 保持展开。
 * 用「显式展开集 + 显式收起集」而不是单个 collapsed 集合：分组随场景/表绑定动态生成，
 * 不必 watch 新分组去补默认值，没被点过的分组自动套用默认规则。纯界面状态，不写进页面配置。 */
const forcedOpenGroups = ref<Set<string>>(new Set())
const forcedClosedGroups = ref<Set<string>>(new Set())

function isGroupOpen(g: { id: string; source: string }): boolean {
  if (forcedOpenGroups.value.has(g.id)) return true
  if (forcedClosedGroups.value.has(g.id)) return false
  // 搜索时把没手动收起过的组都展开，否则命中项被折叠藏起来，看起来像「搜不到」
  const searching = !!poolKeyword.value.trim()
  return searching || g.source !== 'TABLE'
}

function toggleGroup(g: { id: string; source: string }) {
  const open = isGroupOpen(g)
  const o = new Set(forcedOpenGroups.value)
  const c = new Set(forcedClosedGroups.value)
  if (open) {
    o.delete(g.id)
    c.add(g.id)
  } else {
    c.delete(g.id)
    o.add(g.id)
  }
  forcedOpenGroups.value = o
  forcedClosedGroups.value = c
}

/** 一键展开/收起：只作用于当前（搜索过滤后）可见的分组 */
function setAllGroups(open: boolean) {
  const ids = groupedPool.value.map((g) => g.id)
  forcedOpenGroups.value = new Set(open ? ids : [])
  forcedClosedGroups.value = new Set(open ? [] : ids)
}

/** 已被画布使用：既包括作为普通字段加进分组，也包括作为列加进了某个表格控件 */
function isUsed(key: string): boolean {
  const inFields = editModel.sections.some((s) => s.fields.some((f) => f.key === key))
  if (inFields) return true
  const physical = physicalColumnOf(key)
  return editModel.sections.some((s) => s.fields.some(
    (f) => f.format === 'table' && (f.tableColumns || []).some((c) => c.key === physical)
  ))
}

/** 当前激活分组：优先选中分组，否则第一个 */
const activeSectionIdx = computed(() => {
  if (sel.value.kind === 'section') return sel.value.si ?? 0
  if (sel.value.kind === 'field') return sel.value.si ?? 0
  return 0
})

/* ---------------- 表格控件：数据源 / 选列 ---------------- */

/** 可作为表格数据源的表：字段池里 tableKind=SUB 的子表（后端 values[表名] 是行数组） */
const tableSources = computed(() => {
  const seen = new Set<string>()
  const out: { name: string; label: string }[] = []
  for (const p of props.fieldPool || []) {
    if (p.tableKind !== 'SUB') continue
    const name = p.table || (p.code.includes('.') ? p.code.split('.')[0] : p.code)
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push({ name, label: p.tableLabel || name })
  }
  return out
})

function tableLabelOfKey(key: string): string {
  return tableSources.value.find((t) => t.name === key)?.label || ''
}

/** 画布里当前选中的表格块：选中后左侧字段池的 ＋ 变成「加入表格列」 */
const activeTableField = computed(() => {
  if (sel.value.kind !== 'field') return null
  const f = editModel.sections[sel.value.si!]?.fields[sel.value.fi!]
  return f && f.format === 'table' ? f : null
})

/**
 * 进入「选表格列」上下文时，自动展开该表格数据源对应的字段分组，省得先手动找。
 * 不加 immediate：首次选中表格块一定发生在 setup 之后，无需在挂载阶段求值。
 * 历史上这里加过 immediate，而当时 sel 声明在后，setup 阶段求值撞 TDZ，
 * 直接让整个设计器挂载失败（表现为「点击页面配置没反应」）。
 */
watch(
  () => activeTableField.value?.key,
  (key) => {
    if (!key) return
    const id = `tbl:${key}`
    if (!groupedPool.value.some((g) => g.id === id)) return
    const o = new Set(forcedOpenGroups.value)
    const c = new Set(forcedClosedGroups.value)
    c.delete(id)
    o.add(id)
    forcedOpenGroups.value = o
    forcedClosedGroups.value = c
  }
)

/** 退出选列上下文：把选中态退回所在分组 */
function exitTableContext() {
  if (sel.value.kind === 'field') selectSection(sel.value.si ?? 0)
}

/** 字段池 code「表名.列名」→ 物理列名（表格按 row[列名] 取值） */
function physicalColumnOf(code: string): string {
  const dot = code.lastIndexOf('.')
  return dot >= 0 ? code.slice(dot + 1) : code
}

function isColumnUsed(code: string): boolean {
  const f = activeTableField.value
  if (!f) return false
  const key = physicalColumnOf(code)
  return (f.tableColumns || []).some((c) => c.key === key)
}

/** 左侧点 ＋：把该字段作为一列加进当前选中的表格（tableColumns 会写进页面配置） */
function addTableColumn(p: PoolItem) {
  const f = activeTableField.value
  if (!f) return
  const key = physicalColumnOf(p.code)
  f.tableColumns = f.tableColumns || []
  if (f.tableColumns.some((c) => c.key === key)) {
    message.info('该列已在表格中')
    return
  }
  f.tableColumns.push({ key, label: p.name, code: p.code })
}

function removeTableColumn(f: DesignerField, ci: number) {
  f.tableColumns?.splice(ci, 1)
}

/** 一键把当前数据源表在字段池里的全部列加进表格 */
function addAllTableColumns(f: DesignerField) {
  const src = f.key
  const candidates = (props.fieldPool || []).filter((p) => {
    const t = p.table || (p.code.includes('.') ? p.code.split('.')[0] : p.code)
    return (p.source || '').toUpperCase() === 'TABLE' && t === src
  })
  if (!candidates.length) {
    message.warning('字段池里没有该表的列元数据')
    return
  }
  f.tableColumns = f.tableColumns || []
  let added = 0
  for (const p of candidates) {
    const key = physicalColumnOf(p.code)
    if (f.tableColumns.some((c) => c.key === key)) continue
    f.tableColumns.push({ key, label: p.name, code: p.code })
    added++
  }
  message.success(added ? `已加入 ${added} 列` : '列已全部存在')
}

/** 切换数据源表：旧表的列不适用，清空让用户重新选 */
function onTableSourceChange() {
  const f = currentField.value
  if (!f) return
  f.tableColumns = []
  f.label = tableLabelOfKey(f.key) || f.label
}

/** 「＋ 添加表格」：在当前分组追加一个空表格控件，并自动选中，便于紧接着从左侧选列 */
function addTable() {
  const sources = tableSources.value
  if (!sources.length) {
    message.warning('当前场景没有一对多子表，无法添加表格。请先在「业务场景」页配置数据表绑定。')
    return
  }
  let si = activeSectionIdx.value
  if (!editModel.sections[si]) si = editModel.sections.length - 1
  const sec = editModel.sections[si]
  if (!sec) return
  const src = sources[0]
  sec.fields.push({
    key: src.name,
    label: src.label,
    source: 'TABLE',
    format: 'table',
    tableColumns: []
  })
  selectField(si, sec.fields.length - 1)
  message.info(`已添加表格「${src.label}」，从左侧字段池点 ＋ 加入列`)
}

function addField(p: PoolItem) {
  // 选中表格块时，＋ 是把字段加入该表格的列，而不是新增一个表单字段
  if (activeTableField.value) {
    addTableColumn(p)
    return
  }
  const sec = editModel.sections[activeSectionIdx.value] || editModel.sections[0]
  if (!sec) {
    editModel.sections.push({ key: `s${Date.now()}`, title: '', columns: 3, fields: [] })
  }
  const target = editModel.sections[activeSectionIdx.value] || editModel.sections[editModel.sections.length - 1]
  target.fields.push({
    key: p.code,
    label: p.name,
    source: (p.source || 'FORM').toUpperCase(),
    format: p.format || 'text'
  })
}

/** 字段池主显示：表字段 code 形如「表名.列名」→ 只取列名（与截图里 id / parent_id / type 一致） */
function fieldDisplayName(f: PoolItem): string {
  const dot = f.code.lastIndexOf('.')
  return dot >= 0 ? f.code.slice(dot + 1) : f.code
}

function addCustom() {
  const key = (customKey.value || '').trim()
  const name = (customName.value || '').trim() || key
  if (!key) {
    message.warning('请填字段 key')
    return
  }
  const sec = editModel.sections[activeSectionIdx.value] || editModel.sections[0]
  sec.fields.push({ key, label: name, source: 'FORM', format: 'text' })
  customKey.value = ''
  customName.value = ''
}

/* ============================ 画布编辑 ============================ */
const currentSection = computed(() => (sel.value.kind === 'section' ? editModel.sections[sel.value.si!] : null))
const currentField = computed(() =>
  sel.value.kind === 'field' ? editModel.sections[sel.value.si!]?.fields[sel.value.fi!] : null
)

function selectPage() {
  sel.value = { kind: 'page' }
}
function selectSection(si: number) {
  sel.value = { kind: 'section', si }
}
function selectField(si: number, fi: number) {
  sel.value = { kind: 'field', si, fi }
}

function addSection() {
  editModel.sections.push({
    key: `s${Date.now()}`,
    title: '',
    columns: 3,
    emphasis: false,
    fields: []
  })
  selectSection(editModel.sections.length - 1)
}
function removeSection(si: number) {
  editModel.sections.splice(si, 1)
  if (!editModel.sections.length) editModel.sections.push({ key: 'summary', title: '', columns: 3, fields: [] })
  selectPage()
}
function removeField(si: number, fi: number) {
  editModel.sections[si]?.fields.splice(fi, 1)
  selectSection(si)
}

function spanStyle(f: DesignerField, cols: number) {
  const span = Math.min(Math.max(f.span || 1, 1), cols)
  return span > 1 ? { gridColumn: `span ${span}` } : {}
}

function toggleAction(a: string, on: boolean) {
  const i = editModel.actions.indexOf(a)
  if (on && i < 0) editModel.actions.push(a)
  if (!on && i >= 0) editModel.actions.splice(i, 1)
}

/* ============================ 高级 JSON ============================ */
const rawActive = ref<string[]>([])
const rawText = ref('')
const rawDirty = ref(false)
const rawErr = ref('')
const rawOk = ref(false)

function onRawInput() {
  rawDirty.value = true
  rawErr.value = ''
  rawOk.value = false
}
function formatRaw() {
  try {
    rawText.value = JSON.stringify(JSON.parse(rawText.value), null, 2)
    rawErr.value = ''
  } catch (e) {
    rawErr.value = 'JSON 解析失败：' + (e as Error).message
  }
}
function applyRaw() {
  try {
    JSON.parse(rawText.value)
    syncing.value = true
    Object.assign(editModel, parseModel(rawText.value))
    syncing.value = false
    rawDirty.value = false
    rawErr.value = ''
    rawOk.value = true
    commit()
  } catch (e) {
    rawErr.value = 'JSON 解析失败：' + (e as Error).message
    rawOk.value = false
  }
}

// 初始化：从外部 modelValue 加载
loadFromProp()
defineExpose({ loadFromProp })
</script>

<style scoped>
.apd {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.apd-alert {
  margin-bottom: 0;
}

.apd-body {
  display: flex;
  gap: 12px;
  min-height: 460px;
}

/* ---------- 左：字段池 ---------- */
.apd-pool {
  width: 210px;
  flex: 0 0 210px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
}

.apd-pool-search {
  margin-bottom: 8px;
}

.pool-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: -4px 0 6px;
  font-size: 10px;
  color: var(--muted);
}
.pool-tools-tip {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.8;
}
.pool-tools a {
  flex: 0 0 auto;
  color: #7c5cff;
  white-space: nowrap;
}

.apd-pool-scroll {
  flex: 1;
  overflow: auto;
}

/* 分组标题即「收起/展开」开关：TABLE 组动辄 20+ 列，默认折叠 */
.pool-group-title {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 11px;
  color: var(--muted);
  padding: 8px 4px 4px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
}
.pool-group-title:hover {
  background: rgba(127, 127, 127, 0.08);
}
.pool-group-title.static {
  cursor: default;
}
.pool-group-title.static:hover {
  background: none;
}
.pool-group-title.table-group {
  color: #7c5cff;
}
.pool-group-caret {
  flex: 0 0 auto;
  width: 10px;
  font-size: 10px;
  opacity: 0.8;
}
.pool-group-label {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pool-group-count {
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 400;
  padding: 0 4px;
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.14);
  opacity: 0.85;
}

.pool-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid transparent;
}
.pool-item:hover {
  background: rgba(124, 92, 255, 0.08);
  border-color: var(--panel-border);
}
.pool-item.used {
  opacity: 0.55;
}
.pool-item-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.pool-name {
  font-size: 13px;
  font-weight: 500;
}
/* 字段池 hover 浮层：展示完整注释（节点名称/组织简称）+ 完整 code */
.tt-name {
  font-weight: 600;
  margin-bottom: 2px;
}
.tt-code {
  font-size: 11px;
  opacity: 0.85;
}
.tt-hint {
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;
}
.pool-add {
  font-size: 15px;
  font-weight: 600;
  color: #7c5cff;
}

.pool-custom {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 6px;
}

/* ---------- 中：画布 ---------- */
.apd-canvas {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
  background: var(--panel-bg);
}

.apd-empty {
  color: var(--muted);
  font-size: 13px;
  text-align: center;
  padding: 40px 0;
}

.apd-section {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
  background: var(--color-background-primary, #fff);
}
.apd-section.active {
  border-color: #7c5cff;
  box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.15);
}

.sec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.sec-title {
  width: 200px;
}
.sec-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.mini-label {
  font-size: 12px;
  color: var(--muted);
}

.sec-fields {
  display: grid;
  gap: 10px;
}

.field-card {
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  padding: 8px 10px;
  cursor: pointer;
  background: rgba(127, 127, 127, 0.03);
  position: relative;
  min-width: 0;
}
.field-card.active {
  border-color: #7c5cff;
  background: rgba(124, 92, 255, 0.06);
}
.fc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.fc-label {
  font-size: 13px;
  font-weight: 500;
}
.fc-fmt {
  font-size: 11px;
  color: var(--muted);
  background: rgba(127, 127, 127, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.fc-key {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fc-del {
  font-size: 12px;
  display: none;
  position: absolute;
  top: 6px;
  right: 8px;
}
.field-card:hover .fc-del {
  display: inline;
}

.field-add {
  border: 1px dashed var(--panel-border);
  border-radius: 6px;
  padding: 10px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
}
.field-add:hover {
  color: #7c5cff;
  border-color: #7c5cff;
}

.add-sec {
  margin-top: 4px;
}

/* ---------- 右：属性面板 ---------- */
.apd-prop {
  width: 280px;
  flex: 0 0 280px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 12px;
  overflow: auto;
}

.prop-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 10px;
}

.prop-key {
  font-size: 13px;
  color: var(--muted);
}

.prop-del {
  margin-top: 14px;
}

.actions-edit {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prop-hint {
  margin-top: 12px;
  font-size: 12px;
}

/* ---------- 高级 JSON ---------- */
.apd-raw {
  border: 1px solid var(--panel-border);
  border-radius: 8px;
}

.expr-tip {
  font-size: 12px;
  color: #52c41a;
}
.expr-tip.err {
  color: #ff4d4f;
}

/* ---------- 字段池：选中表格块后的「选列」上下文 ---------- */
.pool-context {
  margin-bottom: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(124, 92, 255, 0.35);
  background: rgba(124, 92, 255, 0.08);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
}
.pool-context-exit {
  margin-left: 4px;
  color: #7c5cff;
  white-space: nowrap;
}

/* ---------- 画布：表格控件 ---------- */
.table-block {
  grid-column: 1 / -1; /* 占满分组整行，忽略 span / 列数 */
  border: 1px dashed rgba(124, 92, 255, 0.55);
  border-radius: 6px;
  padding: 9px 10px;
  cursor: pointer;
  background: rgba(124, 92, 255, 0.04);
  position: relative;
  min-width: 0;
}
.table-block.active {
  border-color: #7c5cff;
  background: rgba(124, 92, 255, 0.09);
  box-shadow: 0 0 0 2px rgba(124, 92, 255, 0.15);
}
.tb-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.tb-icon {
  color: #7c5cff;
  font-size: 14px;
}
.tb-title {
  font-size: 13px;
  font-weight: 600;
}
.tb-count {
  font-size: 11px;
  color: #7c5cff;
  background: rgba(124, 92, 255, 0.12);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.tb-del {
  font-size: 12px;
  margin-left: auto;
  display: none;
}
.table-block:hover .tb-del {
  display: inline;
}
.tb-cols {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}
.tb-col {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 18px;
  padding: 0 6px;
  border: 1px solid rgba(124, 92, 255, 0.22);
  background: rgba(124, 92, 255, 0.07);
  border-radius: 3px;
  max-width: 190px;
  white-space: nowrap;
}
.tb-col-x {
  flex: 0 0 auto;
  font-size: 12px;
  color: var(--muted);
}
.tb-col-x:hover {
  color: #ff4d4f;
}
.tb-empty {
  margin-top: 8px;
  font-size: 11px;
  color: var(--muted);
}
.tb-key {
  font-size: 11px;
  color: var(--muted);
  margin-top: 7px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-col-list {
  max-height: 220px;
  overflow: auto;
  margin-bottom: 6px;
}
.prop-col-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
}
.prop-col-key {
  flex: 0 0 88px;
  font-size: 11px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prop-col-row :deep(.ant-input) {
  flex: 1 1 0%;
  min-width: 0;
}
.prop-col-del {
  flex: 0 0 auto;
  font-size: 14px;
}
.prop-muted {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.5;
}

/* 添加表格按钮与「添加分组」上下排列，留出间距便于区分 */
.add-table {
  margin-top: 8px;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.danger {
  color: #ff4d4f;
}
</style>
