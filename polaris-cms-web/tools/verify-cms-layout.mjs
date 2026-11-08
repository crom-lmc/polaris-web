/**
 * cms-web 布局验证（无需后端）：
 * 用 CDP Fetch 拦截 /api/* 返回 mock，使 cms 误以为已登录并渲染仪表盘，
 * 进而检查 antd 组件样式是否注入（验证「页面乱掉」根因：antd 未注册）。
 *
 * 用法：node tools/verify-cms-layout.mjs
 */
import { spawn } from 'node:child_process'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5177'
const PORT = 9341
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const login = JSON.parse(readFileSync('C:\\Users\\Administrator\\AppData\\Local\\Temp\\cms-login.json', 'utf8'))
const { accessToken, refreshToken } = login

const profile = mkdtempSync(join(tmpdir(), 'edge-cmslayout-'))
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
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

const ME = JSON.stringify({
  code: 0,
  data: { accountId: 1, username: 'admin', superAdmin: true, appCode: 'cms', permissions: ['dashboard:view', 'article:view', 'media:view', 'banner:view'] }
})
const DASH = JSON.stringify({
  code: 0,
  data: { total: 12, published: 8, pendingAudit: 1, draft: 3, recycled: 0, media: 5, banners: 2 }
})

async function browserWs() {
  for (let i = 0; i < 80; i++) {
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
      if (v.webSocketDebuggerUrl) return v.webSocketDebuggerUrl
    } catch {}
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
    logs.push(`[exception] ${(d.exception?.description || d.text).slice(0, 300)}`)
  }
  if (msg.method === 'Runtime.consoleAPICalled') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
    if (msg.params.type === 'error' || msg.params.type === 'warning') {
      logs.push(`[${msg.params.type}] ${text.slice(0, 240)}`)
    }
  }
  // Fetch 拦截：/api/* 返回 mock，其余放行
  if (msg.method === 'Fetch.requestPaused') {
    const { requestId, request, resourceType } = msg.params
    const url = request.url
    if (url.includes('/api/')) {
      let body = '{}'
      if (url.includes('/api/cms/me')) body = ME
      else if (url.includes('/api/cms/dashboard')) body = DASH
      else body = JSON.stringify({ code: 0, data: {} })
      send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'content-type', value: 'application/json' }],
        body: b64(body)
      }).catch(() => {})
    } else {
      send('Fetch.continueRequest', { requestId }).catch(() => {})
    }
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
await send('Fetch.enable', { patterns: [{ urlPattern: '*', resourceType: 'XHR' }, { urlPattern: '*', resourceType: 'Fetch' }] })

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `if (location.origin === 'http://localhost:5177') {
    localStorage.setItem('cms_access_token', ${JSON.stringify(accessToken)});
    localStorage.setItem('cms_refresh_token', ${JSON.stringify(refreshToken)});
  }`
})

await evaluate(`location.href = ${JSON.stringify(BASE + '/dashboard')}`)
await sleep(9000)

const mount = await evaluate(`(() => ({
  appChildren: document.getElementById('app') ? document.getElementById('app').children.length : -1,
  bodyLen: document.body ? document.body.innerHTML.length : -1,
  text: document.body ? document.body.innerText.slice(0, 200) : ''
}))()`)
console.log('[mount]', JSON.stringify(mount))

const result = await evaluate(`(() => {
  const q = (s) => document.querySelector(s)
  const qa = (s) => Array.from(document.querySelectorAll(s))
  const cs = (el) => (el ? getComputedStyle(el) : null)
  const sider = q('.ant-layout-sider')
  const layout = q('.ant-layout')
  const cards = qa('.ant-card')
  const rowTops = qa('.ant-row > .ant-col').slice(0, 3).map((el) => Math.round(el.getBoundingClientRect().top))
  const styleTags = qa('style').length
  const antdStyle = qa('style').some((s) => s.textContent.includes('.ant-layout'))
  return {
    url: location.href,
    hasMenu: !!q('.ant-menu'),
    hasLayout: !!layout,
    layoutDisplay: cs(layout)?.display,
    siderWidth: cs(sider)?.width,
    cardCount: cards.length,
    rowTops,
    cardsInSameRow: rowTops.length >= 2 && rowTops[0] === rowTops[1],
    antdStyleInjected: antdStyle,
    styleTagCount: styleTags
  }
})()`)

console.log('\n===== CMS 布局验证（mock 后端） =====')
console.log('URL              :', result.url)
console.log('ant-menu 存在    :', result.hasMenu, '(antd 已注册?)')
console.log('ant-layout 存在  :', result.hasLayout, ' display=', result.layoutDisplay)
console.log('sider 宽度       :', result.siderWidth, '(应为 208px)')
console.log('统计卡片数       :', result.cardCount)
console.log('卡片首行 top     :', JSON.stringify(result.rowTops), ' 横向同排=', result.cardsInSameRow)
console.log('antd 样式已注入  :', result.antdStyleInjected)
console.log('style 标签数     :', result.styleTagCount)
console.log('运行期异常       :', logs.length ? '\n  ' + logs.join('\n  ') : '(无)')

const ok =
  result.hasMenu &&
  result.hasLayout &&
  result.layoutDisplay === 'flex' &&
  result.siderWidth === '208px' &&
  result.cardsInSameRow &&
  result.antdStyleInjected

console.log('\n结论:', ok ? '✅ 布局已修复（antd 组件样式正常注入，不再乱掉）' : '❌ 仍有问题')
ws.close()
edge.kill()
process.exit(0)
