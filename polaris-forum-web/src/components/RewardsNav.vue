<template>
  <nav class="rewards-nav" aria-label="积分服务导航">
    <RouterLink to="/points"><wallet-outlined />积分中心</RouterLink>
    <RouterLink to="/levels"><rise-outlined />等级晋升</RouterLink>
    <RouterLink v-if="featureFlags.lotteryEnabled" to="/lottery"><thunderbolt-outlined />积分抽奖</RouterLink>
    <RouterLink v-if="featureFlags.exchangeEnabled" to="/gifts"><gift-outlined />礼品兑换</RouterLink>
  </nav>
</template>

<script setup lang="ts">
import { GiftOutlined, RiseOutlined, ThunderboltOutlined, WalletOutlined } from '@ant-design/icons-vue'
import { featureFlags } from '@/composables/useFeatureSwitch'
</script>
