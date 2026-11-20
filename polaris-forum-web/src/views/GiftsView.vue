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
      <article v-for="gift in filteredGifts" :key="gift.id" class="panel gift-card" :class="{ 'level-locked': giftLocked(gift) }">
        <div class="gift-visual" :class="gift.icon || 'violet'">
          <img v-if="gift.imageUrl" :src="gift.imageUrl" :alt="gift.name" class="gift-image" />
          <template v-else><gift-outlined /><span>POLARIS</span></template>
          <span v-if="giftLocked(gift)" class="level-lock-badge">Lv.{{ gift.minLevel }} 可兑</span>
        </div>
        <div class="gift-content">
          <span class="gift-category">{{ gift.category }}</span>
          <h2>{{ gift.name }}</h2>
          <p>{{ gift.description }}</p>
          <div class="gift-stock"><span>剩余 {{ gift.stock }} 份</span><span>{{ giftLocked(gift) ? `需 Lv.${gift.minLevel} 及以上` : '库存实时扣减' }}</span></div>
          <div class="gift-footer"><strong><thunderbolt-outlined />{{ gift.points.toLocaleString() }} <small>积分</small></strong><button class="primary-button" :disabled="giftLocked(gift) || gift.stock <= 0 || exchangingId === gift.id" @click="openExchange(gift)">{{ exchangingId === gift.id ? '兑换中…' : giftLocked(gift) ? `Lv.${gift.minLevel} 可兑` : gift.stock <= 0 ? '已兑完' : isLoggedIn ? '立即兑换' : '登录后兑换' }}</button></div>
        </div>
      </article>
    </div>
    <section v-if="isLoggedIn" class="panel exchange-history">
      <div class="reward-section-heading"><div><h2>我的兑换记录</h2><p>管理员登记快递单号后可在此查看，签收结果由线下确认。</p></div></div>
      <div v-if="!exchanges.length" class="comments-more">暂无兑换记录。</div>
      <div v-else class="exchange-table-wrap">
        <table class="exchange-table">
          <thead><tr><th>序号</th><th>兑换时间</th><th>发放时间</th><th>来源</th><th>状态</th><th>积分</th></tr></thead>
          <tbody>
            <tr v-for="(record, index) in exchanges" :key="record.id">
              <td>{{ index + 1 }}</td>
              <td>{{ record.createdAt || '—' }}</td>
              <td>{{ record.issuedAt || '—' }}</td>
              <td><span class="exchange-source" :class="{ lottery: record.source === 'LOTTERY' }">{{ record.source === 'LOTTERY' ? '抽奖' : '兑换' }}</span></td>
              <td><span class="exchange-status" :class="{ issued: record.status === 'ISSUED' }">{{ statusNames[record.status] }}</span></td>
              <td>{{ record.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-for="record in exchanges" :key="`detail-${record.id}`" class="exchange-detail">
        <b>{{ record.giftName }}</b>
        <span v-if="record.trackingNo">快递单号：{{ record.trackingNo }}</span>
        <span v-if="record.issuedByName || record.issueRemark">{{ record.issuedByName || '' }} {{ record.issueRemark || '' }}</span>
      </div>
    </section>
    <div class="gift-note"><info-circle-outlined /><span>兑换成功后立即扣减积分和库存，并由服务端保存兑换记录。实物领取方式请联系社区管理员。</span></div>

    <!-- 兑换确认 / 积分不足弹窗（居中，复用登录弹窗样式） -->
    <div v-if="exchangeTarget" class="modal-mask" @click.self="closeExchange">
      <div class="login-dialog confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="exchange-dialog-title">
        <button class="dialog-close" aria-label="关闭" @click="closeExchange">×</button>
        <template v-if="levelLockedDialog">
          <span class="confirm-icon warn"><warning-outlined /></span>
          <h2 id="exchange-dialog-title">等级不足</h2>
          <p>兑换「{{ exchangeTarget?.name }}」需要达到 <b>Lv.{{ exchangeTarget?.minLevel }}</b>，当前为 Lv.{{ myLevel }}。继续发帖、评论积累经验即可提升社区等级。</p>
          <div class="confirm-actions">
            <RouterLink to="/levels" class="secondary-button" @click="closeExchange">查看等级路线</RouterLink>
            <button class="primary-button" @click="closeExchange">我知道了</button>
          </div>
        </template>
        <template v-else-if="insufficient">
          <span class="confirm-icon warn"><warning-outlined /></span>
          <h2 id="exchange-dialog-title">积分不足</h2>
          <p>兑换「{{ exchangeTarget.name }}」需要 {{ exchangeTarget.points }} 积分，当前可用积分不足。可通过签到、发帖和参与评论赚取积分。</p>
          <div class="confirm-actions">
            <RouterLink to="/points" class="secondary-button" @click="closeExchange">去赚积分</RouterLink>
            <button class="primary-button" @click="closeExchange">我知道了</button>
          </div>
        </template>
        <template v-else>
          <span class="confirm-icon"><gift-outlined /></span>
          <h2 id="exchange-dialog-title">确认兑换</h2>
          <p>确认使用 <b>{{ exchangeTarget.points }}</b> 积分兑换「<b>{{ exchangeTarget.name }}</b>」吗？兑换成功后积分将立即扣减。</p>
          <div class="confirm-actions">
            <button class="secondary-button" :disabled="exchangingId === exchangeTarget.id" @click="closeExchange">取消</button>
            <button class="primary-button" :disabled="exchangingId === exchangeTarget.id" @click="confirmExchange">{{ exchangingId === exchangeTarget.id ? '兑换中…' : '确认兑换' }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { GiftOutlined, InfoCircleOutlined, RightOutlined, ThunderboltOutlined, WalletOutlined, WarningOutlined } from '@ant-design/icons-vue'
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
const message = ref('')
const error = ref('')
const exchangeTarget = ref<Gift | null>(null)
const insufficient = ref(false)
const levelLockedDialog = ref(false)
const statusNames: Record<ExchangeRecord['status'], string> = {
  PENDING_ISSUE: '待发放',
  SHIPPING: '物流运输中',
  ISSUED: '已发放'
}
const categories = computed(() => ['全部礼品', ...new Set(gifts.value.map(gift => gift.category))])
const filteredGifts = computed(() => selectedCategory.value === '全部礼品' ? gifts.value : gifts.value.filter(gift => gift.category === selectedCategory.value))
const balanceText = computed(() => (balance.value ?? currentUser.value?.member.points)?.toLocaleString() || '—')
// 当前用户等级：登录后取会员等级，游客按 1 级（只能兑无门槛礼品）
const myLevel = computed(() => currentUser.value?.member?.level ?? 1)
function giftLocked(gift: Gift) {
  return (gift.minLevel ?? 1) > myLevel.value
}

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

function clearFeedback() {
  message.value = ''
  error.value = ''
}

function openExchange(gift: Gift) {
  if (!requireLogin(`兑换${gift.name}`)) return
  if (giftLocked(gift)) return
  clearFeedback()
  const available = balance.value ?? currentUser.value?.member.points ?? 0
  insufficient.value = available < gift.points
  levelLockedDialog.value = false
  exchangeTarget.value = gift
}

function closeExchange() {
  if (exchangingId.value) return
  exchangeTarget.value = null
  insufficient.value = false
  levelLockedDialog.value = false
}

async function confirmExchange() {
  const gift = exchangeTarget.value
  if (!gift || exchangingId.value) return
  exchangingId.value = gift.id
  clearFeedback()
  try {
    const result = await exchangeGift(gift.id)
    balance.value = result.balance
    gift.stock -= 1
    message.value = `兑换成功：${result.giftName}，剩余 ${result.balance} 积分。`
    exchangeTarget.value = null
    insufficient.value = false
    await Promise.all([refreshCurrentUser(), loadBalance()])
  } catch (cause) {
    const text = cause instanceof Error ? cause.message : '兑换失败'
    if (text.includes('积分')) {
      insufficient.value = true
    } else if (text.includes('等级')) {
      levelLockedDialog.value = true
    } else {
      error.value = text
      exchangeTarget.value = null
    }
  } finally {
    exchangingId.value = ''
  }
}
</script>
