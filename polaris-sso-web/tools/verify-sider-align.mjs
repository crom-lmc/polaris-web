/**
 * 校验管理台顶栏 logo 与折叠侧栏的对齐。
 * 用法：node tools/verify-sider-align.mjs <accessToken>
 * 产物：tools/out-sider-expanded.png / tools/out-sider-collapsed.png
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TOKEN = process.argv[2] || ''
const URL_ = process.argv[3] || 'http://localhost:5173/dashboard'
const PREFIX = process.argv[4] || 'sso'
const OUT = process.argv[5] || 'tools/out-sider'
const PORT = 9371
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync('tools', { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'edge-sider-'))
const edge = spawn(
  EDGE,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-sync',
    '--proxy-server=direct://',
    '--proxy-bypass-list=*',
    '--window-size=1440,900',
    'about:blank'
  ],
  { stdio: 'ignore' }
)

let wsUrl
for (let i = 0; i < 80; i++) {
  try {
    const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    if (v.webSocketDebuggerUrl) {
      wsUrl = v.webSocketDebuggerUrl
      break
    }
  } catch {}
  await sleep(250)
}
if (!wsUrl) {
  console.error('Edge 启动失败')
  process.exit(1)
}

const ws = new WebSocket(wsUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
let seq = 0
const pending = new Map()
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(p.method + ' ' + JSON.stringify(m.error))) : p.resolve(m.result)
  }
}
let sessionId = null
function send(method, params = {}, noSession) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
    const p = { id, method, params }
    if (sessionId && !noSession) p.sessionId = sessionId
    ws.send(JSON.stringify(p))
  })
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const at = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = at.sessionId
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('${PREFIX}_access_token',${JSON.stringify(TOKEN)});localStorage.setItem('${PREFIX}_refresh_token',${JSON.stringify(TOKEN)});}catch(e){}`
})
await send('Page.navigate', { url: URL_ })
await sleep(6000)

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

const probe = `(() => {
  const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), w: Math.round(r.width), cx: Math.round(r.x + r.width / 2), h: Math.round(r.height) } }
  const logo = document.querySelector('.logo')
  const toggle = document.querySelector('.menu-toggle')
  const text = document.querySelector('.logo-text')
  const sider = document.querySelector('.sider')
  const firstIcon = document.querySelector('.sider .ant-menu-item .anticon')
  const content = document.querySelector('.content')
  return {
    siderW: sider ? Math.round(sider.getBoundingClientRect().width) : -1,
    logo: box(logo),
    toggle: box(toggle),
    textVisible: !!text && getComputedStyle(text).display !== 'none',
    textRight: text ? Math.round(text.getBoundingClientRect().right) : -1,
    icon: box(firstIcon),
    contentLeft: content ? Math.round(content.getBoundingClientRect().x) : -1,
    docScrollW: document.documentElement.scrollWidth,
    innerW: innerWidth
  }
})()`

const expanded = await evaluate(probe)
const shot1 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT + '-expanded.png', Buffer.from(shot1.data, 'base64'))

// 点击汉堡折叠
await evaluate(`(() => { document.querySelector('.menu-toggle')?.click(); return true })()`)
await sleep(900)
const collapsed = await evaluate(probe)
const shot2 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync(OUT + '-collapsed.png', Buffer.from(shot2.data, 'base64'))

console.log('展开态:', JSON.stringify(expanded, null, 0))
console.log('折叠态:', JSON.stringify(collapsed, null, 0))

const dToggle = Math.abs(collapsed.toggle.cx - collapsed.icon.cx)
const dToggleExpanded = Math.abs(expanded.toggle.cx - expanded.icon.cx)
console.log('\n展开后 汉堡中心 vs 菜单图标中心 偏差 =', dToggleExpanded, 'px')
console.log('折叠后 汉堡中心 vs 菜单图标中心 偏差 =', dToggle, 'px')
console.log('折叠后 系统名是否常驻显示 =', collapsed.textVisible)
console.log('折叠后 内容区左边界 =', collapsed.contentLeft)
console.log('横向溢出 =', collapsed.docScrollW > collapsed.innerW)
console.log(
  '结论:',
  dToggle <= 2 && dToggleExpanded <= 2 && collapsed.textVisible && collapsed.docScrollW <= collapsed.innerW
    ? 'PASS'
    : 'FAIL'
)

ws.close()
edge.kill()
process.exit(0)
