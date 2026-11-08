/**
 * 深色模式下验证：侧栏菜单区与菜单下方空白区是否同色。
 * 登录 → 切深色 → 读 .ant-menu / .ant-layout-sider 计算背景色 → 截图到 tools/_dark.png
 */
import { spawn } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5173'
const PORT = 9336
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

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
const extra = new Map()
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  } else if (extra.has(msg.method)) {
    extra.get(msg.method)(msg.params)
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
await evaluate(`(() => {
  const set = (el, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  set(document.querySelector('input[autocomplete="username"]'), 'admin')
  set(document.querySelector('input[autocomplete="current-password"]'), 'Ej4PIq_RkR9f2Nd8IHjmrYd4')
  document.querySelector('button[type="submit"], .ant-btn-primary')?.click()
  return 1
})()`)
await sleep(4500)

// 切到深色（localStorage 预置 + 刷新后由 store 初始化读取）
await evaluate(`localStorage.setItem('sso_theme', 'dark'); location.reload(); 1`)
await sleep(4000)

const info = await evaluate(`(() => {
  const bg = (sel) => {
    const el = document.querySelector(sel)
    return el ? getComputedStyle(el).backgroundColor : null
  }
  return {
    url: location.pathname,
    dataTheme: document.documentElement.getAttribute('data-theme'),
    siderBg: bg('.ant-layout-sider'),
    menuBg: bg('.sider .ant-menu'),
    bodyBg: bg('.ant-layout-content') || bg('.ant-layout .ant-layout')
  }
})()`)
console.log(JSON.stringify(info, null, 2))

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('F:/code/sso/sso-web/tools/_dark.png', Buffer.from(shot.data, 'base64'))
console.log('screenshot -> tools/_dark.png')
ws.close()
edge.kill()
process.exit(0)
