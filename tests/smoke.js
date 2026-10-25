// raffle-picker-bd — headless-Chrome smoke test via raw CDP (no deps).
// Run: node tests/smoke.js   (uses /opt/meta-chromium/chrome)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const CHROME = '/opt/meta-chromium/chrome';
const DIR = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(DIR, 'index.html');

let pass = 0, fail = 0;
function check(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name); }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
async function waitFor(fn, label, timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await fn()) return true; } catch (e) {}
    await sleep(200);
  }
  throw new Error('timeout waiting for ' + label);
}

async function main() {
  const port = 19400 + Math.floor(Math.random() * 500);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'rpb-smoke-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + port, '--user-data-dir=' + profile, 'about:blank'
  ], { stdio: 'ignore' });
  const errors = [];
  try {
    await waitFor(async () => {
      const r = await fetch('http://127.0.0.1:' + port + '/json/version');
      return r.ok;
    }, 'chrome debug port');
    const put = await fetch('http://127.0.0.1:' + port + '/json/new?' + new URLSearchParams({ url: URL }), { method: 'PUT' });
    const created = await put.json();
    if (!created || !created.webSocketDebuggerUrl) throw new Error('no debug target (PUT status ' + put.status + ')');
    const ws = new WebSocket(created.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let seq = 0;
    const pending = new Map();
    let loadResolver = null;
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails.exception));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('console.error: ' + JSON.stringify(msg.params.args));
      } else if (msg.method === 'Page.loadEventFired' && loadResolver) {
        const f = loadResolver; loadResolver = null; f();
      }
    };
    function send(method, params) {
      return new Promise((res, rej) => {
        const id = ++seq;
        pending.set(id, { res, rej });
        ws.send(JSON.stringify({ id, method, params: params || {} }));
        setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error('CDP timeout ' + method)); } }, 25000);
      });
    }
    async function ev(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('eval exception: ' + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    await send('Runtime.enable');
    await send('Page.enable');
    await send('Page.navigate', { url: URL });
    await waitFor(() => ev('document.readyState === "complete"'), 'page load');
    await ev('window.confirm = () => true; true');

    // 1. Title + empty state + wheel canvas
    check((await ev('document.title')).includes('Raffle Picker BD'), 'title');
    check(await ev('!!document.getElementById("wheelCanvas")'), 'wheel canvas present');
    check(await ev('document.getElementById("spinBtn").disabled === true'), 'spin disabled with 0 names');
    check(await ev('document.getElementById("nameList").textContent.length > 0'), 'empty-state note shown');

    // 2. Bulk add 3 names
    await ev('document.getElementById("bulkNames").value = "Rahim\\nKarim\\nNusrat"; document.getElementById("addBulkBtn").click(); true');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 3'), 'bulk add gives 3 name rows');
    check(await ev('document.getElementById("poolCount").textContent.includes("3")'), 'pool count shows 3');
    check(await ev('document.getElementById("spinBtn").disabled === false'), 'spin enabled with 3 names');
    check(await ev('(localStorage.getItem("raffle-picker-bd-v1") || "").includes("Nusrat")'), 'localStorage holds names');

    // 3. Real spin (4.5s animation): banner winner must be a pool name, pool shrinks by 1 (no-repeat)
    await ev('document.getElementById("spinBtn").click(); true');
    await waitFor(() => ev('document.querySelector("#winnerBanner .banner-name") && document.querySelector("#winnerBanner .banner-name").textContent.length > 0'), 'spin banner winner', 20000);
    const winner = await ev('document.querySelector("#winnerBanner .banner-name").textContent');
    check(['Rahim', 'Karim', 'Nusrat'].includes(winner), 'spin winner is a pool name (' + winner + ')');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 2'), 'no-repeat: pool shrinks to 2 after spin');
    check(await ev('document.querySelectorAll("#winnersList .winner-row").length === 1'), 'winners board has 1 row after spin');

    // 4. Quick draw 1 more winner
    await ev('document.getElementById("quickCount").value = "1"; document.getElementById("quickDrawBtn").click(); true');
    check(await ev('document.querySelectorAll("#winnersList .winner-row").length === 2'), 'winners board has 2 rows after quick draw');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 1'), 'pool shrinks to 1 after quick draw');

    // 5. Persistence across reload
    const loadPromise = new Promise(r => { loadResolver = r; });
    await send('Page.reload', { ignoreCache: true });
    await Promise.race([loadPromise, sleep(15000)]);
    await waitFor(() => ev('document.readyState === "complete"'), 'reload complete');
    check(await ev('document.querySelectorAll("#winnersList .winner-row").length === 2'), 'winners survive reload');

    // 6. BN toggle: title + persisted lang
    await ev('document.getElementById("langBtn").click(); true');
    check(await ev('document.querySelector("h1").textContent === "র‍্যাফেল পিকার বিডি"'), 'BN title after toggle');
    check(await ev('localStorage.getItem("raffle-picker-bd-lang") === "bn"'), 'BN lang persisted');
    check(await ev('document.getElementById("poolCount").textContent.includes("১")'), 'Bengali digits in pool count');

    // 7. Duplicate single-name rejected, row count unchanged
    await ev('(() => { const rows = [...document.querySelectorAll("#nameList .name-row")].map(r => r.textContent); document.getElementById("singleName").value = rows[0].replace("সরান","").replace("Remove",""); document.getElementById("singleForm").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); return true; })()');
    check(await ev('document.getElementById("formError").textContent.length > 0'), 'duplicate shows inline error');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 1'), 'duplicate not added');

    // 8. Erase (typed DELETE) wipes stored data
    await ev('document.getElementById("eraseInput").value = "DELETE"; document.getElementById("eraseBtn").click(); true');
    check(await ev('!localStorage.getItem("raffle-picker-bd-v1")'), 'localStorage cleared after erase');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 0'), 'name list empty after erase');

    // 9. Sample loader
    await ev('document.getElementById("sampleBtn").click(); true');
    check(await ev('document.querySelectorAll("#nameList .name-row").length === 8'), 'sample loads 8 names');

    // 10. 390px mobile: no horizontal overflow
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    check(await ev('document.documentElement.scrollWidth <= 391'), '390px no horizontal overflow (scrollWidth ' + await ev('document.documentElement.scrollWidth') + ')');

    // 11. No page/console errors
    check(errors.length === 0, '0 console/page errors' + (errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''));

    ws.close();
  } finally {
    try { chrome.kill(); } catch (e) {}
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  console.log(pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}

main().catch(e => { console.log('SMOKE CRASH: ' + (e && e.stack || e)); process.exit(1); });
