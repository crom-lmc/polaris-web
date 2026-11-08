/**
 * SSO 统一账号中心「控制台退出」专项复现（无头 Edge + CDP）。
 * 登录控制台 → 点右上角「退出」→ 观察 SSO_SID 是否清除、是否弹回 /dashboard。
 * 用法：node tools/cdp-sso-logout.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SSO = 'http://localhost:5173'
const PORT = 9342
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PWD_FILE = 'F:\\code\\sso\\sso-microservices\\nacos\\.secrets\\admin-password.txt'
const user = 'admin'
const password = readFileSync(PWD_FILE, 'utf8').trim()
const profile = mkdtempSync(join(tmpdir(), 'edge-sso-logout-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-sync', 'about:blank'], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function browserWs() {
  for (let i = 0; i < 80; i++) {
    try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl } catch {}
    await sleep(250)
  }
  throw new Error('Edge CDP 未就绪')
}
const ws = new WebSocket(await browserWs())
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(method + ' -> ' + JSON.stringify(m.error))) : resolve(m.result) } }
let sessionId = null
function send(method, params = {}, noSession = false) {
  const id = ++seq
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, method }); const p = { id, method, params }; if (sessionId && !noSession) p.sessionId = sessionId; ws.send(JSON.stringify(p)) })
}
async function evaluate(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
async function waitFor(expr, timeout = 20000, label = '') { const s = Date.now(); while (Date.now() - s < timeout) { try { if (await evaluate(expr)) return true } catch {} await sleep(400) } console.log('   [timeout]', label || expr); return false }
async function getSsoSid() { try { const r = await send('Network.getCookies', { urls: ['http://127.0.0.1/'] }); const c = (r.cookies || []).find((x) => x.name === 'SSO_SID'); return c ? '有(len=' + c.value.length + ')' : '— 无 —' } catch (e) { return '读cookie失败:' + e.message } }
async function rectOf(sel, text) {
  return evaluate(`(() => { const els = Array.from(document.querySelectorAll(${JSON.stringify(sel)})); const el = els.find(e => e.innerText && e.innerText.replace(/\\s/g,'').includes(${JSON.stringify(text)})); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`)
}
async function realClick(sel, text) {
  const r = await rectOf(sel, text)
  if (!r) return false
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  return true
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, true)).sessionId
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable')
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(method + ' -> ' + JSON.stringify(m.error))) : resolve(m.result); return } }

// 1) 打开控制台根路径 → 未登录会跳 /login
await evaluate(`location.href = ${JSON.stringify(SSO + '/')}`)
await sleep(2500)
console.log('① 打开控制台 ->', await evaluate('location.href'))
if (!(await waitFor(`location.href.includes('/login') || location.href.includes('5173')`, 15000, '跳登录页'))) { console.log('FAIL: 没到登录页'); process.exit(1) }

// 2) 登录（无 app 参数，登录后应回 /dashboard 控制台）
await waitFor(`!!document.querySelector('input[placeholder="登录名"]')`, 15000, '登录表单')
await evaluate(`(() => { const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};const u=document.querySelector('input[placeholder="登录名"]');const p=document.querySelector('input[placeholder="密码"]');if(u)setVal(u,${JSON.stringify(user)});if(p)setVal(p,${JSON.stringify(password)});return true})()`)
await sleep(400)
const loginBtn = await realClick('.ant-btn', '登录')
console.log('② 提交登录:', loginBtn ? 'OK' : 'FAIL')
await waitFor(`!!localStorage.getItem('sso_access_token') && location.href.includes('5173')`, 25000, '回到控制台')
await sleep(1500)
console.log('   登录后地址 =', await evaluate('location.href'))

// 3) 退出前状态
const sidBefore = await getSsoSid()
console.log('③ 登录态 SSO_SID =', sidBefore)
console.log('   本地 sso_access_token =', await evaluate(`!!localStorage.getItem('sso_access_token')`))

// 4) 点右上角「退出」
const clicked = await realClick('.ant-btn', '退出')
console.log('④ 真实点击「退出」:', clicked ? 'OK' : 'FAIL(没找到退出按钮)')

// 5) 轮询变化
console.log('⑤ 退出后变化序列（每 400ms）：')
let last = ''
for (let i = 0; i < 50; i++) {
  await sleep(400)
  const snap = await evaluate(`(() => ({ h: location.href, t: !!localStorage.getItem('sso_access_token') }))()`).catch(() => ({ h: '(err)', t: '?' }))
  let sid = '?'
  try { sid = (await getSsoSid()).slice(0, 14) } catch {}
  const addr = snap.h.includes('/login') ? 'LOGIN' : (snap.h.includes('5173') ? 'CONSOLE' : 'OTHER')
  const line = `t+${(i * 0.4).toFixed(1)}s | addr=${addr} | token=${snap.t} | sid=${sid}`
  if (line !== last) { console.log('   ' + line); last = line }
}
const afterHref = await evaluate('location.href')
const sidAfter = await getSsoSid()
console.log('   最终地址 =', afterHref)
console.log('   退出后 SSO_SID =', sidAfter)
console.log('   退出后本地 token =', await evaluate(`!!localStorage.getItem('sso_access_token')`))

console.log('\n=== 结论 ===')
console.log('  SSO_SID 已清除 :', sidBefore !== '— 无 —' && sidAfter === '— 无 —' ? '是 ✅' : (sidAfter === '— 无 —' ? '是 ✅(原本就无)' : '否 ❌'))
console.log('  落地登录页     :', afterHref.includes('/login') ? '是 ✅' : '否 ❌')
console.log('  被弹回控制台   :', afterHref.includes('5173') && !afterHref.includes('/login') ? '是 ❌' : '否 ✅')

ws.close(); edge.kill(); process.exit(0)
