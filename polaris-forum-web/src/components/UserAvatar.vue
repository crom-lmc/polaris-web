<template>
  <span class="avatar" :class="{ 'avatar-image': showImage }" :style="avatarStyle">
    <img v-if="showImage" :src="avatarUrl" :alt="`${name}的头像`" @error="failed = true" />
    <template v-else>{{ initials || name.slice(0, 1).toUpperCase() }}</template>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  avatarUrl?: string
  initials?: string
  color?: string
  size?: number
}>(), { color: '#5b67f1' })
const failed = ref(false)
const showImage = computed(() => Boolean(props.avatarUrl) && !failed.value)
const avatarStyle = computed(() => ({
  background: showImage.value ? 'transparent' : props.color,
  ...(props.size ? { width: `${props.size}px`, height: `${props.size}px`, flexBasis: `${props.size}px` } : {})
}))
watch(() => props.avatarUrl, () => { failed.value = false })
</script>
