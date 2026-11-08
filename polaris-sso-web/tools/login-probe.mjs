/**
 * 登录链路前端探针（本地排障用）。
 *
 * 用途：用无头 Edge 真跑一遍「打开登录页 → 填账密 → 提交」，把
 *   · vue-router 的 push/replace 痕迹（history 打点）
 *   · 所有 /api、/oauth2 响应
 *   · console / pageerror / unhandledrejection
 * 全部打印出来，用来判断「点了登录没反应」这类问题到底卡在哪一环。
 *
 * 依赖（不下载 Chromium，复用本机 Edge）：
 *   npm i puppeteer-core
 * 用法：
 *   node tools/login-probe.mjs [url] [account] [password]
 *   node tools/login-probe.mjs http://localhost:5173/login admin Admin@123
 *
 * 环境变量：
 *   BROWSER_PATH  浏览器可执行文件，默认本机 Edge
 */
import puppeteer from 'puppeteer-core'

const BROWSER =
  process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const URL = process.argv[2] || 'http://localhost:5173/login'
const ACCOUNT = process.argv[3] || 'admin'
const PASSWORD = process.argv[4] || 'Admin@123'

const browser = await puppeteer.launch({
  executablePath: BROWSER,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,900']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })

// 记录 vue-router 的导航（底层是 history API）以及未捕获异常
await page.evaluateOnNewDocument(() => {
  window.__nav = []
  const push = history.pushState.bind(history)
  const replace = history.replaceState.bind(history)
  history.pushState = (...a) => { window.__nav.push('pushState -> ' + a[2]); return push(...a) }
  history.replaceState = (...a) => { window.__nav.push('replaceState -> ' + a[2]); return replace(...a) }
  window.addEventListener('unhandledrejection', (e) => {
    console.log('UNHANDLED_REJECTION: ' + (e.reason?.message || JSON.stringify(e.reason)))
  })
  window.addEventListener('error', (e) => console.log('WINDOW_ERROR: ' + e.message))
})

const logs = []
page.on('console', (m) => logs.push(`[console.${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`))
page.on('response', async (r) => {
  const u = r.url()
  if (u.includes('/api/') || u.includes('/oauth2/')) {
    let body = ''
    try { body = (await r.text()).slice(0, 300) } catch { /* 非文本响应忽略 */ }
    logs.push(`[response] ${r.status()} ${u} :: ${body}`)
  }
})

await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 800))
console.log('url(before login) =', page.url())

const inputs = await page.$$('input')
const types = []
for (const el of inputs) types.push(await el.evaluate((n) => n.type))
const accIdx = types.findIndex((t) => t !== 'password')
const pwdIdx = types.findIndex((t) => t === 'password')

if (accIdx >= 0) { await inputs[accIdx].click({ clickCount: 3 }); await inputs[accIdx].type(ACCOUNT) }
if (pwdIdx >= 0) { await inputs[pwdIdx].click({ clickCount: 3 }); await inputs[pwdIdx].type(PASSWORD) }
await new Promise((r) => setTimeout(r, 300))

const btn = await page.$('button[type=submit]')
if (!btn) throw new Error('没找到提交按钮')
await btn.click()

await new Promise((r) => setTimeout(r, 4000))
console.log('url(after login)  =', page.url())
console.log('nav trace:', JSON.stringify(await page.evaluate(() => window.__nav || []), null, 1))
console.log('--- logs ---')
console.log(logs.join('\n') || '(无请求/无控制台输出：表单提交基本没触发)')

await browser.close()
