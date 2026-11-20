import { fetchAppName } from '@/api/forum'

const cache = new Map<string, string>()
const pending = new Map<string, Promise<string>>()

/** 查询应用名；成功结果按 appCode 缓存，失败返回空串由调用方决定兜底。 */
export function resolveAppName(appCode: string): Promise<string> {
  const cached = cache.get(appCode)
  if (cached) return Promise.resolve(cached)

  let task = pending.get(appCode)
  if (!task) {
    task = fetchAppName(appCode)
      .then((name) => {
        if (name) cache.set(appCode, name)
        return name
      })
      .finally(() => pending.delete(appCode))
    pending.set(appCode, task)
  }
  return task
}

/** 浏览器标签只显示 SSO 登记的应用名；查询失败时保留 index.html 里的标题不动。 */
export async function applyAppTitle(appCode: string) {
  const name = await resolveAppName(appCode)
  if (name) document.title = name
}
