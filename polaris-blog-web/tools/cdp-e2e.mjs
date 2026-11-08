/**
 * 博客后台「单点登录」端到端冒烟（无头 Edge + CDP）。
 *
 * 走的是真实用户路径，不做任何令牌注入：
 *   打开 5176（无 cookie）→ 应被送去账号中心 5173 登录页
 *   → 自动填账号密码登录 → 账号中心签 ticket 回跳 5176
 *   → 5176 后端换票 → 进入后台首页 → 抓菜单/页面文本/接口状态
 *
 * 用法：node tools/cdp-e2e.mjs [起始路由]
 * 依赖：Node 22+（内置 WebSocket）、本机 Edge、四个服务已启动
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ADMIN = 'http://localhost:5176'
const PORT = 9337
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PWD_FILE = 'F:\\code\\sso\\sso-microservices\\nacos\\.secrets\\admin-password.txt'
const route = process.argv[2] || '/'

// 默认用超管；BLOG_USER / BLOG_PWD 可切到受限账号，用来验证菜单按权限收缩
const user = process.env.BLOG_USER || 'admin'
const password = process.env.BLOG_PWD || readFileSync(PWD_FILE, 'utf8').trim()
const profile = mkdtempSync(join(tmpdir(), 'edge-blog-'))
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
    if (u && !u.includes('/vite')) logs.push(`[net] ${msg.params.response.status} ${u}`)
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

/** 等某个条件成立（页面内表达式返回真），最多等 timeout 毫秒 */
async function waitFor(expr, timeout = 15000, label = '') {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(expr)) return true
    } catch {
      /* 页面正在跳转时会短暂报错，忽略 */
    }
    await sleep(400)
  }
  logs.push(`[timeout] ${label || expr}`)
  return false
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = attached.sessionId

await send('Page.enable')
await send('Runtime.enable')
await send('Log.enable')
await send('Network.enable')

// 1) 打开后台首页：此时没有任何 cookie，应被重定向到账号中心登录页
await evaluate(`location.href = ${JSON.stringify(ADMIN + route)}`)
await sleep(3000)
const afterRedirect = await evaluate('location.href')
console.log('① 打开后台 ->', afterRedirect)
const wentToSso = afterRedirect.includes('5173/login') && afterRedirect.includes('app=blog')
console.log('   跳转到账号中心登录页：', wentToSso ? 'OK' : 'FAIL')

// 2) 在登录页填账号密码并提交
if (wentToSso) {
  await waitFor(`!!document.querySelector('input[placeholder="登录名"]')`, 15000, '登录表单')
  await evaluate(`(() => {
    const setVal = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const u = document.querySelector('input[placeholder="登录名"]')
    const p = document.querySelector('input[placeholder="密码"]')
    if (u) setVal(u, ${JSON.stringify(user)})
    if (p) setVal(p, ${JSON.stringify(password)})
    return !!u && !!p
  })()`)
  await sleep(500)
  await evaluate(`(() => {
    const btns = Array.from(document.querySelectorAll('button'))
    const login = btns.find((b) => b.innerText.replace(/\\s/g, '') === '登录')
    if (login) login.click()
    return !!login
  })()`)
  console.log('② 提交登录表单')
}

// 3) 等回到后台（hash 路由 + 令牌已落库）
const back = await waitFor(
  `location.origin === 'http://localhost:5176' && !!localStorage.getItem('blog.admin.token')`,
  25000,
  '回到后台并拿到令牌'
)
console.log('③ 回到后台并拿到令牌：', back ? 'OK' : 'FAIL')
await sleep(3000)

const info = await evaluate(`(() => ({
  href: location.href,
  title: document.title,
  menus: Array.from(document.querySelectorAll('.el-menu-item')).map((e) => e.innerText.trim()),
  user: document.querySelector('.user')?.innerText.trim() || '',
  text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 900),
  tokenLen: (localStorage.getItem('blog.admin.token') || '').length
}))()`)

console.log('④ 最终地址：', info.href)
console.log('   标题：', info.title)
console.log('   当前用户：', info.user)
console.log('   菜单：', info.menus.join(' / '))
console.log('   令牌长度：', info.tokenLen)
console.log('--- 页面文本 ---')
console.log(info.text)
console.log('--- 网络/异常 ---')
console.log(logs.filter((l) => !l.includes('200 /api/blog/public')).join('\n') || '(无)')

ws.close()
edge.kill()
process.exit(0)
