<template>
  <div class="ip-editor">
    <div class="ip-toolbar">
      <span class="ip-hint">每行一条规则：精确 IPv4（如 192.168.1.10）或 CIDR 网段（如 10.0.0.0/8）；* 表示全部，无规则表示不限制</span>
      <a-button v-if="!disabled" size="small" type="dashed" @click="addRow">新增一行</a-button>
    </div>

    <div v-if="rows.length" class="ip-rows">
      <div v-for="(row, index) in rows" :key="row.id" class="ip-row">
        <span class="ip-index">{{ index + 1 }}</span>
        <a-tag :color="kindOf(row.value).color" class="ip-kind">{{ kindOf(row.value).label }}</a-tag>
        <a-input
          :value="row.value"
          :disabled="disabled"
          :placeholder="index === 0 ? '如 192.168.1.10 或 10.0.0.0/8，* 表示不限制' : 'IP 或 CIDR'"
          allow-clear
          @update:value="(value: string) => { row.value = value; emitChange() }"
        />
        <a-button
          v-if="!disabled"
          type="text"
          danger
          size="small"
          class="ip-remove"
          @click="removeRow(index)"
        >
          删除
        </a-button>
      </div>
    </div>
    <div v-else class="ip-empty">未配置白名单（不限制来源 IP）</div>

    <div v-if="error" class="ip-error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

interface Row {
  id: number
  value: string
}

let seq = 0
const rows = ref<Row[]>([])
const error = ref('')

/** 兼容历史配置：逗号/换行分隔均可 */
function parse(value: string): Row[] {
  return (value || '')
    .split(/[\r\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => ({ id: ++seq, value: v }))
}

watch(
  () => props.modelValue,
  (value) => {
    rows.value = parse(value)
    error.value = ''
  },
  { immediate: true }
)

function emitChange() {
  const values = rows.value.map((r) => r.value.trim()).filter(Boolean)
  emit('update:modelValue', values.join('\n'))
}

function addRow() {
  rows.value.push({ id: ++seq, value: '' })
  error.value = ''
}

function removeRow(index: number) {
  rows.value.splice(index, 1)
  error.value = ''
  emitChange()
}

function kindOf(value: string): { label: string; color: string } {
  const v = value.trim()
  if (!v) return { label: '待填写', color: 'default' }
  if (v === '*') return { label: '全部', color: 'gold' }
  if (v.includes('/')) return { label: '网段', color: 'blue' }
  return { label: '指定 IP', color: 'green' }
}

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/
const CIDR = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/

function validIpv4(value: string): boolean {
  if (!IPV4.test(value)) return false
  return value.split('.').every((part) => {
    const n = Number(part)
    return n >= 0 && n <= 255
  })
}

/** 保存前校验，由父组件调用 */
function validate(): boolean {
  for (let i = 0; i < rows.value.length; i++) {
    const v = rows.value[i].value.trim()
    if (!v || v === '*' || validIpv4(v)) continue
    const match = CIDR.exec(v)
    if (match && validIpv4(match[1]) && Number(match[2]) >= 0 && Number(match[2]) <= 32) continue
    error.value = `第 ${i + 1} 行格式不合法：${v}，请填写 IPv4 或 CIDR 网段`
    return false
  }
  error.value = ''
  return true
}

defineExpose({ validate })
</script>

<style scoped>
.ip-editor {
  width: 100%;
}
.ip-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.ip-hint {
  font-size: 12px;
  color: var(--muted);
}
.ip-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ip-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.ip-index {
  width: 20px;
  flex: none;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}
.ip-kind {
  width: 72px;
  flex: none;
  margin: 0;
  text-align: center;
}
.ip-remove {
  flex: none;
}
.ip-empty {
  padding: 12px 0;
  font-size: 12px;
  color: var(--muted);
}
.ip-error {
  margin-top: 8px;
  font-size: 12px;
  color: #ff4d4f;
}
</style>
