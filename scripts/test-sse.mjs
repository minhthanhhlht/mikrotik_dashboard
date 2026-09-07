// Test SSE /api/events — odczyt 2 ramek
const BASE = 'http://localhost:3000/api';
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'mikrotik2026' }),
})).json();

const res = await fetch(`${BASE}/events`, {
  headers: { 'x-auth-token': login.token },
});
console.log('content-type:', res.headers.get('content-type'));
if (!res.ok) { console.log('HTTP', res.status, await res.text()); process.exit(1); }

const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
let frames = 0;
const start = Date.now();
while (Date.now() - start < 12000 && frames < 2) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  let idx;
  while ((idx = buf.indexOf('\n\n')) !== -1) {
    const frame = buf.slice(0, idx);
    buf = buf.slice(idx + 2);
    if (frame.startsWith('data: ')) {
      const d = JSON.parse(frame.slice(6));
      console.log(`frame${++frames} users=${d.users} active=${d.active} at=$`)
    }
  }
}
try { await reader.cancel(); } catch {}
console.log(frames >= 1 ? 'SSE_OK' : 'SSE_NO_FRAMES');