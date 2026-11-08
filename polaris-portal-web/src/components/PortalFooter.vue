<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">
    <div class="container footer-inner">
      <div class="left">
        <div class="brand-small">内容门户</div>
        <div class="muted">内容由内容中心维护 · 单点登录由统一账号中心提供</div>
      </div>
      <div class="right muted">© {{ year }} 内容门户</div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  border-top: 1px solid var(--line);
  background: var(--bg-soft);
  margin-top: 40px;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28px 24px;
}

.brand-small {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 4px;
}
</style>
