/**
 * 业务点数据类型与「判断符白名单」。
 *
 * <p>业务点（BusinessPoint）是分支条件的变量池，值来自业务单据的表单快照。
 * 一个业务点是什么类型，决定了它能用哪些判断符：
 * <ul>
 *   <li>数字：大于 / 大于等于 / 小于 / 小于等于 / 等于 / 不等于</li>
 *   <li>字符串：包含 / 不包含 / 等于 / 不等于</li>
 *   <li>日期：晚于 / 早于 / 等于 / 不早于 / 不晚于</li>
 *   <li>人员：是 / 不是</li>
 *   <li>组织：是 / 不是</li>
 *   <li>字典：字典值等于 / 字典值不等于</li>
 * </ul>
 * 老数据（升级前种的 form_schema）用的是 type=number|text|date|enum，这里统一映射过来，
 * 没写类型的历史业务点按「不限」处理，避免把已有条件判成非法。
 */

export type BizPointType = 'NUMBER' | 'STRING' | 'DATE' | 'USER' | 'ORG' | 'DICT'

export interface BizPointTypeMeta {
  value: BizPointType
  label: string
  color: string
  /** 弹窗里的一句话说明，告诉配置人「这个值在单据里长什么样」 */
  hint: string
}

export const BIZ_POINT_TYPES: BizPointTypeMeta[] = [
  { value: 'NUMBER', label: '数字', color: 'blue', hint: '如请假天数、试用期月数、司龄；只支持数值比较' },
  { value: 'STRING', label: '字符串', color: 'default', hint: '如职位、离职原因、手机号；支持包含/不包含' },
  { value: 'DATE', label: '日期', color: 'cyan', hint: '如入职日期、最后工作日；按 yyyy-MM-dd 比较先后' },
  { value: 'USER', label: '人员', color: 'purple', hint: '人员标识（工号或账号ID）；判断「是不是某人」' },
  { value: 'ORG', label: '组织', color: 'geekblue', hint: '组织标识（ID 或名称）；判断「是不是某组织」' },
  { value: 'DICT', label: '字典', color: 'orange', hint: '枚举/字典值，如 annual、是/否；只做等于/不等于' }
]

/** 错误提示里用的类型名 */
export function typeLabel(t?: string): string {
  const hit = BIZ_POINT_TYPES.find((x) => x.value === normalizePointType(t))
  return hit ? hit.label : '未指定类型'
}

/** 老 JSON 的 type 值 → 新 dataType；认不出的原样保留为空（= 不限） */
export function normalizePointType(raw?: string): BizPointType | '' {
  const v = (raw || '').trim().toUpperCase()
  if (!v) return ''
  const alias: Record<string, BizPointType> = {
    NUMBER: 'NUMBER', INT: 'NUMBER', INTEGER: 'NUMBER', DECIMAL: 'NUMBER', NUMERIC: 'NUMBER',
    STRING: 'STRING', TEXT: 'STRING', VARCHAR: 'STRING',
    DATE: 'DATE', DATETIME: 'DATE', TIME: 'DATE',
    USER: 'USER', PERSON: 'USER', EMPLOYEE: 'USER',
    ORG: 'ORG', ORG_NODE: 'ORG', DEPARTMENT: 'ORG',
    DICT: 'DICT', ENUM: 'DICT', BOOL: 'DICT', BOOLEAN: 'DICT'
  }
  return alias[v] || ''
}

/** 业务点对象上取类型：新字段 dataType 优先，其次兼容老字段 type */
export function pointType(p?: { dataType?: string; type?: string } | null): BizPointType | '' {
  if (!p) return ''
  return normalizePointType(p.dataType) || normalizePointType(p.type)
}

export interface CondOperatorMeta {
  value: string
  /** 下拉里展示的文案 */
  label: string
  /** 生成 SpEL 用的符号；contains 类由构建器特殊处理 */
  symbol: string
}

const OPS: Record<string, CondOperatorMeta> = {
  gt: { value: 'gt', label: '大于 >', symbol: '>' },
  gte: { value: 'gte', label: '大于等于 >=', symbol: '>=' },
  lt: { value: 'lt', label: '小于 <', symbol: '<' },
  lte: { value: 'lte', label: '小于等于 <=', symbol: '<=' },
  eq: { value: 'eq', label: '等于 =', symbol: '==' },
  neq: { value: 'neq', label: '不等于 ≠', symbol: '!=' },
  after: { value: 'after', label: '晚于', symbol: '>' },
  before: { value: 'before', label: '早于', symbol: '<' },
  notBefore: { value: 'notBefore', label: '不早于 >=', symbol: '>=' },
  notAfter: { value: 'notAfter', label: '不晚于 <=', symbol: '<=' },
  contains: { value: 'contains', label: '包含', symbol: 'contains' },
  notContains: { value: 'notContains', label: '不包含', symbol: 'notContains' }
}

/** 每种数据类型允许的判断符（顺序即下拉顺序） */
const TYPE_OPS: Record<BizPointType, string[]> = {
  NUMBER: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
  STRING: ['contains', 'notContains', 'eq', 'neq'],
  DATE: ['after', 'before', 'eq', 'notBefore', 'notAfter'],
  USER: ['eq', 'neq'],
  ORG: ['eq', 'neq'],
  DICT: ['eq', 'neq']
}

/** 未指定类型（历史数据）：保留全部判断符，别把存量条件锁死 */
const ANY_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'notContains', 'after', 'before']

export function operatorsFor(type?: string): CondOperatorMeta[] {
  const t = normalizePointType(type)
  const list = t ? TYPE_OPS[t as BizPointType] : ANY_OPS
  return list.map((k) => OPS[k])
}

export function operatorMeta(op: string): CondOperatorMeta | undefined {
  return OPS[op]
}

/** 值输入框的占位/提示，按类型给例子，省得配置人瞎猜 */
export function valueHint(type?: string): { placeholder: string; extra?: string } {
  switch (normalizePointType(type)) {
    case 'NUMBER':
      return { placeholder: '数值，如 3', extra: '只填数字，不要带单位' }
    case 'DATE':
      return { placeholder: '选择日期' }
    case 'USER':
      return { placeholder: '人员工号或账号ID，如 A0001', extra: '与单据里『员工』字段的取值保持一致' }
    case 'ORG':
      return { placeholder: '组织ID或组织名称', extra: '与单据里『所属组织』字段的取值保持一致' }
    case 'DICT':
      return { placeholder: '字典值，如 annual', extra: '填字典编码而不是中文名（如 annual 而非 年假）' }
    case 'STRING':
      return { placeholder: '文本，如 研发部' }
    default:
      return { placeholder: '值，如 3 或 annual' }
  }
}
