/**
 * 通用「固定外壳」校验：内容区滚动时顶栏/侧栏是否保持不动、window 是否未被滚动。
 *
 * node tools/verify-fixed-shell.mjs <url> <token> <prefix> [headerSel] [siderSel] [scrollSel]
 *   例：node tools/verify-fixed-shell.mjs http://localhost:5173/accounts "$TOKEN" sso ".header" ".sider" ".content"
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [url, TOKEN, PREFIX = 'sso', HEADER = '.header', SIDER = '.sider', SCROLL = '.content'] =
  process.argv.slice(2)
const H = Number(process.argv[8] || 720)
const PORT = 9391
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = mkdtempSync(join(tmpdir(), 'edge-shell-'))
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
    `--window-size=1440,${H}`,
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: H, deviceScaleFactor: 1, mobile: false })
// PREFIX 含 '.' 时视为「完整键名」（博客后台是 blog.admin.token），否则按 <prefix>_access_token 处理
const LS_KEYS = PREFIX.includes('.') ? [PREFIX] : [`${PREFIX}_access_token`, `${PREFIX}_refresh_token`]
const LS_SRC = LS_KEYS.map((k) => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(TOKEN)})`).join(';')
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{${LS_SRC}}catch(e){}`
})
await send('Page.navigate', { url })
await sleep(6000)

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

const probe = (h, s, c) => `(() => {
  const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), h: Math.round(r.height) } }
  const el = document.querySelector(${JSON.stringify(c)})
  return {
    header: rect(${JSON.stringify(h)}),
    sider: rect(${JSON.stringify(s)}),
    scrollTop: el ? el.scrollTop : -1,
    scrollH: el ? el.scrollHeight : -1,
    clientH: el ? el.clientHeight : -1,
    scrollable: el ? el.scrollHeight > el.clientHeight + 4 : false,
    winScrollY: Math.round(window.scrollY),
    bodyScrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : -1
  }
})()`

const before = await evaluate(probe(HEADER, SIDER, SCROLL))
await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(SCROLL)}); if (el) el.scrollTop = 600; return true })()`)
await sleep(500)
const after = await evaluate(probe(HEADER, SIDER, SCROLL))

console.log('before:', JSON.stringify(before))
console.log('after :', JSON.stringify(after))
const ok =
  before.header &&
  before.sider &&
  before.header.t === after.header.t &&
  before.sider.t === after.sider.t &&
  after.winScrollY === 0 &&
  after.bodyScrollTop === 0 &&
  after.scrollTop > 0
console.log('内容区独立滚动 :', after.scrollTop > 0)
console.log('顶栏固定 :', before.header?.t, '->', after.header?.t)
console.log('侧栏固定 :', before.sider?.t, '->', after.sider?.t)
console.log('window/body 未滚 :', after.winScrollY === 0 && after.bodyScrollTop === 0)
console.log('结论:', ok ? 'PASS' : 'FAIL')

ws.close()
edge.kill()
process.exit(0)
