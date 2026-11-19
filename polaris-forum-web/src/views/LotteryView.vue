<template>
  <div class="container rewards-page">
    <div class="rewards-heading"><div><span class="eyebrow">LUCKY DRAW</span><h1>积分抽奖</h1><p>小积分，大惊喜，试试今天的好运气。</p></div></div>
    <RewardsNav />

    <div class="lottery-layout">
      <section class="panel lottery-board">
        <div class="lottery-board-heading"><div><span>今日剩余机会</span><b>{{ isLoggedIn ? `${remaining} 次` : '登录后查看' }}</b></div><div><span>我的可用积分</span><b>{{ balanceText }}</b></div></div>
        <div v-if="loading" class="compact-state">正在加载奖品配置…</div>
        <div v-else-if="config" class="lottery-grid">
          <template v-for="(prize, index) in config.prizes" :key="prize.key">
            <div v-if="index === 4" class="lottery-core">
              <gift-outlined />
              <button :disabled="drawing || (isLoggedIn && remaining <= 0)" @click="draw">{{ drawing ? '开奖中…' : !isLoggedIn ? '登录后抽奖' : remaining <= 0 ? '今日已用完' : '立即抽奖' }}</button>
              <span>{{ config.lotteryCost }} 积分 / 次</span>
            </div>
            <div class="lottery-prize" :class="{ selected: lastResult?.index === index }" :style="{ background: prize.color }"><gift-outlined /><b>{{ prize.name }}</b><span>{{ prize.points > 0 ? '积分即时到账' : '好运在路上' }}</span></div>
          </template>
        </div>
        <p v-if="lastResult" class="draw-result"><check-circle-outlined />抽奖结果：{{ lastResult.prize.name }}，当前余额 {{ lastResult.balance }} 积分。</p>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p class="lottery-static-tip"><info-circle-outlined />每次抽奖由服务端随机开奖并保存流水，积分奖励实时到账</p>
      </section>

      <aside class="lottery-sidebar">
        <section class="panel reward-side-card">
          <span class="side-icon"><read-outlined /></span><h3>活动规则</h3>
          <ol class="lottery-rules"><li><span>1</span>每次抽奖消耗 {{ config?.lotteryCost || 50 }} 积分，每日最多参与 {{ config?.dailyLotteryLimit || 3 }} 次。</li><li><span>2</span>积分不足或当日次数用完时无法继续参与。</li><li><span>3</span>积分奖励即时到账，收入与支出均可在积分明细查看。</li><li><span>4</span>抽奖结果以服务端返回和保存的记录为准。</li></ol>
        </section>
        <section class="panel reward-side-card draw-balance-card">
          <span class="side-icon"><wallet-outlined /></span><h3>积分不够？</h3><p>签到、发帖和参与评论都可以获得积分。</p><RouterLink to="/points" class="secondary-button full-button">去赚积分<right-outlined /></RouterLink>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CheckCircleOutlined, GiftOutlined, InfoCircleOutlined, ReadOutlined, RightOutlined, WalletOutlined } from '@ant-design/icons-vue'
import RewardsNav from '@/components/RewardsNav.vue'
import { drawLottery, fetchPointsSummary, fetchRewardConfig, type DrawResult, type RewardConfig } from '@/api/forum'
import { currentUser, isLoggedIn, refreshCurrentUser, requireLogin } from '@/auth'

const config = ref<RewardConfig | null>(null)
const lastResult = ref<DrawResult | null>(null)
const balance = ref<number | null>(null)
const remaining = ref(3)
const loading = ref(true)
const drawing = ref(false)
const error = ref('')
const balanceText = computed(() => (balance.value ?? currentUser.value?.member.points)?.toLocaleString() || '—')

onMounted(async () => {
  try {
    config.value = await fetchRewardConfig()
    if (isLoggedIn.value) await loadSummary()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '奖品配置加载失败'
  } finally {
    loading.value = false
  }
})
watch(isLoggedIn, logged => {
  lastResult.value = null
  if (logged) loadSummary()
  else { balance.value = null; remaining.value = config.value?.dailyLotteryLimit || 3 }
})

async function loadSummary() {
  try {
    const summary = await fetchPointsSummary()
    balance.value = summary.member.points
    remaining.value = summary.lotteryRemaining
    error.value = ''
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '积分信息加载失败'
  }
}

async function draw() {
  if (!requireLogin('积分抽奖')) return
  drawing.value = true
  error.value = ''
  try {
    lastResult.value = await drawLottery()
    balance.value = lastResult.value.balance
    remaining.value = lastResult.value.remaining
    await refreshCurrentUser()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '抽奖失败'
  } finally {
    drawing.value = false
  }
}
</script>
