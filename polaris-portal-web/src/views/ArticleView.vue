<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import { articleDetail, type ArticleItem } from '@/api/portal'

const route = useRoute()
const router = useRouter()
const article = ref<ArticleItem | null>(null)
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    article.value = await articleDetail(route.params.id as string)
  } catch {
    article.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)

const html = computed(() => {
  const c = article.value?.content || ''
  try {
    return DOMPurify.sanitize(marked.parse(c) as string)
  } catch {
    return DOMPurify.sanitize(c)
  }
})

function fmtDate(s?: string | null) {
  return s ? s.slice(0, 16) : ''
}

function goTag(id: number, name: string) {
  router.push({ path: '/list', query: { tagId: String(id), title: `标签：${name}` } })
}

/** 标签名快照（多个用逗号分隔）；只有主标签能按 tagId 筛选，其余仅展示 */
const tagNames = computed(() =>
  (article.value?.tag || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
)

function clickTag(index: number, name: string) {
  const id = article.value?.tagId
  if (index === 0 && id) {
    goTag(id, name)
  }
}
</script>

<template>
  <div>
    <PortalHeader />
    <main class="portal-main">
      <div class="container narrow">
        <a-spin :spinning="loading">
          <article v-if="article" class="article">
            <a class="back" @click="router.back()">← 返回</a>
            <h1 class="title">{{ article.title }}</h1>
            <div class="meta">
              <span v-if="article.categoryName" class="cat">{{ article.categoryName }}</span>
              <span v-if="article.authorName">{{ article.authorName }}</span>
              <span>{{ fmtDate(article.publishedAt) }}</span>
            </div>
            <div class="cover" v-if="article.cover">
              <img :src="article.cover" :alt="article.title" />
            </div>
            <div class="content markdown-body" v-html="html"></div>
            <div class="tags" v-if="tagNames.length">
              <span
                v-for="(name, i) in tagNames"
                :key="name + i"
                class="chip"
                :class="{ clickable: i === 0 && article.tagId }"
                @click="clickTag(i, name)"
              >
                #{{ name }}
              </span>
            </div>
          </article>
          <a-empty v-else-if="!loading" description="文章不存在或已下线" />
        </a-spin>
      </div>
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
.narrow {
  max-width: 820px;
}

.back {
  display: inline-block;
  font-size: 13px;
  color: var(--text-3);
  cursor: pointer;
  margin-bottom: 12px;
}

.back:hover {
  color: var(--accent);
}

.title {
  font-size: 30px;
  font-weight: 700;
  line-height: 1.35;
  margin: 0 0 14px;
}

.meta {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: var(--text-3);
  padding-bottom: 18px;
  border-bottom: 1px solid var(--line);
  margin-bottom: 22px;
}

.meta .cat {
  color: var(--accent);
}

.cover {
  margin-bottom: 22px;
  border-radius: var(--radius);
  overflow: hidden;
}

.cover img {
  width: 100%;
  display: block;
}

.content {
  font-size: 15px;
  line-height: 1.85;
  color: var(--text-body);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid var(--line);
}

.chip {
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 13px;
  color: var(--accent);
  background: var(--accent-soft);
  cursor: default;
}

.chip.clickable {
  cursor: pointer;
}

/* 正文富文本样式 */
.content :deep(h1),
.content :deep(h2),
.content :deep(h3) {
  font-weight: 600;
  line-height: 1.4;
  margin: 1.4em 0 0.6em;
}

.content :deep(h1) { font-size: 24px; }
.content :deep(h2) { font-size: 20px; }
.content :deep(h3) { font-size: 17px; }

.content :deep(p) {
  margin: 0.8em 0;
}

.content :deep(img) {
  max-width: 100%;
  border-radius: 8px;
}

.content :deep(pre) {
  background: var(--code-bg);
  padding: 14px 16px;
  border-radius: 8px;
  overflow: auto;
  font-size: 13px;
}

.content :deep(code) {
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 13px;
}

.content :deep(blockquote) {
  margin: 1em 0;
  padding: 6px 16px;
  border-left: 3px solid var(--accent);
  color: var(--text-2);
  background: var(--bg-soft);
}

.content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}

.content :deep(th),
.content :deep(td) {
  border: 1px solid var(--line);
  padding: 8px 12px;
  text-align: left;
}

.content :deep(a) {
  color: var(--accent);
}
</style>
