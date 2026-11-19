<template>
  <div class="container badges-page">
    <section class="badges-hero panel">
      <div><span class="eyebrow">POLARIS BADGES</span><h1>社区勋章墙</h1><p>每一枚勋章都记录真实的社区贡献。发布内容、参与讨论、持续签到，解锁你的成长印记。</p></div>
      <div class="badges-hero-stat"><trophy-outlined /><b v-if="isLoggedIn">{{ earnedCount }}</b><b v-else>{{ badges.length }}</b><span>{{ isLoggedIn ? '已获得勋章' : '已发布勋章' }}</span></div>
    </section>
    <div v-if="!isLoggedIn" class="badge-login-tip panel"><span><lock-outlined />登录后可查看每枚勋章的当前进度与获得时间。</span><button class="primary-button" @click="requireLogin('查看我的勋章进度', '/badges')">统一登录</button></div>
    <p v-if="error" class="form-message error" role="alert">{{ error }} <button class="secondary-button" @click="load">重新加载</button></p>
    <div v-if="loading" class="panel page-state">正在加载勋章数据…</div>
    <div v-else-if="badges.length" class="badge-grid">
      <article v-for="badge in badges" :key="badge.id" class="panel badge-card" :class="{ earned: badge.awarded, locked: isLoggedIn && !badge.awarded }">
        <div class="badge-card-top">
          <span class="badge-large-icon" :style="{ color: badge.color, background: `${badge.color}18`, borderColor: `${badge.color}45` }"><span v-if="badge.icon">{{ badge.icon }}</span><trophy-outlined v-else /></span>
          <span v-if="badge.awarded" class="badge-earned-tag"><check-circle-outlined />已获得</span><span v-else-if="isLoggedIn" class="badge-progress-tag">未获得</span>
        </div>
        <h2>{{ badge.name }}</h2><p>{{ badge.description }}</p>
        <div class="badge-rule"><span>{{ ruleNames[badge.ruleType] }}</span><b>目标 {{ badge.targetValue ?? badge.threshold }}</b></div>
        <div v-if="isLoggedIn" class="badge-progress">
          <div><span>当前 {{ badge.currentValue ?? 0 }} / {{ badge.targetValue ?? badge.threshold }}</span><b>{{ progress(badge) }}%</b></div>
          <span class="badge-progress-track"><i :style="{ width: `${progress(badge)}%`, background: badge.color }"></i></span>
          <small v-if="badge.awarded && badge.awardedAt">获得于 {{ formatTime(badge.awardedAt) }}</small><small v-else>继续参与社区互动即可提升进度</small>
        </div>
        <div v-else class="badge-public-rule">累计达成 {{ badge.threshold }} {{ ruleUnits[badge.ruleType] }}后自动发放</div>
      </article>
    </div>
    <div v-else class="panel empty-state"><trophy-outlined /><h3>暂无已发布勋章</h3><p>勋章发布后，会在这里展示规则与获得进度。</p></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircleOutlined, LockOutlined, TrophyOutlined } from '@ant-design/icons-vue'
import { fetchMyBadges, fetchPublicBadges } from '@/api/forum'
import { isLoggedIn, requireLogin } from '@/auth'
import { formatTime } from '@/data/forum'
import type { Badge, BadgeRuleType } from '@/types'

const badges = ref<Badge[]>([])
const loading = ref(true)
const error = ref('')
const ruleNames: Record<BadgeRuleType, string> = { TOTAL_POINTS: '累计积分', THREAD_COUNT: '有效发帖', COMMENT_COUNT: '有效评论', CHECKIN_DAYS: '累计签到', LIKES_RECEIVED: '帖子获赞' }
const ruleUnits: Record<BadgeRuleType, string> = { TOTAL_POINTS: '分', THREAD_COUNT: '篇', COMMENT_COUNT: '条', CHECKIN_DAYS: '天', LIKES_RECEIVED: '次' }
const earnedCount = computed(() => badges.value.filter(badge => badge.awarded).length)
watch(isLoggedIn, load, { immediate: true })

async function load() {
  loading.value = true
  error.value = ''
  try { badges.value = isLoggedIn.value ? await fetchMyBadges() : await fetchPublicBadges() }
  catch (cause) { badges.value = []; error.value = cause instanceof Error ? cause.message : '勋章加载失败' }
  finally { loading.value = false }
}

function progress(badge: Badge) {
  const target = badge.targetValue ?? badge.threshold
  return target > 0 ? Math.min(100, Math.round((badge.currentValue ?? 0) * 100 / target)) : 0
}
</script>
