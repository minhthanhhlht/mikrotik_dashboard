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

  const [authChecked, setAuthChecked] = useState(true);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    const uName = res.username || username;
    const uGroup = res.group || 'full';
    const uRole = res.role || 'admin';
    const uFull = res.fullName || uName;

    try {
      localStorage.setItem('hs_token', res.token);
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
  }, []);

  // Fetch current me profile info on init if logged in
  useEffect(() => {
    const token = localStorage.getItem('hs_token');
    if (token) {
      api
        .me()
        .then((res) => {
          if (res?.user) {
            setUser(res.user.username);
            setGroup(res.user.group || 'read');
            setRole(res.user.role || 'viewer');
            setFullName(res.user.fullName || res.user.username);
            localStorage.setItem('hs_user', res.user.username);
            localStorage.setItem('hs_group', res.user.group || 'read');
            localStorage.setItem('hs_role', res.user.role || 'viewer');
            localStorage.setItem('hs_fullname', res.user.fullName || res.user.username);
          }
        })
        .catch(() => {
          /* ignore */
        });
    }
  }, []);

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