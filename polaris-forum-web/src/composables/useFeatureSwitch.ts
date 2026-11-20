import { reactive } from 'vue'
import { fetchFeatureFlags } from '@/api/forum'
import type { FeatureFlags } from '@/types'

/**
 * 论坛功能开关（抽奖/兑换）共享状态。
 * 开关来自配置中心埋点，通过公开接口读取：关闭时前台隐藏对应模块入口，路由守卫拦截直接访问。
 * 默认开启（fail-open）：接口失败时不误伤正常功能，由服务端接口继续兜底校验。
 */
export const featureFlags = reactive<FeatureFlags>({ lotteryEnabled: true, exchangeEnabled: true })

let loading: Promise<FeatureFlags | null> | null = null

/** 加载一次并缓存，App 挂载与路由守卫共用同一请求。 */
export function loadFeatureSwitch(): Promise<FeatureFlags | null> {
  if (!loading) {
    loading = fetchFeatureFlags()
      .then(flags => {
        featureFlags.lotteryEnabled = flags.lotteryEnabled !== false
        featureFlags.exchangeEnabled = flags.exchangeEnabled !== false
        return flags
      })
      .catch(() => null)
  }
  return loading
}
