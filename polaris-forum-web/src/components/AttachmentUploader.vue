<template>
  <div class="attachment-uploader">
    <input ref="fileInput" type="file" hidden :accept="accept" @change="selectFile" />
    <button type="button" class="secondary-button upload-button" :disabled="uploading || disabled" @click="fileInput?.click()">
      <upload-outlined />{{ uploading ? '正在上传…' : usageType === 'COVER' ? '上传文章封面' : '上传附件' }}
    </button>
    <span class="upload-hint">{{ usageType === 'COVER' ? '仅图片，最大 10MB' : '图片、PDF、MP4、MP3、ZIP，最大 50MB' }}</span>
    <img v-if="previewUrl" :src="previewUrl" class="draft-cover-preview" alt="文章封面预览" />
    <div v-for="item in modelValue" :key="item.id" class="attachment-edit-row">
      <paper-clip-outlined />
      <span>{{ item.originalName }}</span>
      <small>{{ formatSize(item.size) }}</small>
      <button type="button" aria-label="移除附件" :disabled="disabled" @click="remove(item.id)"><close-outlined /></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { CloseOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { uploadAttachment } from '@/api/forum'
import { download } from '@/api/request'
import type { ForumAttachment } from '@/types'

const props = withDefaults(defineProps<{
  modelValue: ForumAttachment[]
  usageType?: 'ATTACHMENT' | 'COVER'
  disabled?: boolean
}>(), { usageType: 'ATTACHMENT', disabled: false })
const emit = defineEmits<{
  'update:modelValue': [value: ForumAttachment[]]
  error: [message: string]
}>()
const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const previewUrl = ref('')
const accept = computed(() => props.usageType === 'COVER'
  ? '.jpg,.jpeg,.png,.gif,.webp,.bmp,.ico'
  : '.jpg,.jpeg,.png,.gif,.webp,.bmp,.ico,.pdf,.mp4,.mp3,.zip')

watch(() => props.modelValue.map(item => item.id).join(','), async () => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  const cover = props.usageType === 'COVER' ? props.modelValue[0] : undefined
  if (!cover) return
  try {
    previewUrl.value = URL.createObjectURL(await download(cover.url))
  } catch (cause) {
    emit('error', cause instanceof Error ? cause.message : '封面预览失败')
  }
}, { immediate: true })

onBeforeUnmount(() => { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })

async function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > (props.usageType === 'COVER' ? 10 : 50) * 1024 * 1024) {
    emit('error', `文件不能超过 ${props.usageType === 'COVER' ? 10 : 50}MB`)
    return
  }
  uploading.value = true
  emit('error', '')
  try {
    const uploaded = await uploadAttachment(file, props.usageType)
    emit('update:modelValue', props.usageType === 'COVER' ? [uploaded] : [...props.modelValue, uploaded])
  } catch (cause) {
    emit('error', cause instanceof Error ? cause.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

function remove(id: string) {
  emit('update:modelValue', props.modelValue.filter(item => item.id !== id))
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`
  return `${Math.max(1, Math.ceil(size / 1024))}KB`
}
</script>
