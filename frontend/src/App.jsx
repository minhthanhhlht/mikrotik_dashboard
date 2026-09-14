import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import SystemPerformancePage from './pages/SystemPerformancePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SessionsPage from './pages/SessionsPage.jsx';
import ProfilesPage from './pages/ProfilesPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProxmoxPerformancePage from './pages/ProxmoxPerformancePage.jsx';
import HassPerformancePage from './pages/HassPerformancePage.jsx';
import LoginPage from './pages/LoginPage.jsx';

function Protected({ children }) {
  const { user, authChecked } = useAuth();
  if (!authChecked) return null;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/performance" element={<SystemPerformancePage />} />
        <Route path="/proxmox" element={<ProxmoxPerformancePage />} />
        <Route path="/hass" element={<HassPerformancePage />} />
        <Route index element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/performance" replace />} />
      </Route>
    </Routes>
  );
}