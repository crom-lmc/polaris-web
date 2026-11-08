// 注入 CMS 令牌，无头打开 CMS 后台「门户设置」页，验证模块列表渲染
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GW = 'http://127.0.0.1:9080'
const REDIRECT = 'http://localhost:5177/callback'
const PORT = 9334
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const PW = readFileSync('C:/Users/Administrator/AppData/Local/Temp/admin-pwd.txt', 'utf8').trim()

async function getCmsToken() {
  const lj = await (await fetch(GW + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PW, appCode: 'sso' })
  })).json()
  const aj = await (await fetch(GW + '/api/auth/oauth/authorize', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lj.data.accessToken },
    body: JSON.stringify({ responseType: 'code', clientId: 'cms', redirectUri: REDIRECT, state: 'page' })
  })).json()
  const ej = await (await fetch(GW + '/api/cms/sso/oauth/exchange', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: aj.data.code, redirectUri: REDIRECT })
  })).json()
  if (ej.code !== 0) throw new Error('换票失败: ' + ej.message)
  return ej.data.accessToken
}

async function main() {
  const token = await getCmsToken()
  console.log('已获取 CMS 令牌')

  const exe = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe'
  ].find((p) => existsSync(p))
  const profile = mkdtempSync(join(tmpdir(), 'cms-cdp-'))
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-sync',
    '--proxy-server=direct://', '--proxy-bypass-list=*', 'about:blank'], { stdio: 'ignore' })

  let wsUrl = ''
  for (let i = 0; i < 40; i++) {
    try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; if (wsUrl) break } catch {}
    await sleep(250)
  }
  const ws = new WebSocket(wsUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  let id = 0, sessionId = null
  const pending = new Map()
  const errs = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200))
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200))
  })
  const send = (method, params = {}, useSession = true) => {
    const mid = ++id
    const msg = { id: mid, method, params }
    if (useSession && sessionId) msg.sessionId = sessionId
    ws.send(JSON.stringify(msg))
    return new Promise((r) => pending.set(mid, r))
  }
  const { result: t } = await send('Target.createTarget', { url: 'about:blank' }, false)
  const at = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true }, false)
  sessionId = at.result.sessionId
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.setItem('cms_access_token', ${JSON.stringify(token)})}catch(e){}`
  })
  await send('Page.navigate', { url: 'http://localhost:5177/portal' })
  await sleep(5500)

  const r = await send('Runtime.evaluate', {
    expression: `(() => {
      const txt = document.body.innerText || '';
      const rows = [...document.querySelectorAll('.row .name')].map(e => e.textContent.trim());
      return {
        url: location.href,
        title: document.title,
        rows,
        hasHint: txt.includes('保存布局'),
        menus: [...document.querySelectorAll('.ant-menu-item')].map(e=>e.textContent.trim()).filter(Boolean)
      };
    })()`,
    returnByValue: true
  })
  console.log('=== CMS 门户设置页 ===')
  console.log(JSON.stringify(r.result?.result?.value, null, 2))
  console.log('控制台错误:', errs.length ? errs.join(' | ') : '(无)')

  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await sleep(300)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (shot.result?.data) {
    writeFileSync('F:/code/sso/portal-web/tools/cms-portal-page.png', Buffer.from(shot.result.data, 'base64'))
    console.log('截图: portal-web/tools/cms-portal-page.png')
  }
  ws.close(); proc.kill()
}
main().catch((e) => { console.log('ERROR', e.message); process.exit(1) })
