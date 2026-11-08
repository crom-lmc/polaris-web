/**
 * 验证 /login?gl=1 的「强制登出落地」行为：即使中心会话（SSO_SID）仍有效，
 * gl=1 也必须清本地令牌并显示登录框，不能静默重登弹回控制台。
 * 用法：node tools/cdp-sso-gl.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SSO = 'http://localhost:5173'
const PORT = 9343
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PWD_FILE = 'F:\\code\\sso\\sso-microservices\\nacos\\.secrets\\admin-password.txt'
const user = 'admin'
const password = readFileSync(PWD_FILE, 'utf8').trim()
const profile = mkdtempSync(join(tmpdir(), 'edge-sso-gl-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-sync', 'about:blank'], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function browserWs() { for (let i = 0; i < 80; i++) { try { const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl } catch {} await sleep(250) } throw new Error('Edge CDP 未就绪') }
const ws = new WebSocket(await browserWs())
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0; const pending = new Map()
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(method + ' -> ' + JSON.stringify(m.error))) : resolve(m.result) } }
let sessionId = null
function send(method, params = {}, noSession = false) { const id = ++seq; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject, method }); const p = { id, method, params }; if (sessionId && !noSession) p.sessionId = sessionId; ws.send(JSON.stringify(p)) }) }
async function evaluate(expr) { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
async function waitFor(expr, timeout = 20000, label = '') { const s = Date.now(); while (Date.now() - s < timeout) { try { if (await evaluate(expr)) return true } catch {} await sleep(400) } console.log('   [timeout]', label || expr); return false }
async function getSsoSid() { try { const r = await send('Network.getCookies', { urls: ['http://127.0.0.1/'] }); const c = (r.cookies || []).find((x) => x.name === 'SSO_SID'); return c ? '有(len=' + c.value.length + ')' : '— 无 —' } catch (e) { return '读cookie失败:' + e.message } }
async function rectOf(sel, text) { return evaluate(`(() => { const els = Array.from(document.querySelectorAll(${JSON.stringify(sel)})); const el = els.find(e => e.innerText && e.innerText.replace(/\\s/g,'').includes(${JSON.stringify(text)})); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width/2, y: r.y + r.height/2 } })()`) }
async function realClick(sel, text) { const r = await rectOf(sel, text); if (!r) return false; await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 }); await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 }); return true }

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, true)).sessionId
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable')
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(method + ' -> ' + JSON.stringify(m.error))) : resolve(m.result); return } }

// 1) 登录拿到有效会话（SSO_SID + sso_access_token 都有效）
await evaluate(`location.href = ${JSON.stringify(SSO + '/')}`)
await sleep(2500)
await waitFor(`!!document.querySelector('input[placeholder="登录名"]')`, 15000, '登录表单')
await evaluate(`(() => { const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};const u=document.querySelector('input[placeholder="登录名"]');const p=document.querySelector('input[placeholder="密码"]');if(u)setVal(u,${JSON.stringify(user)});if(p)setVal(p,${JSON.stringify(password)});return true})()`)
await sleep(400)
const loginBtn = await realClick('.ant-btn', '登录')
console.log('① 登录:', loginBtn ? 'OK' : 'FAIL')
await waitFor(`!!localStorage.getItem('sso_access_token') && location.href.includes('5173')`, 25000, '回到控制台')
await sleep(1200)
console.log('   登录后 SSO_SID =', await getSsoSid(), '| token =', await evaluate(`!!localStorage.getItem('sso_access_token')`))

// 2) 关键：直接访问 /login?gl=1（模拟「中心会话没被销毁」的最坏情况）
console.log('② 直接打开 /login?gl=1（会话仍有效）...')
await evaluate(`location.href = ${JSON.stringify(SSO + '/login?gl=1')}`)
await sleep(2500)
let bounced = false
for (let i = 0; i < 25; i++) {
  await sleep(400)
  const h = await evaluate('location.href').catch(() => '(err)')
  if (h.includes('5173') && !h.includes('/login')) { bounced = true; console.log('   在 t+' + (i * 0.4).toFixed(1) + 's 弹回控制台:', h); break }
}
const finalHref = await evaluate('location.href').catch(() => '(err)')
const finalToken = await evaluate(`!!localStorage.getItem('sso_access_token')`).catch(() => '?')
console.log('   最终地址 =', finalHref)
console.log('   本地 token 已清 =', finalToken === false ? '是 ✅' : '否 ❌')

console.log('\n=== 结论 ===')
console.log('  gl=1 落地登录页(未弹回) :', finalHref.includes('/login') && !bounced ? '是 ✅' : '否 ❌')
console.log('  仍被静默重登弹回控制台  :', bounced ? '是 ❌' : '否 ✅')

ws.close(); edge.kill(); process.exit(0)
