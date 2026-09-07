// Test nhanh các thao tác CRUD qua backend proxy
// Chạy: node scripts/test-api.mjs  (không cần curl)
const BASE = 'http://localhost:3000/api';

async function req(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  console.log(`\n[${method}] ${path} -> ${res.status}`);
  console.log(JSON.stringify(data ?? null, null, 2));
  return { res, data };
}

// 1. Tạo user mới
const { data: created } = await req('/users', {
  method: 'POST',
  body: {
    name: 'test-user-99',
    password: '9999',
    profile: 'default',
    'limit-uptime': '2h',
    comment: 'test crud',
  },
});

// 2. Sửa user vừa tạo
if (created && created['.id']) {
  await req(`/users/${encodeURIComponent(created['.id'])}`, {
    method: 'PUT',
    body: { comment: 'đã sửa qua API', disabled: 'true' },
  });

  // 3. Xóa user vừa tạo
  await req(`/users/${encodeURIComponent(created['.id'])}`, { method: 'DELETE' });
}

// 4. Kick phiên active
const { data: active } = await req('/active');
if (active && active.length > 0) {
  await req(`/active/${encodeURIComponent(active[0]['.id'])}`, { method: 'DELETE' });
}

// 5. Kiểm tra lại danh sách
await req('/stats');
console.log('\n=== XONG ===');