import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem('hs_user') || null;
    } catch {
      return null;
    }
  });

  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem('hs_role') || 'admin';
    } catch {
      return 'admin';
    }
  });

  const [fullName, setFullName] = useState(() => {
    try {
      return localStorage.getItem('hs_fullname') || '';
    } catch {
      return '';
    }
  });

  const [group, setGroup] = useState(() => {
    try {
      return localStorage.getItem('hs_group') || 'full';
    } catch {
      return 'full';
    }
  });

  const [expiresAt, setExpiresAt] = useState(() => {
    try {
      const exp = localStorage.getItem('hs_token_expires_at');
      return exp ? Number(exp) : null;
    } catch {
      return null;
    }
  });

  const [authChecked, setAuthChecked] = useState(false);

  const login = useCallback(async (username, password, rememberMe = true) => {
    const res = await api.login(username, password, rememberMe);
    const uName = res.username || username;
    const uGroup = res.group || 'full';
    const uRole = res.role || 'admin';
    const uFull = res.fullName || uName;
    const exp = res.expiresAt || (Date.now() + 3 * 24 * 60 * 60 * 1000);

    try {
      localStorage.setItem('hs_token', res.token);
      localStorage.setItem('hs_token_expires_at', String(exp));
      localStorage.setItem('hs_user', uName);
      localStorage.setItem('hs_group', uGroup);
      localStorage.setItem('hs_role', uRole);
      localStorage.setItem('hs_fullname', uFull);
    } catch {
      /* ignore */
    }

    setUser(uName);
    setGroup(uGroup);
    setRole(uRole);
    setFullName(uFull);
    setExpiresAt(exp);
    setAuthChecked(true);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* bỏ qua lỗi mạng */
    }
    try {
      localStorage.removeItem('hs_token');
      localStorage.removeItem('hs_token_expires_at');
      localStorage.removeItem('hs_user');
      localStorage.removeItem('hs_group');
      localStorage.removeItem('hs_role');
      localStorage.removeItem('hs_fullname');
    } catch {
      /* ignore */
    }
    setUser(null);
    setGroup('read');
    setRole('viewer');
    setFullName('');
    setExpiresAt(null);
  }, []);

  // Kiểm tra tính hợp lệ và hạn sử dụng 3 ngày khi khởi tạo ứng dụng
  useEffect(() => {
    const token = localStorage.getItem('hs_token');
    const expStr = localStorage.getItem('hs_token_expires_at');
    const expTime = expStr ? Number(expStr) : null;

    // Nếu token đã hết hạn 3 ngày -> tự động đăng xuất
    if (token && expTime && Date.now() > expTime) {
      logout();
      setAuthChecked(true);
      return;
    }

    if (token) {
      api
        .me()
        .then((res) => {
          if (res?.user) {
            setUser(res.user.username);
            setGroup(res.user.group || 'read');
            setRole(res.user.role || 'viewer');
            setFullName(res.user.fullName || res.user.username);
            if (res.user.expiresAt) {
              setExpiresAt(res.user.expiresAt);
              localStorage.setItem('hs_token_expires_at', String(res.user.expiresAt));
            }
          }
        })
        .catch(() => {
          logout();
        })
        .finally(() => {
          setAuthChecked(true);
        });
    } else {
      setAuthChecked(true);
    }
  }, [logout]);

  const isAdmin = role === 'admin' || group === 'full';
  const isOperator = role === 'operator' || group === 'write';
  const isViewer = role === 'viewer' || group === 'read';

  // Permission helpers
  const canManageUsers = isAdmin || isOperator; // Thêm/sửa user hotspot, gia hạn, reset, kick
  const canManageProfiles = isAdmin; // Chỉ admin được thêm/sửa/xóa Profile
  const canEditSettings = isAdmin; // Chỉ admin quản lý tài khoản & router config

  return (
    <AuthContext.Provider
      value={{
        user,
        group,
        role,
        fullName,
        login,
        logout,
        authChecked,
        isAdmin,
        isOperator,
        isViewer,
        canManageUsers,
        canManageProfiles,
        canEditSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}