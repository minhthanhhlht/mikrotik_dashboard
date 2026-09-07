// Test E2E tính năng mới trên router THẬT (thận trọng: tạo + dọn test data)
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
  console.log(`[${res.status}] ${method} ${path}`);
  if (res.status >= 400 && data?.error) {
    console.log('  ERROR:', data.error, JSON.stringify(data.detail ?? ''));
  }
  return { status: res.status, data };
}

console.log('=== Login ===');
const { data: login } = await jreq('/auth/login', { method: 'POST', body: { username: 'admin', password: 'mikrotik2026' }, token: '' });
const token = login.token;
console.log('token:', token);

// 1. Tạo user test
console.log('\n=== 1. Tạo user TEST ===');
const uname = `zz-test-${Date.now().toString(36)}`;
const { data: created } = await jreq('/users', {
  method: 'POST', token,
  body: { name: uname, password: 'test123', profile: 'default', 'limit-uptime': '1h' },
});
console.log('created:', created?.name, created?.['.id']);
const uid = created['.id'];

// 2. Gia hạn +1h
console.log('\n=== 2. Gia hạn 1h ===');
const { data: extended } = await jreq(`/users/${encodeURIComponent(uid)}/extend`, {
  method: 'POST', token, body: { time: '1h' },
});
console.log('limit-uptime sau gia hạn:', extended?.['limit-uptime']);

// 3. Reset counters
console.log('\n=== 3. Reset bộ đếm ===');
const { data: resetRes } = await jreq(`/users/${encodeURIComponent(uid)}/reset`, { method: 'POST', token });
console.log('reset ok:', resetRes?.ok);

// 4. Tạo profile test
console.log('\n=== 4. Tạo profile TEST ===');
const pname = `zz-pro-${Date.now().toString(36)}`;
const { data: pcreated } = await jreq('/profiles', {
  method: 'POST', token,
  body: { name: pname, 'shared-users': '2', 'rate-limit': '10M/10M' },
});
console.log('profile created:', pcreated?.name, pcreated?.['.id']);
const pid = pcreated['.id'];

// 5. Sửa profile
console.log('\n=== 5. Sửa profile ===');
const { data: pupdated } = await jreq(`/profiles/${encodeURIComponent(pid)}`, {
  method: 'PUT', token, body: { 'rate-limit': '20M/5M' },
});
console.log('rate-limit sau sửa:', pupdated?.['rate-limit']);

// 6. Xóa profile test
console.log('\n=== 6. Xóa profile TEST ===');
const { data: pdel } = await jreq(`/profiles/${encodeURIComponent(pid)}`, { method: 'DELETE', token });
console.log('profile deleted:', pdel?.ok);

// 7. Xóa user test
console.log('\n=== 7. Xóa user TEST ===');
const { data: udel } = await jreq(`/users/${encodeURIComponent(uid)}`, { method: 'DELETE', token });
console.log('user deleted:', udel?.ok);

// 8. Verify còn nguyên vẹn
console.log('\n=== 8. Verify dữ liệu gốc ===');
const { data: users } = await jreq('/users', { token });
const { data: profiles } = await jreq('/profiles', { token });
console.log('users:', users.map((u) => u.name));
console.log('profiles:', profiles.map((p) => p.name));

console.log('\n=== XONG ===');