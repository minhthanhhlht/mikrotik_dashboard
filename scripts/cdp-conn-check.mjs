// CDP: verify ConnectionStatus — nhận URL qua biến môi trường CDP_MIK
const MIK = process.env.CDP_MIK || 'http://localhost:3000';

const login = await (await fetch(`${MIK}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'mikrotik2026' }),
})).json();
if (!login.token) throw new Error('login failed: ' + JSON.stringify(login));

const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = targets.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let msgId = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    data.error ? reject(new Error(JSON.stringify(data.error))) : resolve(data.result);
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
async function ev(expr) {
  const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.value;
}

// Điều hướng tới login trước để same-origin localStorage, rồi set token
await cmd('Page.navigate', { url: `${MIK}/login` });
await new Promise((r) => setTimeout(r, 900));
await ev(`localStorage.setItem('hs_token', ${JSON.stringify(login.token)}); localStorage.setItem('hs_user','admin'); 'ok'`);
await cmd('Page.navigate', { url: `${MIK}/` });
await new Promise((r) => setTimeout(r, 1800));

const info = await ev(`(() => {
  const aside = document.querySelector('aside');
  const text = aside ? aside.innerText : '';
  return {
    url: location.pathname,
    hasConnected: text.includes('REST API đã kết nối'),
    hasOffline: text.includes('Mất kết nối'),
    hasChecking: text.includes('Đang kiểm tra'),
    asideText: text.slice(0, 220)
  };
})()`);
console.log(JSON.stringify(info, null, 2));
ws.close();
console.log('\n=== XONG ===');