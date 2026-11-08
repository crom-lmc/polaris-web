// 验证 portal 的 SSO 登录：admin -> portal 授权码 -> /api/portal/sso/oauth/exchange -> /api/portal/me
import { readFileSync } from 'node:fs'

const GW = 'http://127.0.0.1:9080'
const REDIRECT = 'http://localhost:5178/callback'
const PW = readFileSync('C:/Users/Administrator/AppData/Local/Temp/admin-pwd.txt', 'utf8').trim()
const J = (r) => r.json()

async function main() {
  const lj = await J(await fetch(GW + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW, appCode: 'sso' })
  }))
  if (lj.code !== 0) throw new Error('登录失败: ' + lj.message)
  console.log('1) admin 登录 OK')

  const aj = await J(await fetch(GW + '/api/auth/oauth/authorize', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lj.data.accessToken },
    body: JSON.stringify({ responseType: 'code', clientId: 'portal', redirectUri: REDIRECT, state: 'login' })
  }))
  if (aj.code !== 0) throw new Error('授权失败: ' + aj.message)
  console.log('2) 签发 portal 授权码 OK')

  const ej = await J(await fetch(GW + '/api/portal/sso/oauth/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: aj.data.code, redirectUri: REDIRECT })
  }))
  if (ej.code !== 0) throw new Error('换票失败: ' + ej.message)
  console.log('3) 换取 portal 令牌 OK, scope=', ej.data.scope || '(none)')

  const me = await J(await fetch(GW + '/api/portal/me', {
    headers: { Authorization: 'Bearer ' + ej.data.accessToken }
  }))
  console.log('4) /api/portal/me =>', JSON.stringify(me.data || me))
  console.log(me.code === 0 && me.data?.username === 'admin' ? '✅ portal 登录链路全通' : '❌ 失败')
}
main().catch((e) => { console.log('ERROR', e.message); process.exit(1) })
