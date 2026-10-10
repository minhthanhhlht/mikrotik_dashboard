import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';
import StatCard from '../components/StatCard.jsx';
import { formatBytes, formatUptime } from '../utils/format.js';

const REFRESH_MS = 10000;

// Tag color badge styling helper for LXC
function getLxcTagBadgeClass(tag = '') {
  const t = tag.toLowerCase().trim();
  if (t.includes('prod') || t.includes('main')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (t.includes('docker') || t.includes('k8s') || t.includes('pod')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  if (t.includes('dns') || t.includes('pihole') || t.includes('adguard')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (t.includes('db') || t.includes('redis') || t.includes('mysql')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (t.includes('web') || t.includes('nginx') || t.includes('traefik')) return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  if (t.includes('vpn') || t.includes('wg') || t.includes('openvpn')) return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  return 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]';
}

const PRESET_LXC_TAGS = ['docker', 'pihole', 'production', 'nginx', 'adguard', 'database', 'vpn', 'alpine'];

export default function ProxmoxLxcsPage() {
  const { isReadOnly } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [lxcs, setLxcs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [storages, setStorages] = useState([]);
  const [bridges, setBridges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');

  // Modal States
  const [createOpen, setCreateOpen] = useState(false);
  const [editLxc, setEditLxc] = useState(null);
  const [deleteLxc, setDeleteLxc] = useState(null);
  const [purgeRootfs, setPurgeRootfs] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Data for Create / Edit
  const [formData, setFormData] = useState({
    vmid: '',
    hostname: '',
    ostemplate: '',
    password: '',
    cores: 2,
    memory: 1024,
    swap: 512,
    disk: 8,
    storage: 'local-lvm',
    bridge: 'vmbr0',
    ipMode: 'dhcp', // 'dhcp' | 'static'
    ip: '',
    gw: '',
    unprivileged: true,
    tags: '',
    start: false,
  });

  async function loadData(quiet = false) {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [lxcsRes, tmplRes, summaryRes] = await Promise.allSettled([
        api.proxmoxLxcs(),
        api.proxmoxTemplates(),
        api.proxmoxSummary(),
      ]);

      if (lxcsRes.status === 'fulfilled' && lxcsRes.value) {
        const list = Array.isArray(lxcsRes.value) ? lxcsRes.value : (lxcsRes.value.data || []);
        setLxcs(list);
      }
      if (tmplRes.status === 'fulfilled' && tmplRes.value) {
        const list = Array.isArray(tmplRes.value) ? tmplRes.value : (tmplRes.value.data || []);
        setTemplates(list);
      }
      if (summaryRes.status === 'fulfilled' && summaryRes.value) {
        const sum = summaryRes.value;
        if (Array.isArray(sum?.storage)) setStorages(sum.storage);
        if (Array.isArray(sum?.network)) {
          const brs = sum.network.filter((n) => n.type === 'bridge' || (n.iface && n.iface.startsWith('vmbr')));
          setBridges(brs.length > 0 ? brs : sum.network);
        }
      }
    } catch (err) {
      if (!quiet) toast(err.message || 'Lỗi tải danh sách container Proxmox', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  // Quick Power Actions (start, stop, shutdown, reboot)
  async function handleGuestAction(vmid, action) {
    if (isReadOnly) {
      toast('Tài khoản chỉ có quyền xem (Read-Only)', 'warning');
      return;
    }
    setActionLoadingId(`${vmid}-${action}`);
    try {
      await api.proxmoxGuestAction('lxc', vmid, action);
      toast(t('proxmoxLxcs.actionSuccess', { action: action.toUpperCase(), vmid }), 'success');
      await loadData(true);
    } catch (err) {
      toast(err.message || `Lỗi thực hiện thao tác ${action}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  // Open Create Modal
  async function handleOpenCreate() {
    let nextId = '';
    try {
      const nextIdRes = await api.proxmoxNextId();
      nextId = nextIdRes?.nextvmid || '';
    } catch {}

    const defaultTmpl = (templates || []).find((t) => t.volid && (t.volid.includes('.tar.') || t.content === 'vztmpl'))?.volid || '';

    setFormData({
      vmid: nextId,
      hostname: '',
      ostemplate: defaultTmpl,
      password: '',
      cores: 2,
      memory: 1024,
      swap: 512,
      disk: 8,
      storage: 'local-lvm',
      bridge: 'vmbr0',
      ipMode: 'dhcp',
      ip: '',
      gw: '',
      unprivileged: true,
      tags: '',
      start: false,
    });
    setCreateOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(lxc) {
    setEditLxc(lxc);
    const memMb = lxc.maxmem ? Math.round(lxc.maxmem / (1024 * 1024)) : 1024;
    const swapMb = lxc.maxswap ? Math.round(lxc.maxswap / (1024 * 1024)) : 512;
    setFormData({
      vmid: lxc.vmid,
      hostname: lxc.name || '',
      cores: lxc.cpus || 2,
      memory: memMb,
      swap: swapMb,
      ip: lxc.ip || '',
      tags: lxc.tags || '',
    });
  }

  // Submit Create LXC
  async function handleSubmitCreate(e) {
    e.preventDefault();
    if (!formData.hostname.trim()) {
      toast(t('proxmoxLxcs.hostnameRequired'), 'warning');
      return;
    }
    if (!formData.ostemplate.trim()) {
      toast(t('proxmoxLxcs.templateRequired'), 'warning');
      return;
    }
    if (!formData.password.trim() || formData.password.length < 5) {
      toast(t('proxmoxLxcs.passwordRequired'), 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const net0 =
        formData.ipMode === 'static' && formData.ip.trim()
          ? `name=eth0,bridge=${formData.bridge || 'vmbr0'},ip=${formData.ip.trim()}${formData.gw.trim() ? `,gw=${formData.gw.trim()}` : ''}`
          : `name=eth0,bridge=${formData.bridge || 'vmbr0'},ip=dhcp`;

      const payload = {
        vmid: formData.vmid ? Number(formData.vmid) : undefined,
        hostname: formData.hostname.trim(),
        ostemplate: formData.ostemplate.trim(),
        password: formData.password,
        cores: Number(formData.cores) || 2,
        memory: Number(formData.memory) || 1024,
        swap: Number(formData.swap) || 512,
        rootfs: `${formData.storage || 'local-lvm'}:${Number(formData.disk) || 8}`,
        net0,
        unprivileged: formData.unprivileged ? 1 : 0,
        tags: formData.tags.trim() || undefined,
        start: Boolean(formData.start),
      };

      await api.createProxmoxLxc(payload);
      toast(t('proxmoxLxcs.createSuccess', { vmid: formData.vmid || payload.hostname }), 'success');
      setCreateOpen(false);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi tạo container LXC', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Edit LXC
  async function handleSubmitEdit(e) {
    e.preventDefault();
    if (!formData.hostname.trim()) {
      toast(t('proxmoxLxcs.hostnameRequired'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        hostname: formData.hostname.trim(),
        cores: Number(formData.cores) || 2,
        memory: Number(formData.memory) || 1024,
        swap: Number(formData.swap) || 512,
        tags: formData.tags.trim() || undefined,
      };
      await api.updateProxmoxLxc(editLxc.vmid, payload);
      toast(t('proxmoxLxcs.updateSuccess', { vmid: editLxc.vmid }), 'success');
      setEditLxc(null);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi cập nhật cấu hình container', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Confirm Delete LXC
  async function handleConfirmDelete() {
    if (!deleteLxc) return;
    setSubmitting(true);
    try {
      await api.deleteProxmoxLxc(deleteLxc.vmid, purgeRootfs ? 1 : 0);
      toast(t('proxmoxLxcs.deleteSuccess', { vmid: deleteLxc.vmid }), 'success');
      setDeleteLxc(null);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi xóa container Proxmox', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Available OS Templates list from Proxmox storage
  const lxcTemplateList = useMemo(() => {
    const list = (templates || []).filter(
      (t) => t.volid && (t.volid.includes('.tar.') || t.volid.includes('vztmpl') || t.content === 'vztmpl')
    );
    if (list.length > 0) return list;
    return [
      { volid: 'local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst', size: 145000000 },
      { volid: 'local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst', size: 162000000 },
      { volid: 'local:vztmpl/alpine-3.20-default_20240606_amd64.tar.xz', size: 3400000 },
    ];
  }, [templates]);

  // Available Storage list from Proxmox
  const availableStorages = useMemo(() => {
    if (storages && storages.length > 0) {
      return storages.map((s) => ({
        id: s.storage || s.id,
        type: s.type || 'dir',
        avail: s.avail || 0,
        total: s.total || 0,
      }));
    }
    return [
      { id: 'local-lvm', type: 'lvmthin', avail: 140000000000 },
      { id: 'local', type: 'dir', avail: 60000000000 },
      { id: 'local-zfs', type: 'zfspool', avail: 500000000000 },
    ];
  }, [storages]);

  // Available Bridge list from Proxmox
  const availableBridges = useMemo(() => {
    if (bridges && bridges.length > 0) {
      return bridges.map((b) => ({
        id: b.iface || b.name || 'vmbr0',
        cidr: b.cidr || '',
        comment: b.comment || '',
      }));
    }
    return [
      { id: 'vmbr0', cidr: '192.168.20.254/24', comment: 'Default LAN Bridge' },
      { id: 'vmbr1', cidr: '10.0.0.1/24', comment: 'VLAN / Trunk Bridge' },
    ];
  }, [bridges]);

  // Unique tags across all LXCs
  const allTags = useMemo(() => {
    const set = new Set();
    lxcs.forEach((ct) => {
      if (ct.tags) {
        String(ct.tags)
          .split(/[,;\s]+/)
          .filter(Boolean)
          .forEach((t) => set.add(t));
      }
    });
    return Array.from(set);
  }, [lxcs]);

  // Filtered LXCs
  const filteredLxcs = useMemo(() => {
    return lxcs.filter((ct) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(ct.vmid).includes(q) ||
        (ct.name && ct.name.toLowerCase().includes(q)) ||
        (ct.ip && ct.ip.toLowerCase().includes(q)) ||
        (ct.tags && ct.tags.toLowerCase().includes(q)) ||
        (ct.status && ct.status.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'RUNNING' && ct.status === 'running') ||
        (statusFilter === 'STOPPED' && ct.status === 'stopped');

      const matchTag =
        tagFilter === 'ALL' ||
        (ct.tags &&
          String(ct.tags)
            .toLowerCase()
            .split(/[,;\s]+/)
            .includes(tagFilter.toLowerCase()));

      return matchSearch && matchStatus && matchTag;
    });
  }, [lxcs, search, statusFilter, tagFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = lxcs.length;
    const running = lxcs.filter((c) => c.status === 'running').length;
    const stopped = lxcs.filter((c) => c.status === 'stopped').length;
    const totalCores = lxcs.reduce((acc, c) => acc + (Number(c.cpus) || 0), 0);
    const totalRamBytes = lxcs.reduce((acc, c) => acc + (Number(c.maxmem) || 0), 0);
    return {
      total,
      running,
      stopped,
      totalCores,
      totalRamStr: totalRamBytes > 0 ? `${(totalRamBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '0 GB',
    };
  }, [lxcs]);

  // Export CSV
  function handleExportCsv() {
    if (lxcs.length === 0) {
      toast('Không có dữ liệu container để xuất file', 'warning');
      return;
    }
    const headers = ['CT ID', 'Hostname', 'Trạng Thái', 'IP Address', 'CPU Cores', 'RAM (MB)', 'Swap (MB)', 'RootFS (GB)', 'Uptime (s)', 'Tags'];
    const rows = lxcs.map((c) => [
      c.vmid,
      `"${c.name || ''}"`,
      c.status || '',
      `"${c.ip || ''}"`,
      c.cpus || 1,
      c.maxmem ? Math.round(c.maxmem / (1024 * 1024)) : '',
      c.maxswap ? Math.round(c.maxswap / (1024 * 1024)) : '',
      c.maxdisk ? (c.maxdisk / (1024 * 1024 * 1024)).toFixed(1) : '',
      c.uptime || 0,
      `"${c.tags || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `proxmox_lxcs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Đã xuất danh sách container Proxmox sang CSV thành công!', 'success');
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {t('proxmoxLxcs.title')}
            </h1>
            {refreshing && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {t('common.refreshing')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            {t('proxmoxLxcs.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => loadData(false)}
            disabled={loading || refreshing}
            className="btn btn-secondary btn-sm"
            title={t('common.refreshNow')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`}
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
            </svg>
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={lxcs.length === 0}
            className="btn btn-secondary btn-sm"
          >
            {t('proxmoxLxcs.exportExcel')}
          </button>

          <button
            onClick={handleOpenCreate}
            disabled={isReadOnly}
            className="btn btn-primary btn-sm shadow-sm"
          >
            {t('proxmoxLxcs.createLxcBtn')}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={t('proxmoxLxcs.totalLxcs')}
          value={stats.total}
          sub="LXC Linux Containers"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          }
        />
        <StatCard
          label={t('proxmoxLxcs.runningLxcs')}
          value={stats.running}
          sub={`${stats.total > 0 ? Math.round((stats.running / stats.total) * 100) : 0}% trực tuyến`}
          badge={stats.running > 0 ? 'ONLINE' : 'IDLE'}
          badgeVariant={stats.running > 0 ? 'success' : 'default'}
          accent="green"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-emerald-400">
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
            </svg>
          }
        />
        <StatCard
          label={t('proxmoxLxcs.stoppedLxcs')}
          value={stats.stopped}
          sub="Tắt nguồn / Offline"
          badge={stats.stopped > 0 ? `${stats.stopped} OFF` : '0 OFF'}
          badgeVariant="default"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-[var(--text-faint)]">
              <circle cx="12" cy="12" r="10" />
              <rect x="9" y="9" width="6" height="6" fill="currentColor" />
            </svg>
          }
        />
        <StatCard
          label={t('proxmoxLxcs.totalRam')}
          value={stats.totalRamStr}
          sub={`${stats.totalCores} CPU Cores`}
          accent="cyan"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-teal-400">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
            </svg>
          }
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-[var(--surface-1)] p-3.5 rounded-[var(--radius)] border border-[var(--border)]">
        <div className="relative flex-1 max-w-md">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)]"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t('proxmoxLxcs.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-sm pl-9 w-full bg-[var(--surface-2)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input input-sm bg-[var(--surface-2)] text-xs"
          >
            <option value="ALL">{t('proxmoxLxcs.filterAllStatus')}</option>
            <option value="RUNNING">{t('proxmoxLxcs.filterRunning')}</option>
            <option value="STOPPED">{t('proxmoxLxcs.filterStopped')}</option>
          </select>

          {/* Tags Filter */}
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="input input-sm bg-[var(--surface-2)] text-xs"
            >
              <option value="ALL">Tất cả Tags ({allTags.length})</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}

          {(search || statusFilter !== 'ALL' || tagFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setTagFilter('ALL');
              }}
              className="btn btn-ghost btn-sm text-xs text-[var(--text-faint)] hover:text-[var(--text)]"
            >
              ✕ Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* LXC List Table */}
      <div className="card overflow-hidden">
        {loading && lxcs.length === 0 ? (
          <div className="py-16 text-center">
            <Spinner />
            <p className="mt-3 text-sm text-[var(--text-dim)]">{t('common.loading')}</p>
          </div>
        ) : filteredLxcs.length === 0 ? (
          <div className="py-16 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto h-12 w-12 text-[var(--text-faint)]"
            >
              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <p className="mt-3 text-sm font-medium text-[var(--text-dim)]">
              {t('proxmoxLxcs.noLxcsFound')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-sk w-full">
              <thead>
                <tr>
                  <th className="w-20">{t('proxmoxLxcs.colCtid')}</th>
                  <th>{t('proxmoxLxcs.colHostname')}</th>
                  <th className="w-28">{t('proxmoxLxcs.colStatus')}</th>
                  <th>{t('proxmoxLxcs.colIp')}</th>
                  <th>{t('proxmoxLxcs.colCpu')}</th>
                  <th>{t('proxmoxLxcs.colMemory')}</th>
                  <th>{t('proxmoxLxcs.colDisk')}</th>
                  <th>{t('proxmoxLxcs.colUptime')}</th>
                  <th>{t('proxmoxLxcs.colTags')}</th>
                  <th className="text-right w-44">{t('proxmoxLxcs.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {filteredLxcs.map((ct) => {
                  const isRunning = ct.status === 'running';
                  const cpuUsagePct = ct.cpu ? (ct.cpu * 100).toFixed(1) : '0';
                  const memMb = ct.maxmem ? Math.round(ct.maxmem / (1024 * 1024)) : 0;
                  const curMemMb = ct.mem ? Math.round(ct.mem / (1024 * 1024)) : 0;
                  const swapMb = ct.maxswap ? Math.round(ct.maxswap / (1024 * 1024)) : 0;
                  const diskGb = ct.maxdisk ? (ct.maxdisk / (1024 * 1024 * 1024)).toFixed(0) : '-';
                  const tagsArr = ct.tags ? String(ct.tags).split(/[,;\s]+/).filter(Boolean) : [];

                  return (
                    <tr key={ct.vmid} className="hover:bg-[var(--surface-2)]/60 transition-colors">
                      {/* CT ID */}
                      <td className="font-mono text-xs font-semibold text-teal-400">
                        #{ct.vmid}
                      </td>

                      {/* Hostname */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] ${
                              isRunning
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-[var(--surface-3)] text-[var(--text-faint)] border border-[var(--border)]'
                            }`}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                              <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                              <line x1="12" y1="22.08" x2="12" y2="12" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium text-sm text-[var(--text)] flex items-center gap-1.5">
                              {ct.name || `CT-${ct.vmid}`}
                              {ct.template ? (
                                <span className="badge badge-warning text-[10px] px-1 py-0">TEMPLATE</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--text-faint)]">
                              lxc container
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        {isRunning ? (
                          <span className="badge badge-success flex items-center gap-1.5 w-fit font-mono text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            RUNNING
                          </span>
                        ) : (
                          <span className="badge badge-default flex items-center gap-1.5 w-fit font-mono text-xs text-[var(--text-faint)]">
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500"></span>
                            STOPPED
                          </span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="text-xs font-mono">
                        {ct.ip ? (
                          <span className="text-[var(--accent)] font-medium">{ct.ip}</span>
                        ) : (
                          <span className="text-[var(--text-faint)] italic">DHCP / Auto</span>
                        )}
                      </td>

                      {/* CPU */}
                      <td className="text-xs">
                        <div className="font-medium text-[var(--text)]">
                          {ct.cpus || 1} Cores
                        </div>
                        {isRunning && (
                          <div className="text-[11px] font-mono text-[var(--text-dim)]">
                            CPU: {cpuUsagePct}%
                          </div>
                        )}
                      </td>

                      {/* RAM & Swap */}
                      <td className="text-xs">
                        <div className="font-medium text-[var(--text)]">
                          {memMb > 0 ? `${memMb} MB` : '-'}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-dim)]">
                          Swap: {swapMb} MB
                        </div>
                      </td>

                      {/* RootFS Disk */}
                      <td className="text-xs font-mono text-[var(--text-dim)]">
                        {diskGb !== '-' ? `${diskGb} GB` : '-'}
                      </td>

                      {/* Uptime */}
                      <td className="text-xs font-mono text-[var(--text-dim)]">
                        {isRunning && ct.uptime ? formatUptime(ct.uptime) : '-'}
                      </td>

                      {/* Tags */}
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          {tagsArr.length > 0 ? (
                            tagsArr.map((t, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getLxcTagBadgeClass(t)}`}
                              >
                                {t}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-[var(--text-faint)] italic">-</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Start / Shutdown / Stop / Reboot buttons */}
                          {isRunning ? (
                            <>
                              <button
                                onClick={() => handleGuestAction(ct.vmid, 'shutdown')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-amber-400 hover:bg-amber-500/10"
                                title={t('proxmoxLxcs.shutdownBtn')}
                              >
                                {actionLoadingId === `${ct.vmid}-shutdown` ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                    <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleGuestAction(ct.vmid, 'stop')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10"
                                title={t('proxmoxLxcs.stopBtn')}
                              >
                                {actionLoadingId === `${ct.vmid}-stop` ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                    <rect x="5" y="5" width="14" height="14" rx="2" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleGuestAction(ct.vmid, 'reboot')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-sky-400 hover:bg-sky-500/10"
                                title={t('proxmoxLxcs.rebootBtn')}
                              >
                                {actionLoadingId === `${ct.vmid}-reboot` ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
                                  </svg>
                                )}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleGuestAction(ct.vmid, 'start')}
                              disabled={actionLoadingId !== null || isReadOnly}
                              className="btn btn-ghost btn-xs text-emerald-400 hover:bg-emerald-500/10"
                              title={t('proxmoxLxcs.startBtn')}
                            >
                              {actionLoadingId === `${ct.vmid}-start` ? (
                                <Spinner size="xs" />
                              ) : (
                                <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              )}
                            </button>
                          )}

                          {/* Edit Config */}
                          <button
                            onClick={() => handleOpenEdit(ct)}
                            disabled={isReadOnly}
                            className="btn btn-ghost btn-xs text-[var(--text-dim)] hover:text-[var(--text)]"
                            title={t('proxmoxLxcs.editConfigBtn')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>

                          {/* Delete LXC */}
                          <button
                            onClick={() => {
                              setDeleteLxc(ct);
                              setPurgeRootfs(true);
                            }}
                            disabled={isReadOnly || isRunning}
                            className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-30"
                            title={isRunning ? 'Hãy tắt container trước khi xóa' : t('proxmoxLxcs.deleteLxcBtn')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tạo Container LXC Mới */}
      {createOpen && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title={t('proxmoxLxcs.createTitle')}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            {/* Section 1: Thông tin định danh */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">1. Thông tin định danh Container</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.ctidLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="999999999"
                    value={formData.vmid}
                    onChange={(e) => setFormData({ ...formData, vmid: e.target.value })}
                    placeholder={t('proxmoxLxcs.ctidPlaceholder')}
                    className="input input-sm font-mono"
                    required
                  />
                  <span className="sk-help-text">Mã định danh CT ID duy nhất trên Proxmox</span>
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.hostnameLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    placeholder={t('proxmoxLxcs.hostnamePlaceholder')}
                    className="input input-sm font-mono"
                    required
                  />
                  <span className="sk-help-text">VD: debian-pihole, alpine-nginx</span>
                </div>
              </div>
            </div>

            {/* Section 2: Template & Mật khẩu root */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">2. Hệ điều hành & Xác thực (OS & Auth)</div>
              <div className="space-y-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.templateLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  {lxcTemplateList.length > 0 ? (
                    <select
                      value={formData.ostemplate}
                      onChange={(e) => setFormData({ ...formData, ostemplate: e.target.value })}
                      className="input input-sm font-mono text-xs"
                      required
                    >
                      <option value="">{t('proxmoxLxcs.templateSelect')}</option>
                      {lxcTemplateList.map((tmpl) => (
                        <option key={tmpl.volid} value={tmpl.volid}>
                          {tmpl.volid} ({formatBytes(tmpl.size)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.ostemplate}
                      onChange={(e) => setFormData({ ...formData, ostemplate: e.target.value })}
                      placeholder="VD: local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
                      className="input input-sm font-mono text-xs"
                      required
                    />
                  )}
                  <span className="sk-help-text">Đường dẫn file Template OS dạng .tar.zst hoặc .tar.gz</span>
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.rootPasswordLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={t('proxmoxLxcs.rootPasswordPlaceholder')}
                    className="input input-sm font-mono"
                    required
                  />
                  <span className="sk-help-text">Mật khẩu tài khoản root của Linux container (tối thiểu 5 ký tự)</span>
                </div>
              </div>
            </div>

            {/* Section 3: Phân bổ tài nguyên */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">3. Phân bổ Tài nguyên (Cores / RAM / RootFS)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.coresLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="128"
                    value={formData.cores}
                    onChange={(e) => setFormData({ ...formData, cores: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.memoryLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="128"
                    max="131072"
                    step="128"
                    value={formData.memory}
                    onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.swapLabel')}</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="131072"
                    step="128"
                    value={formData.swap}
                    onChange={(e) => setFormData({ ...formData, swap: e.target.value })}
                    className="input input-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.diskLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formData.disk}
                    onChange={(e) => setFormData({ ...formData, disk: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.storageLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <select
                    value={formData.storage}
                    onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                    className="input input-sm font-mono text-xs"
                    required
                  >
                    {availableStorages.map((st) => (
                      <option key={st.id} value={st.id}>
                        💽 {st.id} ({st.type.toUpperCase()}{st.avail ? ` · Trống ${formatBytes(st.avail)}` : ''})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Mạng & Chế độ bảo mật */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">4. Cấu hình Mạng & Bảo mật (Network & Security)</div>
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxLxcs.netBridgeLabel')}</span>
                    </label>
                    <select
                      value={formData.bridge}
                      onChange={(e) => setFormData({ ...formData, bridge: e.target.value })}
                      className="input input-sm font-mono text-xs"
                    >
                      {availableBridges.map((br) => (
                        <option key={br.id} value={br.id}>
                          🌐 {br.id} {br.cidr ? `(${br.cidr})` : ''} {br.comment ? `· ${br.comment}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxLxcs.ipModeLabel')}</span>
                    </label>
                    <select
                      value={formData.ipMode}
                      onChange={(e) => setFormData({ ...formData, ipMode: e.target.value })}
                      className="input input-sm text-xs"
                    >
                      <option value="dhcp">{t('proxmoxLxcs.ipModeDhcp')}</option>
                      <option value="static">{t('proxmoxLxcs.ipModeStatic')}</option>
                    </select>
                  </div>
                </div>

                {formData.ipMode === 'static' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <label className="sk-label">
                        <span>{t('proxmoxLxcs.ipStaticLabel')}</span>
                        <span className="sk-label-req">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.ip}
                        onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                        placeholder={t('proxmoxLxcs.ipStaticPlaceholder')}
                        className="input input-sm font-mono text-xs"
                        required
                      />
                    </div>

                    <div>
                      <label className="sk-label">
                        <span>{t('proxmoxLxcs.gatewayLabel')}</span>
                      </label>
                      <input
                        type="text"
                        value={formData.gw}
                        onChange={(e) => setFormData({ ...formData, gw: e.target.value })}
                        placeholder={t('proxmoxLxcs.gatewayPlaceholder')}
                        className="input input-sm font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="unprivileged-check"
                    checked={formData.unprivileged}
                    onChange={(e) => setFormData({ ...formData, unprivileged: e.target.checked })}
                    className="rounded border-[var(--border)] text-[var(--accent)]"
                  />
                  <label htmlFor="unprivileged-check" className="text-xs font-medium text-[var(--text)] cursor-pointer select-none">
                    {t('proxmoxLxcs.unprivilegedLabel')}
                  </label>
                </div>
              </div>
            </div>

            {/* Section 5: Tags */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">5. Thẻ phân loại & Khởi động</div>
              <div>
                <label className="sk-label">
                  <span>{t('proxmoxLxcs.tagsLabel')}</span>
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('proxmoxLxcs.tagsPlaceholder')}
                  className="input input-sm font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[var(--text-faint)]">Gợi ý:</span>
                  {PRESET_LXC_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const cur = formData.tags ? formData.tags.split(/[,;\s]+/).filter(Boolean) : [];
                        if (!cur.includes(tag)) {
                          setFormData({ ...formData, tags: [...cur, tag].join(', ') });
                        }
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-dim)] hover:text-[var(--text)] border border-[var(--border)] transition-colors"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-3 mt-3 border-t border-[var(--border-soft)]">
                <input
                  type="checkbox"
                  id="lxc-start-check"
                  checked={formData.start}
                  onChange={(e) => setFormData({ ...formData, start: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <label htmlFor="lxc-start-check" className="text-xs font-medium text-[var(--text)] cursor-pointer select-none">
                  Tự động khởi động container ngay sau khi tạo xong (Start after created)
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={submitting}
                className="btn btn-secondary btn-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                {submitting && <Spinner size="xs" />}
                {t('common.create')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Sửa Cấu Hình LXC */}
      {editLxc && (
        <Modal
          open={Boolean(editLxc)}
          onClose={() => setEditLxc(null)}
          title={t('proxmoxLxcs.editTitle', { vmid: editLxc.vmid, hostname: editLxc.name || `CT-${editLxc.vmid}` })}
        >
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="sk-form-section">
              <div className="sk-form-section__title">Cập nhật Cấu hình Container</div>
              <div className="space-y-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.hostnameLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.hostname}
                    onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxLxcs.coresLabel')}</span>
                      <span className="sk-label-req">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="128"
                      value={formData.cores}
                      onChange={(e) => setFormData({ ...formData, cores: e.target.value })}
                      className="input input-sm font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxLxcs.memoryLabel')}</span>
                      <span className="sk-label-req">*</span>
                    </label>
                    <input
                      type="number"
                      min="128"
                      max="131072"
                      step="128"
                      value={formData.memory}
                      onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                      className="input input-sm font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxLxcs.swapLabel')}</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="131072"
                      step="128"
                      value={formData.swap}
                      onChange={(e) => setFormData({ ...formData, swap: e.target.value })}
                      className="input input-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxLxcs.tagsLabel')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="docker, production, nginx"
                    className="input input-sm font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditLxc(null)}
                disabled={submitting}
                className="btn btn-secondary btn-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                {submitting && <Spinner size="xs" />}
                {t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Xác Nhận Xóa LXC */}
      {deleteLxc && (
        <Modal
          open={Boolean(deleteLxc)}
          onClose={() => setDeleteLxc(null)}
          title={t('proxmoxLxcs.deleteTitle', { vmid: deleteLxc.vmid })}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs leading-relaxed flex items-start gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
              </svg>
              <div>
                <p className="font-semibold text-rose-300">
                  {t('proxmoxLxcs.deleteWarning', { vmid: deleteLxc.vmid, hostname: deleteLxc.name || `CT-${deleteLxc.vmid}` })}
                </p>
                <p className="mt-1 text-[var(--text-dim)]">
                  Mã CT ID: <span className="font-mono text-rose-300">#{deleteLxc.vmid}</span> | Hostname: <span className="font-semibold text-rose-300">{deleteLxc.name || '-'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="purge-rootfs-check"
                checked={purgeRootfs}
                onChange={(e) => setPurgeRootfs(e.target.checked)}
                className="rounded border-[var(--border)] text-rose-500 focus:ring-0"
              />
              <label htmlFor="purge-rootfs-check" className="text-xs text-[var(--text)] cursor-pointer select-none">
                {t('proxmoxLxcs.purgeLabel')}
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeleteLxc(null)}
                disabled={submitting}
                className="btn btn-secondary btn-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={submitting}
                className="btn btn-danger btn-sm flex items-center gap-1.5"
              >
                {submitting && <Spinner size="xs" />}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
