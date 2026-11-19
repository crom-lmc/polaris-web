<template>
  <div class="container rewards-page">
    <div class="rewards-heading"><div><span class="eyebrow">GIFT STORE</span><h1>礼品兑换</h1><p>用分享积累的积分，兑换一份社区心意。</p></div></div>
    <RewardsNav />

    <section class="gift-store-bar">
      <div class="gift-balance"><wallet-outlined /><span>当前可用积分</span><b>{{ balanceText }}</b><RouterLink to="/points">积分明细<right-outlined /></RouterLink></div>
      <div class="gift-categories" aria-label="礼品分类"><button v-for="category in categories" :key="category" :class="{ active: selectedCategory === category }" @click="selectedCategory = category">{{ category }}</button></div>
    </section>
    <p v-if="message" class="form-message success">{{ message }}</p>
    <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
    <div v-if="loading" class="panel compact-state">正在加载礼品与库存…</div>
    <div v-else-if="!filteredGifts.length" class="panel compact-state">当前分类暂无可兑换礼品。</div>
    <div v-else class="gift-grid">
      <article v-for="gift in filteredGifts" :key="gift.id" class="panel gift-card">
        <div class="gift-visual" :class="gift.icon || 'violet'"><gift-outlined /><span>POLARIS</span></div>
        <div class="gift-content">
          <span class="gift-category">{{ gift.category }}</span>
          <h2>{{ gift.name }}</h2>
          <p>{{ gift.description }}</p>
          <div class="gift-stock"><span>剩余 {{ gift.stock }} 份</span><span>库存实时扣减</span></div>
          <div class="gift-footer"><strong><thunderbolt-outlined />{{ gift.points.toLocaleString() }} <small>积分</small></strong><button class="primary-button" :disabled="gift.stock <= 0 || exchangingId === gift.id" @click="exchange(gift)">{{ exchangingId === gift.id ? '兑换中…' : gift.stock <= 0 ? '已兑完' : isLoggedIn ? '立即兑换' : '登录后兑换' }}</button></div>
        </div>
      </article>
    </div>
    <section v-if="isLoggedIn" class="panel exchange-history">
      <div class="reward-section-heading"><div><h2>我的兑换记录</h2><p>管理员登记快递单号后可在此查看，签收结果由线下确认。</p></div></div>
      <div v-if="!exchanges.length" class="comments-more">暂无兑换记录。</div>
      <div v-for="record in exchanges" :key="record.id" class="exchange-row">
        <div><b>{{ record.giftName }}</b><span>{{ record.createdAt }} · {{ record.points }} 积分</span></div>
        <span class="exchange-status" :class="{ issued: record.status === 'ISSUED' }">{{ statusNames[record.status] }}</span>
        <p v-if="record.trackingNo">快递单号：{{ record.trackingNo }}</p>
        <p>{{ record.status === 'ISSUED' ? `${record.issuedAt || ''} ${record.issuedByName || ''} ${record.issueRemark || ''}` : record.status === 'SHIPPING' ? '礼品物流运输中，签收结果由管理员线下核实。' : '管理员登记物流后会在此显示快递单号。' }}</p>
      </div>
    </section>
    <div class="gift-note"><info-circle-outlined /><span>兑换成功后立即扣减积分和库存，并由服务端保存兑换记录。实物领取方式请联系社区管理员。</span></div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GiftOutlined, InfoCircleOutlined, RightOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons-vue'
import RewardsNav from '@/components/RewardsNav.vue'
import { exchangeGift, fetchMyExchanges, fetchPointsSummary, fetchRewardConfig } from '@/api/forum'
import { currentUser, isLoggedIn, refreshCurrentUser, requireLogin } from '@/auth'
import type { ExchangeRecord, Gift } from '@/types'

const gifts = ref<Gift[]>([])
const exchanges = ref<ExchangeRecord[]>([])
const selectedCategory = ref('全部礼品')
const balance = ref<number | null>(null)
const loading = ref(true)
const exchangingId = ref('')
const error = ref('')
const message = ref('')
const statusNames: Record<ExchangeRecord['status'], string> = {
  PENDING_ISSUE: '待发放',
  SHIPPING: '物流运输中',
  ISSUED: '已发放'
}
const categories = computed(() => ['全部礼品', ...new Set(gifts.value.map(gift => gift.category))])
const filteredGifts = computed(() => selectedCategory.value === '全部礼品' ? gifts.value : gifts.value.filter(gift => gift.category === selectedCategory.value))
const balanceText = computed(() => (balance.value ?? currentUser.value?.member.points)?.toLocaleString() || '—')

onMounted(async () => {
  try {
    const config = await fetchRewardConfig()
    gifts.value = config.gifts
    if (isLoggedIn.value) await loadBalance()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '礼品数据加载失败'
  } finally {
    loading.value = false
  }
})
watch(isLoggedIn, logged => { if (logged) loadBalance(); else { balance.value = null; exchanges.value = [] } })

async function loadBalance() {
  try {
    const [summary, records] = await Promise.all([fetchPointsSummary(), fetchMyExchanges()])
    balance.value = summary.member.points
    exchanges.value = records
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '积分余额加载失败'
  }
}

async function exchange(gift: Gift) {
  if (!requireLogin(`兑换${gift.name}`)) return
  if (!window.confirm(`确认使用 ${gift.points} 积分兑换「${gift.name}」吗？`)) return
  exchangingId.value = gift.id
  error.value = ''
  message.value = ''
  try {
    const result = await exchangeGift(gift.id)
    balance.value = result.balance
    gift.stock -= 1
    message.value = `兑换成功：${result.giftName}，剩余 ${result.balance} 积分。`
    await Promise.all([refreshCurrentUser(), loadBalance()])
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '兑换失败'
  } finally {
    exchangingId.value = ''
  }
}
</script>
