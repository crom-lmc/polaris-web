<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import { fetchProgress, type ApplyResult } from '@/api/recruit'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const result = ref<ApplyResult | null>(null)
const query = reactive({
  trackCode: String(route.query.trackCode || ''),
  mobile: String(route.query.mobile || '')
})

async function queryProgress() {
  if (!query.mobile.trim()) {
    message.warning('请填写手机号')
    return
  }
  loading.value = true
  try {
    result.value = await fetchProgress(query.trackCode.trim(), query.mobile.trim())
  } catch (e: any) {
    result.value = null
    message.error(e?.message || '查询失败')
  } finally {
    loading.value = false
  }
}

function fmt(t?: string) {
  return t ? t.replace('T', ' ').slice(0, 16) : ''
}

/** 主流程只展示简历/面试/Offer 三段，面试轮次单独展示 */
const mainTimeline = computed(() =>
  (result.value?.timeline || []).filter((t) => t.stage !== 'INTERVIEW_ROUND')
)
const stepCurrent = computed(() => Math.max(0, mainTimeline.value.filter((t) => t.done).length - 1))

function roundColor(status: string) {
  if (status === 'PASS') return 'green'
  if (status === 'FAIL') return 'red'
  return 'default'
}

function isLink(v?: string) {
  return !!v && /^https?:\/\//i.test(v)
}

onMounted(() => {
  if (query.mobile) queryProgress()
})
</script>

<template>
  <div class="page">
    <PortalHeader />
    <main class="container main">
      <a-button type="link" class="back" @click="router.push('/careers')">← 返回职位列表</a-button>
      <section class="card">
        <h1>投递进度查询</h1>
        <p class="hint">输入投递时填写的手机号即可查询，填写查询码可精确匹配某次投递</p>
        <div class="form">
          <a-input v-model:value="query.trackCode" placeholder="查询码（选填），如 A2B3C4D5" :maxlength="8" />
          <a-input v-model:value="query.mobile" placeholder="投递时填写的手机号" :maxlength="11" />
          <a-button type="primary" :loading="loading" @click="queryProgress">查询</a-button>
        </div>
      </section>

      <section v-if="result" class="card result">
        <div class="result-head">
          <div>
            <h2>{{ result.jobTitle }}</h2>
            <span class="hint">投递人：{{ result.candidateName }} · {{ fmt(result.appliedAt) }}</span>
          </div>
          <a-tag color="blue">{{ result.stageLabel }}</a-tag>
        </div>
        <a-steps :current="stepCurrent" size="small">
          <a-step
            v-for="item in mainTimeline"
            :key="item.stage"
            :title="item.label"
            :description="fmt(item.time)"
          />
        </a-steps>

        <div v-if="result.rounds && result.rounds.length" class="rounds">
          <div class="rounds-title">面试进度</div>
          <div v-for="r in result.rounds" :key="r.roundNo" class="round-item">
            <span class="round-name">{{ r.label }}</span>
            <a-tag :color="roundColor(r.status)">{{ r.statusLabel }}</a-tag>
            <span class="hint">{{ fmt(r.time) || '时间待定' }}</span>
            <span v-if="r.methodLabel" class="hint">· {{ r.methodLabel }}</span>
            <template v-if="r.location">
              <span class="hint">·</span>
              <a
                v-if="isLink(r.location)"
                :href="r.location"
                target="_blank"
                rel="noopener"
                class="round-link"
                >{{ r.location }}</a
              >
              <span v-else class="hint">{{ r.location }}</span>
            </template>
          </div>
        </div>
        <p class="tip">
          流程状态由 HR 更新。若长时间未收到通知，可通过招聘邮箱与我们联系。
        </p>
      </section>
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
.main {
  padding: 24px 0 48px;
  max-width: 760px;
}
.back {
  padding-left: 0;
}
.card {
  margin-top: 16px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-soft);
}
.card h1 {
  margin: 0 0 6px;
  font-size: 24px;
}
.hint {
  color: var(--text-2);
  font-size: 13px;
}
.form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 10px;
  margin-top: 18px;
}
.result-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 24px;
}
.result-head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}
.tip {
  margin: 24px 0 0;
  font-size: 13px;
  color: var(--text-2);
}
.rounds {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px dashed var(--line);
}
.rounds-title {
  font-weight: 600;
  margin-bottom: 10px;
}
.round-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 6px 0;
  font-size: 14px;
}
.round-link {
  font-size: 13px;
  color: var(--brand, #1677ff);
  word-break: break-all;
}
.round-name {
  min-width: 110px;
}
@media (max-width: 640px) {
  .form {
    grid-template-columns: 1fr;
  }
}
</style>
