<template>
  <div class="container member-page">
    <div v-if="loading" class="panel page-state">正在加载个人主页…</div>
    <div v-else-if="error" class="panel page-state error-state"><p>{{ error }}</p><button class="secondary-button" @click="load">重新加载</button></div>
    <template v-else-if="member">
      <section class="panel member-hero">
        <div class="member-cover"><img v-if="member.coverUrl" :src="member.coverUrl" alt="个人主页封面" /></div>
        <div class="member-hero-content">
          <UserAvatar class="member-page-avatar" :name="displayName" :avatar-url="member.avatarUrl" :size="104" />
          <div class="member-identity">
            <div><h1>{{ displayName }}</h1><span class="level-badge" :style="member.levelColor ? { color: '#fff', background: member.levelColor } : {}">Lv.{{ member.level || 1 }} {{ member.levelName || '社区成员' }}</span></div>
            <p>@{{ member.username }}<span v-if="member.location"> · {{ member.location }}</span></p>
            <p class="member-bio">{{ member.bio || '这位成员还没有填写个人简介。' }}</p>
            <a v-if="safeWebsite" :href="safeWebsite" target="_blank" rel="noopener noreferrer" class="member-website"><link-outlined />{{ member.website }}</a>
          </div>
          <RouterLink v-if="isOwn" to="/settings/profile" class="secondary-button member-edit-button"><edit-outlined />编辑资料</RouterLink>
          <button v-else class="member-edit-button" :class="member.following ? 'secondary-button' : 'primary-button'" :disabled="followPending" @click="toggleFollow"><user-add-outlined v-if="!member.following" /><check-outlined v-else />{{ followPending ? '处理中…' : member.following ? '已关注' : '关注' }}</button>
        </div>
        <div class="member-page-stats">
          <div><b>{{ member.points }}</b><span>当前积分</span></div>
          <div><b>{{ member.totalPoints ?? member.points }}</b><span>累计积分</span></div>
          <div><b>{{ member.threadsCount }}</b><span>发帖</span></div>
          <div><b>{{ member.commentsCount ?? 0 }}</b><span>评论</span></div>
          <div><b>{{ member.likesReceived }}</b><span>获赞</span></div>
          <button type="button" @click="selectSection('following')"><b>{{ member.followingCount ?? 0 }}</b><span>关注</span></button>
          <button type="button" @click="selectSection('followers')"><b>{{ followerTotal }}</b><span>粉丝</span></button>
        </div>
        <p v-if="followError" class="form-message error member-follow-error" role="alert">{{ followError }}</p>
      </section>

      <div class="member-content-layout">
        <section class="panel member-content-card">
          <div class="member-section-heading"><h2>{{ section === 'threads' ? '发布内容' : section === 'following' ? '关注成员' : '粉丝成员' }}</h2><span>{{ section === 'threads' ? `${threads.length} 条` : `${relations.length} 人` }}</span></div>
          <div class="member-thread-tabs member-main-tabs">
            <button :class="{ active: section === 'threads' }" @click="selectSection('threads')">发布内容</button>
            <button :class="{ active: section === 'following' }" @click="selectSection('following')">关注 {{ member.followingCount ?? 0 }}</button>
            <button :class="{ active: section === 'followers' }" @click="selectSection('followers')">粉丝 {{ followerTotal }}</button>
          </div>
          <template v-if="section === 'threads'">
            <div v-if="threadsLoading" class="compact-state">正在加载发布内容…</div>
            <div v-else-if="threadsError" class="compact-state error-state"><p>{{ threadsError }}</p><button class="secondary-button" @click="loadThreads">重新加载</button></div>
            <div v-else-if="threads.length"><ThreadCard v-for="thread in threads" :key="thread.id" :thread="thread" /></div>
            <div v-else class="empty-state"><file-text-outlined /><h3>暂无发布内容</h3><p>当前分类下还没有公开内容。</p></div>
          </template>
          <template v-else>
            <div v-if="relationsLoading" class="compact-state">正在加载成员列表…</div>
            <div v-else-if="relationsError" class="compact-state error-state"><p>{{ relationsError }}</p><button class="secondary-button" @click="loadRelations">重新加载</button></div>
            <div v-else-if="relations.length" class="member-relation-list">
              <RouterLink v-for="item in relations" :key="item.accountId" :to="`/members/${item.accountId}`" class="member-relation-row">
                <UserAvatar :name="relationName(item)" :avatar-url="item.avatarUrl" :size="44" />
                <div><b>{{ relationName(item) }}</b><span>@{{ item.username }}<template v-if="item.location"> · {{ item.location }}</template></span><p>{{ item.bio || '这位成员还没有填写个人简介。' }}</p></div>
                <right-outlined />
              </RouterLink>
            </div>
            <div v-else class="empty-state"><user-outlined /><h3>{{ section === 'following' ? '还没有关注成员' : '还没有粉丝' }}</h3><p>成员关系会展示在这里。</p></div>
          </template>
        </section>

        <aside class="member-side">
          <section class="panel sidebar-section member-badges-card">
            <div class="member-section-heading"><h2><trophy-outlined class="section-title-icon" />已获得勋章</h2><RouterLink to="/badges">勋章墙<right-outlined class="section-more-arrow" /></RouterLink></div>
            <div v-if="member.badges?.length" class="member-badge-list">
              <div v-for="badge in member.badges" :key="badge.id" class="member-badge-summary">
                <span class="badge-icon" :style="{ color: badge.color, background: `${badge.color}1f` }"><span v-if="badge.icon" class="badge-glyph">{{ badge.icon }}</span><trophy-outlined v-else /></span>
                <div class="member-badge-copy"><b>{{ badge.name }}</b><small>{{ badge.description }}</small></div>
              </div>
            </div>
            <p v-else class="compact-state">还没有获得勋章</p>
          </section>
          <section class="panel sidebar-section member-about-card">
            <div class="member-section-heading"><h2><idcard-outlined class="section-title-icon" />个人资料</h2></div>
            <dl class="member-about-list">
              <div><dt><user-outlined />论坛账号</dt><dd class="about-username">{{ member.username }}</dd></div>
              <div><dt><trophy-outlined />社区等级</dt><dd><span class="level-badge" :style="member.levelColor ? { color: '#fff', background: member.levelColor } : {}">Lv.{{ member.level || 1 }} {{ member.levelName || '社区成员' }}</span><small class="about-level-exp">累计 {{ member.experience ?? 0 }} 经验</small></dd></div>
              <div v-if="member.location"><dt><environment-outlined />所在地</dt><dd>{{ member.location }}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { CheckOutlined, EditOutlined, EnvironmentOutlined, FileTextOutlined, IdcardOutlined, LinkOutlined, RightOutlined, TrophyOutlined, UserAddOutlined, UserOutlined } from '@ant-design/icons-vue'
import ThreadCard from '@/components/ThreadCard.vue'
import UserAvatar from '@/components/UserAvatar.vue'
import { fetchMember, fetchMemberRelations, fetchMemberThreads, followMember, unfollowMember } from '@/api/forum'
import { currentUser, requireLogin } from '@/auth'
import type { Member, MemberRelation, Thread } from '@/types'

const route = useRoute()
const member = ref<Member | null>(null)
const threads = ref<Thread[]>([])
const loading = ref(true)
const threadsLoading = ref(false)
const error = ref('')
const threadsError = ref('')
const section = ref<'threads' | 'following' | 'followers'>('threads')
const relations = ref<MemberRelation[]>([])
const relationsLoading = ref(false)
const relationsError = ref('')
const followPending = ref(false)
const followError = ref('')
const displayName = computed(() => member.value?.displayName || member.value?.nickname || member.value?.username || '')
const isOwn = computed(() => Boolean(currentUser.value?.accountId) && currentUser.value?.accountId === routeAccountId())
const followerTotal = computed(() => member.value?.followersCount ?? 0)
const safeWebsite = computed(() => {
  if (!member.value?.website) return ''
  try {
    const url = new URL(member.value.website)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch { return '' }
})

watch(() => route.params.accountId, load, { immediate: true })
watch(() => currentUser.value?.accountId, (accountId, previousAccountId) => {
  if (member.value && accountId !== previousAccountId) load()
})

function routeAccountId() {
  const value = route.params.accountId
  return typeof value === 'string' ? value : ''
}

async function load() {
  const accountId = routeAccountId()
  if (!/^[1-9]\d*$/.test(accountId)) {
    loading.value = false
    error.value = '成员编号不正确'
    return
  }
  loading.value = true
  error.value = ''
  member.value = null
  section.value = 'threads'
  relations.value = []
  followError.value = ''
  try {
    const [profile, list] = await Promise.all([fetchMember(accountId), fetchMemberThreads(accountId)])
    member.value = profile
    threads.value = list
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '个人主页加载失败'
  } finally {
    loading.value = false
  }
}

async function loadThreads() {
  const accountId = routeAccountId()
  if (!member.value || !/^[1-9]\d*$/.test(accountId)) return
  threadsLoading.value = true
  threadsError.value = ''
  try { threads.value = await fetchMemberThreads(accountId) }
  catch (cause) { threadsError.value = cause instanceof Error ? cause.message : '发布内容加载失败' }
  finally { threadsLoading.value = false }
}

function relationName(item: MemberRelation) {
  return item.displayName || item.nickname || item.username
}

function selectSection(value: 'threads' | 'following' | 'followers') {
  section.value = value
  if (value !== 'threads') loadRelations()
}

async function loadRelations() {
  if (section.value === 'threads') return
  const accountId = routeAccountId()
  const currentSection = section.value
  relationsLoading.value = true
  relationsError.value = ''
  try {
    const result = await fetchMemberRelations(accountId, currentSection)
    if (section.value === currentSection) relations.value = result
  } catch (cause) {
    relationsError.value = cause instanceof Error ? cause.message : '成员列表加载失败'
  } finally {
    relationsLoading.value = false
  }
}

async function toggleFollow() {
  if (!member.value || isOwn.value || !requireLogin(member.value.following ? '取消关注成员' : '关注成员')) return
  const wasFollowing = Boolean(member.value.following)
  followPending.value = true
  followError.value = ''
  try {
    const result = wasFollowing ? await unfollowMember(member.value.accountId) : await followMember(member.value.accountId)
    member.value.following = result.following
    const nextCount = Math.max(0, followerTotal.value + (result.following ? 1 : -1))
    member.value.followersCount = nextCount
    if (section.value !== 'threads') await loadRelations()
  } catch (cause) {
    followError.value = cause instanceof Error ? cause.message : '关注操作失败'
  } finally {
    followPending.value = false
  }
}
</script>
