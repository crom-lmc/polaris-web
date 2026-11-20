<template>
  <div class="container rewards-page">
    <div class="rewards-heading"><div><span class="eyebrow">LUCKY DRAW</span><h1>积分抽奖</h1><p>小积分，大惊喜，试试今天的好运气。</p></div></div>
    <RewardsNav />

    <div class="lottery-layout">
      <section class="panel lottery-board">
        <div class="lottery-board-heading"><div><span>今日剩余机会</span><b>{{ isLoggedIn ? `${remaining} 次` : '登录后查看' }}</b></div><div><span>我的可用积分</span><b>{{ balanceText }}</b></div></div>
        <div v-if="loading" class="compact-state">正在加载奖品配置…</div>

        <!-- 方形九宫格：外圈 8 格放奖项，中间是抽奖按钮 -->
        <div v-else-if="isSquare && config" class="lottery-grid">
          <template v-for="cell in gridCells" :key="cell">
            <div v-if="cell === 4" class="lottery-core">
              <gift-outlined />
              <button :disabled="drawing || (isLoggedIn && remaining <= 0)" @click="draw">{{ drawing ? '抽奖中…' : !isLoggedIn ? '登录后抽奖' : remaining <= 0 ? '今日已用完' : '立即抽奖' }}</button>
              <span>{{ config.lotteryCost }} 积分 / 次</span>
            </div>
            <div v-else class="lottery-prize" :class="{ selected: spinCell === cell || (!drawing && hitCell === cell) }" :style="cellStyle(cell)">
              <template v-if="prizeAtCell(cell)">
                <img v-if="isGift(prizeAtCell(cell)!) && prizeAtCell(cell)!.giftImageUrl" :src="prizeAtCell(cell)!.giftImageUrl" class="prize-gift-image" alt="" />
                <gift-outlined v-else />
                <b>{{ prizeAtCell(cell)!.name }}</b>
                <span v-if="isGift(prizeAtCell(cell)!)">礼品 · 中奖后发放</span>
                <span v-else>{{ (prizeAtCell(cell)!.points || 0) > 0 ? '积分即时到账' : '好运在路上' }}</span>
              </template>
              <template v-else><gift-outlined /><b>奖项占位</b><span>待配置</span></template>
            </div>
          </template>
        </div>

        <!-- 转盘：扇区按配置数量均分，指针固定在正上方 -->
        <div v-else-if="config" class="wheel-stage">
          <div class="wheel-pointer" />
          <div class="wheel" :style="wheelStyle">
            <div v-for="(prize, index) in config.prizes" :key="prize.key" class="wheel-label"
                 :style="wheelLabelStyle(index)">
              <span>{{ prize.name }}</span>
              <small v-if="isGift(prize)">礼品</small>
              <small v-else-if="(prize.points || 0) > 0">{{ prize.points }} 分</small>
            </div>
          </div>
          <button class="wheel-spin" :disabled="drawing || (isLoggedIn && remaining <= 0)" @click="draw">
            {{ drawing ? '抽奖中…' : !isLoggedIn ? '登录后抽奖' : remaining <= 0 ? '今日已用完' : '立即抽奖' }}
          </button>
        </div>

        <p v-if="lastResult && !drawing" class="draw-result">
          <check-circle-outlined />{{ isGift(lastResult.prize)
            ? `抽奖结果：获得礼品「${lastResult.prize.giftName || lastResult.prize.name}」，可在兑换记录查看发放进度。`
            : `抽奖结果：${lastResult.prize.name}，当前余额 ${lastResult.balance} 积分。` }}
        </p>
        <p v-if="error" class="form-message error" role="alert">{{ error }}</p>
        <p class="lottery-static-tip"><info-circle-outlined />每次抽奖由服务端随机开奖并保存流水，积分与礼品奖励均可查询</p>
      </section>

      <aside class="lottery-sidebar">
        <section class="panel reward-side-card">
          <span class="side-icon"><read-outlined /></span><h3>活动规则</h3>
          <ol class="lottery-rules"><li><span>1</span>每次抽奖消耗 {{ config?.lotteryCost || 50 }} 积分，每日最多参与 {{ config?.dailyLotteryLimit || 3 }} 次。</li><li><span>2</span>积分不足或当日次数用完时无法继续参与。</li><li><span>3</span>抽中积分即时到账；抽中礼品将自动进入兑换记录，由管理员安排发放。</li><li><span>4</span>抽奖结果以服务端返回和保存的记录为准。</li></ol>
        </section>
        <section class="panel reward-side-card draw-balance-card">
          <span class="side-icon"><wallet-outlined /></span><h3>积分不够？</h3><p>签到、发帖和参与评论都可以获得积分。</p><RouterLink to="/points" class="secondary-button full-button">去赚积分<right-outlined /></RouterLink>
        </section>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { CheckCircleOutlined, GiftOutlined, InfoCircleOutlined, ReadOutlined, RightOutlined, WalletOutlined } from '@ant-design/icons-vue'
import RewardsNav from '@/components/RewardsNav.vue'
import { drawLottery, fetchPointsSummary, fetchRewardConfig, type DrawResult, type RewardConfig } from '@/api/forum'
import type { Prize } from '@/types'
import { currentUser, isLoggedIn, refreshCurrentUser, requireLogin } from '@/auth'

const config = ref<RewardConfig | null>(null)
const lastResult = ref<DrawResult | null>(null)
const spinCell = ref(-1)
const hitCell = ref(-1)
const wheelRotation = ref(0)
const balance = ref<number | null>(null)
const remaining = ref(3)
const loading = ref(true)
const drawing = ref(false)
const error = ref('')
const balanceText = computed(() => (balance.value ?? currentUser.value?.member.points)?.toLocaleString() || '—')
const isSquare = computed(() => (config.value?.mode || 'SQUARE') !== 'WHEEL')
function isGift(prize: Prize): boolean {
  return prize.prizeType === 'GIFT'
}

// 方形九宫格：格子位置按行优先 0-8，中心 4 为抽奖按钮；奖项按下标依次落在外圈 8 格
// 注意用 0-8 的索引渲染（v-for="cell in 9" 是 1-9，会导致按钮错位到第二行第一列）
const gridCells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const GRID_POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8]
// 外圈顺时针环（格子位置），用于依次高亮转动
const SPIN_RING = [0, 1, 2, 5, 8, 7, 6, 3]
let spinTimer: ReturnType<typeof setTimeout> | null = null

function prizeAtCell(cell: number): Prize | null {
  const index = GRID_POSITIONS.indexOf(cell)
  return index >= 0 && config.value ? config.value.prizes[index] ?? null : null
}

function cellStyle(cell: number) {
  const prize = prizeAtCell(cell)
  return prize ? { background: prize.color || '#fff' } : {}
}

function indexToCell(index: number): number {
  return GRID_POSITIONS[index] ?? GRID_POSITIONS[0]
}

const prizeCount = computed(() => config.value?.prizes.length ?? 0)
const segmentAngle = computed(() => (prizeCount.value > 0 ? 360 / prizeCount.value : 360))

const wheelStyle = computed(() => ({
  background: conicBackground(),
  transform: `rotate(${wheelRotation.value}deg)`,
  transition: drawing.value ? 'transform 4s cubic-bezier(0.12, 0.72, 0.12, 1)' : 'none'
}))

function wheelLabelStyle(index: number) {
  const angle = index * segmentAngle.value + segmentAngle.value / 2
  return {
    transform: `rotate(${angle}deg) translateY(calc(-1 * var(--wheel-label-r))) rotate(${-angle}deg)`,
    color: '#3b4260'
  }
}

function conicBackground() {
  const prizes = config.value?.prizes ?? []
  if (!prizes.length) return 'conic-gradient(#eef0ff, #f6f7fb)'
  const seg = 360 / prizes.length
  const stops = prizes.map((p, i) => `${p.color || '#eef0ff'} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')
  return `conic-gradient(from 0deg, ${stops})`
}

function stopSpin() {
  if (spinTimer) { clearTimeout(spinTimer); spinTimer = null }
}
onUnmounted(stopSpin)

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
  hitCell.value = -1
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
  lastResult.value = null
  hitCell.value = -1
  stopSpin()
  try {
    // 服务端先开奖，再用结果驱动动画，最后停在奖品格/扇区
    const result = await drawLottery()
    if (isSquare.value) await playSquare(result.index)
    else await playWheel(result.index)
    lastResult.value = result
    balance.value = result.balance
    remaining.value = result.remaining
    await refreshCurrentUser()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '抽奖失败'
  } finally {
    stopSpin()
    spinCell.value = -1
    hitCell.value = isSquare.value ? indexToCell(lastResult.value?.index ?? -1) : -1
    if (hitCell.value < 0) hitCell.value = -1
    drawing.value = false
  }
}

function playSquare(index: number): Promise<void> {
  return new Promise(resolve => {
    const targetCell = indexToCell(index)
    const targetPos = Math.max(0, SPIN_RING.indexOf(targetCell))
    let steps = 40 - (40 % SPIN_RING.length) + targetPos
    if (steps <= 40) steps += SPIN_RING.length
    let step = 0
    const tick = () => {
      spinCell.value = SPIN_RING[step % SPIN_RING.length]
      if (step >= steps) {
        spinCell.value = targetCell
        resolve()
        return
      }
      const progress = step / steps
      const delay = 40 + Math.pow(progress, 3) * 360
      step += 1
      spinTimer = setTimeout(tick, delay)
    }
    tick()
  })
}

function playWheel(index: number): Promise<void> {
  return new Promise(resolve => {
    const seg = segmentAngle.value || 360
    const center = index * seg + seg / 2
    const current = ((wheelRotation.value % 360) + 360) % 360
    const delta = ((-center - current) % 360 + 360) % 360
    wheelRotation.value = wheelRotation.value + 5 * 360 + delta
    spinTimer = setTimeout(resolve, 4100)
  })
}
</script>

<style scoped>
.lottery-prize { min-height: 110px; }
.prize-gift-image { width: 34px; height: 34px; object-fit: cover; border-radius: 8px; }
.wheel-stage { position: relative; width: 360px; height: 360px; margin: 8px auto; display: flex; align-items: center; justify-content: center; --wheel-label-r: 112px; }
.wheel {
  position: absolute; inset: 0; border-radius: 50%;
  border: 6px solid #fff; box-shadow: 0 12px 34px rgb(78 90 213 / 18%), inset 0 0 0 2px rgb(255 255 255 / 60%);
  will-change: transform;
}
.wheel-label {
  position: absolute; left: 50%; top: 50%; width: 108px; margin-left: -54px; margin-top: -14px;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  font-size: 13px; font-weight: 700; text-align: center; text-shadow: 0 1px 2px rgb(255 255 255 / 70%);
  pointer-events: none;
}
.wheel-label small { font-size: 10px; font-weight: 500; opacity: 0.75; }
.wheel-pointer {
  position: absolute; top: -10px; left: 50%; z-index: 3; transform: translateX(-50%);
  width: 0; height: 0; border-left: 13px solid transparent; border-right: 13px solid transparent;
  border-top: 26px solid #4e5ad5; filter: drop-shadow(0 2px 3px rgb(0 0 0 / 20%));
}
.wheel-spin {
  position: relative; z-index: 4; width: 92px; height: 92px; border: 4px solid #fff; border-radius: 50%;
  color: #fff; background: linear-gradient(145deg, #6873e8, #4e5ad5); box-shadow: 0 6px 18px rgb(78 90 213 / 32%);
  font-size: 14px; font-weight: 700; cursor: pointer;
}
.wheel-spin:disabled { opacity: 0.7; cursor: not-allowed; }
@media (max-width: 640px) {
  .wheel-stage { width: 280px; height: 280px; --wheel-label-r: 86px; }
  .wheel-label { width: 84px; margin-left: -42px; font-size: 11px; }
  .wheel-spin { width: 76px; height: 76px; font-size: 12px; }
}
</style>
