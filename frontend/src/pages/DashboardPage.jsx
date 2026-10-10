import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useApi } from '../hooks/useApi.js';
import { useEventSource } from '../hooks/useEventSource.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import StatCard from '../components/StatCard.jsx';
import Spinner from '../components/Spinner.jsx';
import { formatBytes, formatDuration } from '../utils/format.js';

const ACTIVE_REFRESH_MS = 15000;

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const [sseStats, setSseStats] = useState(null);
  const active = useApi(api.active);

  useEventSource('/api/events', setSseStats);
  const stats = useApi(api.stats);

  useEffect(() => {
    const tTimer = setInterval(() => {
      active.reload();
      if (!sseStats) stats.reload();
    }, ACTIVE_REFRESH_MS);
    return () => clearInterval(tTimer);
  }, [sseStats]);

  const s = sseStats || stats.data;
  const waiting = !s && (active.loading || stats.loading);
  const errors = stats.error ? [stats.error] : s?.errors || [];

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="sk-topbar">
        <div>
          <h1 className="sk-title">{t('dashboard.title')}</h1>
          <p className="sk-subtitle font-mono">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="sk-pill sk-pill--green">
            <span className="sk-pill__dot" />
            {t('dashboard.sseLive')}
          </span>
          <button
            onClick={() => {
              active.reload();
              stats.reload();
            }}
            className="btn btn-secondary btn-sm"
          >
            ⟳ {t('common.refresh')}
          </button>
        </div>
      </div>

      {/* Error notification */}
      {errors.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[rgba(245,185,69,0.3)] bg-[var(--amber-bg)] p-4 text-xs">
          <p className="flex items-center gap-2 font-semibold text-[var(--amber)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--amber)] shadow-[0_0_8px_var(--amber)]" />
            {t('performance.restErrorHint')}
          </p>
          <ul className="mt-2 list-inside list-disc text-[var(--text-dim)] space-y-0.5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={stats.reload} className="btn btn-primary btn-sm">
              ⟳ {t('common.retry')}
            </button>
          </div>
        </div>
      )}

      {waiting ? (
        <Spinner label={t('common.loading')} />
      ) : s ? (
        <>
          {/* KPI Band */}
          <div className="sk-kpiband">
            <StatCard
              label={t('dashboard.totalUsers')}
              value={s.users}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
              accent="accent"
            />
            <StatCard
              label={t('dashboard.activeSessions')}
              value={s.active}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              }
              accent="green"
            />
            <StatCard
              label={t('users.tabProfiles')}
              value={Array.isArray(s.profiles) ? s.profiles.length : '—'}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
              accent="violet"
            />
            <StatCard
              label="Router Host"
              value={s.router?.host || '—'}
              sub={s.router?.restBase}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                  <line x1="6" y1="6" x2="6.01" y2="6" />
                  <line x1="6" y1="18" x2="6.01" y2="18" />
                </svg>
              }
              accent="cyan"
            />
          </div>

          {/* Distribution & Recent Sessions */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Phân bố theo profile (5 cols) */}
            <div className="sk-card lg:col-span-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3 mb-4">
                  <h2 className="label-caps mb-0 text-xs">{t('dashboard.profileDistribution')}</h2>
                  <span className="sk-state sk-state--accent">
                    {Object.keys(s.usersByProfile || {}).length} PROFILES
                  </span>
                </div>

                {Object.keys(s.usersByProfile || {}).length === 0 ? (
                  <p className="text-xs font-mono text-[var(--text-faint)] py-6 text-center">{t('common.empty')}</p>
                ) : (
                  <div className="space-y-3.5">
                    {Object.entries(s.usersByProfile).map(([profile, count]) => {
                      const max = Math.max(1, ...Object.values(s.usersByProfile));
                      const pct = Math.round((count / max) * 100);
                      return (
                        <div key={profile} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-semibold text-[var(--text)]">{profile}</span>
                            <span className="font-mono text-[var(--text-dim)]">{count} users</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
                            <div
                              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--border-soft)] text-right">
                <Link to="/profiles" className="text-xs font-mono text-[var(--accent-bright)] hover:underline">
                  {t('dashboard.viewAllUsers')} →
                </Link>
              </div>
            </div>

            {/* Phiên hoạt động gần đây (7 cols) */}
            <div className="sk-card lg:col-span-7 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3 mb-4">
                  <h2 className="label-caps mb-0 text-xs">{t('dashboard.recentSessions')}</h2>
                  <Link
                    to="/sessions"
                    className="text-xs font-mono text-[var(--accent-bright)] hover:underline"
                  >
                    {t('dashboard.viewAllSessions')} ({active.data?.length || 0}) →
                  </Link>
                </div>

                {active.error ? (
                  <p className="text-xs text-[var(--red)]">{active.error}</p>
                ) : active.loading && !active.data ? (
                  <Spinner size="sm" />
                ) : active.data?.length === 0 ? (
                  <p className="text-xs font-mono text-[var(--text-faint)] py-8 text-center">
                    {t('dashboard.noActiveSessions')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="sk-dtable">
                      <thead>
                        <tr>
                          <th>{t('users.colUser')}</th>
                          <th>{t('sessions.colIp')}</th>
                          <th>{t('sessions.colUptime')}</th>
                          <th className="text-right">{t('sessions.colTraffic')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(active.data || []).slice(0, 6).map((a) => (
                          <tr key={a['.id']}>
                            <td className="font-semibold">{a.user}</td>
                            <td className="font-mono text-xs text-[var(--text-dim)]">{a.ip}</td>
                            <td className="font-mono text-xs text-[var(--text-faint)]">
                              {formatDuration(a.uptime, language)}
                            </td>
                            <td className="text-right font-mono text-xs">
                              <span className="text-[var(--cyan)]">{formatBytes(a['bytes-in'])}</span> ↓ /{' '}
                              <span className="text-[var(--violet)]">{formatBytes(a['bytes-out'])}</span> ↑
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}