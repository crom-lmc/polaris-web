<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { MdEditor } from 'md-editor-v3'
import type { ToolbarNames } from 'md-editor-v3'
import {
  articleDetail,
  createArticle,
  listCategories,
  listTags,
  listVersions,
  rollbackVersion,
  updateArticle,
  uploadMedia,
  type ArticleItem,
  type TaxonomyItem,
  type VersionItem
} from '@/api/cms'
import { useUserStore } from '@/stores/user'
import { useThemeStore } from '@/stores/theme'
import { confirmAction } from '@/utils/confirm'

const route = useRoute()
const router = useRouter()
const store = useUserStore()
const themeStore = useThemeStore()

const id = route.params.id as string | undefined
const saving = ref(false)
const loading = ref(false)
const categories = ref<TaxonomyItem[]>([])
const allTags = ref<TaxonomyItem[]>([])
const form = reactive({
  title: '',
  summary: '',
  content: '',
  categoryId: undefined as number | undefined,
  tagId: undefined as number | undefined,
  cover: '',
  pinned: false,
  recommended: false,
  seoTitle: '',
  seoKeywords: '',
  seoDescription: ''
})
const status = ref(0)
const auditNote = ref('')

/** 版本抽屉 */
const versionsOpen = ref(false)
const versions = ref<VersionItem[]>([])
const versionsLoading = ref(false)
const previewVersion = ref<VersionItem | null>(null)

const toolbars: ToolbarNames[] = [
  'bold', 'underline', 'italic', 'strikeThrough', '-',
  'title', 'quote', 'unorderedList', 'orderedList', '-',
  'image', 'table', 'code', '-', 'preview'
]

onMounted(async () => {
  loading.value = true
  try {
    categories.value = await listCategories()
    allTags.value = await listTags()
    if (id) {
      const a: ArticleItem = await articleDetail(id)
      Object.assign(form, {
        title: a.title,
        summary: a.summary || '',
        content: a.content || '',
        categoryId: a.categoryId ?? undefined,
        tagId: a.tagId ?? undefined,
        cover: a.cover || '',
        pinned: !!a.pinned,
        recommended: !!a.recommended,
        seoTitle: a.seoTitle || '',
        seoKeywords: a.seoKeywords || '',
        seoDescription: a.seoDescription || ''
      })
      status.value = a.status
      auditNote.value = a.auditNote || ''
    }
  } catch (e: any) {
    message.error(e?.message || '加载失败')
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!form.title.trim()) {
    message.warning('请填写标题')
    return
  }
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      summary: form.summary,
      content: form.content,
      categoryId: form.categoryId,
      tagId: form.tagId ?? null,
      cover: form.cover,
      pinned: form.pinned ? 1 : 0,
      recommended: form.recommended ? 1 : 0,
      seoTitle: form.seoTitle,
      seoKeywords: form.seoKeywords,
      seoDescription: form.seoDescription
    }
    if (id) {
      await updateArticle(id, payload)
      message.success('已保存')
    } else {
      const created = await createArticle(payload)
      message.success('已保存草稿')
      router.replace(`/articles/${created.id}/edit`)
      status.value = 0
    }
  } catch (e: any) {
    message.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

/** 编辑器里直接传图：上传到媒体库并插入 URL */
async function onUploadImg(files: File[], callback: (urls: string[]) => void) {
  try {
    const urls: string[] = []
    for (const f of files) {
      const m = await uploadMedia(f)
      urls.push(m.url)
    }
    callback(urls)
  } catch (e: any) {
    message.error(e?.message || '图片上传失败')
  }
}

async function openVersions() {
  if (!id) return
  versionsOpen.value = true
  versionsLoading.value = true
  try {
    versions.value = await listVersions(id)
  } finally {
    versionsLoading.value = false
  }
}

const askRollback = (v: VersionItem) =>
  confirmAction({
    title: '一键回滚',
    content: `将当前内容回滚到「${v.remark || 'v' + v.id}」（${v.title}）。当前内容会先自动存为快照。确认吗？`,
    okText: '回滚',
    onOk: async () => {
      try {
        await rollbackVersion(id!, v.id)
        message.success('已回滚')
        versionsOpen.value = false
        const a: ArticleItem = await articleDetail(id!)
        form.title = a.title
        form.summary = a.summary || ''
        form.content = a.content || ''
      } catch (e: any) {
        message.error(e?.message || '回滚失败')
      }
    }
  })

function fmt(s?: string) {
  return (s || '').replace('T', ' ').slice(0, 19)
}
</script>

<template>
  <a-spin :spinning="loading">
    <a-card :title="id ? '编辑文章' : '新建文章'" size="small">
      <template #extra>
        <a-space>
          <span v-if="id" class="muted">当前状态：{{ ['草稿','待审核','待发布','已发布','驳回','已下线','审批中'][status] }}</span>
          <a-button v-if="id && store.can('article:version')" @click="openVersions">
            版本（{{ form.title ? '' : '' }}历史）
          </a-button>
          <a-button v-if="store.can(id ? 'article:edit' : 'article:create')" type="primary" :loading="saving" @click="save">保存</a-button>
          <a-button @click="router.push('/articles')">返回列表</a-button>
        </a-space>
      </template>

      <a-form layout="vertical">
        <a-form-item label="标题" required>
          <a-input v-model:value="form.title" :maxlength="128" placeholder="文章标题" />
        </a-form-item>

        <a-row :gutter="12">
          <a-col :span="8">
            <a-form-item label="分类">
              <a-select v-model:value="form.categoryId" allow-clear placeholder="选择分类"
                :options="categories.map((c) => ({ label: c.name, value: c.id }))" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="标签">
              <a-select v-model:value="form.tagId" allow-clear show-search placeholder="选择标签"
                :options="allTags.map((t) => ({ label: t.name, value: t.id }))" />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="摘要">
          <a-textarea v-model:value="form.summary" :rows="2" :maxlength="500" placeholder="留空则自动截取正文前 200 字" />
        </a-form-item>

        <a-form-item label="正文（Markdown / 富文本混排，自动做 XSS 清洗）">
          <MdEditor
            v-model="form.content"
            :toolbars="toolbars"
            :theme="themeStore.mode"
            style="height: 420px"
            @on-upload-img="onUploadImg"
          />
        </a-form-item>

        <a-collapse>
          <a-collapse-panel key="seo" header="SEO 与标记">
            <a-row :gutter="12">
              <a-col :span="12">
                <a-form-item label="SEO 标题">
                  <a-input v-model:value="form.seoTitle" :maxlength="128" />
                </a-form-item>
              </a-col>
              <a-col :span="12">
                <a-form-item label="SEO 关键词">
                  <a-input v-model:value="form.seoKeywords" :maxlength="255" placeholder="逗号分隔" />
                </a-form-item>
              </a-col>
            </a-row>
            <a-form-item label="SEO 描述">
              <a-textarea v-model:value="form.seoDescription" :rows="2" :maxlength="500" />
            </a-form-item>
            <a-space>
              <a-checkbox v-if="store.can('article:pin')" v-model:checked="form.pinned">置顶</a-checkbox>
              <a-checkbox v-if="store.can('article:pin')" v-model:checked="form.recommended">推荐位</a-checkbox>
            </a-space>
          </a-collapse-panel>
        </a-collapse>

        <a-alert
          v-if="id && auditNote"
          type="warning"
          show-icon
          style="margin-top: 12px"
          :message="`审核意见：${auditNote}`"
        />
      </a-form>
    </a-card>

    <a-modal centered v-model:open="versionsOpen" title="版本历史（一键回滚）" :footer="null" width="720px">
      <a-spin :spinning="versionsLoading">
        <a-empty v-if="!versions.length" description="还没有版本快照" />
        <a-list :data-source="versions" row-key="id">
          <template #renderItem="{ item }">
            <a-list-item>
              <a-list-item-meta :title="`v${item.id} · ${item.title}`" :description="`${item.remark} · ${item.operator || '-'} · ${fmt(item.createdAt)}`" />
              <template #actions>
                <a @click="previewVersion = item">查看</a>
                <a style="color: #faad14" @click="askRollback(item)">回滚到此版本</a>
              </template>
            </a-list-item>
          </template>
        </a-list>
      </a-spin>
    </a-modal>

    <a-modal centered :open="previewVersion != null" :title="previewVersion ? `v${previewVersion.id} 内容预览` : ''" :footer="null" width="720px" @cancel="previewVersion = null">
      <pre class="ver-preview">{{ previewVersion?.content }}</pre>
    </a-modal>
  </a-spin>
</template>

<style scoped>
.muted {
  font-size: 12px;
  opacity: 0.7;
}

.ver-preview {
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  font-size: 12px;
}
</style>
