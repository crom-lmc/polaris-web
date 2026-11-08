<template>
  <div class="stb">
    <div class="stb-bar">
      <span class="muted small">
        从<b>所属应用的业务库</b>勾选要绑定的表，并给每张表指定<b>定位模式</b>：
        「主体表」按主体 ID 取一行；「本次单据」按 <b>id = biz_id</b> 只取这一张单（一对多场景不会串出历史单）；
        「档案子表」按外键列反查多行。绑定后可在「审批页面配置」里逐列加进表单或组装表格。
        绑定只在<b>发起审批时</b>被冻结进单据，之后改这里不影响在途单。
      </span>
      <a-button size="small" :loading="loading" :disabled="!appCode" @click="reload">刷新表清单</a-button>
    </div>

    <a-alert
      v-if="!appCode"
      type="warning"
      :show-icon="false"
      class="stb-tip"
      message="请先选择「所属应用」，数据表清单从该应用的业务库读取。"
    />
    <a-alert
      v-else-if="loadError"
      type="error"
      :show-icon="false"
      class="stb-tip"
      :message="loadError"
    />
    <template v-else>
      <div class="stb-row stb-head">
        <span class="c-bind">绑定</span>
        <span class="c-mode">定位模式</span>
        <span class="c-name">表名</span>
        <span class="c-label">中文名</span>
        <span class="c-pk">主键</span>
        <span class="c-fk">外键列（档案子表必填）</span>
      </div>
      <div v-if="!rows.length && !loading" class="stb-empty muted small">表清单为空，点「刷新表清单」重试。</div>
      <div class="stb-scroll">
        <div v-for="r in rows" :key="r.table" class="stb-row">
          <a-checkbox v-model:checked="r.bind" />
          <a-select
            v-if="r.bind"
            :value="r.mode"
            size="small"
            :options="MODE_OPTIONS"
            @change="(v: TableBindingMode) => setMode(r, v)"
          />
          <span v-else class="muted small">—</span>
          <span class="c-name mono">{{ r.table }}</span>
          <a-input v-model:value="r.label" size="small" placeholder="如 人员基本信息" :disabled="!r.bind" />
          <!-- 直接把这张表的主键列名列出来：勾选绑定即见，不用去别处查。
               子表选外键时也能一眼看出哪个是主键（见 fkOptions 的「主键」标记）。 -->
          <span class="c-pk mono muted small">{{ pkOf(r.table) || '—' }}</span>
          <!-- FOREIGN KEY 只对 FK_LIST 有意义；BIZ_ROW 直接按 id = biz_id 定位本次单据。 -->
          <a-select
            v-if="r.bind && r.mode === 'FK_LIST'"
            v-model:value="r.fk"
            size="small"
            show-search
            allow-clear
            :loading="colLoading[r.table]"
            :options="fkOptions(r)"
            placeholder="选该表里关联主体的列"
          />
          <a-input
            v-else-if="r.bind && r.mode === 'BIZ_ROW'"
            size="small"
            disabled
            placeholder="按单据 ID 定位，无需外键"
          />
          <a-input
            v-else-if="r.bind"
            size="small"
            disabled
            :placeholder="pkOf(r.table) ? '主体主键：' + pkOf(r.table) : '主体表无需外键'"
          />
          <span v-else class="muted small">—</span>
        </div>
      </div>
      <div class="stb-foot">
        <span class="muted small">主体键（formData）：</span>
        <a-input
          v-model:value="subjectKey"
          size="small"
          allow-clear
          style="width: 150px"
          :placeholder="defaultSubjectKey(appCode)"
        />
        <span class="muted small">留空 = 沿用场景默认（{{ defaultSubjectKey(appCode) }}）</span>
        <span class="muted small">bizId 语义：</span>
        <a-select v-model:value="bizIdKind" size="small" style="width: 130px" :options="KIND_OPTIONS" />
        <a-tag color="blue">已绑 {{ boundCount }} 张表</a-tag>
        <span v-if="!boundCount" class="muted small">不勾任何表 = 该场景不做真绑定</span>
      </div>
      <div class="stb-foot stb-hint">
        <span class="muted small">
          「主体键」同时写入场景的 subject_field，供业务列表按主体批量反查审批单；
          SUBJECT = 单据 ID 就是主体 ID，DOC = 单据 ID 是独立申请单 ID（转正/请假/离职/负责人变更等一对多场景选 DOC）。
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { type EntityColumnMeta, type EntityTableMeta, type TableBinding, type TableBindingMode, fetchEntityColumns, fetchEntityTables } from '@/api/approval'

interface BindingRow {
  table: string
  comment?: string | null
  bind: boolean
  /** 定位模式；main 由它推导（MAIN_ROW 才为 true），保存时两者一起提交 */
  mode: TableBindingMode
  label: string
  fk: string
}

/** 与后端 SceneTableBindingsDto 的三个 mode 一一对应 */
const MODE_OPTIONS: { value: TableBindingMode; label: string }[] = [
  { value: 'MAIN_ROW', label: '主体表（按主体 ID 取一行）' },
  { value: 'BIZ_ROW', label: '本次单据（按 biz_id 取一张）' },
  { value: 'FK_LIST', label: '档案子表（按外键取多行）' }
]

const KIND_OPTIONS = [
  { value: 'SUBJECT', label: 'SUBJECT · 主体ID' },
  { value: 'DOC', label: 'DOC · 申请单ID' }
]

const props = defineProps<{
  /** 所属应用（ehr / cms / blog / sso-center / settings 等）：决定去哪个业务库拉表 */
  appCode: string
  /** 当前已保存的绑定（编辑场景时回填） */
  modelValue?: TableBinding | null
}>()

const emit = defineEmits<{ 'update:modelValue': [TableBinding] }>()

/**
 * 各应用的「主体主键」默认键名。表绑定的主表按表单快照里的这个键取一行，
 * 不同业务下单时塞的键不一样（EHR 是 employeeId，内容类多为 articleId，账号类是 id）。
 * <p>
 * 这里只作<b>提示与兜底</b>，不再往输入框里预填——预填会让「到底按哪个键取主表」
 * 看不出来是配置的还是默认值。留空时后端按所属应用兜底同名的键。
 */
const DEFAULT_SUBJECT_KEY: Record<string, string> = {
  ehr: 'employeeId',
  cms: 'articleId',
  blog: 'articleId',
  'sso-center': 'id',
  settings: 'id'
}

function defaultSubjectKey(app: string) {
  return DEFAULT_SUBJECT_KEY[(app || '').toLowerCase()] || 'id'
}

const loading = ref(false)
const loadError = ref('')
const tables = ref<EntityTableMeta[]>([])
const rows = ref<BindingRow[]>([])
/**
 * 主体主键键名：默认留空（不预填）。
 * <p>
 * 已保存的场景若它的 subjectKey 恰好等于该应用的默认值（多半是当初被默认带上的），
 * 也不写进输入框——只当提示。否则「这个键到底是配的还是默认的」在界面上分不出来，
 * 而这正是配错主表取数时最难查的一类问题。
 */
const subjectKey = ref(initialSubjectKey(props.modelValue, props.appCode))
/** 场景级 bizId 语义：新建场景缺省按老口径 SUBJECT，申请单类业务需改成 DOC */
const bizIdKind = ref<'SUBJECT' | 'DOC'>(props.modelValue?.bizIdKind || 'SUBJECT')
const boundCount = computed(() => rows.value.filter((r) => r.bind).length)

/** 存量绑定没有 mode：按旧字段 main / fk 推断，保证打开编辑就能看到真实语义 */
function normalizeMode(t: { main?: boolean; fk?: string | null; mode?: TableBindingMode }): TableBindingMode {
  if (t.mode === 'MAIN_ROW' || t.mode === 'BIZ_ROW' || t.mode === 'FK_LIST') return t.mode
  return t.main ? 'MAIN_ROW' : (t.fk ? 'FK_LIST' : 'BIZ_ROW')
}

/** 取回填值：等于应用默认值的当作「未显式配置」，输入框留空 */
function initialSubjectKey(saved: TableBinding | null | undefined, app: string) {
  // 场景列 subject_field 是主体键的真相源；绑定 JSON 里的 subjectKey 是旧口径的冗余副本
  const v = (saved?.subjectKey || saved?.subjectField || '').trim()
  if (!v) return ''
  return v === defaultSubjectKey(app) ? '' : v
}

/** 每张已绑定表的列元数据：外键列下拉的候选项 */
const columns = ref<Record<string, EntityColumnMeta[]>>({})
/** 按表加载列元数据的 loading 态 */
const colLoading = reactive<Record<string, boolean>>({})

/** 拉某张表的列清单（只拉一次，失败降级成空列表——不影响其它表编辑） */
async function ensureColumns(table: string) {
  if (!table || columns.value[table] || colLoading[table]) return
  colLoading[table] = true
  try {
    columns.value[table] = (await fetchEntityColumns(props.appCode, table)) || []
  } catch {
    columns.value[table] = []
  } finally {
    colLoading[table] = false
  }
}

/**
 * 外键列下拉项：来自该表真实存在的列。
 * 已经存过的值若不在列清单里（表结构改过 / 列被删），照样列出来并标注，
 * 让使用者一眼看到「当前这个键其实取不到数据」，而不是被下拉悄悄吃掉。
 */
function fkOptions(r: BindingRow) {
  const cols = columns.value[r.table] || []
  const opts = cols.map((c) => ({
    value: c.name,
    // 主键列直接标出来：选外键时一眼知道哪列是这张表的主键
    label: c.primaryKey ? `${c.name} · ${c.comment || '主键'}（主键）` : c.comment ? `${c.name} · ${c.comment}` : c.name
  }))
  if (r.fk && !cols.some((c) => c.name === r.fk)) {
    opts.unshift({ value: r.fk, label: `${r.fk}（当前值，不在列清单中）` })
  }
  return opts
}

/** 这张表的主键列名（多主键用逗号拼）。列清单未加载完成时返回空串，加载完即显示。 */
function pkOf(table: string): string {
  const cols = columns.value[table] || []
  const pks = cols.filter((c) => c.primaryKey).map((c) => c.name)
  return pks.join(',')
}

/** 已保存的绑定 + 全量表清单 → 勾选行（已绑定的表即使不在清单里也保留，避免配置丢失） */
function rebuild() {
  const exist = props.modelValue
  const out: BindingRow[] = []
  const seen = new Set<string>()
  // 已绑定的表打头，保证配置不丢（清单里查不到的表也留一行，提示用户确认）
  for (const t of exist?.tables || []) {
    if (seen.has(t.table)) continue // 绑定时同一张表被写过两次：只认第一条
    out.push({
      table: t.table,
      comment: null,
      bind: true,
      mode: normalizeMode(t),
      label: t.label || '',
      fk: t.fk || ''
    })
    seen.add(t.table)
  }
  // 表清单可能因为代理缓存/历史响应出现同名表重复，这里按表名去重后只留第一条，
  // 否则 v-for 的 key（表名）冲突会渲染出多行一模一样的表。
  for (const t of tables.value) {
    if (!t?.table || seen.has(t.table)) continue
    out.push({ table: t.table, comment: t.comment, bind: false, mode: 'FK_LIST', label: t.comment || '', fk: '' })
    seen.add(t.table)
  }
  rows.value = out
}

/** 拉到的清单兜底去重：即使后端/代理返回重复，也不往上冒 */
function dedupeTables(list: EntityTableMeta[]): EntityTableMeta[] {
  const seen = new Set<string>()
  const out: EntityTableMeta[] = []
  for (const t of list || []) {
    if (!t?.table || seen.has(t.table)) continue
    seen.add(t.table)
    out.push(t)
  }
  return out
}

async function load() {
  loadError.value = ''
  if (!props.appCode) {
    tables.value = []
    rows.value = []
    return
  }
  loading.value = true
  try {
    tables.value = dedupeTables((await fetchEntityTables(props.appCode)) || [])
    rebuild()
  } catch (e) {
    tables.value = []
    rebuild()
    // 未开通数据绑定的应用（如纯展示站）后端会给出明确原因，直接展示在面板里，
    // 比弹一次 message 更好——它需要一直可见，直到用户换应用。
    loadError.value = (e as Error).message || '表清单加载失败'
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function reload() {
  load()
}

/**
 * 切换定位模式。MAIN_ROW 相当于旧版的「主表」单选：一个场景只能有一张主体表，
 * 选中后把原来那张降级成档案子表（外键没填时保存会被后端拦下，提示补 fk）。
 */
function setMode(r: BindingRow, mode: TableBindingMode) {
  if (!r.bind) return
  r.mode = mode
  if (mode === 'MAIN_ROW') {
    rows.value.forEach((x) => {
      if (x !== r && x.mode === 'MAIN_ROW') x.mode = 'FK_LIST'
    })
  }
}

watch(
  () => props.appCode,
  (app) => {
    // 换应用：已保存的绑定若本来就属于这个应用就沿用它记的主体键，否则清空。
    // （主体键是「下单时快照里的哪个字段」，换应用后旧键基本都不适用；
    //   也不预填应用默认值——留空表示「按应用默认兜底」，与显式配置区分得开）
    const saved = props.modelValue
    const sameApp = (saved?.appCode || '') === (app || '')
    subjectKey.value = sameApp ? initialSubjectKey(saved, app) : ''
    bizIdKind.value = (sameApp && saved?.bizIdKind) || 'SUBJECT'
    // 列清单来自另一个库，换应用必须清掉，否则会拿旧库的列名去选
    columns.value = {}
    for (const k of Object.keys(colLoading)) delete colLoading[k]
    load()
  },
  { immediate: true }
)

/** 已勾选的表才需要列清单（用来选外键列） */
watch(
  () => rows.value.filter((r) => r.bind).map((r) => r.table),
  (list) => {
    for (const t of list) ensureColumns(t)
  },
  { immediate: true }
)

/** 把当前勾选状态同步给父级：父级保存场景时一并提交 */
function emitBinding() {
  const bound = rows.value.filter((r) => r.bind)
  emit('update:modelValue', {
    // appCode 是路由依据（哪个库），后端还会以场景的 appCode 复核一遍
    appCode: props.appCode || undefined,
    // 留空 = 按所属应用兜底，不在这里偷偷补默认值
    subjectKey: (subjectKey.value || '').trim(),
    // 场景级元数据：主体键同时写进 subject_field（latest-batch 按主体反查用），
    // 留空时后端保留库里原值，避免把已有配置清掉。
    subjectField: (subjectKey.value || '').trim() || undefined,
    bizIdKind: bizIdKind.value,
    tables: bound.map((r) => ({
      table: r.table,
      // a-select 清空后值是 undefined，这里统一成空串；BIZ_ROW 保留 fk 原值不影响运行期
      fk: r.mode === 'MAIN_ROW' ? null : (r.fk || '').trim() || null,
      label: (r.label || '').trim() || null,
      // main 是旧字段，服务端会再按 mode 覆写一次，这里保持同步避免两套口径
      main: r.mode === 'MAIN_ROW',
      mode: r.mode
    }))
  })
}

/** 行内任何改动都同步给父级 */
watch(rows, emitBinding, { deep: true })
watch(subjectKey, emitBinding)
watch(bizIdKind, emitBinding)
</script>

<style scoped>
.stb {
  border: 1px solid var(--color-border, var(--border-color, #e5e7eb));
  border-radius: 8px;
  padding: 10px 12px;
  background: var(--color-background-primary, #fff);
}
.stb-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.stb-bar .small {
  flex: 1 1 auto;
  min-width: 0;
  line-height: 1.5;
}
.stb-tip {
  margin: 0;
}
.stb-row {
  display: grid;
  grid-template-columns: 48px 200px 160px 1fr 100px 190px;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  border-bottom: 1px dashed var(--color-border, #f0f0f0);
}
.stb-head {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  color: var(--color-text-secondary, #888);
  font-size: 12px;
  font-weight: 500;
  padding-bottom: 6px;
}
.stb-scroll {
  max-height: 320px;
  overflow: auto;
}
.stb-empty {
  padding: 12px 0;
}
.stb-foot {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
}
.stb-hint {
  padding-top: 6px;
  line-height: 1.5;
}
.c-bind {
  text-align: center;
}
.c-mode {
  min-width: 0;
}
.c-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}
.c-pk {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.mono {
  font-family: var(--mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
}
.muted {
  color: var(--color-text-secondary, #888);
}
.small {
  font-size: 12px;
}
</style>
