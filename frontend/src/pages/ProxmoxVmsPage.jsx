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

// Tag color badge styling helper
function getVmTagBadgeClass(tag = '') {
  const t = tag.toLowerCase().trim();
  if (t.includes('prod') || t.includes('main')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (t.includes('db') || t.includes('data') || t.includes('sql')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (t.includes('web') || t.includes('front') || t.includes('api')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  if (t.includes('win') || t.includes('desktop')) return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  if (t.includes('linux') || t.includes('ubuntu') || t.includes('debian')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (t.includes('test') || t.includes('dev') || t.includes('lab')) return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  return 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]';
}

const PRESET_VM_TAGS = ['production', 'development', 'database', 'web', 'ubuntu', 'windows', 'ha-cluster', 'backup'];

export default function ProxmoxVmsPage() {
  const { isReadOnly } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [vms, setVms] = useState([]);
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
  const [editVm, setEditVm] = useState(null);
  const [deleteVm, setDeleteVm] = useState(null);
  const [purgeDisk, setPurgeDisk] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Data for Create / Edit
  const [formData, setFormData] = useState({
    vmid: '',
    name: '',
    cores: 2,
    sockets: 1,
    memory: 2048,
    disk: 32,
    storage: 'local-lvm',
    iso: '',
    bridge: 'vmbr0',
    ostype: 'l26',
    tags: '',
    start: false,
  });

  async function loadData(quiet = false) {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [vmsRes, tmplRes, summaryRes] = await Promise.allSettled([
        api.proxmoxVms(),
        api.proxmoxTemplates(),
        api.proxmoxSummary(),
      ]);

      if (vmsRes.status === 'fulfilled' && vmsRes.value) {
        const list = Array.isArray(vmsRes.value) ? vmsRes.value : (vmsRes.value.data || []);
        setVms(list);
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
      if (!quiet) toast(err.message || 'Lỗi tải danh sách máy ảo Proxmox', 'error');
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

  // Quick Power Actions (start, stop, shutdown, reboot, reset)
  async function handleGuestAction(vmid, action) {
    if (isReadOnly) {
      toast('Tài khoản chỉ có quyền xem (Read-Only)', 'warning');
      return;
    }
    setActionLoadingId(`${vmid}-${action}`);
    try {
      await api.proxmoxGuestAction('qemu', vmid, action);
      toast(t('proxmoxVms.actionSuccess', { action: action.toUpperCase(), vmid }), 'success');
      await loadData(true);
    } catch (err) {
      toast(err.message || `Lỗi thực hiện thao tác ${action}`, 'error');
    } finally {
      setActionLoadingId(null);
    }
  }

  // Open Create Modal
  async function handleOpenCreate() {
    try {
      const nextIdRes = await api.proxmoxNextId();
      setFormData({
        vmid: nextIdRes?.nextvmid || '',
        name: '',
        cores: 2,
        sockets: 1,
        memory: 2048,
        disk: 32,
        storage: 'local-lvm',
        iso: '',
        bridge: 'vmbr0',
        ostype: 'l26',
        tags: '',
        start: false,
      });
    } catch {
      setFormData({
        vmid: '',
        name: '',
        cores: 2,
        sockets: 1,
        memory: 2048,
        disk: 32,
        storage: 'local-lvm',
        iso: '',
        bridge: 'vmbr0',
        ostype: 'l26',
        tags: '',
        start: false,
      });
    }
    setCreateOpen(true);
  }

  // Open Edit Modal
  function handleOpenEdit(vm) {
    setEditVm(vm);
    const memMb = vm.maxmem ? Math.round(vm.maxmem / (1024 * 1024)) : 2048;
    setFormData({
      vmid: vm.vmid,
      name: vm.name || '',
      cores: vm.cpus || vm.cores || 2,
      sockets: vm.sockets || 1,
      memory: memMb,
      tags: vm.tags || '',
    });
  }

  // Submit Create VM
  async function handleSubmitCreate(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast(t('proxmoxVms.nameRequired'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        vmid: formData.vmid ? Number(formData.vmid) : undefined,
        name: formData.name.trim(),
        cores: Number(formData.cores) || 2,
        sockets: Number(formData.sockets) || 1,
        memory: Number(formData.memory) || 2048,
        disk: Number(formData.disk) || 32,
        storage: formData.storage || 'local-lvm',
        iso: formData.iso || undefined,
        bridge: formData.bridge || 'vmbr0',
        ostype: formData.ostype || 'l26',
        tags: formData.tags.trim() || undefined,
        start: Boolean(formData.start),
      };
      await api.createProxmoxVm(payload);
      toast(t('proxmoxVms.createSuccess', { vmid: formData.vmid || payload.name }), 'success');
      setCreateOpen(false);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi tạo máy ảo Proxmox', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Submit Edit VM
  async function handleSubmitEdit(e) {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast(t('proxmoxVms.nameRequired'), 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        cores: Number(formData.cores) || 2,
        sockets: Number(formData.sockets) || 1,
        memory: Number(formData.memory) || 2048,
        tags: formData.tags.trim() || undefined,
      };
      await api.updateProxmoxVm(editVm.vmid, payload);
      toast(t('proxmoxVms.updateSuccess', { vmid: editVm.vmid }), 'success');
      setEditVm(null);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi cập nhật cấu hình máy ảo', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Confirm Delete VM
  async function handleConfirmDelete() {
    if (!deleteVm) return;
    setSubmitting(true);
    try {
      await api.deleteProxmoxVm(deleteVm.vmid, purgeDisk ? 1 : 0);
      toast(t('proxmoxVms.deleteSuccess', { vmid: deleteVm.vmid }), 'success');
      setDeleteVm(null);
      await loadData(true);
    } catch (err) {
      toast(err.message || 'Lỗi xóa máy ảo Proxmox', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Available ISO list from Proxmox storage templates
  const isoList = useMemo(() => {
    return (templates || []).filter((t) => t.volid && (t.volid.includes('.iso') || t.content === 'iso'));
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

  // Unique tags across all VMs
  const allTags = useMemo(() => {
    const set = new Set();
    vms.forEach((vm) => {
      if (vm.tags) {
        String(vm.tags)
          .split(/[,;\s]+/)
          .filter(Boolean)
          .forEach((t) => set.add(t));
      }
    });
    return Array.from(set);
  }, [vms]);

  // Filtered VMs
  const filteredVms = useMemo(() => {
    return vms.filter((vm) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(vm.vmid).includes(q) ||
        (vm.name && vm.name.toLowerCase().includes(q)) ||
        (vm.tags && vm.tags.toLowerCase().includes(q)) ||
        (vm.status && vm.status.toLowerCase().includes(q));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'RUNNING' && vm.status === 'running') ||
        (statusFilter === 'STOPPED' && vm.status === 'stopped');

      const matchTag =
        tagFilter === 'ALL' ||
        (vm.tags &&
          String(vm.tags)
            .toLowerCase()
            .split(/[,;\s]+/)
            .includes(tagFilter.toLowerCase()));

      return matchSearch && matchStatus && matchTag;
    });
  }, [vms, search, statusFilter, tagFilter]);

  // Overall VM Stats
  const stats = useMemo(() => {
    const total = vms.length;
    const running = vms.filter((v) => v.status === 'running').length;
    const stopped = vms.filter((v) => v.status === 'stopped').length;
    const totalCores = vms.reduce((acc, v) => acc + (Number(v.cpus) || Number(v.cores) || 0), 0);
    const totalRamBytes = vms.reduce((acc, v) => acc + (Number(v.maxmem) || 0), 0);
    return {
      total,
      running,
      stopped,
      totalCores,
      totalRamStr: totalRamBytes > 0 ? `${(totalRamBytes / (1024 * 1024 * 1024)).toFixed(1)} GB` : '0 GB',
    };
  }, [vms]);

  // Export to CSV
  function handleExportCsv() {
    if (vms.length === 0) {
      toast('Không có dữ liệu máy ảo để xuất file', 'warning');
      return;
    }
    const headers = ['VMID', 'Tên Máy Ảo', 'Trạng Thái', 'CPU Cores', 'RAM (MB)', 'Disk (GB)', 'Uptime (s)', 'Tags'];
    const rows = vms.map((v) => [
      v.vmid,
      `"${v.name || ''}"`,
      v.status || '',
      v.cpus || v.cores || '',
      v.maxmem ? Math.round(v.maxmem / (1024 * 1024)) : '',
      v.maxdisk ? (v.maxdisk / (1024 * 1024 * 1024)).toFixed(1) : '',
      v.uptime || 0,
      `"${v.tags || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `proxmox_vms_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast('Đã xuất danh sách máy ảo Proxmox sang CSV thành công!', 'success');
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              {t('proxmoxVms.title')}
            </h1>
            {refreshing && (
              <span className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] font-mono">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {t('common.refreshing')}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text-dim)]">
            {t('proxmoxVms.subtitle')}
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
            disabled={vms.length === 0}
            className="btn btn-secondary btn-sm"
          >
            {t('proxmoxVms.exportExcel')}
          </button>

          <button
            onClick={handleOpenCreate}
            disabled={isReadOnly}
            className="btn btn-primary btn-sm shadow-sm"
          >
            {t('proxmoxVms.createVmBtn')}
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label={t('proxmoxVms.totalVms')}
          value={stats.total}
          sub="KVM / QEMU Guests"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
        />
        <StatCard
          label={t('proxmoxVms.runningVms')}
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
          label={t('proxmoxVms.stoppedVms')}
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
          label={t('proxmoxVms.totalRam')}
          value={stats.totalRamStr}
          sub={`${stats.totalCores} CPU Cores`}
          accent="violet"
          icon={
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-indigo-400">
              <path d="M6 19v-3M10 19v-3M14 19v-3M18 19v-3M6 8V5M10 8V5M14 8V5M18 8V5M2 8h20v8H2z" />
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
            placeholder={t('proxmoxVms.searchPlaceholder')}
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
            <option value="ALL">{t('proxmoxVms.filterAllStatus')}</option>
            <option value="RUNNING">{t('proxmoxVms.filterRunning')}</option>
            <option value="STOPPED">{t('proxmoxVms.filterStopped')}</option>
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

      {/* VM List Table */}
      <div className="card overflow-hidden">
        {loading && vms.length === 0 ? (
          <div className="py-16 text-center">
            <Spinner />
            <p className="mt-3 text-sm text-[var(--text-dim)]">{t('common.loading')}</p>
          </div>
        ) : filteredVms.length === 0 ? (
          <div className="py-16 text-center">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="mx-auto h-12 w-12 text-[var(--text-faint)]"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <p className="mt-3 text-sm font-medium text-[var(--text-dim)]">
              {t('proxmoxVms.noVmsFound')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-sk w-full">
              <thead>
                <tr>
                  <th className="w-20">{t('proxmoxVms.colVmid')}</th>
                  <th>{t('proxmoxVms.colName')}</th>
                  <th className="w-28">{t('proxmoxVms.colStatus')}</th>
                  <th>{t('proxmoxVms.colCpu')}</th>
                  <th>{t('proxmoxVms.colMemory')}</th>
                  <th>{t('proxmoxVms.colDisk')}</th>
                  <th>{t('proxmoxVms.colUptime')}</th>
                  <th>{t('proxmoxVms.colTags')}</th>
                  <th className="text-right w-44">{t('proxmoxVms.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)]">
                {filteredVms.map((vm) => {
                  const isRunning = vm.status === 'running';
                  const cpuUsagePct = vm.cpu ? (vm.cpu * 100).toFixed(1) : '0';
                  const memMb = vm.maxmem ? Math.round(vm.maxmem / (1024 * 1024)) : 0;
                  const curMemMb = vm.mem ? Math.round(vm.mem / (1024 * 1024)) : 0;
                  const diskGb = vm.maxdisk ? (vm.maxdisk / (1024 * 1024 * 1024)).toFixed(0) : '-';
                  const tagsArr = vm.tags ? String(vm.tags).split(/[,;\s]+/).filter(Boolean) : [];

                  return (
                    <tr key={vm.vmid} className="hover:bg-[var(--surface-2)]/60 transition-colors">
                      {/* VMID */}
                      <td className="font-mono text-xs font-semibold text-[var(--accent)]">
                        #{vm.vmid}
                      </td>

                      {/* VM Name */}
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
                              <rect x="2" y="3" width="20" height="14" rx="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-medium text-sm text-[var(--text)] flex items-center gap-1.5">
                              {vm.name || `VM-${vm.vmid}`}
                              {vm.template ? (
                                <span className="badge badge-warning text-[10px] px-1 py-0">TEMPLATE</span>
                              ) : null}
                            </div>
                            <div className="text-[11px] font-mono text-[var(--text-faint)]">
                              qemu / kvm
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

                      {/* CPU */}
                      <td className="text-xs">
                        <div className="font-medium text-[var(--text)]">
                          {vm.cpus || vm.cores || 1} Cores
                        </div>
                        {isRunning && (
                          <div className="text-[11px] font-mono text-[var(--text-dim)]">
                            CPU: {cpuUsagePct}%
                          </div>
                        )}
                      </td>

                      {/* RAM */}
                      <td className="text-xs">
                        <div className="font-medium text-[var(--text)]">
                          {memMb > 0 ? `${memMb} MB` : '-'}
                        </div>
                        {isRunning && curMemMb > 0 && (
                          <div className="text-[11px] font-mono text-[var(--text-dim)]">
                            dùng: {curMemMb} MB ({Math.round((curMemMb / memMb) * 100)}%)
                          </div>
                        )}
                      </td>

                      {/* Disk */}
                      <td className="text-xs font-mono text-[var(--text-dim)]">
                        {diskGb !== '-' ? `${diskGb} GB` : '-'}
                      </td>

                      {/* Uptime */}
                      <td className="text-xs font-mono text-[var(--text-dim)]">
                        {isRunning && vm.uptime ? formatUptime(vm.uptime) : '-'}
                      </td>

                      {/* Tags */}
                      <td>
                        <div className="flex flex-wrap items-center gap-1">
                          {tagsArr.length > 0 ? (
                            tagsArr.map((t, idx) => (
                              <span
                                key={idx}
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getVmTagBadgeClass(t)}`}
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
                                onClick={() => handleGuestAction(vm.vmid, 'shutdown')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-amber-400 hover:bg-amber-500/10"
                                title={t('proxmoxVms.shutdownBtn')}
                              >
                                {actionLoadingId === `${vm.vmid}-shutdown` ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                    <path d="M18.36 6.64a9 9 0 11-12.73 0M12 2v10" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleGuestAction(vm.vmid, 'stop')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10"
                                title={t('proxmoxVms.stopBtn')}
                              >
                                {actionLoadingId === `${vm.vmid}-stop` ? (
                                  <Spinner size="xs" />
                                ) : (
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                    <rect x="5" y="5" width="14" height="14" rx="2" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={() => handleGuestAction(vm.vmid, 'reboot')}
                                disabled={actionLoadingId !== null || isReadOnly}
                                className="btn btn-ghost btn-xs text-sky-400 hover:bg-sky-500/10"
                                title={t('proxmoxVms.rebootBtn')}
                              >
                                {actionLoadingId === `${vm.vmid}-reboot` ? (
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
                              onClick={() => handleGuestAction(vm.vmid, 'start')}
                              disabled={actionLoadingId !== null || isReadOnly}
                              className="btn btn-ghost btn-xs text-emerald-400 hover:bg-emerald-500/10"
                              title={t('proxmoxVms.startBtn')}
                            >
                              {actionLoadingId === `${vm.vmid}-start` ? (
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
                            onClick={() => handleOpenEdit(vm)}
                            disabled={isReadOnly}
                            className="btn btn-ghost btn-xs text-[var(--text-dim)] hover:text-[var(--text)]"
                            title={t('proxmoxVms.editConfigBtn')}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
                            </svg>
                          </button>

                          {/* Delete VM */}
                          <button
                            onClick={() => {
                              setDeleteVm(vm);
                              setPurgeDisk(true);
                            }}
                            disabled={isReadOnly || isRunning}
                            className="btn btn-ghost btn-xs text-rose-400 hover:bg-rose-500/10 disabled:opacity-30"
                            title={isRunning ? 'Hãy tắt máy trước khi xóa' : t('proxmoxVms.deleteVmBtn')}
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

      {/* Modal: Tạo VM Mới */}
      {createOpen && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title={t('proxmoxVms.createTitle')}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSubmitCreate} className="space-y-4">
            {/* Section 1: Thông tin cơ bản */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">1. Thông tin định danh Máy ảo</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.vmidLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="999999999"
                    value={formData.vmid}
                    onChange={(e) => setFormData({ ...formData, vmid: e.target.value })}
                    placeholder={t('proxmoxVms.vmidPlaceholder')}
                    className="input input-sm font-mono"
                    required
                  />
                  <span className="sk-help-text">Mã định danh duy nhất trên cụm Proxmox</span>
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.nameLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t('proxmoxVms.namePlaceholder')}
                    className="input input-sm"
                    required
                  />
                  <span className="sk-help-text">VD: ubuntu-server-24, win11-dev</span>
                </div>
              </div>
            </div>

            {/* Section 2: Tài nguyên phần cứng */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">2. Cấu hình Tài nguyên Phần cứng (CPU / RAM / Disk)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.coresLabel')}</span>
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
                    <span>{t('proxmoxVms.socketsLabel')}</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={formData.sockets}
                    onChange={(e) => setFormData({ ...formData, sockets: e.target.value })}
                    className="input input-sm font-mono"
                  />
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.memoryLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="256"
                    max="131072"
                    step="256"
                    value={formData.memory}
                    onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.diskLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="10000"
                    value={formData.disk}
                    onChange={(e) => setFormData({ ...formData, disk: e.target.value })}
                    className="input input-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.storageLabel')}</span>
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

            {/* Section 3: Mạng & Hệ điều hành */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">3. Mạng & Hệ điều hành (Network & OS)</div>
              <div className="space-y-3">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.isoLabel')}</span>
                  </label>
                  <select
                    value={formData.iso}
                    onChange={(e) => setFormData({ ...formData, iso: e.target.value })}
                    className="input input-sm font-mono text-xs"
                  >
                    <option value="">-- {t('proxmoxVms.isoNone')} --</option>
                    {isoList.map((iso) => (
                      <option key={iso.volid} value={iso.volid}>
                        💿 {iso.volid} ({formatBytes(iso.size)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxVms.netBridgeLabel')}</span>
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
                      <span>{t('proxmoxVms.osTypeLabel')}</span>
                    </label>
                    <select
                      value={formData.ostype}
                      onChange={(e) => setFormData({ ...formData, ostype: e.target.value })}
                      className="input input-sm text-xs"
                    >
                      <option value="l26">Linux 6.x - 2.6 Kernel (l26)</option>
                      <option value="win11">Microsoft Windows 11 / 2022 (win11)</option>
                      <option value="win10">Microsoft Windows 10 / 2016 / 2019 (win10)</option>
                      <option value="other">Other / Solaris / BSD (other)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4: Thẻ Tags & Tùy chọn */}
            <div className="sk-form-section">
              <div className="sk-form-section__title">4. Thẻ phân loại & Khởi động</div>
              <div>
                <label className="sk-label">
                  <span>{t('proxmoxVms.tagsLabel')}</span>
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder={t('proxmoxVms.tagsPlaceholder')}
                  className="input input-sm font-mono text-xs"
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-[var(--text-faint)]">Gợi ý:</span>
                  {PRESET_VM_TAGS.map((tag) => (
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
                  id="vm-start-check"
                  checked={formData.start}
                  onChange={(e) => setFormData({ ...formData, start: e.target.checked })}
                  className="rounded border-[var(--border)] text-[var(--accent)]"
                />
                <label htmlFor="vm-start-check" className="text-xs font-medium text-[var(--text)] cursor-pointer select-none">
                  Tự động khởi động máy ảo ngay sau khi tạo xong (Start after created)
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

      {/* Modal: Sửa Cấu Hình VM */}
      {editVm && (
        <Modal
          open={Boolean(editVm)}
          onClose={() => setEditVm(null)}
          title={t('proxmoxVms.editTitle', { vmid: editVm.vmid, name: editVm.name || `VM-${editVm.vmid}` })}
        >
          <form onSubmit={handleSubmitEdit} className="space-y-4">
            <div className="sk-form-section">
              <div className="sk-form-section__title">Cập nhật Cấu hình Máy ảo</div>
              <div className="space-y-3.5">
                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.nameLabel')}</span>
                    <span className="sk-label-req">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input input-sm"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxVms.coresLabel')}</span>
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
                      <span>{t('proxmoxVms.socketsLabel')}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={formData.sockets}
                      onChange={(e) => setFormData({ ...formData, sockets: e.target.value })}
                      className="input input-sm font-mono"
                    />
                  </div>

                  <div>
                    <label className="sk-label">
                      <span>{t('proxmoxVms.memoryLabel')}</span>
                      <span className="sk-label-req">*</span>
                    </label>
                    <input
                      type="number"
                      min="256"
                      max="131072"
                      step="256"
                      value={formData.memory}
                      onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
                      className="input input-sm font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="sk-label">
                    <span>{t('proxmoxVms.tagsLabel')}</span>
                  </label>
                  <input
                    type="text"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="production, web, db"
                    className="input input-sm font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setEditVm(null)}
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

      {/* Modal: Xác Nhận Xóa VM */}
      {deleteVm && (
        <Modal
          open={Boolean(deleteVm)}
          onClose={() => setDeleteVm(null)}
          title={t('proxmoxVms.deleteTitle', { vmid: deleteVm.vmid })}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs leading-relaxed flex items-start gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
              </svg>
              <div>
                <p className="font-semibold text-rose-300">
                  {t('proxmoxVms.deleteWarning', { vmid: deleteVm.vmid, name: deleteVm.name || `VM-${deleteVm.vmid}` })}
                </p>
                <p className="mt-1 text-[var(--text-dim)]">
                  Mã VMID: <span className="font-mono text-rose-300">#{deleteVm.vmid}</span> | Tên: <span className="font-semibold text-rose-300">{deleteVm.name || '-'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="purge-disk-check"
                checked={purgeDisk}
                onChange={(e) => setPurgeDisk(e.target.checked)}
                className="rounded border-[var(--border)] text-rose-500 focus:ring-0"
              />
              <label htmlFor="purge-disk-check" className="text-xs text-[var(--text)] cursor-pointer select-none">
                {t('proxmoxVms.purgeLabel')}
              </label>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeleteVm(null)}
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
