<template>
  <div class="rte">
    <div class="toolbar" @mousedown.prevent>
      <button type="button" class="tb" title="加粗" @click="exec('bold')"><b>B</b></button>
      <button type="button" class="tb" title="斜体" @click="exec('italic')"><i>I</i></button>
      <button type="button" class="tb" title="下划线" @click="exec('underline')"><u>U</u></button>
      <span class="sep" />
      <button type="button" class="tb" title="标题" @click="exec('formatBlock', '<h2>')">H2</button>
      <button type="button" class="tb" title="正文" @click="exec('formatBlock', '<p>')">正文</button>
      <span class="sep" />
      <button type="button" class="tb" title="无序列表" @click="exec('insertUnorderedList')">•</button>
      <button type="button" class="tb" title="有序列表" @click="exec('insertOrderedList')">1.</button>
      <span class="sep" />
      <button type="button" class="tb" title="左对齐" @click="exec('justifyLeft')">左</button>
      <button type="button" class="tb" title="居中" @click="exec('justifyCenter')">中</button>
      <button type="button" class="tb" title="右对齐" @click="exec('justifyRight')">右</button>
      <span class="sep" />
      <button type="button" class="tb" title="插入链接" @click="insertLink">链接</button>
      <label class="tb color" title="文字颜色">
        <span class="color-dot" :style="{ background: color }" />
        <input v-model="color" type="color" class="color-input" @input="exec('foreColor', color)" />
      </label>
      <span class="sep" />
      <button type="button" class="tb" title="清除格式" @click="exec('removeFormat')">清除</button>
      <button type="button" class="tb" title="撤销" @click="exec('undo')">撤销</button>
      <button type="button" class="tb" title="重做" @click="exec('redo')">重做</button>
    </div>
    <div
      ref="editorRef"
      class="body"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="emitChange"
      @blur="emitChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

/**
 * 轻量富文本编辑器：contenteditable + execCommand。
 * 不引入第三方编辑器依赖（EHR 前端目前没有编辑器库），只覆盖通知正文需要的常用格式。
 * 输出 HTML 原样落库，展示端用 v-html（内容由内部 HR/运营人员生产）。
 */
const props = withDefaults(
  defineProps<{ modelValue?: string; placeholder?: string }>(),
  { modelValue: '', placeholder: '请输入通知内容' }
)
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const color = ref('#ff4d4f')

onMounted(() => {
  if (editorRef.value) {
    editorRef.value.innerHTML = props.modelValue || ''
  }
})

// 只在外层值与编辑器内容不一致时回写，避免每次输入都重置光标
watch(
  () => props.modelValue,
  (value) => {
    const el = editorRef.value
    if (el && value !== el.innerHTML) {
      el.innerHTML = value || ''
    }
  }
)

function emitChange() {
  const html = editorRef.value?.innerHTML || ''
  emit('update:modelValue', html)
  emit('change', html)
}

function exec(command: string, value?: string) {
  editorRef.value?.focus()
  // execCommand 已标记废弃但浏览器仍普遍支持，这里避免为纯前端引入额外依赖
  document.execCommand(command, false, value)
  emitChange()
}

function insertLink() {
  const url = window.prompt('请输入链接地址（含 http:// 或 https://）')
  if (url) {
    exec('createLink', url)
  }
}
</script>

<style scoped>
.rte {
  border: 1px solid var(--card-border);
  border-radius: 6px;
  overflow: hidden;
  background: var(--card-bg);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--toolbar-bg);
}

.tb {
  min-width: 26px;
  height: 26px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--text-base);
  font-size: 12px;
  line-height: 24px;
  cursor: pointer;
}

.tb:hover {
  background: var(--header-hover);
  border-color: var(--card-border);
}

.sep {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: var(--border-subtle);
}

.color {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--ant-color-border, #d9d9d9);
}

.color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  border: none;
  padding: 0;
}

.body {
  min-height: 220px;
  max-height: 44vh;
  overflow-y: auto;
  padding: 10px 12px;
  outline: none;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-base);
}

.body:empty::before {
  content: attr(data-placeholder);
  color: var(--ant-color-text-placeholder, #bfbfbf);
}

.body :deep(h2) {
  margin: 8px 0 6px;
  font-size: 18px;
  font-weight: 600;
}

.body :deep(p) {
  margin: 0 0 8px;
}

.body :deep(ul),
.body :deep(ol) {
  margin: 0 0 8px;
  padding-left: 22px;
}

.body :deep(a) {
  color: #1677ff;
  text-decoration: underline;
}
</style>
