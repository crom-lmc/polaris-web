// 无头浏览器验证门户首页：模块渲染 + 内容 + 控制台错误
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PORT = 9333
const BASE = process.env.PORTAL_BASE || 'http://localhost:5178'

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
]
const exe = EDGE_CANDIDATES.find((p) => existsSync(p))
if (!exe) {
  console.log('未找到 Edge/Chrome')
  process.exit(2)
}

const profile = mkdtempSync(join(tmpdir(), 'portal-cdp-'))
const proc = spawn(exe, [
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
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  let wsUrl = ''
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      const j = await r.json()
      wsUrl = j.webSocketDebuggerUrl
      if (wsUrl) break
    } catch { /* retry */ }
    await sleep(250)
  }
  if (!wsUrl) throw new Error('CDP 未就绪')

  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  let id = 0
  const pending = new Map()
  const consoleErrs = []
  let sessionId = null

  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails
      consoleErrs.push((d.exception?.description || d.text || '').slice(0, 300))
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300))
    }
  })

  function send(method, params = {}, useSession = true) {
    const mid = ++id
    const msg = { id: mid, method, params }
    if (useSession && sessionId) msg.sessionId = sessionId
    ws.send(JSON.stringify(msg))
    return new Promise((res) => pending.set(mid, res))
  }

  const { result: t } = await send('Target.createTarget', { url: 'about:blank' }, false)
  const at = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }, false)
  sessionId = at.result.sessionId

  await send('Page.enable')
  await send('Runtime.enable')

  await send('Page.navigate', { url: BASE + '/' })
  await sleep(4500)

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result?.result?.value
  }

  const report = await evalJs(`(() => {
    const txt = document.body.innerText || '';
    const q = (s) => document.querySelectorAll(s).length;
    return {
      url: location.href,
      title: document.title,
      loading: txt.includes('加载') && q('.ant-spin-spinning') > 0,
      hasHeader: !!document.querySelector('.brand'),
      hasLatest: txt.includes('最新文章'),
      hasFeatured: txt.includes('精选推荐'),
      hasCategory: txt.includes('分类导航'),
      bannerImgs: q('.slide-img'),
      featuredCards: q('.fcard'),
      articleCards: q('.card'),
      chips: q('.chip'),
      textLen: txt.length,
      snippet: txt.replace(/\\s+/g, ' ').slice(0, 200)
    };
  })()`)

  console.log('=== 门户首页渲染检查 ===')
  console.log(JSON.stringify(report, null, 2))
  console.log('\n=== 控制台错误 ===')
  console.log(consoleErrs.length ? consoleErrs.join('\n') : '(无)')

  // 截图（整页）
  const metrics = await evalJs(`({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight })`)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1200,
    height: Math.min(metrics?.h || 1200, 2600),
    deviceScaleFactor: 1,
    mobile: false
  })
  await sleep(400)
  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  if (shot.result?.data) {
    writeFileSync('F:/code/sso/portal-web/tools/portal-home.png', Buffer.from(shot.result.data, 'base64'))
    console.log('\n截图已保存: portal-web/tools/portal-home.png')
  }

  ws.close()
  proc.kill()
}

main().catch((e) => {
  console.log('ERROR', e.message)
  proc.kill()
  process.exit(1)
})
