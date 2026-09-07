// Test auth + API mới qua proxy backend
const BASE = 'http://localhost:3000/api';

async function jreq(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-auth-token'] = token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  console.log(`\n[${res.status}] ${method} ${path}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 700));
  return data;
}

console.log('=== 1. Login SAI ===');
await jreq('/auth/login', { method: 'POST', body: { username: 'x', password: 'y' } });

console.log('=== 2. Login ĐÚNG ===');
const login = await jreq('/auth/login', { method: 'POST', body: { username: 'admin', password: 'mikrotik2026' } });
const token = login?.token;
if (!token) { console.log('LOGIN FAILED, STOP'); process.exit(1); }

console.log('=== 3. /api/stats (chưa có token) ===');
await jreq('/stats', { token: '' });

console.log('=== 4. /api/stats (token) ===');
await jreq('/stats', { token });

console.log('=== 5. /api/profiles (token) ===');
await jreq('/profiles', { token });

console.log('=== 6. /api/users (token) ===');
await jreq('/users', { token });

console.log('=== 7. /api/active (token) ===');
await jreq('/active', { token });

console.log('\n=== XONG ===');