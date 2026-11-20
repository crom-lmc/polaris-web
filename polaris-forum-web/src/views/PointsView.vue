<template>
  <div class="container rewards-page reference-points-page">
    <RewardsNav />
    <div class="rewards-community-layout">
      <main class="points-main">
        <section class="panel mission-center">
          <div class="mission-header">
            <div><h1>任务中心</h1><p>完成真实社区互动，积分由服务端自动记录。</p></div>
            <div class="mission-tabs"><button class="active">社区任务</button></div>
          </div>
          <div class="mission-list">
            <div class="mission-row">
              <div class="mission-copy"><div><b>每日签到</b><span :class="{ done: summary?.checkedIn }">{{ summary?.checkedIn ? '已完成' : '待签到' }}</span></div><p>每天签到一次，签到记录按日期唯一保存。</p><small><thunderbolt-outlined />+10 积分<span>·</span>每日 1 次</small></div>
              <div class="mission-progress"><div><span>累计签到 {{ summary?.checkinDays || 0 }} 天</span><b>{{ summary?.checkedIn ? '100%' : '待完成' }}</b></div><div class="mission-progress-track"><i :style="{ width: summary?.checkedIn ? '100%' : '0%' }"></i></div><button v-if="!summary?.checkedIn" :disabled="checkingIn" @click="handleCheckin">{{ checkingIn ? '签到中…' : '立即签到' }}<right-outlined /></button><span v-else class="mission-complete"><check-circle-outlined />今日已签到</span></div>
            </div>
            <div class="mission-row">
              <div class="mission-copy"><div><b>发布社区内容</b><span>可参与</span></div><p>发布帖子，成功保存后获得奖励。</p><small><thunderbolt-outlined />+20 积分<span>·</span>每次成功发布</small></div>
              <div class="mission-progress"><button @click="goCreate">去发布<right-outlined /></button></div>
            </div>
            <div class="mission-row">
              <div class="mission-copy"><div><b>参与评论</b><span>可参与</span></div><p>认真回复他人的讨论，评论与积分流水会同时保存。</p><small><thunderbolt-outlined />+5 积分<span>·</span>每次成功评论</small></div>
              <div class="mission-progress"><RouterLink to="/" class="mission-link">参与讨论<right-outlined /></RouterLink></div>
            </div>
          </div>
          <p v-if="message" class="form-message success">{{ message }}</p>
          <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        </section>

        <section class="panel reward-section point-history-card">
          <div class="reward-section-heading"><div><h2>积分明细</h2><p>当前可用积分 {{ summary?.member.points.toLocaleString() || currentUser?.member.points.toLocaleString() || '—' }}</p></div><history-outlined /></div>
          <div v-if="!isLoggedIn" class="compact-state"><p>登录后查看签到状态和真实积分流水。</p><button class="primary-button" @click="requireLogin('查看积分明细')">统一登录</button></div>
          <div v-else-if="loading" class="compact-state">正在加载积分数据…</div>
          <div v-else-if="summary && !summary.logs.length" class="compact-state">暂无积分流水，先完成一次签到或社区互动吧。</div>
          <div v-else class="point-record-list">
            <div v-for="record in summary?.logs || []" :key="record.id" class="point-record">
              <div><b>{{ record.remark }}</b><span>{{ formatTime(record.createdAt) }} · 余额 {{ record.balance }}</span></div>
              <strong :class="record.changePoints >= 0 ? 'earn' : 'spend'">{{ record.changePoints > 0 ? '+' : '' }}{{ record.changePoints }}</strong>
            </div>
          </div>
        </section>
      </main>
      <CommunitySidebar />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { CheckCircleOutlined, HistoryOutlined, RightOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import RewardsNav from '@/components/RewardsNav.vue'
import CommunitySidebar from '@/components/CommunitySidebar.vue'
import { checkin, fetchPointsSummary, type PointsSummary } from '@/api/forum'
import { formatTime } from '@/data/forum'
import { currentUser, isLoggedIn, refreshCurrentUser, requireLogin } from '@/auth'

const router = useRouter()
const summary = ref<PointsSummary | null>(null)
const loading = ref(false)
const checkingIn = ref(false)
const error = ref('')
const message = ref('')

onMounted(load)
watch(isLoggedIn, logged => { if (logged) load(); else summary.value = null })

async function load() {
  if (!isLoggedIn.value) return
  loading.value = true
  error.value = ''
  try {
    summary.value = await fetchPointsSummary()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '积分数据加载失败'
  } finally {
    loading.value = false
  }
}

async function handleCheckin() {
  if (!requireLogin('每日签到')) return
  checkingIn.value = true
  error.value = ''
  message.value = ''
  try {
    summary.value = await checkin()
    await refreshCurrentUser()
    message.value = '签到成功，10 积分已到账。'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '签到失败'
  } finally {
    checkingIn.value = false
  }
}

function goCreate() {
  if (requireLogin('发布社区内容')) router.push('/new')
}
</script>
