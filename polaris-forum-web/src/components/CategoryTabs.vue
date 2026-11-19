<template>
  <nav class="category-tabs" aria-label="内容分类">
    <button type="button" class="category-tab" :class="{ active: !activeTag }" @click="select('')">最新</button>
    <button
      v-for="tag in tags"
      :key="tag.name"
      type="button"
      class="category-tab"
      :class="{ active: activeTag === tag.name }"
      @click="select(tag.name)"
    >{{ tag.name }}</button>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collectAllTags } from '@/data/forum'
import type { ForumTag } from '@/types'

const route = useRoute()
const router = useRouter()
const tags = ref<ForumTag[]>([])
const activeTag = computed(() => String(route.query.q || ''))

onMounted(async () => {
  // 分类项即后台预设标签，名称由后台维护，这里只负责聚合展示
  try {
    tags.value = await collectAllTags()
  } catch {
    tags.value = []
  }
})

function select(name: string) {
  const query = { ...route.query }
  if (name) query.q = name
  else delete query.q
  router.push({ path: route.path, query })
}
</script>
