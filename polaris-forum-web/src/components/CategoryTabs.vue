<template>
  <nav class="category-tabs" aria-label="内容分类">
    <button type="button" class="category-tab" :class="{ active: !activeBoard }" @click="select('', '')">最新</button>
    <div v-for="board in boards" :key="board.key" class="category-item" @mouseenter="openKey = board.key" @mouseleave="openKey = ''">
      <button
        type="button"
        class="category-tab"
        :class="{ active: activeBoard === board.key }"
        @click="select(board.key, '')"
      >{{ board.name }}<span class="category-caret">▾</span></button>
      <div v-if="board.children?.length && openKey === board.key" class="category-submenu" @mouseenter="openKey = board.key">
        <button
          v-for="child in board.children"
          :key="child.key"
          type="button"
          :class="{ active: activeBoard === board.key && activeTag === child.name }"
          @click="select(board.key, child.name)"
        >{{ child.name }}</button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { fetchBoards } from '@/api/forum'
import type { Board } from '@/types'

const route = useRoute()
const router = useRouter()
const boards = ref<Board[]>([])
const openKey = ref('')
const activeBoard = computed(() => String(route.query.board || ''))
const activeTag = computed(() => String(route.query.q || ''))

onMounted(async () => {
  // 一级分类与二级标签均由后台板块/标签配置维护，这里只负责拉取展示
  try {
    boards.value = await fetchBoards()
  } catch {
    boards.value = []
  }
})

function select(board: string, tag: string) {
  const query = { ...route.query }
  if (board) query.board = board
  else delete query.board
  if (tag) query.q = tag
  else delete query.q
  openKey.value = ''
  router.push({ path: route.path, query })
}
</script>
