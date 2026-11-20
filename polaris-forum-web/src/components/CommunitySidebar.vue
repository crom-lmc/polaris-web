<template>
  <aside class="community-sidebar">
    <section class="panel member-card">
      <!-- 我的中心整卡都要登录：未登录点进来由路由守卫直接送统一登录 -->
      <RouterLink to="/me" class="member-profile">
        <UserAvatar :name="displayName" :avatar-url="memberAvatar" :size="45" />
        <div><b>{{ isLoggedIn ? displayName : '社区游客' }}</b><span>{{ isLoggedIn ? `Lv.${currentUser?.member?.level || 1} ${currentUser?.member?.levelName || '社区成员'}` : '登录后参与互动并累积积分' }}</span></div>
        <crown-outlined />
      </RouterLink>
      <div class="member-level"><span>{{ isLoggedIn ? `累计积分 ${member?.totalPoints ?? member?.points ?? 0}` : '公开内容可直接浏览' }}</span><span v-if="summary">累计签到 {{ summary.checkinDays }} 天</span></div>
      <div class="member-stats"><div><b>{{ member?.points.toLocaleString() || '—' }}</b><span>积分</span></div><div><b>{{ member?.threadsCount ?? '—' }}</b><span>帖子</span></div><div><b>{{ member?.likesReceived ?? '—' }}</b><span>获赞</span></div></div>
      <div class="member-links"><RouterLink to="/points"><wallet-outlined />积分中心</RouterLink><RouterLink v-if="featureFlags.exchangeEnabled" to="/gifts"><gift-outlined />兑换礼品</RouterLink></div>
    </section>

    <section class="panel daily-checkin-card">
      <div class="sidebar-card-heading"><span><calendar-outlined />每日签到</span><small v-if="summary">累计 {{ summary.checkinDays }} 天</small></div>
      <p>今天签到可获得 10 积分，每个账号每天可签到一次。</p>
      <button :disabled="checkingIn || summary?.checkedIn" @click="handleCheckin"><check-circle-outlined />{{ checkingIn ? '签到中…' : summary?.checkedIn ? '今日已签到' : '立即签到' }}<span v-if="!summary?.checkedIn">+10</span></button>
      <p v-if="checkinMessage" class="sidebar-message">{{ checkinMessage }}</p>
    </section>

    <section class="panel sidebar-section compact-tags">
      <div class="panel-heading"><fire-outlined />热门板块</div>
      <div v-if="tagsLoading" class="ranking-empty">正在加载…</div>
      <div v-else-if="!hotTags.length" class="ranking-empty">暂无热门标签</div>
      <div v-else class="tag-cloud"><RouterLink v-for="tag in hotTags" :key="tag.name" :to="`/?board=${encodeURIComponent(tag.boardKey)}&q=${encodeURIComponent(tag.name)}`"># {{ tag.name }}<small>{{ tag.count }}</small></RouterLink></div>
    </section>

    <section class="panel ranking-card">
      <div class="sidebar-card-heading"><span><crown-outlined />等级排行</span><small>按累计经验</small></div>
      <div v-if="levelRankingLoading" class="ranking-empty">正在加载…</div>
      <div v-else-if="!levelRanking.length" class="ranking-empty">暂无排行数据</div>
      <div v-else class="ranking-list">
        <RouterLink v-for="(item, index) in levelRanking" :key="item.accountId" :to="`/members/${item.accountId}`" class="ranking-row">
          <span class="rank-number" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
          <UserAvatar :name="item.name || item.displayName || item.nickname || item.username" :avatar-url="item.avatarUrl" :size="30" />
          <div><b>{{ item.name || item.displayName || item.nickname || item.username }}</b><span :style="item.levelColor ? { color: item.levelColor } : {}">Lv.{{ item.level || 1 }} {{ item.levelName || '' }}</span></div>
          <strong>{{ (item.experience ?? 0).toLocaleString() }} 经验</strong>
        </RouterLink>
      </div>
    </section>

    <section class="panel ranking-card">
      <div class="sidebar-card-heading"><span><trophy-outlined />积分排行</span><small>真实积分</small></div>
      <div v-if="rankingLoading" class="ranking-empty">正在加载…</div>
      <div v-else-if="!ranking.length" class="ranking-empty">暂无排行数据</div>
      <div v-else class="ranking-list">
        <RouterLink v-for="(item, index) in ranking" :key="item.accountId" :to="`/members/${item.accountId}`" class="ranking-row">
          <span class="rank-number" :class="`rank-${index + 1}`">{{ index + 1 }}</span>
          <UserAvatar :name="item.name || item.displayName || item.nickname || item.username" :avatar-url="item.avatarUrl" :size="30" />
          <div><b>{{ item.name || item.displayName || item.nickname || item.username }}</b><span>Lv.{{ item.level || 1 }} · 累计 {{ item.totalPoints ?? item.points }}</span></div>
          <strong>{{ item.points }} 分</strong>
        </RouterLink>
      </div>
    </section>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarOutlined, CheckCircleOutlined, CrownOutlined, FireOutlined, GiftOutlined, TrophyOutlined, WalletOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { checkin, fetchBoards, fetchLevelRanking, fetchPointsRanking, fetchPointsSummary, type PointsSummary } from '@/api/forum'
import { currentUser, isLoggedIn, refreshCurrentUser, requireLogin } from '@/auth'
import { featureFlags } from '@/composables/useFeatureSwitch'
import type { Member } from '@/types'

interface HotTag {
  name: string
  count: number
  boardKey: string
}

const summary = ref<PointsSummary | null>(null)
const ranking = ref<Member[]>([])
const rankingLoading = ref(false)
const levelRanking = ref<Member[]>([])
const levelRankingLoading = ref(false)
const hotTags = ref<HotTag[]>([])
const tagsLoading = ref(false)
const checkingIn = ref(false)
const checkinMessage = ref('')
const member = computed(() => summary.value?.member || currentUser.value?.member || null)
const displayName = computed(() => member.value?.displayName || member.value?.nickname || currentUser.value?.username || 'P')
const memberAvatar = computed(() => member.value?.avatarUrl || (member.value?.avatarAttachmentId ? `/api/forum/public/attachments/${member.value.avatarAttachmentId}` : ''))

watch(isLoggedIn, logged => {
  summary.value = null
  checkinMessage.value = ''
  if (logged) loadSummary()
}, { immediate: true })
onMounted(() => {
  loadRanking()
  loadLevelRanking()
  loadHotTags()
})

async function loadSummary() {
  try {
    summary.value = await fetchPointsSummary()
  } catch (cause) {
    checkinMessage.value = cause instanceof Error ? cause.message : '签到信息加载失败'
  }
}

async function loadRanking() {
  rankingLoading.value = true
  try { ranking.value = await fetchPointsRanking(10) }
  catch { ranking.value = [] }
  finally { rankingLoading.value = false }
}

async function loadLevelRanking() {
  levelRankingLoading.value = true
  try { levelRanking.value = await fetchLevelRanking(10) }
  catch { levelRanking.value = [] }
  finally { levelRankingLoading.value = false }
}

async function loadHotTags() {
  tagsLoading.value = true
  try {
    const boardList = await fetchBoards()
    const tagMap = new Map<string, HotTag>()
    boardList.forEach(board => board.children?.forEach(child => {
      const existing = tagMap.get(child.name)
      if (existing) existing.count += child.count ?? 0
      else tagMap.set(child.name, { name: child.name, count: child.count ?? 0, boardKey: child.parentKey || board.key })
    }))
    hotTags.value = [...tagMap.values()]
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 12)
  } catch {
    hotTags.value = []
  } finally {
    tagsLoading.value = false
  }
}

async function handleCheckin() {
  if (!requireLogin('每日签到')) return
  checkingIn.value = true
  checkinMessage.value = ''
  try {
    summary.value = await checkin()
    await refreshCurrentUser()
    checkinMessage.value = '签到成功，10 积分已到账。'
    loadRanking()
    loadLevelRanking()
  } catch (cause) {
    checkinMessage.value = cause instanceof Error ? cause.message : '签到失败'
  } finally {
    checkingIn.value = false
  }
}
</script>
