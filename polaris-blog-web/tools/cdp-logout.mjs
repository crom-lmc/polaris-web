/**
 * 博客后台「退出登录」专项复现（无头 Edge + CDP）。
 * 走真实用户路径：登录 → 读 SSO_SID(HttpOnly) → 点退出 → 确认 → 再读 SSO_SID + 看落点。
 * 用法：node tools/cdp-logout.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ADMIN = 'http://localhost:5176'
const SSO = 'http://localhost:5173'
const PORT = 9341
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PWD_FILE = 'F:\\code\\sso\\sso-microservices\\nacos\\.secrets\\admin-password.txt'
const user = 'admin'
const password = readFileSync(PWD_FILE, 'utf8').trim()
const profile = mkdtempSync(join(tmpdir(), 'edge-logout-'))
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
async function getSsoSid() { try { const r = await send('Network.getCookies', { urls: ['http://127.0.0.1/'] }); const c = (r.cookies || []).find((x) => x.name === 'SSO_SID'); return c ? c.value.slice(0, 6) + '…(len=' + c.value.length + ')' : '— 无 —' } catch (e) { return '读cookie失败:' + e.message } }
async function clickByText(sel, text) {
  return evaluate(`(() => { const els = Array.from(document.querySelectorAll(${JSON.stringify(sel)})); const el = els.find(e => e.innerText && e.innerText.replace(/\\s/g,'').includes(${JSON.stringify(text)})); if (el) { el.click(); return true } return false })()`)
}
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
async function realClickSel(sel) {
  const r = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`)
  if (!r) return false
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.y, button: 'left', clickCount: 1 })
  return true
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, true)).sessionId
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Log.enable')
const errs = []
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { const { resolve, reject, method } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(method + ' -> ' + JSON.stringify(m.error))) : resolve(m.result); return } if (m.method === 'Runtime.exceptionThrown') errs.push('[exception] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text)); if (m.method === 'Log.entryAdded') errs.push('[log:' + m.params.entry.level + '] ' + m.params.entry.text) }

// 1) 打开后台 → 应跳账号中心登录页
await evaluate(`location.href = ${JSON.stringify(ADMIN + '/')}`)
await sleep(2500)
console.log('① 打开后台 ->', await evaluate('location.href'))
if (!(await waitFor(`location.href.includes('5173/login')`, 15000, '跳登录页'))) { console.log('FAIL: 没跳登录页'); process.exit(1) }

// 2) 登录
await waitFor(`!!document.querySelector('input[placeholder="登录名"]')`, 15000, '登录表单')
await evaluate(`(() => { const setVal=(el,v)=>{const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))};const u=document.querySelector('input[placeholder="登录名"]');const p=document.querySelector('input[placeholder="密码"]');if(u)setVal(u,${JSON.stringify(user)});if(p)setVal(p,${JSON.stringify(password)});return true})()`)
await sleep(400)
await clickByText('button', '登录')
console.log('② 提交登录')
await waitFor(`location.origin==='http://localhost:5176' && !!localStorage.getItem('blog.admin.token')`, 25000, '回到后台')
await sleep(2000)

// 3) 退出前：读 SSO_SID + 落点
const sidBefore = await getSsoSid()
console.log('③ 登录态 SSO_SID =', sidBefore)
console.log('   当前地址 =', await evaluate('location.href'))

// 4) 点击用户区打开下拉（trigger=click）→ 真实点击「退出登录」
const opened = await realClickSel('.user')
console.log('④ 点击用户区打开下拉:', opened ? 'OK' : 'FAIL')
await sleep(600)
const clicked = await realClick('.el-dropdown-menu__item', '退出登录')
console.log('   真实点击「退出登录」:', clicked ? 'OK' : 'FAIL(没找到菜单项)')
await sleep(500)

// 5) 确认弹窗 → 真实点击确定
await waitFor(`!!document.querySelector('.el-message-box')`, 8000, '确认弹窗')
const ok = await realClick('.el-message-box__btns button', '确定')
console.log('⑤ 真实点击「确定」:', ok ? 'OK' : 'FAIL(没找到确定按钮)')

// 6) 细粒度轮询：记录 地址 / token / SSO_SID 三者变化
console.log('⑥ 退出后变化序列（每 400ms）：')
let last = ''
for (let i = 0; i < 50; i++) {
  await sleep(400)
  const snap = await evaluate(`(() => ({ h: location.href, t: !!localStorage.getItem('blog.admin.token') }))()`).catch(() => ({ h: '(err)', t: '?' }))
  let sid = '?'
  try { sid = (await getSsoSid()).slice(0, 10) } catch {}
  const addr = snap.h.includes('5173/login') ? 'LOGIN' : snap.h.includes('5176') ? 'ADMIN' : 'OTHER'
  const line = `t+${(i * 0.4).toFixed(1)}s | addr=${addr} | token=${snap.t} | sid=${sid}`
  if (line !== last) { console.log('   ' + line); last = line }
}
const afterHref = await evaluate('location.href')
const sidAfter = await getSsoSid()
console.log('   最终地址 =', afterHref)
console.log('   退出后 SSO_SID =', sidAfter)
console.log('   页面异常/日志：', errs.length ? '\n     ' + errs.join('\n     ') : '(无)')

// 7) 判断是否真退出
const backToLogin = afterHref.includes('5173/login')
const reloginBounce = afterHref.includes('localhost:5176') && !afterHref.includes('5173')
console.log('\n=== 结论 ===')
console.log('  SSO_SID 已清除 :', sidBefore !== '— 无 —' && sidAfter === '— 无 —' ? '是 ✅' : '否 ❌')
console.log('  退出后去登录页 :', backToLogin ? '是 ✅' : '否 ❌')
console.log('  被自动重登回后台:', reloginBounce ? '是 ❌' : '否 ✅')

ws.close(); edge.kill(); process.exit(0)
