<template>
  <div class="app-shell">
    <SiteHeader v-if="!isCallback" />
    <main class="page-main">
      <RouterView />
    </main>
    <footer v-if="!isCallback" class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand"><img class="brand-mark small" src="/favicon.svg" alt="" aria-hidden="true" /><b>Polaris</b></div>
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
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import SiteHeader from '@/components/SiteHeader.vue'
import { authReady, clearAuth, getAccessToken, refreshCurrentUser } from '@/auth'
import { loadBoards } from '@/data/forum'
import { loadFeatureSwitch } from '@/composables/useFeatureSwitch'
import { fetchSite } from '@/api/forum'
import { applyAppTitle } from '@/utils/appTitle'
import type { SiteConfig } from '@/types'

const route = useRoute()
// SSO 回调页单独呈现简洁卡片，不套站点导航与页脚
const isCallback = computed(() => route.name === 'auth-callback')
const site = ref<SiteConfig | null>(null)

function handleUnauthorized() {
  clearAuth()
  authReady.value = true
}
onMounted(() => {
  loadBoards().catch(() => undefined)
  void fetchSite().then(result => { site.value = result }).catch(() => undefined)
  void loadFeatureSwitch()
  void applyAppTitle('forum')
  void refreshCurrentUser().then(user => applyAppTitle(user?.appCode || 'forum'))
  window.addEventListener('forum:unauthorized', handleUnauthorized)
})
onUnmounted(() => window.removeEventListener('forum:unauthorized', handleUnauthorized))
</script>
