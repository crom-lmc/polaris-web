<template>
  <div class="container profile-page">
    <section class="profile-heading"><div><span class="eyebrow">MY POLARIS</span><h1>个人中心</h1><p>管理你的论坛资料、收藏、勋章与消息。</p></div><RouterLink to="/settings/profile" class="secondary-button"><edit-outlined />编辑资料</RouterLink></section>
    <div v-if="loading" class="panel page-state">正在加载个人中心…</div>
    <div v-else-if="error" class="panel page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
    <template v-else-if="profile">
      <section class="panel profile-summary-card">
        <UserAvatar :name="displayName" :avatar-url="profile.avatarUrl" :size="76" />
        <div class="profile-summary-copy"><div><h2>{{ displayName }}</h2><span class="level-badge" :style="levelBadgeStyle">Lv.{{ profile.level || 1 }} · {{ profile.levelName || '社区成员' }}</span></div><p>{{ profile.bio || '完善个人简介，让社区成员更了解你。' }}</p><RouterLink :to="`/members/${profile.accountId}`">查看公开个人主页 <arrow-right-outlined /></RouterLink></div>
        <div class="profile-points"><span>当前积分</span><b>{{ profile.points }}</b><small>累计 {{ profile.totalPoints ?? profile.points }}</small></div>
      </section>

      <div class="profile-stat-grid">
        <RouterLink to="/notifications" class="panel profile-stat-card"><span class="profile-stat-icon"><bell-outlined /></span><div><b>{{ unreadCount }}</b><span>未读消息</span></div><arrow-right-outlined /></RouterLink>
        <RouterLink to="/favorites" class="panel profile-stat-card"><span class="profile-stat-icon"><heart-outlined /></span><div><b>{{ favoriteCount }}</b><span>我的收藏</span></div><arrow-right-outlined /></RouterLink>
        <RouterLink to="/badges" class="panel profile-stat-card"><span class="profile-stat-icon"><trophy-outlined /></span><div><b>{{ earnedBadgeCount }}</b><span>已获得勋章</span></div><arrow-right-outlined /></RouterLink>
        <RouterLink to="/points" class="panel profile-stat-card"><span class="profile-stat-icon"><wallet-outlined /></span><div><b>{{ profile.threadsCount }}</b><span>发布帖子</span></div><arrow-right-outlined /></RouterLink>
      </div>

      <div class="profile-content-grid">
        <section class="panel profile-quick-card">
          <div class="member-section-heading"><h2>快捷入口</h2></div>
          <div class="profile-quick-links">
            <RouterLink to="/settings/profile"><idcard-outlined /><span><b>个人资料</b><small>修改显示名、头像、封面和联系方式</small></span><right-outlined /></RouterLink>
            <RouterLink to="/drafts"><save-outlined /><span><b>我的草稿</b><small>继续编辑尚未发布的内容</small></span><right-outlined /></RouterLink>
            <RouterLink v-if="featureFlags.exchangeEnabled" to="/gifts"><gift-outlined /><span><b>积分兑换</b><small>查看礼品与兑换记录</small></span><right-outlined /></RouterLink>
          </div>
        </section>
        <section class="panel profile-quick-card">
          <div class="member-section-heading"><h2>社区数据</h2></div>
          <div class="profile-activity-stats"><div><b>{{ profile.commentsCount ?? 0 }}</b><span>评论与回复</span></div><div><b>{{ profile.likesReceived }}</b><span>累计获赞</span></div><div><b>{{ profile.totalPoints ?? profile.points }}</b><span>累计积分</span></div></div>
          <div class="profile-level-progress">
            <div class="profile-level-line"><span>{{ profile.levelName || '社区成员' }} · 累计 {{ profile.experience ?? 0 }} 经验</span><b v-if="profile.nextLevel">距 Lv.{{ profile.nextLevel }} 还差 {{ profile.experienceToNext }} 经验</b><b v-else>已达最高等级</b></div>
            <div class="profile-level-track"><i :style="{ width: `${profile.levelProgress ?? 100}%` }"></i></div>
            <RouterLink to="/levels">查看等级晋升路线 <arrow-right-outlined /></RouterLink>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowRightOutlined, BellOutlined, EditOutlined, GiftOutlined, HeartOutlined, IdcardOutlined, RightOutlined, SaveOutlined, TrophyOutlined, WalletOutlined } from '@ant-design/icons-vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { fetchProfile } from '@/api/forum'
import { refreshUnreadCount, unreadCount } from '@/auth'
import { featureFlags } from '@/composables/useFeatureSwitch'
import type { Member } from '@/types'

const profile = ref<Member | null>(null)
const loading = ref(true)
const error = ref('')
const displayName = computed(() => profile.value?.displayName || profile.value?.nickname || profile.value?.username || '')
const levelBadgeStyle = computed(() => profile.value?.levelColor ? { color: '#fff', background: profile.value.levelColor } : {})
const favoriteCount = computed(() => profile.value?.favoriteCount ?? 0)
const earnedBadgeCount = computed(() => profile.value?.badgeCount ?? 0)
onMounted(load)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [member] = await Promise.all([fetchProfile(), refreshUnreadCount()])
    profile.value = member
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '个人中心加载失败'
  } finally {
    loading.value = false
  }
}
</script>
