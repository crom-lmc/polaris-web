<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ArticleItem } from '@/api/portal'

const props = defineProps<{ article: ArticleItem }>()
const router = useRouter()

function open() {
  router.push(`/article/${props.article.id}`)
}

function fmtDate(s?: string | null) {
  if (!s) return ''
  return s.slice(0, 10)
}

/** 无封面时的柔和占位底色（按分类名稳定取色，深浅色由 CSS 变量切换） */
const COVER_GRADIENTS = [
  'var(--cover-grad-1)',
  'var(--cover-grad-2)',
  'var(--cover-grad-3)',
  'var(--cover-grad-4)',
  'var(--cover-grad-5)'
]

function coverGrad(categoryId?: number | null) {
  const i = Math.abs(categoryId ?? 0) % COVER_GRADIENTS.length
  return COVER_GRADIENTS[i]
}
</script>

<template>
  <div class="card" @click="open">
    <div
      class="cover"
      :style="
        article.cover ? { backgroundImage: `url(${article.cover})` } : { backgroundImage: coverGrad(article.categoryId) }
      "
    >
      <span v-if="!article.cover" class="cover-ph">
        {{ (article.categoryName || '文章').slice(0, 4) }}
      </span>
    </div>
    <div class="body">
      <div class="title clamp-2">{{ article.title }}</div>
      <div class="summary clamp-2">{{ article.summary || '暂无摘要' }}</div>
      <div class="meta">
        <span v-if="article.categoryName" class="cat">{{ article.categoryName }}</span>
        <span class="dot" v-if="article.categoryName">·</span>
        <span>{{ fmtDate(article.publishedAt) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  gap: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg-card);
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s;
}

.card:hover {
  border-color: var(--line-hover);
  transform: translateY(-1px);
}

.cover {
  width: 108px;
  height: 80px;
  flex: 0 0 auto;
  border-radius: 8px;
  background-color: var(--bg-mute);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-ph {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
  letter-spacing: 1px;
}

.body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.title {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
}

.summary {
  font-size: 13px;
  color: var(--text-2);
  margin-top: 6px;
  flex: 1;
}

.meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.cat {
  color: var(--accent);
}
</style>
