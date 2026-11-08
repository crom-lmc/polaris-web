<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchDashboard, type DashboardStats } from '@/api/cms'
import { useUserStore } from '@/stores/user'
import { message } from 'ant-design-vue'

const router = useRouter()
const store = useUserStore()
const stats = ref<DashboardStats | null>(null)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    stats.value = await fetchDashboard()
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
})

const cards = [
  { key: 'total', label: '全部内容', perm: 'article:view' },
  { key: 'published', label: '已发布', perm: 'article:view' },
  { key: 'pendingAudit', label: '待审核', perm: 'article:view' },
  { key: 'draft', label: '草稿箱', perm: 'article:view' },
  { key: 'media', label: '媒体文件', perm: 'media:view' },
  { key: 'banners', label: 'Banner', perm: 'banner:view' }
]
</script>

<template>
  <div>
    <a-spin :spinning="loading">
      <a-row :gutter="12" align="stretch" class="dash-row">
        <a-col v-for="c in cards.filter((c) => store.can(c.perm))" :key="c.key" :span="8" style="display: flex">
          <a-card class="stat-card">
            <div class="stat-num">{{ stats ? (stats as any)[c.key] : '-' }}</div>
            <div class="stat-label">{{ c.label }}</div>
          </a-card>
        </a-col>
      </a-row>

      <a-card title="快捷操作" size="small" style="margin-top: 12px">
        <a-space wrap>
          <a-button v-if="store.can('article:create')" type="primary" @click="router.push('/articles/new')">
            新建文章
          </a-button>
          <a-button v-if="store.can('media:upload')" @click="router.push('/media')">上传媒体</a-button>
          <a-button v-if="store.can('banner:manage')" @click="router.push('/banners')">管理 Banner</a-button>
        </a-space>
      </a-card>
    </a-spin>
  </div>
</template>

<style scoped>
.dash-row {
  margin-bottom: 4px;
}

.stat-card {
  flex: 1;
  text-align: center;
}

.stat-num {
  font-size: 28px;
  font-weight: 600;
  color: var(--text-primary, var(--color-text));
}

.stat-label {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.7;
}
</style>
