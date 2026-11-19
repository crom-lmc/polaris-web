<template>
  <div class="app-shell">
    <SiteHeader />
    <main class="page-main">
      <RouterView />
    </main>
    <footer class="site-footer">
      <div class="container footer-inner">
        <div class="footer-brand"><span class="brand-mark small">P</span><b>Polaris Forum</b></div>
        <span class="footer-text">{{ site?.footerText || '分享知识，连接彼此' }}</span>
        <nav class="footer-links" aria-label="站点链接"><RouterLink to="/about">关于</RouterLink><RouterLink to="/about#friend-links">友情链接</RouterLink></nav>
        <span class="footer-meta">真实社区数据 · SSO 统一认证</span>
      </div>
    </footer>

    <Teleport to="body">
      <div v-if="!authReady && getAccessToken()" class="auth-loading">正在恢复统一登录状态…</div>
      <div v-if="loginDialogOpen" class="modal-mask" @click.self="loginDialogOpen = false">
        <section class="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button class="dialog-close" aria-label="关闭" @click="loginDialogOpen = false"><close-outlined /></button>
          <div class="login-symbol"><safety-certificate-outlined /></div>
          <span class="eyebrow">POLARIS SSO</span>
          <h2 id="login-title">登录后继续{{ pendingAction }}</h2>
          <p>使用现有统一账号即可参与讨论，无需重新注册论坛账号。浏览帖子和评论无需登录。</p>
          <button class="primary-button login-submit" @click="redirectToSsoLogin">
            前往统一账号中心登录 <arrow-right-outlined />
          </button>
          <span class="login-note">通过 OAuth2 授权码安全接入论坛</span>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ArrowRightOutlined, CloseOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import SiteHeader from '@/components/SiteHeader.vue'
import { authReady, clearAuth, getAccessToken, loginDialogOpen, pendingAction, redirectToSsoLogin, refreshCurrentUser } from '@/auth'
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
