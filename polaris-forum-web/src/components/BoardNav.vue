<template>
  <aside class="board-nav panel">
    <div class="panel-heading">社区板块</div>
    <RouterLink to="/" class="board-nav-item" :class="{ active: !activeKey }">
      <span class="board-dot all"></span><span>全部讨论</span><b>{{ total }}</b>
    </RouterLink>
    <RouterLink
      v-for="board in boards"
      :key="board.key"
      :to="`/boards/${board.key}`"
      class="board-nav-item"
      :class="{ active: activeKey === board.key }"
    >
      <span class="board-dot" :style="{ background: board.color }"></span>
      <span>{{ board.name }}</span><b>{{ board.count }}</b>
    </RouterLink>
    <div class="board-nav-footer">公开浏览 · 登录后参与讨论</div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { boards } from '@/data/forum'

defineProps<{ activeKey?: string }>()
const total = computed(() => boards.reduce((sum, item) => sum + item.count, 0))
</script>
