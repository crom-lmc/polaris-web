<template>
  <div class="fcb">
    <div class="fcb-head">
      <span class="fcb-title">分支条件</span>
      <a class="fcb-toggle" @click="manual = !manual">{{ manual ? '切回可视化' : '手写 SpEL' }}</a>
    </div>

    <div v-if="!points.length" class="fcb-empty">
      当前业务场景<template v-if="bizLabel">「{{ bizLabel }}」</template>还没有配置业务点。
      先到「审批配置 → 业务点配置」给它添加业务点，这里才有可选项。
    </div>

    <template v-if="!manual">
      <div v-for="(r, i) in rows" :key="i" class="fcb-row">
        <div class="fcb-line">
          <a-select v-model:value="r.point" size="small" show-search option-filter-prop="label"
                    :options="pointOptions" placeholder="选择业务点" class="fcb-point"
                    :dropdown-match-select-width="false" :dropdown-style="{ minWidth: '320px' }"
                    @change="(v: any) => onPointChange(r, v)" />
          <a-tag v-if="typeOf(r.point)" :color="typeMetaOf(r.point).color" class="fcb-type">
            {{ typeMetaOf(r.point).label }}
          </a-tag>
          <a class="fcb-del" title="移除条件行" @click="removeRow(i)">×</a>
        </div>
        <div class="fcb-line">
          <a-select v-model:value="r.op" size="small" :options="opOptionsOf(r.point)" class="fcb-op"
                    placeholder="判断符" @change="emitExpr" />
          <a-date-picker v-if="typeOf(r.point) === 'DATE'" v-model:value="r.value" size="small"
                         value-format="YYYY-MM-DD" placeholder="选择日期" class="fcb-val"
                         @change="emitExpr" />
          <a-input v-else v-model:value="r.value" size="small" class="fcb-val"
                   :placeholder="hintOf(r.point).placeholder"
                   @change="emitExpr" @press-enter="emitExpr" />
        </div>
        <div v-if="hintOf(r.point).extra" class="fcb-hint">{{ hintOf(r.point).extra }}</div>
        <div v-if="r.point && !pointSet.has(r.point)" class="fcb-bad">
          业务点 {{ r.point }} 不属于当前业务场景，运行时取不到值，请重新选择。
        </div>
        <div v-else-if="r.point && !opAllowed(r)" class="fcb-bad">
          {{ typeMetaOf(r.point).label }}类型不支持「{{ opLabel(r.op) }}」，请改判断符；否则运行时这条条件恒不命中。
        </div>
      </div>
      <div class="fcb-foot">
        <a-button size="small" type="dashed" :disabled="!points.length" @click="addRow">+ 添加条件行</a-button>
        <a-select v-model:value="logic" size="small" class="fcb-logic" @change="emitExpr">
          <a-select-option value="&&">且 and（全部满足）</a-select-option>
          <a-select-option value="||">或 or（满足其一）</a-select-option>
        </a-select>
      </div>
      <div class="fcb-expr" title="生成的 SpEL，服务端用 SimpleEvaluationContext 求值">
        <span class="fcb-label">生成 SpEL</span>
        <code>{{ built || '（未设置条件）' }}</code>
      </div>
      <div class="fcb-note">
        只列出当前业务场景<template v-if="bizLabel">「{{ bizLabel }}」</template>配置的业务点。
        判断符按业务点的数据类型给：数字比大小，字符串可判包含，日期比先后，人员/组织判断是不是，字典只做等于/不等于；
        类型到「审批配置 → 业务点配置」里维护。AND 并行语义下所有命中的分支都会走，全部完成后才汇合。
      </div>
    </template>

    <template v-else>
      <a-input v-model:value="manualText" size="small" placeholder="如 days > 3" @change="onManual" />
      <div class="fcb-note">
        手写模式不做结构校验，保存时由后端编译校验。变量只能用当前业务场景的业务点编码，
        其它变量运行时取不到值，会按「不命中」处理。
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BusinessPoint } from '@/api/approval'
import {
  BIZ_POINT_TYPES,
  operatorMeta,
  operatorsFor,
  pointType,
  valueHint,
  type BizPointType
} from '@/utils/bizpoint'

/**
 * 结构化分支条件构建器：业务点 + 判断符 + 值 + 且/或 → SpEL。
 * 生成的表达式由服务端 ConditionEvaluator（SpEL + SimpleEvaluationContext）求值，
 * 前端只负责拼串，不执行表达式。
 *
 * 判断符<b>不是</b>一张固定列表：业务点配了什么数据类型（数字/字符串/日期/人员/组织/字典），
 * 就只给这一类型合法的判断符。字符串点拿不到「>」，数字点也拿不到「包含」，
 * 从源头上避免「配得出来、跑起来恒不命中」的条件。
 * 业务点池由调用方按「当前模板的业务场景」过滤后传入，这里不再做跨场景聚合。
 */
const props = defineProps<{ modelValue: string; points: BusinessPoint[]; bizLabel?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

interface CondRow { point: string; op: string; value: string }

const pointOptions = computed(() => (props.points || []).map((p) => ({
  value: p.code,
  label: `${p.name}（${p.code}）${typeLabelOf(p) ? ' · ' + typeLabelOf(p) : ''}`
})))
const pointSet = computed(() => new Set((props.points || []).map((p) => p.code)))
const pointMap = computed(() => new Map((props.points || []).map((p) => [p.code, p])))

function typeOf(code: string): BizPointType | '' {
  return pointType(pointMap.value.get(code))
}
function typeLabelOf(p: BusinessPoint): string {
  const t = pointType(p)
  return BIZ_POINT_TYPES.find((x) => x.value === t)?.label || ''
}
function typeMetaOf(code: string) {
  const t = typeOf(code)
  return BIZ_POINT_TYPES.find((x) => x.value === t) || { value: '', label: '未指定类型', color: 'default', hint: '' }
}
function opOptionsOf(code: string) {
  return operatorsFor(typeOf(code)).map((o) => ({ value: o.value, label: o.label }))
}
function opAllowed(r: CondRow): boolean {
  if (!r.op) return true
  return operatorsFor(typeOf(r.point)).some((o) => o.value === r.op)
}
function opLabel(op: string): string {
  return operatorMeta(op)?.label || op
}
function hintOf(code: string) {
  return valueHint(typeOf(code))
}

/** 换业务点时，旧的判断符如果不适用就换成该类型的第一个，别留个非法组合 */
function onPointChange(r: CondRow, v: string) {
  r.point = v
  const opts = operatorsFor(typeOf(v))
  if (opts.length && !opts.some((o) => o.value === r.op)) {
    r.op = opts[0].value
  }
  emitExpr()
}

const rows = ref<CondRow[]>([])
const logic = ref<'&&' | '||'>('&&')
const manual = ref(false)
const manualText = ref('')

/** 符号 → 判断符编码；日期类型走「晚于/早于」，语义更清楚但生成的符号相同 */
function opFromSymbol(sym: string, type: BizPointType | ''): string {
  const isDate = type === 'DATE'
  switch (sym) {
    case '>': return isDate ? 'after' : 'gt'
    case '<': return isDate ? 'before' : 'lt'
    case '>=': return isDate ? 'notBefore' : 'gte'
    case '<=': return isDate ? 'notAfter' : 'lte'
    case '==': return 'eq'
    case '!=': return 'neq'
    default: return 'eq'
  }
}

function unquote(v: string): string {
  const s = v.trim()
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) {
    // SpEL 单引号字面量里用 '' 表示一个单引号
    return s.slice(1, -1).replace(/''/g, "'")
  }
  return s
}

/** 正则里的元字符转义：值里的 . * + 等要按字面比，不能当通配 */
function regexEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** matches 的右操作数还原成用户填的原文：去引号 → 去掉包裹的 .* → 反转义 */
function dematch(raw: string): string {
  const pattern = unquote(raw).replace(/^\.\*/, '').replace(/\.\*$/, '')
  return pattern.replace(/\\(.)/g, '$1')
}

/** 把已有 SpEL 尽量还原成结构化行；解析不了的表达式自动切到手写模式，不丢配置 */
function parse(expr: string) {
  const e = (expr || '').trim()
  if (!e) { rows.value = []; manual.value = false; manualText.value = ''; return }
  const sep = e.includes(' && ') ? ' && ' : e.includes(' || ') ? ' || ' : ''
  logic.value = sep === ' || ' ? '||' : '&&'
  const parts = sep ? e.split(sep) : [e]
  const parsed: CondRow[] = []
  for (const p of parts) {
    const s = p.trim()
    // 字符串包含由 matches 生成：x matches '.*v.*' / !(x matches '.*v.*')
    const nm = s.match(/^!\(\s*([\w.]+)\s+matches\s+(.*?)\s*\)$/)
    if (nm) {
      parsed.push({ point: nm[1], op: 'notContains', value: dematch(nm[2]) })
      continue
    }
    const pm = s.match(/^([\w.]+)\s+matches\s+(.*)$/)
    if (pm) {
      parsed.push({ point: pm[1], op: 'contains', value: dematch(pm[2]) })
      continue
    }
    const m = s.match(/^([\w.]+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/)
    if (!m) { manual.value = true; manualText.value = e; rows.value = []; return }
    const type = pointType(pointMap.value.get(m[1]))
    parsed.push({ point: m[1], op: opFromSymbol(m[2], type), value: unquote(m[3]) })
  }
  rows.value = parsed
  manual.value = false
  manualText.value = e
}

/**
 * SpEL 字符串字面量。
 * 注意不能用反斜杠转义单引号（SpEL 的字面量只认 '' 双写），
 * 反斜杠一律原样保留——字符串包含要用的正则依赖它。
 */
function sl(v: string) {
  return "'" + v.replace(/'/g, "''") + "'"
}

/** 数字点填的是数字就不加引号，其余一律当字符串字面量 */
function literalOf(type: BizPointType | '', v: string) {
  const s = v.trim()
  if (type === 'NUMBER') return /^-?\d+(\.\d+)?$/.test(s) ? s : sl(s)
  if (s === 'true' || s === 'false') return s
  return sl(s)
}

function exprOf(r: CondRow): string {
  const v = r.value.trim()
  // 包含/不包含走 SpEL 内置 matches（正则）：SimpleEvaluationContext 禁方法调用解析，
  // x.contains('v') 在服务端会报 EL1004E；matches 是运算符，不经过方法解析。
  if (r.op === 'contains') return `${r.point} matches ${sl('.*' + regexEscape(v) + '.*')}`
  if (r.op === 'notContains') return `!(${r.point} matches ${sl('.*' + regexEscape(v) + '.*')})`
  const sym = operatorMeta(r.op)?.symbol || '=='
  return `${r.point} ${sym} ${literalOf(typeOf(r.point), v)}`
}

const built = computed(() => rows.value
  .filter((r) => r.point && r.value)
  .map(exprOf)
  .join(` ${logic.value} `))

/** 自己刚 emit 出去的值，回来时不要再解析一遍（会把正在手写的用户切回可视化、也会打断光标） */
let lastEmitted: string | null = null
function emitExpr() {
  const v = manual.value ? manualText.value.trim() : built.value
  manualText.value = v
  lastEmitted = v
  emit('update:modelValue', v)
}

function addRow() {
  rows.value.push({ point: '', op: 'eq', value: '' })
  emitExpr()
}
function removeRow(i: number) {
  rows.value.splice(i, 1)
  emitExpr()
}
function onManual() { emitExpr() }

watch(() => props.modelValue, (v) => {
  if (lastEmitted !== null && v === lastEmitted) return
  parse(v)
  // 切换到一条空条件的分支时先摆一行，别只留个「+ 添加条件行」
  if (!manual.value && !rows.value.length && (props.points || []).length) {
    rows.value.push({ point: '', op: 'eq', value: '' })
  }
}, { immediate: true })
</script>

<style scoped>
.fcb { border: 1px solid var(--panel-border); border-radius: 8px; padding: 10px 12px; }
.fcb-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.fcb-title { font-size: 12px; font-weight: 600; }
.fcb-toggle { font-size: 12px; color: #1677ff; cursor: pointer; }
.fcb-empty {
  margin-bottom: 8px; padding: 8px 10px; border-radius: 6px; font-size: 12px; line-height: 1.6;
  color: #d46b08; background: rgba(250, 173, 20, .12); border: 1px solid rgba(250, 173, 20, .35);
}
.fcb-row {
  border: 1px solid var(--panel-border); border-radius: 8px; padding: 8px; margin-bottom: 8px;
  background: rgba(127, 127, 127, .04);
}
.fcb-line { display: flex; align-items: center; gap: 6px; }
.fcb-line + .fcb-line { margin-top: 6px; }
.fcb-point { flex: 1 1 0%; min-width: 0; }
.fcb-op { width: 120px; flex: none; }
.fcb-val { flex: 1 1 0%; min-width: 0; }
.fcb-type { flex: none; margin: 0; font-size: 11px; line-height: 18px; }
.fcb-hint { margin-top: 6px; font-size: 12px; color: var(--muted); line-height: 1.5; }
.fcb-del { color: #ff4d4f; font-size: 15px; line-height: 1; flex: none; padding: 0 4px; cursor: pointer; }
.fcb-bad { margin-top: 6px; font-size: 12px; color: #ff4d4f; line-height: 1.5; }
.fcb-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
.fcb-logic { width: 190px; }
.fcb-expr {
  margin-top: 10px; padding: 8px 10px; border-radius: 6px;
  background: rgba(127, 127, 127, .07); font-size: 12px;
  display: flex; gap: 8px; align-items: baseline; min-width: 0;
}
.fcb-expr code { flex: 1 1 0%; min-width: 0; word-break: break-all; font-family: var(--mono, monospace); }
.fcb-label { color: var(--muted); white-space: nowrap; }
.fcb-note { margin-top: 8px; font-size: 12px; color: var(--muted); line-height: 1.6; }
</style>
