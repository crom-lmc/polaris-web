<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import { fetchJobs, jobTypeText, type JobPostItem } from '@/api/recruit'

const router = useRouter()
const loading = ref(true)
const jobs = ref<JobPostItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 8
const keyword = ref('')
const jobType = ref<string | undefined>(undefined)

const typeOptions = [
  { value: '', label: '全部' },
  { value: 'FULL_TIME', label: '全职' },
  { value: 'INTERN', label: '实习' },
  { value: 'PART_TIME', label: '兼职' }
]

async function load() {
  loading.value = true
  try {
    const data = await fetchJobs({
      keyword: keyword.value.trim() || undefined,
      jobType: jobType.value || undefined,
      page: page.value,
      size: pageSize
    })
    jobs.value = data.list || []
    total.value = data.total || 0
  } catch {
    jobs.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
}

function changeType(v: string) {
  jobType.value = v || undefined
  page.value = 1
  load()
}

function open(job: JobPostItem) {
  router.push(`/careers/${job.id}`)
}

function onPage(p: number) {
  page.value = p
  load()
}

function tagsOf(job: JobPostItem) {
  return (job.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4)
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PortalHeader />
    <main class="container main">
      <section class="hero">
        <h1>加入我们</h1>
        <p>找到属于你的位置，和一群认真的人做有价值的事。</p>
        <div class="hero-actions">
          <a-input-search
            v-model:value="keyword"
            placeholder="搜索职位名称、城市或标签"
            enter-button="搜索"
            size="large"
            @search="search"
          />
          <a-button size="large" @click="router.push('/careers/progress')">查询投递进度</a-button>
        </div>
        <div class="types">
          <a-tag
            v-for="t in typeOptions"
            :key="t.value"
            :color="(jobType || '') === t.value ? 'blue' : undefined"
            class="type-tag"
            @click="changeType(t.value)"
          >{{ t.label }}</a-tag>
        </div>
      </section>

      <a-spin :spinning="loading">
        <div v-if="!jobs.length" class="empty">暂无在招职位，欢迎投递简历到我们的邮箱。</div>
        <div class="job-grid">
          <article v-for="job in jobs" :key="job.id" class="job-card" @click="open(job)">
            <div class="job-top">
              <h3>{{ job.title }}</h3>
              <strong class="salary">{{ job.salaryRange || '面议' }}</strong>
            </div>
            <div class="job-meta">
              <span>{{ job.workCity || '城市不限' }}</span>
              <span>{{ job.experienceReq || '经验不限' }}</span>
              <span>{{ job.educationReq || '学历不限' }}</span>
              <span>{{ jobTypeText(job.jobType) }}</span>
            </div>
            <p class="job-desc">{{ job.description || '点击查看职位详情' }}</p>
            <div class="job-bottom">
              <a-tag v-for="t in tagsOf(job)" :key="t">{{ t }}</a-tag>
              <span class="count">已投 {{ job.applyCount || 0 }}</span>
            </div>
          </article>
        </div>
      </a-spin>

      <div v-if="total > pageSize" class="pager">
        <a-pagination
          :current="page"
          :page-size="pageSize"
          :total="total"
          :show-size-changer="false"
          @change="onPage"
        />
      </div>
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
.main {
  padding: 32px 0 48px;
}
.hero {
  text-align: center;
  padding: 24px 0 32px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 34px;
  font-weight: 700;
}
.hero p {
  margin: 0 0 20px;
  color: var(--text-2);
}
.hero-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  max-width: 640px;
  margin: 0 auto;
}
.types {
  margin-top: 16px;
}
.type-tag {
  cursor: pointer;
  margin: 0 4px;
}
.job-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 20px;
}
.job-card {
  padding: 18px 20px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--bg-soft);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}
.job-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: 0 8px 24px rgb(0 0 0 / 8%);
}
.job-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.job-top h3 {
  margin: 0;
  font-size: 17px;
}
.salary {
  color: var(--accent);
  white-space: nowrap;
}
.job-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 10px 0;
  font-size: 13px;
  color: var(--text-2);
}
.job-desc {
  margin: 0 0 12px;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.job-bottom {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-2);
}
.empty {
  padding: 60px 0;
  text-align: center;
  color: var(--text-2);
}
.pager {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
@media (max-width: 640px) {
  .hero h1 {
    font-size: 26px;
  }
  .hero-actions {
    flex-direction: column;
  }
}
</style>
