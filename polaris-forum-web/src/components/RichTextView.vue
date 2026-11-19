<template>
  <!-- 仅渲染经过统一白名单清洗的 HTML，历史纯文本会先转义。 -->
  <div class="rich-text-view" v-html="safeHtml"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { richTextDisplayHtml } from '@/utils/html'

const props = defineProps<{ content: string }>()
const safeHtml = computed(() => richTextDisplayHtml(props.content))
</script>
