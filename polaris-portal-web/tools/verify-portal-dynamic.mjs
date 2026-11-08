// 验证门户布局「动态可调」：admin -> CMS 令牌 -> 管理端 PUT 改布局 -> 门户公开接口随之变化 -> 还原
import { readFileSync } from 'node:fs'

const B = 'http://127.0.0.1:9080'
const REDIRECT = 'http://localhost:5177/callback' // 与 cms 应用注册的 redirect_uri 一致
const PW = readFileSync('C:/Users/Administrator/AppData/Local/Temp/admin-pwd.txt', 'utf8').trim()
const J = (r) => r.json()

async function main() {
  // 1) admin 登录拿 sso 令牌
  const lj = await J(await fetch(B + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW, appCode: 'sso' })
  }))
  if (lj.code !== 0) throw new Error('登录失败: ' + lj.message)
  const ssoToken = lj.data.accessToken
  console.log('1) admin 登录 OK')

  // 2) 用 sso 令牌签 CMS 授权码
  const aj = await J(await fetch(B + '/api/auth/oauth/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ssoToken },
    body: JSON.stringify({ responseType: 'code', clientId: 'cms', redirectUri: REDIRECT, state: 'dyn' })
  }))
  if (aj.code !== 0) throw new Error('授权码签发失败: ' + aj.message)
  const code = aj.data.code
  console.log('2) 签发 CMS 授权码 OK')

  // 3) 换 CMS 令牌
  const ej = await J(await fetch(B + '/api/cms/sso/oauth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri: REDIRECT })
  }))
  if (ej.code !== 0) throw new Error('换票失败: ' + ej.message)
  const cmsToken = ej.data.accessToken
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cmsToken }
  console.log('3) 换取 CMS 令牌 OK')

  // 4) 管理端读布局（验证 @Permit 放行）
  const list = (await J(await fetch(B + '/api/cms/portal-layout', { headers: H }))).data
  console.log('4) 管理端读布局 OK:', list.map((m) => `${m.moduleKey}(${m.enabled})`).join(', '))

  const original = list.map((m) => ({
    moduleKey: m.moduleKey, moduleName: m.moduleName, enabled: m.enabled, sort: m.sort, config: m.config || ''
  }))

  // 5) 改布局：启用“热门标签”并置顶（其他保持原顺序）
  const tags = original.find((m) => m.moduleKey === 'tags')
  const rest = original.filter((m) => m.moduleKey !== 'tags')
  const changed = [
    { ...tags, enabled: 1 },
    ...rest.map((m) => ({ ...m }))
  ]
  const putRes = await J(await fetch(B + '/api/cms/portal-layout', { method: 'PUT', headers: H, body: JSON.stringify(changed) }))
  if (putRes.code !== 0) throw new Error('保存布局失败: ' + putRes.message)
  console.log('5) 管理端保存新布局 OK')

  // 6) 门户公开接口读取（未登录也应看到变化）
  const pub = (await J(await fetch(B + '/api/cms/public/layout'))).data
  console.log('6) 门户端读到布局:', pub.map((m) => `${m.moduleKey}(${m.enabled},sort=${m.sort})`).join(', '))
  const ok = pub[0]?.moduleKey === 'tags' && pub[0]?.enabled === 1
  console.log(ok ? '   ✅ 动态生效：热门标签已置顶且启用' : '   ❌ 动态未生效')

  // 7) 还原原布局
  const restore = await J(await fetch(B + '/api/cms/portal-layout', { method: 'PUT', headers: H, body: JSON.stringify(original) }))
  console.log('7) 还原布局:', restore.code === 0 ? 'OK' : 'FAIL ' + restore.message)

  const pub2 = (await J(await fetch(B + '/api/cms/public/layout'))).data
  console.log('   还原后门户端:', pub2.map((m) => m.moduleKey).join(', '))
}

main().catch((e) => { console.log('ERROR', e.message); process.exit(1) })
