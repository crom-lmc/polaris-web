/**
 * 用本地 Edge（Chromium）做一次无头冒烟：注入 token 后直接打开指定路由，
 * 抓 console / 未捕获异常 / 页面文本，用来复现「页面打不开」这类前端问题。
 *
 * 用法：node tools/cdp-smoke.mjs /permissions [/roles]
 * 依赖：Node 22+（内置全局 WebSocket）、本机 Edge
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5173'
const PORT = 9334
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const route = process.argv[2] || '/permissions'

const login = JSON.parse(readFileSync('C:\\Users\\Administrator\\AppData\\Local\\Temp\\login.json', 'utf8'))
const { accessToken, refreshToken } = login.data

const profile = mkdtempSync(join(tmpdir(), 'edge-sso-'))
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
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function browserWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl
    } catch {
      /* 还没起来 */
    }
    await sleep(250)
  }
  throw new Error('Edge CDP 未就绪')
}

const ws = new WebSocket(await browserWs())
await new Promise((res, rej) => {
  ws.onopen = res
  ws.onerror = rej
})

let seq = 0
const pending = new Map()
const logs = []
const reqUrl = new Map()

ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject, method } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(method + ' -> ' + JSON.stringify(msg.error))) : resolve(msg.result)
    return
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
    logs.push(`[${msg.params.type}] ${text}`)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    logs.push(`[exception] ${d.exception?.description || d.text}`)
  }
  if (msg.method === 'Log.entryAdded') {
    logs.push(`[log:${msg.params.entry.level}] ${msg.params.entry.text}`)
  }
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.includes('/api/')) {
    reqUrl.set(msg.params.requestId, msg.params.request.url.replace(/^https?:\/\/[^/]+/, ''))
  }
  if (msg.method === 'Network.responseReceived') {
    const u = reqUrl.get(msg.params.requestId)
    if (u) logs.push(`[net] ${msg.params.response.status} ${u}`)
  }
}

/** 走 flat session：所有 Page/Runtime 命令都带上 sessionId */
let sessionId = null
function send(method, params = {}, noSession = false) {
  const id = ++seq
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, method })
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

// 1) 新建一个标签页并 attach（避免拿到 Edge 的 edge://sync-confirmation-dialog 内部页）
const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = attached.sessionId

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Network.enable')
await send('Page.bringToFront')

// 2) 先在站点上下文里写 token（localStorage 需要同源）
const loginUrl = `${BASE}/login`
// 这个 Edge 版本的 Page.navigate 在 flat session 下会报 invalid URL，改用页面内 location 跳转
await evaluate(`location.href = ${JSON.stringify(loginUrl)}`)
await sleep(3500)
const seeded = await evaluate(
  `localStorage.setItem('sso_access_token', ${JSON.stringify(accessToken)});
   localStorage.setItem('sso_refresh_token', ${JSON.stringify(refreshToken)});
   'len=' + (localStorage.getItem('sso_access_token') || '').length`
)
console.log('[seed]', seeded)

// 3) 打开目标路由
logs.push('--- navigate ' + route + ' ---')
await evaluate(`location.href = ${JSON.stringify(BASE + route)}`)
await sleep(5000)

// 4) 可选：点击第 N 个左侧菜单项，验证「点菜单能不能切过去」
const clickIndex = process.argv[3]
if (clickIndex !== undefined && /^\d+$/.test(clickIndex)) {
  logs.push('--- click menu #' + clickIndex + ' ---')
  await evaluate(`(() => {
    const items = Array.from(document.querySelectorAll('.ant-menu-item'))
    const el = items[${Number(clickIndex)}]
    if (!el) return 'menu not found, total=' + items.length
    el.querySelector('.ant-menu-title-content')?.click?.()
    el.click()
    return 'clicked: ' + el.innerText.trim()
  })()`)
  await sleep(3000)
}

// 5) 可选：点第一行「编辑」并直接保存，验证雪花ID回传后端不丢精度
if (process.argv[3] === 'edit') {
  const clicked = await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('.ant-table-row .ant-btn'))
    const edit = btns.find((b) => b.innerText.includes('编辑'))
    if (!edit) return 'no edit button'
    edit.click()
    return 'clicked edit'
  })()`)
  logs.push('--- ' + clicked + ' ---')
  await sleep(1500)
  const ok = await evaluate(`(() => {
    const btn = document.querySelector('.ant-modal-footer .ant-btn-primary')
    if (!btn) return 'no ok button'
    btn.click()
    return 'clicked ok'
  })()`)
  logs.push('--- ' + ok + ' ---')
  await sleep(2500)
  const toast = await evaluate(
    `Array.from(document.querySelectorAll('.ant-message-notice-content')).map((e) => e.innerText).join(' | ')`
  )
  logs.push('--- toast: ' + (toast || '(无)') + ' ---')
}

// 6) 可选：打开角色授权抽屉并保存，验证 permissionIds 回填与保存
if (process.argv[3] === 'assign') {
  await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('.ant-table-row .ant-btn')).find((b) => b.innerText.includes('授权'))
    if (btn) btn.click()
  })()`)
  await sleep(2500)
  const tools = await evaluate(
    `(document.querySelector('.assign-tools')?.innerText || 'no drawer').split(String.fromCharCode(10)).join(' ')`
  )
  logs.push('--- 抽屉: ' + tools + ' ---')
  await evaluate(`(() => {
    const btn = document.querySelector('.ant-drawer-footer .ant-btn-primary')
    if (btn) btn.click()
  })()`)
  await sleep(2500)
  const toast = await evaluate(
    `Array.from(document.querySelectorAll('.ant-message-notice-content')).map((e) => e.innerText).join(' | ')`
  )
  logs.push('--- toast: ' + (toast || '(无)') + ' ---')
}

const info = await evaluate(`(() => ({
  url: location.pathname,
  title: document.title,
  text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 1200),
  hasTable: !!document.querySelector('.ant-table'),
  alertText: Array.from(document.querySelectorAll('.ant-alert')).map(e => e.innerText).join(' | ')
}))()`)

console.log('URL   :', info.url)
console.log('TITLE :', info.title)
console.log('TABLE :', info.hasTable)
console.log('ALERT :', info.alertText || '(无)')
console.log('--- 页面文本 ---')
console.log(info.text)
console.log('--- 控制台 ---')
console.log(logs.join('\n') || '(无)')

ws.close()
edge.kill()
process.exit(0)
