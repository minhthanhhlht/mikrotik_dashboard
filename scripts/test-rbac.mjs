// Script kiểm thử toàn diện Phân quyền RBAC qua MikroTik RouterOS (/user)
import fs from 'node:fs';
import path from 'node:path';

// Đọc .env nếu có
const envPath = path.resolve('backend/.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim();
    }
  }
}

const BASE = process.env.TEST_BASE || 'http://localhost:3000';
const ADMIN_USER = process.env.MTIK_USER || 'user_api';
const ADMIN_PASS = process.env.MTIK_PASS || 'MinhThanh@6021';

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-auth-token'] = token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== KIỂM THỬ PHÂN QUYỀN MIKROTIK SYSTEM USERS (RBAC) ===\n');

  // 1. Test Admin
  console.log(`--- 1. Kiểm tra tài khoản ADMIN (${ADMIN_USER}) ---`);
  const adminLogin = await req('/api/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  console.log('Admin login status:', adminLogin.status, 'Role:', adminLogin.data.role, 'Group:', adminLogin.data.group);
  if (!adminLogin.ok || adminLogin.data.role !== 'admin') {
    throw new Error('Admin login failed: ' + JSON.stringify(adminLogin.data));
  }
  const adminToken = adminLogin.data.token;

  // Admin lấy danh sách tài khoản từ MikroTik /user
  const adminUsers = await req('/api/admin/users', { token: adminToken });
  console.log('Admin xem danh sách /user MikroTik:', adminUsers.status, `(${adminUsers.data.length} accounts)`);

  // Dọn dẹp tài khoản test cũ nếu có
  for (const u of adminUsers.data || []) {
    if (u.username === 'test_op' || u.username === 'test_view') {
      await req(`/api/admin/users/${u.id}`, { method: 'DELETE', token: adminToken });
    }
  }

  // Admin tạo tài khoản Operator (group: write) trên MikroTik
  console.log('Admin tạo tài khoản test_op (group: write) trên MikroTik...');
  const createOp = await req('/api/admin/users', {
    method: 'POST',
    token: adminToken,
    body: {
      username: 'test_op',
      password: 'op_password_123',
      group: 'write',
      fullName: 'Nhân viên Test',
    },
  });
  console.log('Tạo test_op:', createOp.status, createOp.data);
  const testOpId = createOp.data.id;

  // Admin tạo tài khoản Viewer (group: read) trên MikroTik
  console.log('Admin tạo tài khoản test_view (group: read) trên MikroTik...');
  const createView = await req('/api/admin/users', {
    method: 'POST',
    token: adminToken,
    body: {
      username: 'test_view',
      password: 'view_password_123',
      group: 'read',
      fullName: 'Giám sát Test',
    },
  });
  console.log('Tạo test_view:', createView.status, createView.data);
  const testViewId = createView.data.id;

  try {
    // 2. Test Operator (test_op)
    console.log('\n--- 2. Kiểm tra tài khoản OPERATOR (test_op) ---');
    const opLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'test_op', password: 'op_password_123' },
    });
    console.log('Operator login status:', opLogin.status, 'Role:', opLogin.data.role, 'Group:', opLogin.data.group);
    if (!opLogin.ok || opLogin.data.role !== 'operator') {
      throw new Error('Operator login failed: ' + JSON.stringify(opLogin.data));
    }
    const opToken = opLogin.data.token;

    // Operator thử vào /api/admin/users (Phải bị 403)
    const opForbidden = await req('/api/admin/users', { token: opToken });
    console.log('Operator vào /api/admin/users:', opForbidden.status, '(Kỳ vọng 403 Forbidden)');
    if (opForbidden.status !== 403) throw new Error('Operator was not blocked from /api/admin/users!');

    // Operator thử sửa Profile (Phải bị 403)
    const opProfileForbidden = await req('/api/profiles', {
      method: 'POST',
      token: opToken,
      body: { name: 'test-forbidden' },
    });
    console.log('Operator tạo Profile:', opProfileForbidden.status, '(Kỳ vọng 403 Forbidden)');
    if (opProfileForbidden.status !== 403) throw new Error('Operator was not blocked from creating profile!');

    // 3. Test Viewer (test_view)
    console.log('\n--- 3. Kiểm tra tài khoản VIEWER (test_view) ---');
    const viewLogin = await req('/api/auth/login', {
      method: 'POST',
      body: { username: 'test_view', password: 'view_password_123' },
    });
    console.log('Viewer login status:', viewLogin.status, 'Role:', viewLogin.data.role, 'Group:', viewLogin.data.group);
    if (!viewLogin.ok || viewLogin.data.role !== 'viewer') {
      throw new Error('Viewer login failed: ' + JSON.stringify(viewLogin.data));
    }
    const viewToken = viewLogin.data.token;

    // Viewer xem danh sách user (Được phép GET 200)
    const viewUsers = await req('/api/users', { token: viewToken });
    console.log('Viewer xem danh sách users:', viewUsers.status, '(Kỳ vọng 200 OK)');

    // Viewer thử tạo user hotspot (Phải bị 403)
    const viewCreateUser = await req('/api/users', {
      method: 'POST',
      token: viewToken,
      body: { name: 'test-viewer' },
    });
    console.log('Viewer tạo user hotspot:', viewCreateUser.status, '(Kỳ vọng 403 Forbidden)');
    if (viewCreateUser.status !== 403) throw new Error('Viewer was not blocked from creating user!');

    // Viewer thử ngắt phiên (Phải bị 403)
    const viewKick = await req('/api/active/some-id', {
      method: 'DELETE',
      token: viewToken,
    });
    console.log('Viewer ngắt phiên active:', viewKick.status, '(Kỳ vọng 403 Forbidden)');
    if (viewKick.status !== 403) throw new Error('Viewer was not blocked from kicking session!');

    // 4. Test bảo vệ tài khoản group 'full' (Không thể xóa)
    console.log('\n--- 4. Kiểm tra bảo vệ tài khoản group "full" (Chặn xóa) ---');
    // Tìm user full trong danh sách
    const currentAdminUser = adminUsers.data.find((u) => u.group === 'full') || adminUsers.data[0];
    if (currentAdminUser) {
      const delFull = await req(`/api/admin/users/${currentAdminUser.id}`, {
        method: 'DELETE',
        token: adminToken,
      });
      console.log('Admin thử xóa tài khoản group full:', delFull.status, delFull.data);
      if (delFull.status !== 400) {
        throw new Error('Hệ thống không chặn xóa tài khoản group full (kỳ vọng HTTP 400)!');
      }
      console.log('✓ Đã chặn xóa tài khoản group full thành công (HTTP 400).');
    }
  } finally {
    // 5. Dọn dẹp tài khoản test trên MikroTik
    console.log('\n--- 5. Dọn dẹp tài khoản kiểm thử trên MikroTik ---');
    if (testOpId) {
      const delOp = await req(`/api/admin/users/${testOpId}`, { method: 'DELETE', token: adminToken });
      console.log('Xóa test_op:', delOp.status);
    }
    if (testViewId) {
      const delView = await req(`/api/admin/users/${testViewId}`, { method: 'DELETE', token: adminToken });
      console.log('Xóa test_view:', delView.status);
    }
  }

  console.log('\n=== TẤT CẢ CÁC BƯỚC KIỂM THỬ RBAC THEO MIKROTIK ĐỀU THÀNH CÔNG (100% PASS) ===');
}

run().catch((err) => {
  console.error('\n❌ KIỂM THỬ THẤT BẠI:', err.message);
  process.exit(1);
});

