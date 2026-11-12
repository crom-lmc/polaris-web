<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import http from '@/api/http'
import { redirectToSsoLogout } from '@/api/sso'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const collapsed = ref(false)

/** 站点 logo（公开接口，无需管理员权限）；为空时回退为字母块 */
const apiOrigin = (import.meta.env.VITE_API_TARGET as string) || ''
const siteLogo = ref('')

function resolveAssetUrl(rawUrl: string) {
  if (!rawUrl) return ''
  if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith('data:')) return rawUrl
  if (!apiOrigin) return rawUrl
  return new URL(rawUrl, apiOrigin).toString()
}

onMounted(async () => {
  try {
    const data: any = await http.get('/public/settings')
    siteLogo.value = resolveAssetUrl(data?.settings?.site_logo || '')
  } catch {
    /* 拿不到就用默认字母块 */
  }
})

/** 前台访问地址，「查看前台」按钮跳这里（dev 下 define 不生效，统一走 import.meta.env） */
const webOrigin = (import.meta.env.VITE_WEB_ORIGIN as string) || 'http://localhost:5173'

/**
 * 菜单项与权限码的对应关系。
 * <p>
 * 每项有两套码：
 * - `menu`：账号中心「权限管理」里该页面的菜单节点（如 `article`）
 * - `perm`：进入该页面的接口权限（如 `article:list`，与后端 `@Permit` 一致）
 * 只要有其一就显示——这样在角色里勾一个菜单（连带子按钮）即可授予整页访问，
 * 只勾单个按钮（历史数据）也不会让菜单消失。
 * 显隐只是体验，真正的拦截在每个接口的 @Permit 上。
 */
const allMenus = [
  { path: '/dashboard', title: '仪表盘', icon: 'DataLine', menu: 'dashboard', perm: 'stat:view' },
  { path: '/articles', title: '文章管理', icon: 'Document', menu: 'article', perm: 'article:list' },
  { path: '/categories', title: '分类管理', icon: 'Folder', menu: 'category', perm: 'category:list' },
  { path: '/tags', title: '标签管理', icon: 'CollectionTag', menu: 'tag', perm: 'tag:list' },
  { path: '/comments', title: '评论管理', icon: 'ChatDotRound', menu: 'comment', perm: 'comment:list' },
  { path: '/media', title: '媒体库', icon: 'Picture', menu: 'media', perm: 'media:list' },
  { path: '/theme', title: '主题编辑器', icon: 'Brush', menu: 'theme', perm: 'theme:list' },
  { path: '/settings', title: '站点设置', icon: 'Setting', menu: 'setting', perm: 'setting:view' },
  { path: '/logs', title: '操作日志', icon: 'Tickets', menu: 'log', perm: 'log:list' }
]

const menus = computed(() =>
  allMenus.filter((m) => auth.can(m.menu) || auth.can(m.perm))
)

const activeMenu = computed(() => {
  const p = route.path
  // 文章编辑页高亮到文章管理
  if (p.startsWith('/articles')) return '/articles'
  return p
})

const breadcrumb = computed(() =>
  route.matched.filter((r) => r.meta?.title).map((r) => String(r.meta.title))
)

async function logout() {
  try {
    await ElMessageBox.confirm('退出后需要重新登录统一账号中心，确定吗？', '提示', { type: 'warning' })
  } catch {
    return
  }
  await auth.logout()
  redirectToSsoLogout()
}

function onCommand(command: string) {
  if (command === 'logout') logout()
}
</script>

<template>
  <el-container class="admin-layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="admin-aside">
      <div class="brand" :class="{ collapsed }">
        <img v-if="siteLogo" :src="siteLogo" class="brand-logo" alt="logo" />
        <span v-else class="brand-logo brand-fallback">B</span>
        <span v-if="!collapsed" class="brand-text">博客后台</span>
      </div>
      <el-menu :default-active="activeMenu" :collapse="collapsed" router unique-opened>
        <el-menu-item v-for="m in menus" :key="m.path" :index="m.path">
          <el-icon><component :is="m.icon" /></el-icon>
          <template #title>{{ m.title }}</template>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="admin-header">
        <div class="header-left">
          <el-button text :icon="collapsed ? 'Expand' : 'Fold'" @click="collapsed = !collapsed" />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="b in breadcrumb" :key="b">{{ b }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-button text tag="a" :href="webOrigin" target="_blank" rel="noopener">查看前台</el-button>
          <el-dropdown trigger="click" @command="onCommand">
            <span class="user">
              <el-icon><User /></el-icon>
              <span>{{ auth.nickname }}</span>
              <el-tag v-if="auth.isSuperAdmin" size="small" type="danger" class="role-tag">超管</el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="admin-main">
        <RouterView />
      </el-main>
    </el-container>

  </el-container>
</template>

<style scoped>
.admin-layout {
  height: 100%;
}

.admin-aside {
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color-light);
  transition: width 0.2s ease;
  overflow-x: hidden;
}

.brand {
  height: var(--admin-header-height);
  display: flex;
  align-items: center;
  gap: 10px;
  /* 左缩进与 el-menu-item 的 20px 对齐 */
  padding: 0 20px;
  overflow: hidden;
  white-space: nowrap;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

/* 缩回侧栏时只显示 logo，居中 */
.brand.collapsed {
  padding: 0;
  justify-content: center;
}

.brand-logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 6px;
  flex-shrink: 0;
}

/* 无 logo 时的字母块兜底 */
.brand-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 700;
  font-size: 16px;
}

.brand-text {
  font-weight: 700;
  font-size: 15px;
  color: var(--el-color-primary);
}

.admin-header {
  height: var(--admin-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  outline: none;
}

.role-tag {
  margin-left: 4px;
}

.admin-main {
  padding: 0;
  overflow-x: hidden;
}

@media (max-width: 640px) {
  .admin-aside {
    position: fixed;
    z-index: 20;
    height: 100%;
  }
}
</style>
