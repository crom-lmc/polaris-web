/**
 * 测量顶栏 logo（汉堡图标 / 「统一账号中心」文字）与侧栏菜单项（图标 / 文字）的横向坐标，
 * 用于把两条文字列对齐。用法：node tools/cdp-measure.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5173'
const PORT = 9335
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const login = JSON.parse(readFileSync('C:\\Users\\Administrator\\AppData\\Local\\Temp\\login.json', 'utf8'))
const { accessToken, refreshToken } = login.data

const profile = mkdtempSync(join(tmpdir(), 'edge-sso-'))
const edge = spawn(EDGE, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--window-size=1440,900',
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-sync', 'about:blank'
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function browserWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl
    } catch { /* retry */ }
    await sleep(250)
  }
  throw new Error('Edge CDP 未就绪')
}

const ws = new WebSocket(await browserWs())
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
}
let sessionId = null
function send(method, params = {}, noSession = false) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const payload = { id, method, params }
    if (sessionId && !noSession) payload.sessionId = sessionId
    ws.send(JSON.stringify(payload))
  })
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
sessionId = (await send('Target.attachToTarget', { targetId, flatten: true }, true)).sessionId
await send('Page.enable')
await evaluate(`location.href = ${JSON.stringify(BASE + '/login')}`)
await sleep(3500)
// UI 真实登录（token 注入会因过期被 bootstrap 打回）
await evaluate(`(() => {
  const set = (el, v) => {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const user = document.querySelector('input[autocomplete="username"]')
  const pass = document.querySelector('input[autocomplete="current-password"]')
  set(user, 'admin')
  set(pass, 'Ej4PIq_RkR9f2Nd8IHjmrYd4')
  document.querySelector('button[type="submit"], .ant-btn-primary')?.click()
  return 'submitted'
})()`)
await sleep(4500)
await evaluate(`location.href = ${JSON.stringify(BASE + '/dashboard')}`)
await sleep(4500)

const m = await evaluate(`(() => {
  const x = (el) => el ? Math.round(el.getBoundingClientRect().left * 10) / 10 : null
  const toggle = document.querySelector('.menu-toggle')
  const logo = document.querySelector('.logo')
  let logoTextX = null
  if (logo) {
    const tn = Array.from(logo.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim())
    if (tn) {
      const rg = document.createRange()
      rg.selectNode(tn)
      logoTextX = Math.round(rg.getBoundingClientRect().left * 10) / 10
    }
  }
  const item = document.querySelector('.sider .ant-menu-item:not(.ant-menu-item-only-child), .sider .ant-menu-item')
  const icon = item?.querySelector('.ant-menu-item-icon, .anticon')
  const title = item?.querySelector('.ant-menu-title-content')
  const iconStyle = icon ? getComputedStyle(icon) : null
  return {
    viewport: window.innerWidth,
    toggleX: x(toggle), toggleW: toggle ? Math.round(toggle.getBoundingClientRect().width * 10) / 10 : null,
    logoTextX,
    menuItem: item ? item.innerText.trim().slice(0, 6) : null,
    menuIconX: x(icon),
    menuIconFont: iconStyle ? iconStyle.fontSize : null,
    menuIconMarginEnd: iconStyle ? iconStyle.marginInlineEnd || iconStyle.marginRight : null,
    menuTitleX: x(title),
    itemPadStart: item ? getComputedStyle(item).paddingInlineStart || getComputedStyle(item).paddingLeft : null
  }
})()`)
console.log(JSON.stringify({ url: await evaluate('location.href'), ...m }, null, 2))
ws.close()
edge.kill()
process.exit(0)
