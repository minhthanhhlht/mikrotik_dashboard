import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const REFRESH_MS = 15000;

export default function SessionsPage() {
  const { isViewer } = useAuth();
  const { language, t } = useLanguage();
  const toast = useToast();

  // Tab điều hướng: 'active' (Phiên đăng nhập) | 'hosts' (Tất cả thiết bị kết nối) | 'leases' (DHCP Leases)
  const [currentTab, setCurrentTab] = useState('active');

  // Dữ liệu các tab
  const [sessions, setSessions] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [leases, setLeases] = useState([]);

  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Tải dữ liệu toàn bộ từ Router (cập nhật êm mượt, không nháy trang)
  async function loadAllData(isManual = false) {
    if (isManual) {
      setRefreshing(true);
    }
    setError('');
    try {
      const [actData, hostData, leaseData] = await Promise.all([
        api.active().catch(() => []),
        api.hosts().catch(() => []),
        api.dhcpLeases().catch(() => []),
      ]);
      setSessions(Array.isArray(actData) ? actData : []);
      setHosts(Array.isArray(hostData) ? hostData : []);
      setLeases(Array.isArray(leaseData) ? leaseData : []);
    } catch (err) {
      setError(err.message || 'Could not sync data from Router.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAllData(false);
    const intervalTimer = setInterval(() => loadAllData(false), REFRESH_MS);
    return () => clearInterval(intervalTimer);
  }, []);

  // Thao tác ngắt phiên Hotspot
  async function handleDisconnectSession(s) {
    const ok = window.confirm(
      t('sessions.disconnectConfirm', { user: s.user, ip: s.ip })
    );
    if (!ok) return;
    setBusyId(s['.id']);
    try {
      await api.disconnect(s['.id']);
      toast.success(`${s.user} (${s.ip})`, t('sessions.disconnect'));
      loadAllData();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  // Thao tác xóa Host khỏi Hotspot
  async function handleDeleteHost(h) {
    const ok = window.confirm(
      t('sessions.deleteHostConfirm', { name: h.hostName || h.macAddress, ip: h.ipAddress })
    );
    if (!ok) return;
    setBusyId(h.id);
    try {
      await api.deleteHost(h.id);
      toast.success(h.macAddress, t('common.delete'));
      loadAllData();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  // Thao tác xóa DHCP Lease
  async function handleDeleteLease(l) {
    const ok = window.confirm(
      t('sessions.revokeLeaseConfirm', { ip: l.ipAddress, name: l.hostName || l.macAddress })
    );
    if (!ok) return;
    setBusyId(l.id);
    try {
      await api.deleteDhcpLease(l.id);
      toast.success(l.ipAddress, t('sessions.revokeIp'));
      loadAllData();
    } catch (err) {
      toast.error(err.message, t('common.error'));
    } finally {
      setBusyId(null);
    }
  }

  // Lọc dữ liệu theo từ khóa tìm kiếm
  const q = searchTerm.toLowerCase().trim();

  const filteredSessions = useMemo(() => {
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        (s.user || '').toLowerCase().includes(q) ||
        (s.ip || '').toLowerCase().includes(q) ||
        (s['mac-address'] || '').toLowerCase().includes(q) ||
        (s.server || '').toLowerCase().includes(q)
    );
  }, [sessions, q]);

  const filteredHosts = useMemo(() => {
    if (!q) return hosts;
    return hosts.filter(
      (h) =>
        (h.hostName || '').toLowerCase().includes(q) ||
        (h.macAddress || '').toLowerCase().includes(q) ||
        (h.ipAddress || '').toLowerCase().includes(q) ||
        (h.bridgePort || '').toLowerCase().includes(q) ||
        (h.comment || '').toLowerCase().includes(q)
    );
  }, [hosts, q]);

  const filteredLeases = useMemo(() => {
    if (!q) return leases;
    return leases.filter(
      (l) =>
        (l.hostName || '').toLowerCase().includes(q) ||
        (l.macAddress || '').toLowerCase().includes(q) ||
        (l.ipAddress || '').toLowerCase().includes(q) ||
        (l.server || '').toLowerCase().includes(q) ||
        (l.comment || '').toLowerCase().includes(q)
    );
  }, [leases, q]);

  return (
    <div className="space-y-6">
      {/* 1. PageTopbar (.sk-topbar) */}
      <div className="sk-topbar flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="sk-title">{t('sessions.title')}</h1>
            <span className={`sk-pill ${sessions.length > 0 ? 'sk-pill--green' : 'sk-pill--amber'}`}>
              <span className="sk-pill__dot" />
              {t('sessions.activeBadge', { count: sessions.length })}
            </span>
            <span className="sk-tag sk-tag--prod">{t('sessions.hostsBadge', { count: hosts.length })}</span>
            <span className="sk-tag sk-tag--dev">{t('sessions.leasesBadge', { count: leases.length })}</span>
          </div>
          <p className="sk-subtitle font-mono">
            {t('sessions.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAllData(true)}
            disabled={refreshing || initialLoading}
            className="btn btn-secondary btn-sm"
          >
            <span className={refreshing ? 'animate-spin inline-block' : 'inline-block'}>⟳</span>{' '}
            {refreshing ? t('common.refreshing') : t('common.refreshNow')}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius)] border border-[rgba(251,111,111,0.3)] bg-[var(--red-bg)] p-4 text-xs font-mono text-[var(--red)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">⚠️ {error}</p>
            </div>
            <button onClick={() => loadAllData(true)} className="btn btn-danger btn-sm">
              ⟳ {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      {/* 2. ListToolbar & Tab Switcher (.sk-seg) */}
      <div className="sk-dtable-wrapper">
        <div className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--surface)]">
          <div className="flex items-center gap-3">
            <div className="sk-seg">
              <button
                onClick={() => setCurrentTab('active')}
                className={`sk-seg__btn ${currentTab === 'active' ? 'is-on' : ''}`}
              >
                {t('sessions.tabActive')} <span className="sk-seg__count">{sessions.length}</span>
              </button>
              <button
                onClick={() => setCurrentTab('hosts')}
                className={`sk-seg__btn ${currentTab === 'hosts' ? 'is-on' : ''}`}
              >
                {t('sessions.tabHosts')} <span className="sk-seg__count">{hosts.length}</span>
              </button>
              <button
                onClick={() => setCurrentTab('leases')}
                className={`sk-seg__btn ${currentTab === 'leases' ? 'is-on' : ''}`}
              >
                {t('sessions.tabLeases')} <span className="sk-seg__count">{leases.length}</span>
              </button>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder={t('sessions.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input text-xs font-mono"
            />
          </div>
        </div>

        {initialLoading && sessions.length === 0 && hosts.length === 0 && leases.length === 0 && !error ? (
          <div className="p-16 flex justify-center">
            <Spinner label={t('common.loading')} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* TAB 1: PHIÊN ĐĂNG NHẬP HOTSPOT (/ip/hotspot/active) */}
            {currentTab === 'active' && (
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>{t('sessions.colUser')}</th>
                    <th>{t('sessions.colIp')}</th>
                    <th>{t('sessions.colMac')}</th>
                    <th className="text-right">{t('sessions.colUptime')}</th>
                    <th className="text-right">{t('sessions.colIdleTime')}</th>
                    <th className="text-right">{t('sessions.colTraffic')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3 font-mono">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-xl text-[var(--text-faint)]">
                            📡
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text)] font-sans">
                            {t('sessions.noActiveSessions')}
                          </h3>
                          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
                            {t('sessions.noActiveSessionsDesc')}
                          </p>
                          <div className="pt-2 flex justify-center gap-2 font-sans">
                            <button onClick={() => setCurrentTab('hosts')} className="btn btn-primary btn-sm">
                              {t('sessions.viewConnectedHosts', { count: hosts.length })}
                            </button>
                            <Link to="/users" className="btn btn-secondary btn-sm no-underline">
                              👥 {t('users.titleUsers')}
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s['.id']}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="sk-pill sk-pill--green text-[8px] p-0.5">
                              <span className="sk-pill__dot" />
                            </span>
                            <span className="font-mono font-semibold text-[var(--text)]">{s.user}</span>
                            {s.server && <span className="sk-tag text-[9px]">{s.server}</span>}
                          </div>
                        </td>
                        <td className="font-mono text-xs text-[var(--cyan)] font-semibold">{s.ip}</td>
                        <td className="font-mono text-xs text-[var(--text-faint)]">{s['mac-address']}</td>
                        <td className="font-mono text-xs text-right text-[var(--text)]">{formatDuration(s.uptime, language)}</td>
                        <td className="font-mono text-xs text-right text-[var(--text-faint)]">{formatDuration(s['idle-time'], language)}</td>
                        <td className="font-mono text-xs text-right">
                          <span className="text-[var(--green)] font-semibold">{formatBytes(s['bytes-in'])}</span> ↓ /{' '}
                          <span className="text-[var(--cyan)] font-semibold">{formatBytes(s['bytes-out'])}</span> ↑
                        </td>
                        <td className="text-right">
                          {isViewer ? (
                            <span className="font-mono text-xs text-[var(--text-faint)]">{t('common.readOnly')}</span>
                          ) : (
                            <button
                              onClick={() => handleDisconnectSession(s)}
                              disabled={busyId === s['.id']}
                              className="btn btn-danger btn-sm"
                              title={t('sessions.disconnect')}
                            >
                              {busyId === s['.id'] ? t('sessions.disconnecting') : t('sessions.disconnect')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* TAB 2: TẤT CẢ THIẾT BỊ KẾT NỐI ROUTER (/ip/hotspot/host) */}
            {currentTab === 'hosts' && (
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>{t('sessions.colHostName')}</th>
                    <th>{t('sessions.colIp')}</th>
                    <th>{t('sessions.colMac')}</th>
                    <th>{t('sessions.colPort')}</th>
                    <th>{t('sessions.colAuthStatus')}</th>
                    <th className="text-right">{t('sessions.colUptime')}</th>
                    <th className="text-right">{t('sessions.colTraffic')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHosts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3 font-mono">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-xl text-[var(--text-faint)]">
                            🔌
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text)] font-sans">
                            {t('sessions.noHosts')}
                          </h3>
                          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
                            {t('sessions.noHostsDesc')}
                          </p>
                          <div className="pt-2 flex justify-center gap-2 font-sans">
                            <button onClick={() => setCurrentTab('leases')} className="btn btn-primary btn-sm">
                              {t('sessions.viewDhcpLeases', { count: leases.length })}
                            </button>
                            <button onClick={loadAllData} className="btn btn-ghost btn-sm">
                              ⟳ {t('common.refresh')}
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHosts.map((h) => {
                      const isAuth = h.authorized;
                      const isBypassed = h.bypassed;

                      return (
                        <tr key={h.id}>
                          <td>
                            <div>
                              <div className="font-semibold text-[var(--text)] flex items-center gap-2 font-sans">
                                <span>{h.hostName || t('sessions.unnamedDevice')}</span>
                                {h.comment && <span className="sk-tag text-[9px]">{h.comment}</span>}
                              </div>
                              <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">
                                server: {h.server}
                              </div>
                            </div>
                          </td>
                          <td className="font-mono text-xs text-[var(--cyan)] font-semibold">{h.ipAddress}</td>
                          <td className="font-mono text-xs text-[var(--text-dim)]">{h.macAddress}</td>
                          <td className="font-mono text-xs">
                            <span className="sk-tag bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]">
                              {h.bridgePort || 'bridge'}
                            </span>
                          </td>
                          <td>
                            {isAuth ? (
                              <span className="sk-pill sk-pill--green">
                                <span className="sk-pill__dot" /> {t('sessions.authLoggedIn')}
                              </span>
                            ) : isBypassed ? (
                              <span className="sk-pill sk-pill--cyan">
                                <span className="sk-pill__dot" /> {t('sessions.authBypass')}
                              </span>
                            ) : (
                              <span className="sk-pill sk-pill--amber">
                                <span className="sk-pill__dot" /> {t('sessions.authWaiting')}
                              </span>
                            )}
                          </td>
                          <td className="font-mono text-xs text-right text-[var(--text)]">{formatDuration(h.uptime, language)}</td>
                          <td className="font-mono text-xs text-right">
                            <span className="text-[var(--green)] font-semibold">{formatBytes(h.bytesIn)}</span> ↓ /{' '}
                            <span className="text-[var(--cyan)] font-semibold">{formatBytes(h.bytesOut)}</span> ↑
                          </td>
                          <td className="text-right">
                            {isViewer ? (
                              <span className="font-mono text-xs text-[var(--text-faint)]">{t('common.readOnly')}</span>
                            ) : (
                              <button
                                onClick={() => handleDeleteHost(h)}
                                disabled={busyId === h.id}
                                className="btn btn-ghost btn-sm text-[var(--red)] hover:bg-[var(--red-bg)]"
                                title={t('sessions.deleteHost')}
                              >
                                {busyId === h.id ? t('sessions.deletingHost') : t('sessions.deleteHost')}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}

            {/* TAB 3: CẤP PHÁT DHCP LEASES (/ip/dhcp-server/lease) */}
            {currentTab === 'leases' && (
              <table className="sk-dtable">
                <thead>
                  <tr>
                    <th>{t('sessions.colHostName')}</th>
                    <th>{t('sessions.colIp')}</th>
                    <th>{t('sessions.colMac')}</th>
                    <th>{t('sessions.colDhcpServer')}</th>
                    <th>{t('common.status')}</th>
                    <th className="text-right">{t('sessions.colExpiresAfter')}</th>
                    <th className="text-right">{t('sessions.colType')}</th>
                    <th className="text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeases.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center">
                        <div className="max-w-md mx-auto space-y-3 font-mono">
                          <div className="w-12 h-12 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center mx-auto text-xl text-[var(--text-faint)]">
                            🌐
                          </div>
                          <h3 className="text-sm font-semibold text-[var(--text)] font-sans">
                            {t('sessions.noLeases')}
                          </h3>
                          <p className="text-xs text-[var(--text-faint)] leading-relaxed">
                            {t('sessions.noLeasesDesc')}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeases.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div>
                            <div className="font-semibold text-[var(--text)] flex items-center gap-2 font-sans">
                              <span>{l.hostName || t('sessions.unnamedDevice')}</span>
                              {l.comment && <span className="sk-tag text-[9px]">{l.comment}</span>}
                            </div>
                            <div className="text-[10px] text-[var(--text-faint)] font-mono mt-0.5">
                              mac: {l.macAddress}
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs text-[var(--cyan)] font-semibold">{l.ipAddress}</td>
                        <td className="font-mono text-xs text-[var(--text-faint)]">{l.macAddress}</td>
                        <td className="font-mono text-xs">
                          <span className="sk-tag bg-[var(--surface-3)] text-[var(--text)] border-[var(--border)]">
                            {l.server || 'dhcp1'}
                          </span>
                        </td>
                        <td>
                          <span className={`sk-pill ${l.status === 'bound' ? 'sk-pill--green' : 'sk-pill--amber'}`}>
                            <span className="sk-pill__dot" />
                            {l.status ? l.status.toUpperCase() : 'BOUND'}
                          </span>
                        </td>
                        <td className="font-mono text-xs text-right text-[var(--text-dim)]">
                          {l.expiresAfter ? formatDuration(l.expiresAfter, language) : t('sessions.forever')}
                        </td>
                        <td className="font-mono text-xs text-right">
                          <span className={`sk-tag ${l.dynamic ? 'sk-tag--dev' : 'sk-tag--prod'}`}>
                            {l.dynamic ? t('common.dynamic') : t('common.static')}
                          </span>
                        </td>
                        <td className="text-right">
                          {isViewer ? (
                            <span className="font-mono text-xs text-[var(--text-faint)]">{t('common.readOnly')}</span>
                          ) : (
                            <button
                              onClick={() => handleDeleteLease(l)}
                              disabled={busyId === l.id}
                              className="btn btn-ghost btn-sm text-[var(--red)] hover:bg-[var(--red-bg)]"
                              title={t('sessions.revokeIp')}
                            >
                              {busyId === l.id ? t('sessions.revokingIp') : t('sessions.revokeIp')}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}