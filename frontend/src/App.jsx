import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth.jsx';
import Layout from './components/Layout.jsx';
import SystemPerformancePage from './pages/SystemPerformancePage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import SessionsPage from './pages/SessionsPage.jsx';
import ProfilesPage from './pages/ProfilesPage.jsx';
import StaticIpPage from './pages/StaticIpPage.jsx';
import IpManagementPage from './pages/IpManagementPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import ProxmoxPerformancePage from './pages/ProxmoxPerformancePage.jsx';
import ProxmoxVmsPage from './pages/ProxmoxVmsPage.jsx';
import ProxmoxLxcsPage from './pages/ProxmoxLxcsPage.jsx';
import HassPerformancePage from './pages/HassPerformancePage.jsx';
import HaSmartHomeDashboardPage from './pages/HaSmartHomeDashboardPage.jsx';
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
        <Route path="/proxmox/vms" element={<ProxmoxVmsPage />} />
        <Route path="/proxmox/lxcs" element={<ProxmoxLxcsPage />} />
        <Route path="/hass" element={<HassPerformancePage />} />
        <Route path="/hass/smart-home" element={<HaSmartHomeDashboardPage />} />
        <Route path="/hass/dashboard" element={<Navigate to="/hass/smart-home" replace />} />
        <Route index element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/profiles" element={<ProfilesPage />} />
        <Route path="/sessions" element={<SessionsPage />} />
        <Route path="/static-ip" element={<StaticIpPage />} />
        <Route path="/ip-plan" element={<IpManagementPage />} />
        <Route path="/ipam" element={<Navigate to="/ip-plan" replace />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/performance" replace />} />
      </Route>
    </Routes>
  );
}