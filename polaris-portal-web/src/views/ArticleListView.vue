<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import ArticleCard from '@/components/ArticleCard.vue'
import { pageArticles, type ArticleItem, type ArticleQuery } from '@/api/portal'

const route = useRoute()
const list = ref<ArticleItem[]>([])
const total = ref(0)
const page = ref(1)
const size = 10
const loading = ref(true)

const title = computed(() => (route.query.title as string) || '全部内容')

async function load() {
  loading.value = true
  try {
    const params: ArticleQuery = { page: page.value, size }
    if (route.query.categoryId) params.categoryId = Number(route.query.categoryId)
    if (route.query.tagId) params.tagId = Number(route.query.tagId)
    if (route.query.keyword) params.keyword = String(route.query.keyword)
    const d = await pageArticles(params)
    list.value = d.list || []
    total.value = d.total || 0
  } catch {
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(
  () => route.query,
  () => {
    page.value = 1
    load()
  }
)

function onPage(p: number, _s: number) {
  page.value = p
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div>
    <PortalHeader />
    <main class="portal-main">
      <div class="container">
        <div class="section-title">
          <h2>{{ title }}</h2>
          <span class="muted">共 {{ total }} 篇</span>
        </div>
        <a-spin :spinning="loading">
          <div class="grid">
            <ArticleCard v-for="a in list" :key="a.id" :article="a" />
          </div>
          <a-empty v-if="!loading && list.length === 0" description="暂无内容" />
          <div class="pager" v-if="total > size">
            <a-pagination
              :current="page"
              :page-size="size"
              :total="total"
              :show-size-changer="false"
              @change="onPage"
            />
          </div>
        </a-spin>
      </div>
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 28px;
}

@media (max-width: 860px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
