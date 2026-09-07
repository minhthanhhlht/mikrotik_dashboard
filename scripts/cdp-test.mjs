// CDP test trực tiếp (không phụ thuộc MCP browser):
// 1. Login qua /api/auth/login để lấy token
// 2. Set localStorage token
// 3. Mở /profiles và dump nội dung render
import { writeFileSync } from 'node:fs';

const MIK = 'http://localhost:3000';

async function getToken() {
  const res = await fetch(`${MIK}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'mikrotik2026' }),
  });
  const d = await res.json();
  if (!d.token) throw new Error('login failed: ' + JSON.stringify(d));
  return d.token;
}

// Tìm page target (trang localhost:3000 hoặc bất kỳ, về:blank)
const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
console.log('targets:', targets.map((t) => `${t.type}:${t.url}`.slice(0, 60)));
let page = targets.find((t) => t.type === 'page' && t.url.includes('localhost:3000')) || targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');
console.log('using page:', page.url, page.webSocketDebuggerUrl);

const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
const events = [];

ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(JSON.stringify(data.error)));
    else resolve(data.result);
  } else if (data.method) {
    events.push(data);
  }
};

await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

function cmd(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const r = await cmd('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

// 1. Set token localStorage (jesteśmy już na origin http://localhost:3000)
const token = await getToken();
console.log('token:', token.slice(0, 12));
const lsSet = await evaluate(`localStorage.setItem('hs_token', ${JSON.stringify(token)}); localStorage.setItem('hs_user','admin'); 'ok'`);
console.log('localStorage set:', lsSet);

// 2. Navigate tới /profiles và chờ load xong
await cmd('Page.navigate', { url: `${MIK}/profiles` });

// Chờ document.readyState complete + không còn trên /login
let ui;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  ui = await evaluate(`(() => ({
    url: location.pathname,
    ready: document.readyState,
    bodyText: document.body ? document.body.innerText.slice(0, 120) : ''
  }))()`);
  if (ui.url !== '/login' && ui.ready === 'complete') break;
}
console.log('after-navigate:', JSON.stringify(ui));

// Chẩn đoán localStorage
const ls = await evaluate(`(() => ({
  hs_user: localStorage.getItem('hs_user'),
  hs_token: (localStorage.getItem('hs_token') || '').slice(0, 15)
}))()`);
console.log('localStorage check:', JSON.stringify(ls));

// 3. Dump UI
const info = await evaluate(`(() => {
  const h1 = document.querySelector('h1')?.textContent || '';
  const rows = [...document.querySelectorAll('tbody tr')].map(tr => tr.textContent.replace(/\\s+/g,' ').trim());
  const nav = [...document.querySelectorAll('nav a')].map(a => a.textContent.trim());
  const btns = [...document.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean);
  return { h1, rows, nav, url: location.pathname, btns: btns.slice(0, 12) };
})()`);
console.log('UI INFO:', JSON.stringify(info, null, 2));

// 4. Agenda móc zmienić — teraz /users
await cmd('Page.navigate', { url: `${MIK}/users` });
let ui2;
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  ui2 = await evaluate(`(() => ({ url: location.pathname, ready: document.readyState }))()`);
  if (ui2.ready === 'complete') break;
}
const info2 = await evaluate(`(() => {
  const h1 = document.querySelector('h1')?.textContent || '';
  const rows = [...document.querySelectorAll('tbody tr')].map(tr => tr.textContent.replace(/\\s+/g,' ').trim());
  const actions = [...document.querySelectorAll('td:last-child button')].map(b => b.textContent.trim());
  const headerBtns = [...document.querySelectorAll('header button')].map(b => b.textContent.replace(/\\s+/g,' ').trim());
  return { h1, rows, actions, headerBtns };
})()`);
console.log('\nUSERS INFO:', JSON.stringify(info2, null, 2));

// 5. Otwórz modal "Gia hấn" na pierwszym wierszu
const ghanBtn = await evaluate(`(() => {
  const cell = [...document.querySelectorAll('tbody tr')][0]?.querySelector('td:last-child');
  const b = [...(cell?.querySelectorAll('button') || [])].find(x => x.textContent.includes('Gia'));
  if (b) { b.click(); return 'clicked'; }
  return 'no-button';
})()`);
console.log('giahán click:', ghanBtn);
await new Promise((r) => setTimeout(r, 700));
const modalInfo = await evaluate(`(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return dlg ? dlg.innerText.replace(/\\s+/g,' ').slice(0, 250) : 'NO_DIALOG';
})()`);
console.log('giahán modal:', modalInfo);
ws.close();
console.log('\n=== XONG ===');