// Verify cuối: router thật sạch test data + API login hoạt động
const BASE = 'http://localhost:3000/api';
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'mikrotik2026' }),
})).json();
const token = login.token;

async function get(p, t = token) {
  const r = await fetch(`${BASE}${p}`, { headers: { 'x-auth-token': t } });
  return r.ok ? r.json() : { error: r.status };
}

const users = await get('/users');
const profiles = await get('/profiles');
const active = await get('/active');
const stats = await get('/stats');

console.log('USERS   :', Array.isArray(users) ? users.map((u) => u.name) : users);
console.log('PROFILES:', Array.isArray(profiles) ? profiles.map((p) => p.name) : profiles);
console.log('ACTIVE  :', Array.isArray(active) ? active.map((a) => a.user) : active);
console.log('STATS   :', stats.users, 'users /', stats.active, 'active /', stats.profiles.length, 'profiles');

const clean = Array.isArray(users) && !users.some((u) => u.name.startsWith('zz-'));
console.log('NO_TEST_DATA:', clean ? 'OK ✓' : 'CÓ LẠI!');