<template>
  <div class="rich-text-editor">
    <div class="editor-toolbar rich-text-toolbar">
      <Toolbar class="rich-text-toolbar-buttons" :editor="editorRef" :default-config="toolbarConfig" mode="default" />
      <button type="button" class="rich-text-clear" :disabled="disabled" @click="clear">清空</button>
    </div>
    <Editor
      v-model="editorHtml"
      class="rich-text-editor-content"
      :default-config="editorConfig"
      mode="default"
      @onCreated="handleCreated"
      @onChange="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import '@wangeditor/editor/dist/css/style.css'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { sanitizeRichText, toEditorHtml } from '@/utils/html'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>(), { placeholder: '', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const editorRef = shallowRef<IDomEditor>()
const editorHtml = ref(toEditorHtml(props.modelValue))
const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: ['header2', 'header3', 'bold', 'italic', 'underline', 'through', 'bulletedList', 'numberedList', 'blockquote', 'undo', 'redo', 'clearStyle']
}
const editorConfig: Partial<IEditorConfig> = {
  placeholder: props.placeholder,
  readOnly: props.disabled
}

watch(() => props.modelValue, value => {
  if (value !== editorHtml.value) editorHtml.value = toEditorHtml(value)
})
watch(() => props.disabled, disabled => {
  const editor = editorRef.value
  if (!editor) return
  if (disabled) editor.disable()
  else editor.enable()
})

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor
  if (props.disabled) editor.disable()
}

function handleChange(editor: IDomEditor) {
  emit('update:modelValue', sanitizeRichText(editor.getHtml()))
}

function clear() {
  editorHtml.value = ''
  editorRef.value?.setHtml('')
  emit('update:modelValue', '')
}

onBeforeUnmount(() => {
  editorRef.value?.destroy()
  editorRef.value = undefined
})
</script>
