/**
 * 用户管理页 UI 探针（本地排障用）。
 *
 * 走完一套真实操作：登录 → 用户管理 → 新增用户（填表提交）→ 行内禁用，
 * 并打印所有 /api/admin/users 的请求/响应报文，用来区分「前端没发对」还是「后端没接对」。
 *
 * 依赖：npm i puppeteer-core（不下载 Chromium，复用本机 Edge）
 * 用法：node tools/users-probe.mjs [base_url] [account] [password]
 *      node tools/users-probe.mjs http://localhost:5174 admin Admin@123
 *
 * 注意：antd 中文按钮文本会被拆成「禁 用」，比较前必须去掉空白。
 */
import puppeteer from 'puppeteer-core'

const BASE = process.argv[2] || 'http://localhost:5174'
const ACCOUNT = process.argv[3] || 'admin'
const PASSWORD = process.argv[4] || 'Admin@123'
const suffix = Date.now().toString().slice(-6)
const NEW_USER = 'u' + suffix

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const page = await browser.newPage()
await page.setViewport({ width: 1400, height: 950 })

const logs = []
page.on('console', (m) => {
  const t = m.text()
  if (t.includes('[vite]')) return
  logs.push(`[console.${m.type()}] ${t}`)
})
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()} :: ${r.failure()?.errorText}`))
page.on('request', (r) => {
  if (r.url().includes('/api/admin/users') && r.method() !== 'GET') {
    logs.push(`[REQ] ${r.method()} ${r.url()} :: ${r.postData()}`)
  }
})
page.on('response', async (r) => {
  if (r.url().includes('/api/admin/users')) {
    let body = ''
    try { body = (await r.text()).slice(0, 400) } catch { /* ignore */ }
    logs.push(`[RES] ${r.status()} ${r.url()} :: ${body}`)
  }
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function clickText(selector, text) {
  // antd 中文按钮会把字拆开加空格（"禁 用"），比较前统一去空白
  const want = text.replace(/\s+/g, '')
  const handles = await page.$$(selector)
  for (const h of handles) {
    const raw = (await h.evaluate((n) => n.innerText || '')).replace(/\s+/g, '')
    if (raw.includes(want)) {
      await h.click()
      return true
    }
  }
  return false
}

async function inputByPlaceholder(ph, value) {
  const el = await page.$(`input[placeholder="${ph}"]`)
  if (!el) return false
  await el.click({ clickCount: 3 })
  await el.type(value)
  return true
}

console.log('== 登录 ==')
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' })
const inputs = await page.$$('input')
const types = []
for (const el of inputs) types.push(await el.evaluate((n) => n.type))
const accIdx = types.findIndex((t) => t !== 'password')
const pwdIdx = types.findIndex((t) => t === 'password')
await inputs[accIdx].click({ clickCount: 3 })
await inputs[accIdx].type(ACCOUNT)
await inputs[pwdIdx].click({ clickCount: 3 })
await inputs[pwdIdx].type(PASSWORD)
await (await page.$('button[type=submit]')).click()
await sleep(2500)
console.log('url =', page.url())

console.log('== 进入用户管理 ==')
await clickText('.ant-menu-title-content', '用户管理')
await sleep(2000)
const rowCount = await page.$$eval('.ant-table-tbody tr', (rs) => rs.length).catch(() => 0)
console.log('表格行数 =', rowCount)

console.log('== 新增用户 ==')
console.log('  点击新增按钮:', await clickText('button', '新增用户'))
await sleep(800)
console.log('  填用户名:', await inputByPlaceholder('3-32 位字母/数字/下划线', NEW_USER))
await page.$eval('#form_item_email', (n) => { n.value = '' })
await (await page.$('#form_item_email')).type(`${NEW_USER}@example.com`)
const nickEl = await page.$('#form_item_nickname')
if (nickEl) await nickEl.type('UI测试用户')
const pwdEl = await page.$('#form_item_password')
if (pwdEl) await pwdEl.type('UiTest@12345')

await sleep(300)
const footerBtns = await page.$$('.ant-modal-footer button')
for (const b of footerBtns) {
  console.log('  footer btn:', JSON.stringify(await b.evaluate((n) => n.innerText)))
}
const primary = await page.$('.ant-modal-footer button.ant-btn-primary')
console.log('  点提交:', !!primary)
if (primary) await primary.click()
await sleep(2500)

const pageText = await page.evaluate(() => document.body.innerText)
console.log('新用户出现在页面 =', pageText.includes(NEW_USER))
const rowsAfter = await page.$$eval('.ant-table-tbody tr', (rs) => rs.length).catch(() => 0)
console.log('表格行数(新增后) =', rowsAfter)

await page.screenshot({ path: 'C:/Users/Administrator/AppData/Local/Temp/users-after-create.png' })

console.log('== 行内操作：禁用 ==')
const rowTexts = await page.$$eval('.ant-table-tbody tr', (rs) => rs.map((r) => r.innerText))
const targetIdx = rowTexts.findIndex((t) => t.includes(NEW_USER))
console.log('目标行 index =', targetIdx)
if (targetIdx >= 0) {
  const row = (await page.$$('.ant-table-tbody tr'))[targetIdx]
  const btns = await row.$$('button')
  for (const b of btns) {
    const t = await b.evaluate((n) => n.innerText.trim())
    if (t === '禁用') { await b.click(); break }
  }
  await sleep(800)
  // 确认 popconfirm
  await clickText('.ant-popover button', '禁用')
  await sleep(2000)
  const after = await page.evaluate(() => document.body.innerText)
  console.log('禁用后该行含「已禁用」 =', after.includes('已禁用'))
}

await page.screenshot({ path: 'C:/Users/Administrator/AppData/Local/Temp/users-final.png' })
console.log('--- logs ---')
console.log(logs.join('\n') || '(无异常输出)')
await browser.close()
