// Test health trên backend offline giả lập (port 3002)
const BASE = process.env.OFFLINE_BASE || 'http://localhost:3002/api';
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'mikrotik2026' }),
})).json();
const health = await (await fetch(`${BASE}/health`, {
  headers: { 'x-auth-token': login.token },
})).json();
console.log('connected :', health.connected);
console.log('latencyMs :', health.latencyMs);
console.log('error     :', health.error);
console.log('host      :', health.mikrotik.host);
console.log(health.connected === false ? '\nOFFLINE_OK ✓' : '\nFAIL: should be offline');