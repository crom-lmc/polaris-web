/**
 * cms-web 无头浏览器冒烟：注入 cms 令牌后遍历主要路由，
 * 抓 console / 未捕获异常 / 网络状态 / 页面文本，验证「页面打得开、数据拉得到」。
 *
 * 用法：node tools/cdp-smoke.mjs
 * 依赖：Node 22+（内置全局 WebSocket）、本机 Edge
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5177'
const PORT = 9337
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const ROUTES = [
  ['/', '仪表盘'],
  ['/articles', '文章管理'],
  ['/categories', '分类'],
  ['/tags', '标签'],
  ['/media', '媒体库'],
  ['/banners', 'Banner']
]

const login = JSON.parse(readFileSync('C:\\Users\\Administrator\\AppData\\Local\\Temp\\cms-login.json', 'utf8'))
const { accessToken, refreshToken } = login

const profile = mkdtempSync(join(tmpdir(), 'edge-cms-'))
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
    if (msg.params.type === 'error' || msg.params.type === 'warning') {
      logs.push(`[${msg.params.type}] ${text.slice(0, 200)}`)
    }
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    logs.push(`[exception] ${(d.exception?.description || d.text).slice(0, 300)}`)
  }
  if (msg.method === 'Network.requestWillBeSent' && msg.params.request.url.includes('/api/')) {
    reqUrl.set(msg.params.requestId, msg.params.request.url.replace(/^https?:\/\/[^/]+/, ''))
  }
  if (msg.method === 'Network.responseReceived') {
    const u = reqUrl.get(msg.params.requestId)
    if (u) logs.push(`[net] ${msg.params.response.status} ${u}`)
  }
}

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

// 1) 新标签页
const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = attached.sessionId

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

// 2) 在每个新文档创建瞬间种 token（先于应用脚本，赶在路由守卫跳 SSO 之前）
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `if (location.origin === 'http://localhost:5177') {
    localStorage.setItem('cms_access_token', ${JSON.stringify(accessToken)});
    localStorage.setItem('cms_refresh_token', ${JSON.stringify(refreshToken)});
  }`
})

// 3) 诊断：注入是否生效 + me 是否可用
await evaluate(`location.href = ${JSON.stringify(BASE + '/dashboard')}`)
await sleep(3000)
const diag = await evaluate(`(async () => {
  const tk = localStorage.getItem('cms_access_token') || ''
  const r = await fetch('/api/cms/me', { headers: { Authorization: 'Bearer ' + tk } })
  const body = await r.json()
  return { tokenLen: tk.length, status: r.status, bodyCode: body.code, msg: body.message, origin: location.origin }
})()`)
console.log('[diag]', JSON.stringify(diag))

// 4) 逐路由冒烟
for (const [route, label] of ROUTES) {
  logs.length = 0
  logs.push(`--- ${label} (${route}) ---`)
  await evaluate(`location.href = ${JSON.stringify(BASE + route)}`)
  await sleep(3800)

  const info = await evaluate(`(() => ({
    url: location.href,
    text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 600),
    hasTable: !!document.querySelector('.ant-table'),
    hasMenu: !!document.querySelector('.ant-menu'),
    tokenLen: (localStorage.getItem('cms_access_token') || '').length,
    cardText: Array.from(document.querySelectorAll('.ant-statistic')).map(e => e.innerText.replace(/\\n/g, ':')).join(' | ')
  }))()`)
  const errs = logs.filter((l) => l.startsWith('[exception]') || l.startsWith('[error]') || /\[net\] [45]/.test(l))
  console.log(`\n===== ${label} =====`)
  console.log('URL    :', info.url)
  console.log('TOKEN  :', info.tokenLen, ' MENU:', info.hasMenu, ' TABLE:', info.hasTable)
  console.log('NET    :', logs.filter((l) => l.startsWith('[net]')).join(' ; ') || '(无)')
  if (info.cardText) console.log('STATS  :', info.cardText)
  console.log('TEXT   :', info.text.replace(/\n+/g, ' / ').slice(0, 260))
  console.log('ERRORS :', errs.length ? '\n  ' + errs.join('\n  ') : '(无)')
}

ws.close()
edge.kill()
process.exit(0)
