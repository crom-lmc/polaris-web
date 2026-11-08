<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Modal } from 'ant-design-vue'
import { fetchCategories, gotoAuthorize, type TaxonomyItem } from '@/api/portal'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'

const router = useRouter()
const route = useRoute()
const store = useUserStore()
const theme = useThemeStore()

const categories = ref<TaxonomyItem[]>([])
const kw = ref('')

onMounted(async () => {
  try {
    categories.value = await fetchCategories()
  } catch {
    categories.value = []
  }
})

function goCategory(id: number) {
  router.push({ path: '/list', query: { categoryId: String(id) } })
}

function onSearch() {
  const q = kw.value.trim()
  if (!q) return
  router.push({ path: '/list', query: { keyword: q, title: `搜索：${q}` } })
}

function login() {
  gotoAuthorize(route.fullPath || '/')
}

function onMenu({ key }: { key: string }) {
  if (key === 'logout') {
    Modal.confirm({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      okText: '退出',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        store.logout()
        router.push('/')
      }
    })
  }
}
</script>

<template>
  <header class="header">
    <div class="container header-inner">
      <div class="brand" @click="router.push('/')">内容门户</div>

      <nav class="nav">
        <a class="nav-item" :class="{ active: route.path === '/' }" @click="router.push('/')">首页</a>
        <a
          v-for="c in categories.slice(0, 6)"
          :key="c.id"
          class="nav-item"
          :class="{ active: route.query.categoryId === String(c.id) }"
          @click="goCategory(c.id)"
        >
          {{ c.name }}
        </a>
      </nav>

      <div class="actions">
        <a-input-search
          v-model:value="kw"
          class="search"
          placeholder="搜索文章…"
          @search="onSearch"
        />
        <a-button
          type="text"
          class="theme-toggle"
          :title="theme.mode === 'dark' ? '切换到白天模式' : '切换到黑夜模式'"
          @click="theme.toggle()"
        >
          <svg
            v-if="theme.mode === 'dark'"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
          <svg
            v-else
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="4" />
            <line x1="12" y1="2" x2="12" y2="5" />
            <line x1="12" y1="19" x2="12" y2="22" />
            <line x1="2" y1="12" x2="5" y2="12" />
            <line x1="19" y1="12" x2="22" y2="12" />
            <line x1="4.5" y1="4.5" x2="6.5" y2="6.5" />
            <line x1="17.5" y1="17.5" x2="19.5" y2="19.5" />
            <line x1="4.5" y1="19.5" x2="6.5" y2="17.5" />
            <line x1="17.5" y1="6.5" x2="19.5" y2="4.5" />
          </svg>
        </a-button>
        <template v-if="store.isLoggedIn">
          <a-dropdown :trigger="['hover']">
            <span class="who">{{ store.username }}</span>
            <template #overlay>
              <a-menu @click="onMenu">
                <a-menu-item key="logout">退出登录</a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </template>
        <a-button v-else class="login-btn" @click="login">登录</a-button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--header-bg);
  backdrop-filter: saturate(180%) blur(8px);
  border-bottom: 1px solid var(--line);
}

.header-inner {
  height: 60px;
  display: flex;
  align-items: center;
  gap: 24px;
}

.brand {
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.nav {
  display: flex;
  gap: 4px;
  flex: 1;
  overflow: hidden;
}

.nav-item {
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-2);
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.nav-item:hover {
  background: var(--bg-soft);
  color: var(--text);
}

.nav-item.active {
  color: var(--accent);
  background: var(--accent-soft);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.search {
  width: 200px;
}

.who {
  font-size: 14px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--text-2);
}

.who:hover {
  background: var(--bg-soft);
}

.login-btn {
  border-color: var(--accent);
  color: var(--accent);
}

.theme-toggle {
  color: var(--text-2);
  flex-shrink: 0;
}

.theme-toggle:hover {
  color: var(--text);
  background: var(--bg-soft);
}

/* 窄屏（含后台手机档预览）：收起分类导航，搜索框让位 */
@media (max-width: 860px) {
  .header-inner {
    gap: 12px;
  }

  .nav {
    display: none;
  }

  .actions {
    margin-left: auto;
  }

  .search {
    width: 160px;
  }
}

@media (max-width: 460px) {
  .container {
    padding: 0 14px;
  }

  .search {
    display: none;
  }
}
</style>
