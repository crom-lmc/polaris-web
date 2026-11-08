/**
 * 校验「进入」的行为：应当在新页签打开目标应用，控制台自己留在原地。
 * node tools/verify-enter-new-tab.mjs <adminPassword> [appCode=cms]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PW = process.argv[2] || ''
const APP = process.argv[3] || 'cms'
const PORT = 9411
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const profile = mkdtempSync(join(tmpdir(), 'edge-enter-'))
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
const ws = new WebSocket(wsUrl)
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})
let seq = 0
const pending = new Map()
const events = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(m.method + ' ' + JSON.stringify(m.error))) : p.resolve(m.result)
    return
  }
  if (m.method === 'Runtime.exceptionThrown') {
    events.push('exception: ' + (m.params.exceptionDetails.exception?.description || '').slice(0, 200))
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

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

// 1) 接口登录拿 SSO_SID + accessToken，写进当前页的登录态
const resp = await fetch('http://127.0.0.1:9080/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: PW, appCode: 'sso-center' })
})
const rawCookies = resp.headers.getSetCookie ? resp.headers.getSetCookie() : []
const loginJson = await resp.json()
const token = loginJson?.data?.accessToken || ''
const sid = rawCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('SSO_SID=')) || ''
console.log('登录接口:', loginJson.code, '| token 长度:', token.length, '| SSO_SID:', sid ? 'ok' : 'none')
await send('Network.enable')
if (sid) {
  const [name, value] = sid.split('=')
  await send('Network.setCookie', { name, value, domain: 'localhost', path: '/' })
}
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('sso_access_token',${JSON.stringify(token)});localStorage.setItem('sso_refresh_token',${JSON.stringify(token)});}catch(e){}`
})
await send('Page.navigate', { url: 'http://localhost:5173/dashboard' })
await sleep(6000)
const afterLogin = await evaluate(
  `({ url: location.href, tiles: Array.from(document.querySelectorAll('.app-code')).map(e => e.textContent.trim()) })`
)
console.log('登录后:', JSON.stringify(afterLogin))

// 2) 真实鼠标点击目标应用的「进入」
const tapTarget = async () => {
  const hit = await evaluate(`(() => {
    const tiles = Array.from(document.querySelectorAll('.app-tile'))
    const tile = tiles.find((t) => t.querySelector('.app-code')?.textContent.trim() === ${JSON.stringify(APP)})
    if (!tile) return { ok: false, tiles: tiles.map(t => t.querySelector('.app-code')?.textContent.trim()) }
    const btn = tile.querySelector('button')
    if (!btn) return { ok: false, reason: '该磁贴没有「进入」按钮' }
    const r = btn.getBoundingClientRect()
    return { ok: true, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })()`)
  if (!hit || !hit.ok) return hit
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hit.x, y: hit.y, button: 'none' })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hit.x, y: hit.y, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hit.x, y: hit.y, button: 'left', clickCount: 1 })
  return hit
}
const tap = await tapTarget()
console.log('点击进入:', JSON.stringify(tap))
await sleep(6000)

// 3) 断言：控制台仍在、且新增了一个落在目标应用 origin 上的页面 target
const afterClick = await evaluate(`({ url: location.href, title: document.title })`)
const targets = (await send('Target.getTargets', {}, true)).targetInfos
  .filter((t) => t.type === 'page')
  .map((t) => t.url)
console.log('点击后控制台:', JSON.stringify(afterClick))
console.log('全部页面 target:')
targets.forEach((u) => console.log('  -', u.slice(0, 130)))
if (events.length) console.log('异常:\n' + events.join('\n'))

const shot = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-enter.png', Buffer.from(shot.data, 'base64'))

const stayedPut = afterClick.url.includes('5173/dashboard')
const opened = targets.filter((u) => u && !u.startsWith('about:blank') && !u.includes('5173'))
const openedApp = opened.length === 1
const notError = opened.length === 1 && !/^chrome-error/.test(opened[0])

console.log('\n控制台是否留在原地 :', stayedPut)
console.log('是否新开页签 :', openedApp, '->', opened[0] ? opened[0].slice(0, 90) : '(无)')
console.log('新页签是否加载成功 :', notError)
console.log('结论:', stayedPut && openedApp && notError ? 'PASS' : 'FAIL')

ws.close()
edge.kill()
process.exit(0)
