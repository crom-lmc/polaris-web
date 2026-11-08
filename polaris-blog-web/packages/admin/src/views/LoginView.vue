<template>
  <div class="login-redirect">
    <div class="box">
      <div class="logo">BLOG</div>
      <h1>博客管理后台</h1>
      <p class="hint">正在前往统一账号中心…</p>
      <p class="sub">首次使用需要登录一次，之后在任一应用登录过都无需再输密码</p>
      <el-button type="primary" text @click="go">没有自动跳转？点这里</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { redirectToSsoLogin } from '@/api/sso'

/**
 * 登录页已经不再是「表单」，而是一个跳板：
 * 账号密码、邮箱验证码、失败锁定全部由统一账号中心负责，博客侧不再持有任何凭据。
 */
function go() {
  redirectToSsoLogin()
}

onMounted(go)
</script>

<style scoped>
.login-redirect {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef2ff 0%, #f7f9fc 100%);
}

.box {
  width: 420px;
  padding: 40px 32px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgb(20 25 40 / 8%);
  text-align: center;
}

.logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 18px;
  border-radius: 12px;
  background: #2f54eb;
  color: #fff;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
}

h1 {
  margin: 0 0 8px;
  font-size: 18px;
}

.hint {
  margin: 0;
  color: #374151;
  font-size: 14px;
}

.sub {
  margin: 8px 0 16px;
  color: #9aa1ad;
  font-size: 12px;
  line-height: 1.6;
}
</style>
