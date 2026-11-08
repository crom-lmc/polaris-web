/**
 * 读者端（blog-web/packages/web，5175）冒烟：确认无需登录就能渲染文章列表。
 *
 * 用法：node tools/cdp-web.mjs [/about]
 * 依赖：Node 22+、本机 Edge、网关与 blog-admin 已启动
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const WEB = process.env.BLOG_WEB || 'http://localhost:5175'
const PORT = 9338
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const route = process.argv[2] || '/'

const profile = mkdtempSync(join(tmpdir(), 'edge-blogweb-'))
const edge = spawn(
  EDGE,
  ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-sync', 'about:blank'],
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
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text}`)
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

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = attached.sessionId
await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')

await evaluate(`location.href = ${JSON.stringify(WEB + route)}`)
await sleep(5000)

const info = await evaluate(`(() => ({
  href: location.href,
  title: document.title,
  text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 800),
  authToken: !!localStorage.getItem('blog.admin.token')
}))()`)

console.log('地址：', info.href)
console.log('标题：', info.title)
console.log('本地令牌：', info.authToken ? '有（不应该有）' : '无（符合预期，读者端免登录）')
console.log('--- 页面文本 ---')
console.log(info.text)
console.log('--- 接口 ---')
console.log(logs.filter((l) => l.startsWith('[net]')).join('\n') || '(无)')
console.log('--- 异常 ---')
console.log(logs.filter((l) => l.startsWith('[exception]')).join('\n') || '(无)')

ws.close()
edge.kill()
process.exit(0)
