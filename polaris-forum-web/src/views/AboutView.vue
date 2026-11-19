<template>
  <div class="container about-page">
    <section class="profile-heading"><div><span class="eyebrow">ABOUT POLARIS</span><h1>关于社区</h1><p>了解 Polaris Forum 与社区友情链接。</p></div></section>
    <div v-if="loading" class="panel page-state">正在加载站点信息…</div>
    <div v-else-if="error" class="panel page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
    <template v-else-if="site">
      <section class="panel about-content-card">
        <div class="member-section-heading"><h2>社区介绍</h2></div>
        <div class="about-plain-text">{{ site.aboutContent || '社区介绍暂未填写。' }}</div>
      </section>
      <section id="friend-links" class="panel friend-links-card">
        <div class="member-section-heading"><h2>友情链接</h2><span>{{ site.friendLinks.length }} 个</span></div>
        <div v-if="site.friendLinks.length" class="friend-link-list">
          <a v-for="link in site.friendLinks" :key="link.id" :href="link.url" target="_blank" rel="noopener noreferrer"><link-outlined /><span>{{ link.name }}</span><small>{{ link.url }}</small><export-outlined /></a>
        </div>
        <div v-else class="compact-state">暂无友情链接</div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ExportOutlined, LinkOutlined } from '@ant-design/icons-vue'
import { fetchSite } from '@/api/forum'
import type { SiteConfig } from '@/types'

const site = ref<SiteConfig | null>(null)
const loading = ref(true)
const error = ref('')

onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try { site.value = await fetchSite() }
  catch (cause) { error.value = cause instanceof Error ? cause.message : '站点信息加载失败' }
  finally { loading.value = false }
}
</script>
