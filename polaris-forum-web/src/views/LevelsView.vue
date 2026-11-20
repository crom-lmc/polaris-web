<template>
  <div class="container rewards-page level-route-page">
    <RewardsNav />

    <section class="panel level-hero">
      <div class="level-hero-current" :style="{ '--level-color': currentColor }">
        <span class="level-hero-badge"><rise-outlined /></span>
        <div class="level-hero-copy">
          <span class="eyebrow">MY LEVEL</span>
          <h1>{{ isLoggedIn ? route?.currentLevelName || '社区成员' : '加入北极星社区' }}</h1>
          <p v-if="isLoggedIn && route">当前 Lv.{{ route.currentLevel }} · 累计经验 {{ route.totalExperience.toLocaleString() }}</p>
          <p v-else>登录后累积经验，沿着成长路线一路晋升，解锁更多社区权益。</p>
          <div v-if="isLoggedIn && route" class="level-hero-progress">
            <div class="level-progress-track"><i :style="{ width: `${route.progress}%` }"></i></div>
            <div class="level-progress-meta">
              <span v-if="route.nextLevel">距 Lv.{{ route.nextLevel }} {{ route.nextLevelName }} 还差 {{ route.experienceToNext }} 经验</span>
              <span v-else>已达成最高等级，感谢一路同行</span>
              <b>{{ route.progress }}%</b>
            </div>
          </div>
          <div v-else class="level-hero-actions"><button class="primary-button" @click="requireLogin('查看等级路线')">统一登录</button></div>
        </div>
      </div>
    </section>

    <section v-if="rules.length" class="panel exp-guide">
      <h2><thunderbolt-outlined /> 如何获得经验</h2>
      <p>经验值只增不减，参与社区互动即可累积，用于提升社区等级（与可消费的积分相互独立）。</p>
      <div class="exp-rule-list">
        <div v-for="rule in rules" :key="rule.id" class="exp-rule-item">
          <span class="exp-rule-name">{{ rule.name }}</span>
          <b>+{{ rule.experience }} 经验</b>
        </div>
      </div>
    </section>

    <section class="level-roadmap">
      <div class="level-roadmap-heading"><div><h2>晋升路线</h2><p>每提升一级，解锁新的身份标识与社区权益。</p></div></div>
      <div v-if="loading" class="panel compact-state">正在加载等级路线…</div>
      <div v-else-if="!levels.length" class="panel compact-state">暂无等级配置，请联系社区管理员。</div>
      <div v-else class="level-steps">
        <div
          v-for="level in levels"
          :key="level.id"
          class="level-step"
          :class="{ current: isLoggedIn && level.levelNo === route?.currentLevel, reached: isLoggedIn && level.levelNo <= (route?.currentLevel ?? 0) }"
          :style="{ '--level-color': level.color || '#5b67f1' }"
        >
          <div class="level-step-node">
            <span class="level-step-badge"><rise-outlined v-if="!level.icon" /><span v-else>{{ level.icon }}</span></span>
            <span v-if="isLoggedIn && level.levelNo === route?.currentLevel" class="level-step-current-tag">当前</span>
            <span v-else-if="isLoggedIn && level.levelNo < (route?.currentLevel ?? 0)" class="level-step-reached-tag"><check-outlined /></span>
          </div>
          <div class="level-step-card panel">
            <span class="level-step-no">LV.{{ level.levelNo }}</span>
            <h3>{{ level.name }}</h3>
            <div class="level-step-threshold"><thunderbolt-outlined />累计 {{ level.minExperience.toLocaleString() }} 经验</div>
            <p class="level-step-desc">{{ level.description || '持续参与社区互动即可解锁。' }}</p>
            <div class="level-step-privilege"><check-circle-outlined /><span>{{ level.privileges || '解锁专属社区权益' }}</span></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckCircleOutlined, CheckOutlined, RiseOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import RewardsNav from '@/components/RewardsNav.vue'
import { fetchExperienceRules, fetchLevelRoute } from '@/api/forum'
import { isLoggedIn, requireLogin } from '@/auth'
import type { ExperienceRule, ForumLevel, LevelRoute } from '@/types'

const route = ref<LevelRoute | null>(null)
const rules = ref<ExperienceRule[]>([])
const loading = ref(true)
const levels = computed<ForumLevel[]>(() => route.value?.levels || [])
const currentColor = computed(() => route.value?.currentLevelColor || '#5b67f1')

onMounted(load)

async function load() {
  loading.value = true
  try {
    const [routeData, ruleData] = await Promise.all([fetchLevelRoute(), fetchExperienceRules()])
    route.value = routeData
    rules.value = ruleData
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.level-route-page { padding-top: 20px; }
.level-hero { margin-bottom: 20px; overflow: hidden; }
.exp-guide { margin-bottom: 20px; padding: 18px 22px; }
.exp-guide h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 16px; }
.exp-guide h2 .anticon { color: #fa8c16; }
.exp-guide > p { margin: 0 0 14px; color: var(--muted); font-size: 13px; }
.exp-rule-list { display: flex; flex-wrap: wrap; gap: 12px; }
.exp-rule-item { display: flex; align-items: center; gap: 14px; padding: 10px 16px; border: 1px solid var(--panel-border); border-radius: 8px; background: var(--panel-bg); }
.exp-rule-name { color: var(--text, inherit); font-size: 14px; }
.exp-rule-item b { color: #fa8c16; font-size: 14px; }
.level-hero-current { display: flex; align-items: center; gap: 22px; padding: 26px 28px; background: linear-gradient(120deg, color-mix(in srgb, var(--level-color) 16%, transparent), transparent 70%); }
.level-hero-badge { display: inline-flex; flex: 0 0 88px; width: 88px; height: 88px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 40px; background: var(--level-color); box-shadow: 0 8px 24px color-mix(in srgb, var(--level-color) 35%, transparent); }
.level-hero-copy { flex: 1; min-width: 0; }
.level-hero-copy h1 { margin: 4px 0 6px; font-size: 26px; }
.level-hero-copy > p { margin: 0; color: var(--muted); font-size: 14px; }
.level-hero-progress { margin-top: 16px; max-width: 520px; }
.level-progress-track { height: 10px; border-radius: 999px; background: var(--panel-border); overflow: hidden; }
.level-progress-track i { display: block; height: 100%; border-radius: 999px; background: var(--level-color); transition: width .4s ease; }
.level-progress-meta { display: flex; justify-content: space-between; margin-top: 8px; color: var(--muted); font-size: 13px; }
.level-progress-meta b { color: var(--level-color); }
.level-hero-actions { margin-top: 16px; }
.level-roadmap-heading { margin-bottom: 16px; }
.level-roadmap-heading h2 { margin: 0; font-size: 18px; }
.level-roadmap-heading p { margin: 4px 0 0; color: var(--muted); font-size: 13px; }
.level-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 22px 18px; }
.level-step { position: relative; display: flex; flex-direction: column; align-items: center; }
.level-step-node { position: relative; display: flex; align-items: center; justify-content: center; height: 52px; width: 100%; margin-bottom: -26px; z-index: 1; }
.level-step-badge { display: inline-flex; width: 50px; height: 50px; align-items: center; justify-content: center; border-radius: 50%; color: #fff; font-size: 20px; background: var(--level-color); border: 3px solid var(--page-bg, #fff); box-shadow: 0 4px 12px color-mix(in srgb, var(--level-color) 30%, transparent); }
.level-step:not(.reached) .level-step-badge { filter: grayscale(.55); opacity: .65; }
.level-step-current-tag { position: absolute; top: -10px; right: calc(50% - 44px); padding: 1px 8px; border-radius: 999px; font-size: 11px; color: #fff; background: var(--level-color); white-space: nowrap; }
.level-step-reached-tag { position: absolute; top: -6px; right: calc(50% - 30px); display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; color: #fff; background: #22a06b; font-size: 11px; }
.level-step-card { width: 100%; padding: 38px 18px 18px; text-align: center; transition: transform .2s ease, box-shadow .2s ease; }
.level-step.current .level-step-card { border-color: var(--level-color); box-shadow: 0 8px 24px color-mix(in srgb, var(--level-color) 18%, transparent); }
.level-step-no { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; color: var(--level-color); background: color-mix(in srgb, var(--level-color) 14%, transparent); }
.level-step-card h3 { margin: 10px 0 6px; font-size: 17px; }
.level-step-threshold { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--level-color); font-weight: 600; }
.level-step-desc { margin: 10px 0; min-height: 36px; font-size: 13px; line-height: 18px; color: var(--muted); }
.level-step-privilege { display: flex; align-items: center; justify-content: center; gap: 6px; padding-top: 10px; border-top: 1px dashed var(--panel-border); font-size: 12px; color: var(--text, inherit); }
.level-step-privilege .anticon { color: #22a06b; }
@media (max-width: 640px) {
  .level-hero-current { flex-direction: column; align-items: flex-start; padding: 20px; }
  .level-steps { grid-template-columns: 1fr; }
}
</style>
