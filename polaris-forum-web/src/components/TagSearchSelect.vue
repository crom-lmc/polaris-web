<template>
  <div ref="root" class="tag-select">
    <div class="tag-select-control" :class="{ focus: open }" @click="openInput">
      <span v-for="name in selected" :key="name" class="tag-select-chip">
        {{ name }}
        <close-outlined class="tag-select-chip-close" @click.stop="removeTag(name)" />
      </span>
      <input
        ref="inputEl"
        v-model="keyword"
        class="tag-select-input"
        :maxlength="maxLength"
        :placeholder="selected.length ? '' : placeholder"
        @focus="open = true"
        @keydown.enter.prevent="onEnter"
        @keydown.backspace="onBackspace"
        @keydown.esc="open = false"
      />
      <down-outlined class="tag-select-arrow" :class="{ open }" />
    </div>
    <div v-if="open" class="tag-select-dropdown">
      <div v-if="filteredOptions.length" class="tag-select-options">
        <button
          v-for="name in filteredOptions"
          :key="name"
          type="button"
          class="tag-select-option"
          :class="{ active: activeIndex === filteredOptions.indexOf(name) }"
          @mouseenter="activeIndex = filteredOptions.indexOf(name)"
          @mousedown.prevent="addTag(name)"
        >{{ name }}</button>
      </div>
      <div v-else-if="!canCreate" class="tag-select-empty">无匹配标签，可直接输入后回车新建</div>
      <button
        v-if="canCreate"
        type="button"
        class="tag-select-option tag-select-create"
        :class="{ active: activeIndex === filteredOptions.length }"
        @mouseenter="activeIndex = filteredOptions.length"
        @mousedown.prevent="addTag(normalizedKeyword)"
      ><plus-outlined /> 新建「{{ normalizedKeyword }}」</button>
      <div class="tag-select-hint">最多 {{ max }} 个，每个不超过 {{ maxLength }} 字；可搜索预设标签或自行输入</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CloseOutlined, DownOutlined, PlusOutlined } from '@ant-design/icons-vue'

const props = withDefaults(defineProps<{
  modelValue: string
  options?: string[]
  max?: number
  maxLength?: number
  placeholder?: string
}>(), {
  options: () => [],
  max: 5,
  maxLength: 20,
  placeholder: '搜索或输入标签'
})
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const keyword = ref('')
const open = ref(false)
const activeIndex = ref(0)

const selected = computed(() => [...new Set(props.modelValue.split(/[,，]/).map(item => item.trim().replace(/^#/, '')).filter(Boolean))])
const normalizedKeyword = computed(() => keyword.value.trim().replace(/^#/, ''))
const filteredOptions = computed(() => {
  const query = normalizedKeyword.value.toLowerCase()
  return props.options.filter(name => !selected.value.includes(name) && (!query || name.toLowerCase().includes(query)))
})
// 自定义标签：输入非空、不在预设、未选中、未达上限、长度合规
const canCreate = computed(() => {
  const name = normalizedKeyword.value
  return !!name && !props.options.some(item => item === name) && !selected.value.includes(name)
    && selected.value.length < props.max && name.length <= props.maxLength
})

watch([keyword, open], () => { activeIndex.value = 0 })

function openInput() {
  open.value = true
  inputEl.value?.focus()
}

function addTag(name: string) {
  const clean = name.trim().replace(/^#/, '')
  if (!clean || clean.length > props.maxLength) return
  if (selected.value.includes(clean) || selected.value.length >= props.max) return
  emit('update:modelValue', [...selected.value, clean].join('，'))
  keyword.value = ''
  activeIndex.value = 0
}

function removeTag(name: string) {
  emit('update:modelValue', selected.value.filter(item => item !== name).join('，'))
}

function onEnter() {
  const total = filteredOptions.value.length + (canCreate.value ? 1 : 0)
  if (!total) return
  const index = Math.min(activeIndex.value, total - 1)
  if (index < filteredOptions.value.length) addTag(filteredOptions.value[index])
  else if (canCreate.value) addTag(normalizedKeyword.value)
}

function onBackspace() {
  if (!keyword.value && selected.value.length) removeTag(selected.value[selected.value.length - 1])
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>
