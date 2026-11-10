<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import PortalHeader from '@/components/PortalHeader.vue'
import PortalFooter from '@/components/PortalFooter.vue'
import { applyJob, fetchJob, jobTypeText, type ApplyResult, type JobPostItem } from '@/api/recruit'

const route = useRoute()
const router = useRouter()
const loading = ref(true)
const job = ref<JobPostItem | null>(null)
const applyOpen = ref(false)
const submitting = ref(false)
const result = ref<ApplyResult | null>(null)
const resultOpen = ref(false)
const resumeFile = ref<File | null>(null)

const form = reactive({
  name: '',
  mobile: '',
  email: '',
  education: '',
  school: '',
  major: '',
  workYears: undefined as number | undefined,
  currentCompany: '',
  expectedSalary: undefined as number | undefined,
  remark: '',
  consent: false
})

const educationOptions = ['高中', '中专', '大专', '本科', '硕士', '博士', '其他'].map((v) => ({
  value: v,
  label: v
}))

const description = computed(() => (job.value?.description || '').split('\n').filter((l) => l.trim()))
const requirement = computed(() => (job.value?.requirement || '').split('\n').filter((l) => l.trim()))
const tags = computed(() => (job.value?.tags || '').split(',').map((t) => t.trim()).filter(Boolean))

async function load() {
  loading.value = true
  try {
    job.value = await fetchJob(String(route.params.id))
  } catch (e: any) {
    message.error(e?.message || '职位不存在或已下架')
    router.replace('/careers')
  } finally {
    loading.value = false
  }
}

function beforeUpload(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    message.error('简历不能超过 10MB')
    return false
  }
  const ok = /\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(file.name)
  if (!ok) {
    message.error('简历仅支持 PDF / Word / 图片')
    return false
  }
  resumeFile.value = file
  return false
}

async function submit() {
  if (!job.value) return
  if (!form.consent) {
    message.warning('请先阅读并同意隐私声明')
    return
  }
  if (!form.name.trim() || !/^1[3-9]\d{9}$/.test(form.mobile.trim())) {
    message.warning('请填写正确的姓名与手机号')
    return
  }
  if (!resumeFile.value) {
    message.warning('请上传简历')
    return
  }
  submitting.value = true
  try {
    const data = new FormData()
    data.append('resume', resumeFile.value)
    data.append('name', form.name.trim())
    data.append('mobile', form.mobile.trim())
    if (form.email.trim()) data.append('email', form.email.trim())
    if (form.education) data.append('education', form.education)
    if (form.school.trim()) data.append('school', form.school.trim())
    if (form.major.trim()) data.append('major', form.major.trim())
    if (form.workYears != null) data.append('workYears', String(form.workYears))
    if (form.currentCompany.trim()) data.append('currentCompany', form.currentCompany.trim())
    if (form.expectedSalary != null) data.append('expectedSalary', String(form.expectedSalary))
    if (form.remark.trim()) data.append('remark', form.remark.trim())
    data.append('consent', 'true')
    result.value = await applyJob(job.value.id, data)
    applyOpen.value = false
    resultOpen.value = true
  } catch (e: any) {
    message.error(e?.message || '投递失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

function goProgress() {
  resultOpen.value = false
  router.push({
    path: '/careers/progress',
    query: { trackCode: result.value?.trackCode, mobile: form.mobile.trim() }
  })
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PortalHeader />
    <main class="container main">
      <a-spin :spinning="loading">
        <template v-if="job">
          <a-button type="link" class="back" @click="router.push('/careers')">← 返回职位列表</a-button>
          <section class="head">
            <div class="head-main">
              <h1>{{ job.title }}</h1>
              <div class="meta">
                <span>{{ job.workCity || '城市不限' }}</span>
                <span>{{ jobTypeText(job.jobType) }}</span>
                <span>{{ job.experienceReq || '经验不限' }}</span>
                <span>{{ job.educationReq || '学历不限' }}</span>
                <span v-if="job.headcount">招 {{ job.headcount }} 人</span>
              </div>
              <div class="tags">
                <a-tag v-for="t in tags" :key="t">{{ t }}</a-tag>
              </div>
            </div>
            <div class="head-side">
              <strong class="salary">{{ job.salaryRange || '面议' }}</strong>
              <a-button type="primary" size="large" block @click="applyOpen = true">投递简历</a-button>
              <span v-if="job.closeAt" class="close-hint">投递截止：{{ job.closeAt }}</span>
            </div>
          </section>

          <section class="section">
            <h2>职位描述</h2>
            <p v-for="(line, i) in description" :key="`d${i}`">{{ line }}</p>
            <p v-if="!description.length" class="muted">暂无描述</p>
          </section>
          <section class="section">
            <h2>任职要求</h2>
            <p v-for="(line, i) in requirement" :key="`r${i}`">{{ line }}</p>
            <p v-if="!requirement.length" class="muted">暂无要求</p>
          </section>
        </template>
      </a-spin>
    </main>
    <PortalFooter />

    <a-modal
      v-model:open="applyOpen"
      title="投递简历"
      width="760px"
      :confirm-loading="submitting"
      ok-text="提交投递"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form layout="vertical">
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item label="姓名" required>
              <a-input v-model:value="form.name" placeholder="您的姓名" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="手机号" required>
              <a-input v-model:value="form.mobile" :maxlength="11" placeholder="用于接收面试通知" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="邮箱">
              <a-input v-model:value="form.email" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="最高学历">
              <a-select v-model:value="form.education" :options="educationOptions" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="毕业院校">
              <a-input v-model:value="form.school" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="专业">
              <a-input v-model:value="form.major" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="工作年限">
              <a-input-number v-model:value="form.workYears" :min="0" :max="50" :step="0.5" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="期望月薪">
              <a-input-number v-model:value="form.expectedSalary" :min="0" :step="500" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="当前/最近公司">
              <a-input v-model:value="form.currentCompany" placeholder="选填" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="简历" required>
              <a-upload :show-upload-list="false" :before-upload="beforeUpload" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png">
                <a-button>{{ resumeFile ? '重新选择' : '选择文件' }}</a-button>
              </a-upload>
              <span v-if="resumeFile" class="file-name">{{ resumeFile.name }}</span>
              <div class="hint">支持 PDF / Word / 图片，不超过 10MB</div>
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="补充说明">
              <a-textarea v-model:value="form.remark" :rows="3" placeholder="选填" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-checkbox v-model:checked="form.consent" class="consent-line">
          我已阅读并同意《招聘隐私声明》，同意公司为招聘目的处理我的个人信息，简历保留 180 天
        </a-checkbox>
      </a-form>
    </a-modal>

    <a-modal v-model:open="resultOpen" title="投递成功" :footer="null" width="480px">
      <div class="result">
        <p>简历已收到，HR 会尽快与您联系。</p>
        <div class="track">
          <span>查询码</span>
          <strong>{{ result?.trackCode }}</strong>
        </div>
        <p class="hint">请保存查询码，后续可用「查询码 + 手机号」查看投递进度。</p>
        <a-button type="primary" block @click="goProgress">查看投递进度</a-button>
      </div>
    </a-modal>
  </div>
</template>

<style scoped>
.main {
  padding: 24px 0 48px;
  max-width: 920px;
}
.back {
  padding-left: 0;
  margin-bottom: 8px;
}
.head {
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg-soft);
}
.head-main h1 {
  margin: 0 0 10px;
  font-size: 26px;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  color: var(--text-2);
  font-size: 14px;
}
.tags {
  margin-top: 12px;
}
.head-side {
  width: 200px;
  flex-shrink: 0;
  text-align: right;
}
.salary {
  display: block;
  font-size: 22px;
  color: var(--accent);
  margin-bottom: 12px;
}
.close-hint {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-2);
}
.section {
  margin-top: 28px;
}
.section h2 {
  font-size: 18px;
  margin: 0 0 12px;
}
.section p {
  margin: 0 0 8px;
  line-height: 1.8;
  color: var(--text-2);
  white-space: pre-wrap;
}
.muted {
  color: var(--text-2);
}
.hint {
  font-size: 12px;
  color: var(--text-2);
}
.consent-line {
  white-space: nowrap;
}
.file-name {
  margin-left: 10px;
  font-size: 13px;
}
.result {
  text-align: center;
}
.track {
  margin: 18px 0;
  padding: 14px;
  border-radius: 10px;
  background: var(--bg-soft);
}
.track span {
  display: block;
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 6px;
}
.track strong {
  font-size: 24px;
  letter-spacing: 3px;
  color: var(--accent);
}
@media (max-width: 720px) {
  .head {
    flex-direction: column;
  }
  .head-side {
    width: 100%;
    text-align: left;
  }
}
</style>
