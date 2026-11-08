/**
 * 门户设置「实时预览」验证（mock 后端，不依赖真实登录）：
 * 1) 左配置 / 右预览 双栏渲染
 * 2) iframe 内嵌真实 portal 首页并能加载
 * 3) 关闭 / 上移模块后，iframe 内容实时变化（postMessage 链路）
 *
 * 用法：node tools/verify-portal-preview.mjs
 * 产出：tools/out-preview-1.png、out-preview-2.png
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = 'http://localhost:5177'
const PORT = 9343
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const profile = mkdtempSync(join(tmpdir(), 'edge-portalpreview-'))
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
    '--window-size=1600,1000',
    'about:blank'
  ],
  { stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64')

// ---------------- mock 数据 ----------------
const LAYOUT = [
  { id: 1, moduleKey: 'banner', moduleName: 'Banner 轮播', enabled: 1, sort: 1, config: '' },
  { id: 2, moduleKey: 'featured', moduleName: '精选推荐', enabled: 1, sort: 2, config: '{"limit":3}' },
  { id: 3, moduleKey: 'latest', moduleName: '最新文章', enabled: 1, sort: 3, config: '{"limit":4}' },
  { id: 4, moduleKey: 'category', moduleName: '分类导航', enabled: 1, sort: 4, config: '' },
  { id: 5, moduleKey: 'tags', moduleName: '热门标签', enabled: 1, sort: 5, config: '{"limit":6}' },
  { id: 6, moduleKey: 'links', moduleName: '友情链接', enabled: 0, sort: 6, config: '' }
]
const ARTICLES = {
  list: [
    { id: 101, title: '分布式事务：从 2PC 到 Saga', summary: '一致性方案对比', categoryName: '架构', pinned: 1, publishedAt: '2026-09-05' },
    { id: 102, title: '微服务熔断降级实战', summary: 'Sentinel 落地', categoryName: '微服务', recommended: 1, publishedAt: '2026-08-11' },
    { id: 103, title: '消息丢失与重复消费的幂等方案', summary: '生产可用的做法', categoryName: '消息队列', publishedAt: '2026-07-15' },
    { id: 104, title: '一次线上 GC 排查记录', summary: '从 FullGC 到定位', categoryName: '性能', publishedAt: '2026-06-20' }
  ],
  total: 4
}
const BANNERS = [{ id: 1, title: 'Banner 轮播 A', imageUrl: 'http://localhost:5178/none.png', linkUrl: '' }]
const CATEGORIES = [{ id: 11, name: '架构', articleCount: 12 }, { id: 12, name: '微服务', articleCount: 8 }]
const TAGS = [{ id: 21, name: '分布式' }, { id: 22, name: '微服务' }, { id: 23, name: '并发' }]

const ME = {
  code: 0,
  data: {
    accountId: 1,
    username: 'admin',
    superAdmin: true,
    appCode: 'cms',
    permissions: ['portal:view', 'portal:config', 'dashboard:view']
  }
}

function mockFor(url) {
  if (url.includes('/api/cms/me')) return ME
  if (url.includes('/api/cms/portal-layout')) return { code: 0, data: LAYOUT }
  if (url.includes('/api/cms/public/layout')) return { code: 0, data: LAYOUT.filter((m) => m.enabled === 1) }
  if (url.includes('/api/cms/public/banners')) return { code: 0, data: BANNERS }
  if (url.includes('/api/cms/public/articles')) return { code: 0, data: ARTICLES }
  if (url.includes('/api/cms/public/categories')) return { code: 0, data: CATEGORIES }
  if (url.includes('/api/cms/public/tags')) return { code: 0, data: TAGS }
  if (url.includes('/api/cms/public/layout')) return { code: 0, data: [] }
  return { code: 0, data: {} }
}

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
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ')
    if (!/favicon|ERR_|Failed to load resource/.test(text)) logs.push(`[error] ${text.slice(0, 240)}`)
  }
  if (msg.method === 'Fetch.requestPaused') {
    const { requestId, request } = msg.params
    if (request.url.includes('/api/')) {
      send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json' },
          { name: 'access-control-allow-origin', value: '*' }
        ],
        body: b64(JSON.stringify(mockFor(request.url)))
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

async function evaluate(expression, contextId) {
  const p = { expression, awaitPromise: true, returnByValue: true }
  if (contextId) p.contextId = contextId
  const r = await send('Runtime.evaluate', p)
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, true)
const attached = await send('Target.attachToTarget', { targetId, flatten: true }, true)
sessionId = attached.sessionId
await send('Page.enable')
await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false
})
await send('Fetch.enable', {
  patterns: [
    { urlPattern: '*/api/*', resourceType: 'XHR' },
    { urlPattern: '*/api/*', resourceType: 'Fetch' }
  ]
})

await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `if (location.origin === 'http://localhost:5177') {
    localStorage.setItem('cms_access_token', 'mock-token');
    localStorage.setItem('cms_refresh_token', 'mock-refresh');
  }`
})

await evaluate(`location.href = ${JSON.stringify(BASE + '/portal')}`)
await sleep(7000)

/** 左侧配置区结构 */
const layoutInfo = await evaluate(`(() => {
  const cs = (el) => el ? getComputedStyle(el) : null
  const page = document.querySelector('.pl')
  const side = document.querySelector('.pl-side')
  const main = document.querySelector('.pl-main')
  const mods = Array.from(document.querySelectorAll('.mod'))
  const frame = document.querySelector('.pv-frame iframe')
  return {
    url: location.href,
    hasSplit: !!page,
    pageDisplay: cs(page)?.display,
    sideWidth: cs(side)?.width,
    mainWidth: cs(main)?.width,
    rowCount: mods.length,
    rowNames: mods.map((m) => m.querySelector('.mod-name')?.textContent?.trim()),
    switchCount: document.querySelectorAll('.mod .ant-switch').length,
    iframeSrc: frame?.getAttribute('src'),
    iframeBox: frame ? (() => { const r = frame.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) } })() : null
  }
})()`)

/**
 * 跨源 iframe 在 Chromium 里是独立渲染进程（OOPIF），父页面拿不到它的 document，
 * 需要 attach 到该 iframe 的 target 再求值。
 */
let iframeSession = null
async function attachIframe() {
  for (let i = 0; i < 30; i++) {
    const { targetInfos } = await send('Target.getTargets', {}, true)
    const t = targetInfos.find((x) => x.url.includes('5178'))
    if (t) {
      const { sessionId: sid } = await send(
        'Target.attachToTarget',
        { targetId: t.targetId, flatten: true },
        true
      )
      const prev = sessionId
      sessionId = sid
      try {
        await send('Runtime.enable')
      } finally {
        sessionId = prev
      }
      iframeSession = sid
      return sid
    }
    await sleep(400)
  }
  return null
}

async function inFrame(expression) {
  if (!iframeSession) return null
  const prev = sessionId
  sessionId = iframeSession
  try {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (r.exceptionDetails) return null
    return r.result.value
  } catch {
    return null
  } finally {
    sessionId = prev
  }
}

await attachIframe()

async function readPreview() {
  const text = (await inFrame('document.body ? document.body.innerText : ""')) || ''
  const sections =
    (await inFrame(
      `Array.from(document.querySelectorAll('.section-title h2, .slide, .chip')).map(e => e.textContent.trim()).slice(0, 12)`
    )) || []
  return { text, sections }
}

const before = await readPreview()

const shot1 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-preview-1.png', Buffer.from(shot1.data, 'base64'))

// ---- 交互：关闭「Banner 轮播」，把「热门标签」逐步上移到最前 ----
const act = []
act.push(
  await evaluate(`(() => {
    const row = Array.from(document.querySelectorAll('.mod'))
      .find(r => r.querySelector('.mod-name')?.textContent?.trim() === 'Banner 轮播')
    const sw = row?.querySelector('.ant-switch')
    if (!sw) return 'switch-not-found'
    sw.click()
    return 'toggle-off:banner'
  })()`)
)
await sleep(400)

for (let i = 0; i < 4; i++) {
  const r = await evaluate(`(() => {
    const row = Array.from(document.querySelectorAll('.mod'))
      .find(r => r.querySelector('.mod-name')?.textContent?.trim() === '热门标签')
    const up = row?.querySelectorAll('.mod-ops .ant-btn')[0]
    if (!up || up.disabled) return 'stop'
    up.click()
    return 'move-up'
  })()`)
  act.push(r)
  if (r === 'stop') break
  await sleep(350)
}
await sleep(1000)

const after = await readPreview()
const stateAfter = await evaluate(`(() => ({
  order: Array.from(document.querySelectorAll('.mod .mod-name')).map(e => e.textContent.trim()),
  dirtyTip: document.querySelector('.pv-tip')?.textContent?.trim(),
  offCount: document.querySelectorAll('.mod.off').length
}))()`)

const shot2 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-preview-2.png', Buffer.from(shot2.data, 'base64'))

// ---- 设备档位：切到「手机」看 iframe 是否收窄 ----
await evaluate(`(() => {
  const btn = Array.from(document.querySelectorAll('.pv-device label'))
    .find(l => l.textContent.trim() === '手机')
  btn?.querySelector('input')?.click() || btn?.click()
  return !!btn
})()`)
await sleep(900)
const mobileBox = await evaluate(
  `(() => { const f = document.querySelector('.pv-frame'); const r = f?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null })()`
)
const shot3 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-preview-3.png', Buffer.from(shot3.data, 'base64'))

console.log('\n===== 门户设置 · 实时预览验证 =====')
console.log('URL                :', layoutInfo.url)
console.log('双栏容器           :', layoutInfo.hasSplit, ' display=', layoutInfo.pageDisplay)
console.log('左栏宽 / 右栏宽    :', layoutInfo.sideWidth, '/', layoutInfo.mainWidth)
console.log('模块行数           :', layoutInfo.rowCount, JSON.stringify(layoutInfo.rowNames))
console.log('开关数             :', layoutInfo.switchCount)
console.log('iframe src         :', layoutInfo.iframeSrc)
console.log('iframe 尺寸        :', JSON.stringify(layoutInfo.iframeBox))
console.log('\n--- 改动前 iframe 内容 ---')
console.log('文本片段 :', (before.text || '(空)').replace(/\n+/g, ' | ').slice(0, 220))
console.log('区块顺序 :', JSON.stringify(before.sections))
console.log('\n--- 操作 ---')
console.log(JSON.stringify(act))
console.log('\n--- 改动后 ---')
console.log('修改后的模块顺序   :', JSON.stringify(stateAfter.order))
console.log('未保存提示         :', stateAfter.dirtyTip)
console.log('已关闭行数         :', stateAfter.offCount)
console.log('iframe 文本片段    :', (after.text || '(空)').replace(/\n+/g, ' | ').slice(0, 220))
console.log('iframe 区块顺序    :', JSON.stringify(after.sections))
console.log('\n运行期异常         :', logs.length ? '\n  ' + logs.join('\n  ') : '(无)')

const isBanner = (s) => s.includes('首页主推') || s.includes('Banner')
const beforeHasBanner = before.sections.some(isBanner)
const afterHasBanner = after.sections.some(isBanner)
const beforeTagsIdx = before.sections.findIndex((s) => s.includes('热门标签'))
const afterTagsIdx = after.sections.findIndex((s) => s.includes('热门标签'))
const tagsMovedUp = beforeTagsIdx >= 0 && afterTagsIdx >= 0 && afterTagsIdx < beforeTagsIdx
const reordered = JSON.stringify(before.sections) !== JSON.stringify(after.sections)
const orderChanged = JSON.stringify(stateAfter.order) !== JSON.stringify(layoutInfo.rowNames)

const ok =
  layoutInfo.hasSplit &&
  layoutInfo.pageDisplay === 'flex' &&
  layoutInfo.rowCount === 6 &&
  layoutInfo.switchCount === 6 &&
  !!layoutInfo.iframeBox &&
  layoutInfo.iframeBox.w > 600 &&
  before.sections.length > 0 &&
  beforeHasBanner &&
  !afterHasBanner &&
  tagsMovedUp &&
  reordered &&
  orderChanged &&
  stateAfter.dirtyTip.includes('未保存') &&
  !!mobileBox &&
  mobileBox.w > 360 &&
  mobileBox.w < 420

console.log('\n--- 判定 ---')
console.log('初始含 Banner 区块 :', beforeHasBanner)
console.log('关闭后 Banner 消失 :', !afterHasBanner)
console.log('热门标签上移       :', `${beforeTagsIdx} -> ${afterTagsIdx}`, tagsMovedUp)
console.log('预览内容已重排     :', reordered)
console.log('手机档 iframe 宽度 :', JSON.stringify(mobileBox), '(应≈390)')

console.log('\n结论:', ok ? '✅ 勾选即实时预览生效' : '❌ 实时预览未按预期工作')
ws.close()
edge.kill()
process.exit(0)
