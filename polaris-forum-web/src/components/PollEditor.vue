<template>
  <div class="poll-editor">
    <label class="poll-toggle"><input type="checkbox" :checked="Boolean(modelValue)" :disabled="disabled" @change="toggle" /> 添加投票</label>
    <template v-if="modelValue">
      <div class="poll-mode-row">
        <label>投票方式
          <select class="form-control" :value="modelValue.mode" :disabled="disabled" @change="setMode">
            <option value="SINGLE">单选</option>
            <option value="MULTIPLE">多选</option>
          </select>
        </label>
        <label v-if="modelValue.mode === 'MULTIPLE'">最多可选
          <input class="form-control" type="number" min="2" :max="modelValue.options.length" :value="modelValue.maxChoices" :disabled="disabled" @input="setMaxChoices" />
        </label>
      </div>
      <div v-for="(_, index) in modelValue.options" :key="index" class="poll-option-edit">
        <input class="form-control" maxlength="100" :value="modelValue.options[index]" :disabled="disabled" :placeholder="`选项 ${index + 1}`" @input="setOption(index, $event)" />
        <button type="button" aria-label="删除选项" :disabled="disabled || modelValue.options.length <= 2" @click="removeOption(index)"><delete-outlined /></button>
      </div>
      <button type="button" class="small-primary" :disabled="disabled || modelValue.options.length >= 10" @click="addOption"><plus-outlined />添加选项</button>
      <p class="form-hint">支持 2～10 个选项，每个账号只能提交一次，提交后不能改票。</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { PollInput } from '@/types'

const props = defineProps<{ modelValue: PollInput | null; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: PollInput | null] }>()

function update(value: PollInput) {
  emit('update:modelValue', value)
}
function toggle(event: Event) {
  const enabled = (event.target as HTMLInputElement).checked
  emit('update:modelValue', enabled ? { mode: 'SINGLE', maxChoices: 1, options: ['', ''] } : null)
}
function setMode(event: Event) {
  if (!props.modelValue) return
  const mode = (event.target as HTMLSelectElement).value as PollInput['mode']
  update({ ...props.modelValue, mode, maxChoices: mode === 'SINGLE' ? 1 : Math.min(2, props.modelValue.options.length) })
}
function setMaxChoices(event: Event) {
  if (!props.modelValue) return
  update({ ...props.modelValue, maxChoices: Number((event.target as HTMLInputElement).value) })
}
function setOption(index: number, event: Event) {
  if (!props.modelValue) return
  const options = [...props.modelValue.options]
  options[index] = (event.target as HTMLInputElement).value
  update({ ...props.modelValue, options })
}
function addOption() {
  if (!props.modelValue) return
  update({ ...props.modelValue, options: [...props.modelValue.options, ''] })
}
function removeOption(index: number) {
  if (!props.modelValue) return
  const options = props.modelValue.options.filter((_, itemIndex) => itemIndex !== index)
  update({ ...props.modelValue, options, maxChoices: Math.min(props.modelValue.maxChoices, options.length) })
}
</script>
