import { onMounted, ref } from 'vue'
import { fetchFeatureFlags } from '@/api/forum'

/**
 * 论坛功能开关（抽奖/兑换）共享状态。
 * 各后台配置页读取公开开关接口（来源为配置中心埋点）判断功能是否开启：
 * 关闭时页面所有操作按钮置灰，仅保留刷新，引导管理员到「配置中心 - 埋点管理」修改。
 */
const lotteryEnabled = ref(true)
const exchangeEnabled = ref(true)

export function useFeatureSwitch() {
  async function loadFeatureSwitch() {
    try {
      const flags = await fetchFeatureFlags()
      lotteryEnabled.value = flags.lotteryEnabled
      exchangeEnabled.value = flags.exchangeEnabled
    } catch {
      // 读取失败时保持默认开启，避免误把配置页全部置灰
      lotteryEnabled.value = true
      exchangeEnabled.value = true
    }
  }

  onMounted(() => { void loadFeatureSwitch() })

  return { lotteryEnabled, exchangeEnabled, loadFeatureSwitch }
}
