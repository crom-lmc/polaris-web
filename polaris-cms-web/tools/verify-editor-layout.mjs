/**
 * 校验 CMS 文章编辑页：
 * 1) md-editor 工具栏是否横向排布（不是竖排堆叠）
 * 2) 内容区滚动时顶栏 / 侧栏是否保持不动（整页不跟着滚）
 * 用法：node tools/verify-editor-layout.mjs <cmsToken> [articleId]
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TOKEN = process.argv[2] || ''
const AID = process.argv[3] || '13'
const PORT = 9381
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

mkdirSync('tools', { recursive: true })
const profile = mkdtempSync(join(tmpdir(), 'edge-editor-'))
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
    '--window-size=1440,760',
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
const logs = []
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data)
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.reject(new Error(p.method + ' ' + JSON.stringify(m.error))) : p.resolve(m.result)
    return
  }
  if (m.method === 'Runtime.exceptionThrown') {
    logs.push('[ex] ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 300))
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 760, deviceScaleFactor: 1, mobile: false })
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.setItem('cms_access_token',${JSON.stringify(TOKEN)});localStorage.setItem('cms_refresh_token',${JSON.stringify(TOKEN)});}catch(e){}`
})
await send('Page.navigate', { url: `http://localhost:5177/articles/${AID}/edit` })
await sleep(6500)

const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

const probe = `(() => {
  const rect = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { t: Math.round(r.top), l: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) } }
  const bar = document.querySelector('.md-editor-toolbar')
  const btns = bar ? Array.from(bar.children) : []
  const tops = [...new Set(btns.map(b => Math.round(b.getBoundingClientRect().top)))]
  const content = document.querySelector('.content')
  return {
    header: rect('.header'),
    sider: rect('.sider'),
    content: rect('.content'),
    contentScrollable: content ? content.scrollHeight > content.clientHeight + 4 : false,
    contentScrollTop: content ? content.scrollTop : -1,
    contentClientH: content ? content.clientHeight : -1,
    contentScrollH: content ? content.scrollHeight : -1,
    winScrollY: Math.round(window.scrollY),
    docScrollH: document.documentElement.scrollHeight,
    winH: innerHeight,
    toolbarFound: !!bar,
    toolbarDisplay: bar ? getComputedStyle(bar).display : '',
    toolbarBtnCount: btns.length,
    toolbarRows: tops.length,
    editorH: rect('.md-editor')
  }
})()`

const before = await evaluate(probe)
const shot1 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-editor-top.png', Buffer.from(shot1.data, 'base64'))

// 滚动内容区（不是 window）
await evaluate(`(() => { const c = document.querySelector('.content'); if (c) c.scrollTop = 400; return c ? c.scrollTop : -1 })()`)
await sleep(600)
const after = await evaluate(probe)
const shot2 = await send('Page.captureScreenshot', { format: 'png' })
writeFileSync('tools/out-editor-scrolled.png', Buffer.from(shot2.data, 'base64'))

console.log('滚动前:', JSON.stringify(before))
console.log('滚动后:', JSON.stringify(after))

const headerFixed = before.header.t === after.header.t
const siderFixed = before.sider.t === after.sider.t
const windowNotScrolled = after.winScrollY === 0
const contentScrolled = after.contentScrollTop > 0
const toolbarInline = before.toolbarFound && before.toolbarRows <= 2

console.log('\n顶部 toolbar 是否存在 :', before.toolbarFound)
console.log('toolbar 行数(=几档纵坐标):', before.toolbarRows, '按钮数:', before.toolbarBtnCount)
console.log('内容区可滚动 :', before.contentScrollable, '| 已滚动到:', after.contentScrollTop)
console.log('顶栏位置不变 :', headerFixed, before.header.t, '->', after.header.t)
console.log('侧栏位置不变 :', siderFixed, before.sider.t, '->', after.sider.t)
console.log('window 未被滚动 :', windowNotScrolled)
console.log(
  '结论:',
  toolbarInline && headerFixed && siderFixed && windowNotScrolled && contentScrolled ? 'PASS' : 'FAIL'
)
if (logs.length) console.log('页面异常:\n' + logs.join('\n'))

ws.close()
edge.kill()
process.exit(0)
