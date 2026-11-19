<template>
  <div class="app-shell">
    <SiteHeader />
    <main class="page-main">
      <RouterView />
    </main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand"><img class="brand-mark small" src="/favicon.svg" alt="" aria-hidden="true" /><b>Polaris Forum</b></div>
        <span class="footer-text">{{ site?.footerText || '分享知识，连接彼此' }}</span>
        <nav class="footer-links" aria-label="站点链接"><RouterLink to="/about">关于</RouterLink><RouterLink to="/about#friend-links">友情链接</RouterLink></nav>
        <span class="footer-meta">真实社区数据 · SSO 统一认证</span>
      </div>
    </footer>

    <Teleport to="body">
      <div v-if="!authReady && getAccessToken()" class="auth-loading">正在恢复统一登录状态…</div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { authReady, clearAuth, getAccessToken, refreshCurrentUser } from '@/auth'
import { loadBoards } from '@/data/forum'
import { fetchSite } from '@/api/forum'
import type { SiteConfig } from '@/types'

const site = ref<SiteConfig | null>(null)

function handleUnauthorized() {
  clearAuth()
  authReady.value = true
}
onMounted(() => {
  loadBoards().catch(() => undefined)
  fetchSite().then(result => { site.value = result }).catch(() => undefined)
  refreshCurrentUser()
  window.addEventListener('forum:unauthorized', handleUnauthorized)
})
onUnmounted(() => window.removeEventListener('forum:unauthorized', handleUnauthorized))
</script>
