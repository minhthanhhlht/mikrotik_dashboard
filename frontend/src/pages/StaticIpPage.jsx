import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Modal from '../components/Modal.jsx';

const REFRESH_MS = 15000;

// Helper: Phân tích tags và comment thuần từ comment gốc "[Tag1, Tag2] Ghi chú"
export function parseTagsAndComment(rawComment = '') {
  const text = String(rawComment || '').trim();
  const match = text.match(/^\[(.*?)\]\s*(.*)$/s);
  if (match) {
    const rawTags = match[1]
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      tags: Array.from(new Set(rawTags)),
      cleanComment: match[2].trim(),
    };
  }
  return {
    tags: [],
    cleanComment: text,
  };
}

// Helper: Gom tags và comment thuần thành chuỗi lưu vào MikroTik RouterOS comment
export function formatCommentWithTags(tags = [], cleanComment = '') {
  const validTags = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  const c = (cleanComment || '').trim();
  if (validTags.length > 0) {
    return `[${validTags.join(', ')}] ${c}`.trim();
  }
  return c;
}

// Helper: Màu sắc sinh động cho từng loại thẻ
export function getTagBadgeClass(tag = '') {
  const t = tag.toLowerCase().trim();
  if (t.includes('cam')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  if (t.includes('tv') || t.includes('tivi')) return 'bg-violet-500/15 text-violet-400 border-violet-500/30';
  if (t.includes('vip')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
  if (t.includes('server') || t.includes('nas') || t.includes('proxmox') || t.includes('pve')) {
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  }
  if (t.includes('in') || t.includes('print') || t.includes('pos')) {
    return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
  }
  if (t.includes('khách') || t.includes('living')) return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  if (t.includes('văn phòng') || t.includes('office')) return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
  if (t.includes('tầng') || t.includes('floor')) return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
  if (t.includes('vườn') || t.includes('garden')) return 'bg-lime-500/15 text-lime-400 border-lime-500/30';
  if (t.includes('laptop') || t.includes('pc') || t.includes('máy tính')) {
    return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  }
  if (t.includes('mobile') || t.includes('phone') || t.includes('thoại')) {
    return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  }
  return 'bg-[var(--surface-3)] text-[var(--text-dim)] border-[var(--border)]';
}

// Danh sách thẻ gợi ý nhanh
const PRESET_TAGS = [
  'Camera',
  'Phòng khách',
  'Tầng 1',
  'Tầng 2',
  'Văn phòng',
  'VIP',
  'Server',
  'TV',
  'Máy in',
  'Laptop',
  'Mobile',
  'Sân Vườn',
];

// Helper: Phân loại icon thiết bị dựa vào tên / ghi chú / MAC
function getDeviceIcon(name = '', comment = '') {
  const text = `${name} ${comment}`.toLowerCase();
  if (text.includes('tv') || text.includes('tivi') || text.includes('webos') || text.includes('androidtv') || text.includes('bravia')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-purple-400">
        <rect x="2" y="7" width="20" height="13" rx="2" />
        <path d="M17 2l-5 5-5-5" />
      </svg>
    );
  }
  if (text.includes('cam') || text.includes('dahua') || text.includes('hik') || text.includes('ezviz') || text.includes('imou') || text.includes('camera')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-amber-400">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    );
  }
  if (text.includes('print') || text.includes('in') || text.includes('pos') || text.includes('canon') || text.includes('epson') || text.includes('hp')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-400">
        <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <path d="M6 14h12v8H6z" />
      </svg>
    );
  }
  if (text.includes('phone') || text.includes('iphone') || text.includes('galaxy') || text.includes('xiaomi') || text.includes('oppo') || text.includes('redmi') || text.includes('pixel')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-cyan-400">
        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
        <path d="M12 18h.01" />
      </svg>
    );
  }
  if (text.includes('macbook') || text.includes('laptop') || text.includes('pc') || text.includes('desktop') || text.includes('thinkpad') || text.includes('dell') || text.includes('asus')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-blue-400">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M2 20h20M12 17v3" />
      </svg>
    );
  }
  if (text.includes('server') || text.includes('nas') || text.includes('proxmox') || text.includes('pve') || text.includes('synology') || text.includes('esxi')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-orange-400">
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <circle cx="6" cy="6" r="1" fill="currentColor" />
        <circle cx="6" cy="18" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-400">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 12h12M12 6v12" opacity="0.4" />
    </svg>
  );
}

// Regex validation
const IP_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const MAC_REGEX = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;

// Helper component bọc form field chuẩn ServerKit
function FormField({ label, hint, error, required, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="form-label mb-0 text-xs font-mono font-semibold tracking-wider text-[var(--text-dim)]">
          {label} {required && <span className="text-rose-400">*</span>}
        </label>
        {hint && <span className="text-[11px] font-mono text-[var(--text-faint)]">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-rose-400 font-medium mt-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5 shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

// Helper: Tạo danh sách các số trang kèm dấu chấm lửng thông minh cho pagination
function getPageNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, '...', totalPages];
  }
  if (currentPage >= totalPages - 3) {
    return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
}

export default function StaticIpPage() {
  const { isViewer } = useAuth();
  const { language, t } = useLanguage();
  const isVi = language === 'vi';
  const toast = useToast();

  const [leases, setLeases] = useState([]);
  const [servers, setServers] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'static' | 'dynamic'
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'bound' | 'waiting' | 'disabled'
  const [filterServer, setFilterServer] = useState('all');
  const [filterTag, setFilterTag] = useState('all');

  // Pagination & Scrollable container states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15); // 10, 15, 25, 50, 100, 'all'
  const tableContainerRef = useRef(null);

  // Reset trang về 1 khi người dùng đổi bộ lọc tìm kiếm hoặc kích thước trang
  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, filterStatus, filterServer, filterTag, pageSize]);

  // Modals state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [isCurrentlyDynamic, setIsCurrentlyDynamic] = useState(false);

  // Form Data with Tag array
  const [formData, setFormData] = useState({
    ipAddress: '',
    macAddress: '',
    hostName: '',
    server: 'all',
    tags: [],
    cleanComment: '',
    disabled: false,
  });
  const [tagInputText, setTagInputText] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Make static quick modal
  const [makeStaticModalOpen, setMakeStaticModalOpen] = useState(false);
  const [targetLease, setTargetLease] = useState(null);
  const [makeStaticTags, setMakeStaticTags] = useState([]);
  const [makeStaticComment, setMakeStaticComment] = useState('');
  const [makeStaticTagInput, setMakeStaticTagInput] = useState('');
  const [makingStatic, setMakingStatic] = useState(false);

  // Make dynamic modal
  const [makeDynamicModalOpen, setMakeDynamicModalOpen] = useState(false);
  const [targetDynamicLease, setTargetDynamicLease] = useState(null);
  const [makingDynamic, setMakingDynamic] = useState(false);

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Tải dữ liệu toàn bộ từ Router
  async function loadData(isManual = false) {
    if (isManual) setRefreshing(true);
    setError('');
    try {
      const [leasesRes, serversRes] = await Promise.all([
        api.dhcpLeases().catch(() => []),
        api.dhcpServers().catch(() => []),
      ]);
      setLeases(Array.isArray(leasesRes) ? leasesRes : []);
      setServers(Array.isArray(serversRes) ? serversRes : []);
    } catch (err) {
      setError(err.message || 'Lỗi tải dữ liệu DHCP Leases.');
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData(false);
    const intervalTimer = setInterval(() => loadData(false), REFRESH_MS);
    return () => clearInterval(intervalTimer);
  }, []);

  // Tổng hợp tất cả các Thẻ (Tags) đang có trong toàn hệ thống
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set();
    leases.forEach((l) => {
      const { tags } = parseTagsAndComment(l.comment);
      tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [leases]);

  // Thống kê KPIs
  const stats = useMemo(() => {
    let total = leases.length;
    let staticCount = 0;
    let dynamicCount = 0;
    let activeCount = 0;

    leases.forEach((l) => {
      if (l.dynamic === false || l.dynamic === 'false') staticCount += 1;
      else dynamicCount += 1;
      if (l.status === 'bound') activeCount += 1;
    });

    return { total, staticCount, dynamicCount, activeCount };
  }, [leases]);

  // Lọc danh sách thiết bị
  const filteredLeases = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leases.filter((l) => {
      const { tags, cleanComment } = parseTagsAndComment(l.comment);

      // Filter Type
      const isStatic = l.dynamic === false || l.dynamic === 'false';
      if (filterType === 'static' && !isStatic) return false;
      if (filterType === 'dynamic' && isStatic) return false;

      // Filter Status
      if (filterStatus === 'bound' && l.status !== 'bound') return false;
      if (filterStatus === 'waiting' && l.status === 'bound') return false;
      if (filterStatus === 'disabled' && !l.disabled) return false;

      // Filter Server
      if (filterServer !== 'all' && l.server !== filterServer) return false;

      // Filter Tag
      if (filterTag !== 'all') {
        const hasTag = tags.some((t) => t.toLowerCase() === filterTag.toLowerCase());
        if (!hasTag) return false;
      }

      // Search term
      if (q) {
        const ip = (l.ipAddress || '').toLowerCase();
        const mac = (l.macAddress || '').toLowerCase();
        const host = (l.hostName || '').toLowerCase();
        const comm = (cleanComment || '').toLowerCase();
        const tagsStr = tags.join(' ').toLowerCase();
        if (
          !ip.includes(q) &&
          !mac.includes(q) &&
          !host.includes(q) &&
          !comm.includes(q) &&
          !tagsStr.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [leases, searchTerm, filterType, filterStatus, filterServer, filterTag]);

  // Tính toán số trang và phân trang
  const totalPages = pageSize === 'all'
    ? 1
    : Math.max(1, Math.ceil(filteredLeases.length / Number(pageSize)));

  useEffect(() => {
    if (page > totalPages && totalPages > 0) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const paginatedLeases = useMemo(() => {
    if (pageSize === 'all') return filteredLeases;
    const size = Number(pageSize);
    const start = (page - 1) * size;
    return filteredLeases.slice(start, start + size);
  }, [filteredLeases, page, pageSize]);

  const handlePageChange = (newPage) => {
    const target = Math.max(1, Math.min(totalPages, newPage));
    setPage(target);
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Copy nhanh
  function handleCopy(text, key) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  // Mở modal Thêm mới
  function openAddModal() {
    setIsEditing(false);
    setCurrentId(null);
    setIsCurrentlyDynamic(false);
    setFormData({
      ipAddress: '',
      macAddress: '',
      hostName: '',
      server: servers[0]?.name || 'all',
      tags: [],
      cleanComment: '',
      disabled: false,
    });
    setTagInputText('');
    setFormErrors({});
    setEditModalOpen(true);
  }

  // Mở modal Sửa (áp dụng cho BẤT KỲ thiết bị nào trong bảng, kể cả Dynamic hoặc Static)
  function openEditModal(lease) {
    const isDyn = lease.dynamic !== false && lease.dynamic !== 'false';
    const { tags, cleanComment } = parseTagsAndComment(lease.comment);

    setIsEditing(true);
    setCurrentId(lease.id);
    setIsCurrentlyDynamic(isDyn);
    setFormData({
      ipAddress: lease.ipAddress || '',
      macAddress: lease.macAddress || '',
      hostName: lease.hostName || '',
      server: lease.server || 'all',
      tags: tags || [],
      cleanComment: cleanComment || '',
      disabled: Boolean(lease.disabled),
    });
    setTagInputText('');
    setFormErrors({});
    setEditModalOpen(true);
  }

  // Thao tác với Tags trong Edit Modal
  function handleAddTagToForm(tagName) {
    const tag = (tagName || tagInputText).trim().replace(/[\[\],]/g, '');
    if (!tag) return;
    if (!formData.tags.includes(tag)) {
      setFormData((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInputText('');
  }

  function handleRemoveTagFromForm(tagToRemove) {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  }

  // Validate form
  function validateForm() {
    const errors = {};
    if (!formData.ipAddress || !IP_REGEX.test(formData.ipAddress.trim())) {
      errors.ipAddress = t('staticIp.invalidIp');
    }
    if (!formData.macAddress || !MAC_REGEX.test(formData.macAddress.trim())) {
      errors.macAddress = t('staticIp.invalidMac');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // Lưu tạo mới / sửa
  async function handleSave(e) {
    e.preventDefault();
    if (!validateForm()) return;

    // Tự động gom tagInputText nếu người dùng gõ dở mà chưa nhấn Enter
    let finalTags = [...formData.tags];
    if (tagInputText.trim()) {
      const extra = tagInputText.trim().replace(/[\[\],]/g, '');
      if (extra && !finalTags.includes(extra)) finalTags.push(extra);
    }

    setSaving(true);
    try {
      const combinedComment = formatCommentWithTags(finalTags, formData.cleanComment);
      const payload = {
        ipAddress: formData.ipAddress.trim(),
        macAddress: formData.macAddress.trim().toUpperCase(),
        hostName: formData.hostName.trim(),
        server: formData.server || 'all',
        comment: combinedComment,
        disabled: formData.disabled,
      };

      if (isEditing && currentId) {
        await api.updateDhcpLease(currentId, payload);
        toast.success(t('staticIp.updateSuccess'));
      } else {
        await api.createDhcpLease(payload);
        toast.success(t('staticIp.addSuccess'));
      }

      setEditModalOpen(false);
      await loadData(false);
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu cấu hình IP thiết bị.');
    } finally {
      setSaving(false);
    }
  }

  // Mở modal Make Static nhanh
  function openMakeStaticModal(lease) {
    const { tags, cleanComment } = parseTagsAndComment(lease.comment);
    setTargetLease(lease);
    setMakeStaticTags(tags || []);
    setMakeStaticComment(cleanComment || lease.hostName || '');
    setMakeStaticTagInput('');
    setMakeStaticModalOpen(true);
  }

  // Thực hiện Make Static
  async function handleMakeStaticConfirm() {
    if (!targetLease) return;
    setMakingStatic(true);
    try {
      let finalTags = [...makeStaticTags];
      if (makeStaticTagInput.trim()) {
        const extra = makeStaticTagInput.trim().replace(/[\[\],]/g, '');
        if (extra && !finalTags.includes(extra)) finalTags.push(extra);
      }

      const combinedComment = formatCommentWithTags(finalTags, makeStaticComment);
      await api.makeDhcpLeaseStatic(targetLease.id, { comment: combinedComment });
      toast.success(t('staticIp.makeStaticSuccess'));
      setMakeStaticModalOpen(false);
      await loadData(false);
    } catch (err) {
      toast.error(err.message || 'Lỗi chuyển sang IP tĩnh.');
    } finally {
      setMakingStatic(false);
    }
  }

  // Mở modal Make Dynamic (Chuyển về IP Động)
  function openMakeDynamicModal(lease) {
    setTargetDynamicLease(lease);
    setMakeDynamicModalOpen(true);
  }

  // Thực hiện Make Dynamic (Chuyển về IP Động)
  async function handleMakeDynamicConfirm() {
    if (!targetDynamicLease) return;
    setMakingDynamic(true);
    try {
      await api.makeDhcpLeaseDynamic(targetDynamicLease.id);
      toast.success(t('staticIp.makeDynamicSuccess'));
      setMakeDynamicModalOpen(false);
      await loadData(false);
    } catch (err) {
      toast.error(err.message || 'Lỗi chuyển sang IP động.');
    } finally {
      setMakingDynamic(false);
    }
  }

  // Mở modal Xóa
  function openDeleteModal(lease) {
    setDeleteTarget(lease);
    setDeleteModalOpen(true);
  }

  // Xác nhận Xóa
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDhcpLease(deleteTarget.id);
      toast.success(t('staticIp.deleteSuccess'));
      setDeleteModalOpen(false);
      await loadData(false);
    } catch (err) {
      toast.error(err.message || 'Lỗi xóa DHCP Lease.');
    } finally {
      setDeleting(false);
    }
  }

  // Xuất file Excel / CSV đầy đủ với UTF-8 BOM và Thẻ phân loại (Tags)
  function handleExportExcel() {
    setExporting(true);
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `Danh_sach_IP_Thiet_bi_MikroTik_${dateStr}_${timeStr}.csv`;

      // Header columns
      const headers = [
        'STT',
        'Tên thiết bị (Host Name)',
        'Địa chỉ IP',
        'Địa chỉ MAC',
        'Thẻ phân loại (Tags)',
        'Phân loại (Type)',
        'DHCP Server',
        'Trạng thái (Status)',
        'Hoạt động gần nhất (Last Seen)',
        'Hết hạn sau (Expires After)',
        'Ghi chú (Comment)',
      ];

      // Format rows
      const rows = filteredLeases.map((item, idx) => {
        const isStatic = item.dynamic === false || item.dynamic === 'false';
        const typeLabel = isStatic ? 'Tĩnh (Static)' : 'Động (Dynamic)';
        const statusLabel = item.disabled ? 'Đã khóa (Disabled)' : item.status === 'bound' ? 'Đã cấp (Bound)' : 'Đang chờ (Waiting)';
        const { tags, cleanComment } = parseTagsAndComment(item.comment);

        return [
          idx + 1,
          `"${(item.hostName || '').replace(/"/g, '""')}"`,
          `"${(item.ipAddress || '').replace(/"/g, '""')}"`,
          `"${(item.macAddress || '').replace(/"/g, '""')}"`,
          `"${tags.join('; ').replace(/"/g, '""')}"`,
          `"${typeLabel}"`,
          `"${(item.server || 'all').replace(/"/g, '""')}"`,
          `"${statusLabel}"`,
          `"${(item.lastSeen || '').replace(/"/g, '""')}"`,
          `"${(item.expiresAfter || (isStatic ? 'Vô hạn (never)' : '')).replace(/"/g, '""')}"`,
          `"${(cleanComment || '').replace(/"/g, '""')}"`,
        ].join(',');
      });

      // Tạo chuỗi CSV kèm BOM UTF-8 (\uFEFF) giúp Excel tự nhận dạng đúng Tiếng Việt
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('staticIp.exportSuccess'));
    } catch (err) {
      toast.error('Lỗi khi xuất file Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)]">
              {t('staticIp.title')}
            </h1>
            <span className="sk-tag sk-tag--prod text-xs font-mono">
              /ip/dhcp-server/lease
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[var(--text-dim)]">
            {t('staticIp.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {!isViewer && (
            <button
              onClick={openAddModal}
              className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md hover:shadow-lg transition"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              <span>{t('staticIp.addStaticIp')}</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            disabled={exporting || filteredLeases.length === 0}
            className="btn btn-secondary btn-sm flex items-center gap-1.5 font-medium shadow-sm hover:bg-[var(--surface-hover)] transition disabled:opacity-50"
            title={t('staticIp.exportExcel')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-emerald-400">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>{exporting ? t('staticIp.exportingExcel') : t('staticIp.exportExcel')}</span>
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="btn btn-ghost btn-sm flex items-center gap-1.5 text-[var(--text-dim)] hover:text-[var(--text)]"
            title={t('common.refreshNow')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`h-4 w-4 ${refreshing ? 'animate-spin text-[var(--accent)]' : ''}`}
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
            <span className="hidden sm:inline">{refreshing ? t('common.refreshing') : t('common.refresh')}</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-[var(--radius-md)] border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Top KPI Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Devices */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider">
              {t('staticIp.totalDevices')}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--surface-2)] text-[var(--text-dim)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--text)] tracking-tight">
            {stats.total}
          </div>
          <div className="mt-1 text-[11px] font-mono text-[var(--text-faint)]">
            /ip/dhcp-server/lease
          </div>
        </div>

        {/* Static Leases */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-emerald-500/30 bg-emerald-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              {t('staticIp.staticCount')}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-emerald-500/20 text-emerald-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 tracking-tight">
            {stats.staticCount}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400/80">
            {stats.total > 0 ? t('staticIp.percentOfTotal', { pct: Math.round((stats.staticCount / stats.total) * 100) }) : '0%'}
          </div>
        </div>

        {/* Dynamic Leases */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-cyan-500/30 bg-cyan-500/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
              {t('staticIp.dynamicCount')}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-cyan-500/20 text-cyan-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-cyan-400 tracking-tight">
            {stats.dynamicCount}
          </div>
          <div className="mt-1 text-[11px] text-cyan-400/80">
            {stats.total > 0 ? t('staticIp.percentOfTotal', { pct: Math.round((stats.dynamicCount / stats.total) * 100) }) : '0%'}
          </div>
        </div>

        {/* Active Bound */}
        <div className="relative overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-dim)] uppercase tracking-wider">
              {t('staticIp.activeCount')}
            </span>
            <div className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-emerald-500/10 text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--text)] tracking-tight">
            {stats.activeCount}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-faint)]">
            {t('staticIp.activeDesc')}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar with Tag Filter */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-[var(--text-faint)] z-10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('staticIp.searchPlaceholder')}
            className="form-input text-xs sm:text-sm !pl-10 !pr-9 h-9"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition z-10"
              title="Xóa tìm kiếm"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter Selects */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Filter Tag */}
          <div className="relative min-w-[140px]">
            <select
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              className="form-input text-xs font-medium h-9 pl-3.5 pr-8 appearance-none bg-[var(--surface-2)]"
            >
              <option value="all">🏷️ {t('staticIp.filterTagAll')}</option>
              {allAvailableTags.map((tag) => (
                <option key={tag} value={tag}>
                  🏷️ {tag}
                </option>
              ))}
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Filter Type */}
          <div className="relative min-w-[130px]">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="form-input text-xs font-medium h-9 pl-3.5 pr-8 appearance-none bg-[var(--surface-2)]"
            >
              <option value="all">{t('staticIp.filterAll')}</option>
              <option value="static">{t('staticIp.filterStatic')}</option>
              <option value="dynamic">{t('staticIp.filterDynamic')}</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Filter Status */}
          <div className="relative min-w-[130px]">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input text-xs font-medium h-9 pl-3.5 pr-8 appearance-none bg-[var(--surface-2)]"
            >
              <option value="all">{t('staticIp.filterAllStatus')}</option>
              <option value="bound">{t('staticIp.filterBound')}</option>
              <option value="waiting">{t('staticIp.filterWaiting')}</option>
              <option value="disabled">{t('staticIp.filterDisabled')}</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>

          {/* Filter DHCP Server */}
          {servers.length > 0 && (
            <div className="relative min-w-[135px]">
              <select
                value={filterServer}
                onChange={(e) => setFilterServer(e.target.value)}
                className="form-input text-xs font-medium h-9 pl-3.5 pr-8 appearance-none bg-[var(--surface-2)] font-mono"
              >
                <option value="all">{t('staticIp.filterServerAll')}</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-faint)]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-sm)]">
        {initialLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--text-dim)]">
            <Spinner size="lg" />
            <span className="mt-3 text-sm font-medium">{t('common.loading')}</span>
          </div>
        ) : filteredLeases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-[var(--text-dim)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-10 w-10 text-[var(--text-faint)] mb-2">
              <rect x="2" y="2" width="20" height="8" rx="2" />
              <rect x="2" y="14" width="20" height="8" rx="2" />
              <line x1="6" y1="6" x2="6.01" y2="6" />
              <line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
            <p className="text-sm font-semibold text-[var(--text)]">{t('staticIp.noDevices')}</p>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc thẻ/phân loại.
            </p>
          </div>
        ) : (
          <div ref={tableContainerRef} className="overflow-x-auto overflow-y-auto max-h-[620px] transition-all">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surface-2)] shadow-sm">
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] font-mono">
                  <th className="py-3.5 pl-4 pr-3 bg-[var(--surface-2)]">{t('staticIp.colDevice')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colIp')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colMac')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colType')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colServer')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colStatus')}</th>
                  <th className="py-3.5 px-3 bg-[var(--surface-2)]">{t('staticIp.colExpires')}</th>
                  <th className="py-3.5 pl-3 pr-4 text-right bg-[var(--surface-2)]">{t('staticIp.colActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] text-xs text-[var(--text)]">
                {paginatedLeases.map((lease) => {
                  const isStatic = lease.dynamic === false || lease.dynamic === 'false';
                  const isBound = lease.status === 'bound';
                  const isDisabled = Boolean(lease.disabled);
                  const { tags, cleanComment } = parseTagsAndComment(lease.comment);

                  return (
                    <tr
                      key={lease.id}
                      className="hover:bg-[var(--surface-hover)]/70 transition-colors group"
                    >
                      {/* Device Name, Tags & Comment */}
                      <td className="py-3 pl-4 pr-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] mt-0.5">
                            {getDeviceIcon(lease.hostName, lease.comment)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-[var(--text)] tracking-tight truncate max-w-[180px] sm:max-w-[240px]">
                                {lease.hostName || cleanComment || (
                                  <span className="text-[var(--text-faint)] italic font-normal">
                                    {t('staticIp.unnamedDevice')}
                                  </span>
                                )}
                              </span>

                              {/* Tags Display */}
                              {tags.length > 0 && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {tags.map((tag) => (
                                    <button
                                      key={tag}
                                      onClick={() => setFilterTag(tag)}
                                      className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-semibold border transition hover:opacity-80 cursor-pointer ${getTagBadgeClass(tag)}`}
                                      title={`Lọc theo thẻ: ${tag}`}
                                    >
                                      #{tag}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Clean Comment (không chứa chuỗi tag [Tags]) */}
                            {cleanComment && lease.hostName && (
                              <div className="text-[11px] text-[var(--text-dim)] truncate max-w-[220px] sm:max-w-[300px] mt-0.5">
                                {cleanComment}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* IP Address - Hỗ trợ Click sửa nhanh IP */}
                      <td className="py-3 px-3 font-mono text-[13px] font-semibold text-[var(--text)]">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => !isViewer && openEditModal(lease)}
                            disabled={isViewer}
                            className={`group/ip flex items-center gap-1 text-[var(--accent-bright)] font-bold hover:underline transition ${!isViewer ? 'cursor-pointer' : ''}`}
                            title={!isViewer ? t('staticIp.clickToEditIp') : ''}
                          >
                            <span>{lease.ipAddress}</span>
                            {!isViewer && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3 opacity-0 group-hover/ip:opacity-100 text-[var(--text-faint)] transition">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleCopy(lease.ipAddress, `ip-${lease.id}`)}
                            className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition"
                            title={t('common.copy')}
                          >
                            {copiedKey === `ip-${lease.id}` ? (
                              <span className="text-[10px] text-emerald-400 font-sans font-bold">✓</span>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* MAC Address */}
                      <td className="py-3 px-3 font-mono text-xs text-[var(--text-dim)]">
                        <div className="flex items-center gap-1.5">
                          <span>{lease.macAddress}</span>
                          <button
                            onClick={() => handleCopy(lease.macAddress, `mac-${lease.id}`)}
                            className="p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition"
                            title={t('common.copy')}
                          >
                            {copiedKey === `mac-${lease.id}` ? (
                              <span className="text-[10px] text-emerald-400 font-sans font-bold">✓</span>
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3 w-3">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        {isStatic ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.15)] font-mono">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {t('staticIp.badgeStatic')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                            {t('staticIp.badgeDynamic')}
                          </span>
                        )}
                      </td>

                      {/* Server */}
                      <td className="py-3 px-3">
                        <span className="sk-tag font-mono text-[10px] px-2 py-0.5">
                          {lease.server || 'all'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isDisabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            {t('common.disabled')}
                          </span>
                        ) : isBound ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {t('common.bound')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            {t('common.waiting')}
                          </span>
                        )}
                      </td>

                      {/* Expires / Last seen */}
                      <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-dim)]">
                        {isStatic ? (
                          <span className="text-[var(--text-faint)]">{t('staticIp.never')}</span>
                        ) : (
                          <div>
                            <div>{lease.expiresAfter || '—'}</div>
                            {lease.lastSeen && (
                              <div className="text-[10px] text-[var(--text-faint)]">
                                {t('staticIp.seenPrefix')}{lease.lastSeen}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-3 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Nút Chuyển thành IP Tĩnh (nếu là lease động) */}
                          {!isStatic && !isViewer && (
                            <button
                              onClick={() => openMakeStaticModal(lease)}
                              className="btn btn-secondary btn-xs flex items-center gap-1 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 font-bold font-mono"
                              title="Cố định IP này cho thiết bị"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                              </svg>
                              <span>{t('staticIp.makeStaticShort')}</span>
                            </button>
                          )}

                          {/* Nút Chuyển thành IP Động (nếu là lease tĩnh) */}
                          {isStatic && !isViewer && (
                            <button
                              onClick={() => openMakeDynamicModal(lease)}
                              className="btn btn-secondary btn-xs flex items-center gap-1 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10 font-bold font-mono"
                              title={t('staticIp.makeDynamic')}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3 w-3">
                                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                              </svg>
                              <span>{t('staticIp.makeDynamicShort')}</span>
                            </button>
                          )}

                          {/* Nút Sửa / Chỉnh IP (Áp dụng cho TẤT CẢ các thiết bị trong bảng) */}
                          {!isViewer && (
                            <button
                              onClick={() => openEditModal(lease)}
                              className="btn btn-ghost btn-xs text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] flex items-center gap-1 font-mono"
                              title="Chỉnh sửa IP và gắn thẻ thiết bị"
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              <span className="text-[11px]">{t('staticIp.editIpBtn')}</span>
                            </button>
                          )}

                          {/* Nút Xóa */}
                          {!isViewer && (
                            <button
                              onClick={() => openDeleteModal(lease)}
                              className="btn btn-ghost btn-xs text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 p-1.5"
                              title={t('common.delete')}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Thanh điều khiển phân trang & thông tin số lượng */}
        {!initialLoading && filteredLeases.length > 0 && (
          <div className="border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs">
            {/* Left: Device count range & per-page selection */}
            <div className="flex flex-wrap items-center gap-3 text-[var(--text-dim)]">
              <div>
                {isVi ? 'Hiển thị: ' : 'Showing: '}
                <strong className="text-[var(--text)] font-semibold font-mono">
                  {pageSize === 'all'
                    ? `1 – ${filteredLeases.length}`
                    : `${(page - 1) * Number(pageSize) + 1} – ${Math.min(page * Number(pageSize), filteredLeases.length)}`}
                </strong>
                {' / '}
                <strong className="text-[var(--text)] font-semibold font-mono">{filteredLeases.length}</strong>
                {isVi ? ' thiết bị' : ' devices'}
              </div>

              <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border)]">
                <span className="text-[var(--text-faint)]">{isVi ? 'Mỗi trang:' : 'Per page:'}</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    setPageSize(val);
                  }}
                  className="form-input text-xs !h-7 !py-0 !pl-2 !pr-6 bg-[var(--surface)] border-[var(--border)] font-medium font-mono"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value="all">{isVi ? 'Tất cả' : 'All'}</option>
                </select>
              </div>
            </div>

            {/* Middle: Pagination Navigation */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="btn btn-secondary btn-sm !h-7 !px-2.5 text-xs disabled:opacity-40"
                  title={isVi ? 'Trang trước' : 'Previous page'}
                >
                  ◀ {isVi ? 'Trước' : 'Prev'}
                </button>

                {getPageNumbers(page, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1 text-[var(--text-faint)] font-mono select-none">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePageChange(p)}
                      className={`btn btn-sm !h-7 !min-w-[28px] !px-1.5 text-xs font-mono ${
                        page === p
                          ? 'btn-primary font-bold shadow-sm'
                          : 'btn-secondary hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="btn btn-secondary btn-sm !h-7 !px-2.5 text-xs disabled:opacity-40"
                  title={isVi ? 'Trang sau' : 'Next page'}
                >
                  {isVi ? 'Sau' : 'Next'} ▶
                </button>
              </div>
            )}

            {/* Right: Quick filter stats pills */}
            <div className="hidden md:flex items-center gap-2">
              <span className="sk-pill sk-pill--green !py-0.5 !px-2 text-[11px]">
                <span className="sk-pill__dot" />
                {filteredLeases.filter((l) => l.dynamic === false || l.dynamic === 'false').length} Tĩnh (Static)
              </span>
              <span className="sk-pill !py-0.5 !px-2 text-[11px]">
                <span className="sk-pill__dot" />
                {filteredLeases.filter((l) => l.dynamic !== false && l.dynamic !== 'false').length} Động (Dynamic)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: Thêm mới & Chỉnh sửa IP / Thiết bị / Thẻ Tags */}
      <Modal
        open={editModalOpen}
        title={
          isEditing
            ? t('staticIp.modalEditTitle', { ip: formData.ipAddress })
            : t('staticIp.modalAddTitle')
        }
        onClose={() => !saving && setEditModalOpen(false)}
        maxWidth="max-w-lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              disabled={saving}
              className="btn btn-ghost btn-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-medium shadow-md"
            >
              {saving ? (
                <>
                  <Spinner size="xs" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <span>{isEditing ? t('common.save') : t('common.add')}</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Notice nếu là Dynamic Lease đang được chỉnh sửa IP */}
          {isEditing && isCurrentlyDynamic && (
            <div className="rounded-[var(--radius-sm)] border border-cyan-500/30 bg-cyan-500/10 p-3 flex items-start gap-2.5 text-xs text-cyan-300">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 mt-0.5 text-cyan-400">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>{t('staticIp.changeIpNotice')}</span>
            </div>
          )}

          {/* IP Address */}
          <FormField
            label={t('staticIp.ipAddressLabel')}
            hint="IPv4 (Đổi IP cho thiết bị)"
            required
            error={formErrors.ipAddress}
          >
            <div className="relative">
              <input
                type="text"
                value={formData.ipAddress}
                onChange={(e) => {
                  setFormData({ ...formData, ipAddress: e.target.value });
                  if (formErrors.ipAddress) setFormErrors({ ...formErrors, ipAddress: null });
                }}
                placeholder={t('staticIp.ipAddressPlaceholder')}
                className={`form-input font-mono text-sm font-bold text-[var(--accent-bright)] ${formErrors.ipAddress ? 'border-rose-500 ring-1 ring-rose-500/30' : ''}`}
                required
                autoFocus
              />
            </div>
          </FormField>

          {/* MAC Address */}
          <FormField
            label={t('staticIp.macAddressLabel')}
            hint="Format: XX:XX:XX:XX:XX:XX"
            required
            error={formErrors.macAddress}
          >
            <div className="relative">
              <input
                type="text"
                value={formData.macAddress}
                onChange={(e) => {
                  setFormData({ ...formData, macAddress: e.target.value.toUpperCase() });
                  if (formErrors.macAddress) setFormErrors({ ...formErrors, macAddress: null });
                }}
                placeholder={t('staticIp.macAddressPlaceholder')}
                className={`form-input font-mono text-sm uppercase ${formErrors.macAddress ? 'border-rose-500 ring-1 ring-rose-500/30' : ''}`}
                required
              />
            </div>
          </FormField>

          {/* Thẻ Phân Loại (Tags Management) */}
          <FormField
            label={t('staticIp.tagsLabel')}
            hint={t('staticIp.tagsHint')}
          >
            <div className="space-y-2">
              {/* Active Tags list */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-[var(--radius-sm)] border border-[var(--border-soft)] bg-[var(--surface-2)]">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${getTagBadgeClass(tag)}`}
                    >
                      <span>#{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTagFromForm(tag)}
                        className="p-0.5 hover:text-white rounded-full transition cursor-pointer"
                        title="Xóa thẻ"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input with Enter or Add button */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInputText}
                  onChange={(e) => setTagInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTagToForm();
                    }
                  }}
                  placeholder="Gõ tên thẻ (vd: Camera, Phòng khách) rồi nhấn Enter..."
                  className="form-input text-xs sm:text-sm flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleAddTagToForm()}
                  disabled={!tagInputText.trim()}
                  className="btn btn-secondary btn-sm px-3 text-xs font-mono disabled:opacity-40"
                >
                  {t('staticIp.addTag')}
                </button>
              </div>

              {/* Preset Tags Suggestions */}
              <div className="pt-1">
                <div className="text-[11px] text-[var(--text-faint)] font-mono mb-1.5">
                  {t('staticIp.presetTagsTitle')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_TAGS.map((preset) => {
                    const isSelected = formData.tags.includes(preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (isSelected) handleRemoveTagFromForm(preset);
                          else handleAddTagToForm(preset);
                        }}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition cursor-pointer ${
                          isSelected
                            ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-bold'
                            : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:border-[var(--border-strong)] hover:text-[var(--text)]'
                        }`}
                      >
                        {isSelected ? `✓ ${preset}` : `+ ${preset}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </FormField>

          {/* Host Name */}
          <FormField
            label={t('staticIp.hostNameLabel')}
            hint="Hostname"
          >
            <input
              type="text"
              value={formData.hostName}
              onChange={(e) => setFormData({ ...formData, hostName: e.target.value })}
              placeholder={t('staticIp.hostNamePlaceholder')}
              className="form-input text-sm"
            />
          </FormField>

          {/* DHCP Server */}
          <FormField
            label={t('staticIp.serverLabel')}
            hint="Target DHCP server"
          >
            <div className="relative">
              <select
                value={formData.server}
                onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                className="form-input text-sm appearance-none bg-[var(--surface-2)] pr-8 font-mono"
              >
                <option value="all">all (Tất cả Server)</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)] pointer-events-none">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </FormField>

          {/* Comment / Ghi chú */}
          <FormField
            label={t('staticIp.commentLabel')}
            hint="Mô tả / Nhận diện"
          >
            <input
              type="text"
              value={formData.cleanComment}
              onChange={(e) => setFormData({ ...formData, cleanComment: e.target.value })}
              placeholder={t('staticIp.commentPlaceholder')}
              className="form-input text-sm"
            />
          </FormField>

          {/* Disabled Toggle Card */}
          <div className="pt-1">
            <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-2)] p-3 flex items-center justify-between transition hover:border-[var(--border-strong)]">
              <div>
                <div className="text-xs font-semibold text-[var(--text)]">
                  {t('staticIp.disabledLabel')}
                </div>
                <div className="text-[11px] text-[var(--text-faint)] mt-0.5">
                  Tạm thời khóa hoặc vô hiệu hóa cấu hình lease này
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
                <input
                  type="checkbox"
                  checked={formData.disabled}
                  onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[var(--surface-3)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] border border-[var(--border-strong)]" />
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Make Static Quick Confirmation */}
      <Modal
        open={makeStaticModalOpen}
        title={t('staticIp.modalMakeStaticTitle')}
        onClose={() => !makingStatic && setMakeStaticModalOpen(false)}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMakeStaticModalOpen(false)}
              disabled={makingStatic}
              className="btn btn-ghost btn-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleMakeStaticConfirm}
              disabled={makingStatic}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-medium shadow-md"
            >
              {makingStatic ? (
                <>
                  <Spinner size="xs" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <span>{t('common.confirm')}</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
            {t('staticIp.makeStaticDesc', {
              ip: targetLease?.ipAddress || '',
              mac: targetLease?.macAddress || '',
            })}
          </p>

          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">IP Address:</span>
              <span className="font-bold text-[var(--accent-bright)] text-sm">{targetLease?.ipAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">MAC Address:</span>
              <span className="text-[var(--text)] font-semibold">{targetLease?.macAddress}</span>
            </div>
            {targetLease?.hostName && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-faint)]">Host Name:</span>
                <span className="text-[var(--text)] font-sans font-medium">{targetLease?.hostName}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">DHCP Server:</span>
              <span className="sk-tag text-[10px]">{targetLease?.server || 'all'}</span>
            </div>
          </div>

          {/* Thẻ phân loại nhanh cho Make Static */}
          <FormField
            label={t('staticIp.tagsLabel')}
            hint="Chọn nhanh thẻ phân loại"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TAGS.map((tag) => {
                  const isSelected = makeStaticTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSelected) setMakeStaticTags(makeStaticTags.filter((t) => t !== tag));
                        else setMakeStaticTags([...makeStaticTags, tag]);
                      }}
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)] font-bold'
                          : 'bg-[var(--surface-2)] text-[var(--text-dim)] border-[var(--border)] hover:text-[var(--text)]'
                      }`}
                    >
                      {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </FormField>

          <FormField
            label={t('staticIp.commentLabel')}
            hint="Tùy chọn ghi chú"
          >
            <input
              type="text"
              value={makeStaticComment}
              onChange={(e) => setMakeStaticComment(e.target.value)}
              placeholder={t('staticIp.commentPlaceholder')}
              className="form-input text-xs sm:text-sm"
              autoFocus
            />
          </FormField>
        </div>
      </Modal>

      {/* MODAL 3: Xóa Lease / Static IP */}
      <Modal
        open={deleteModalOpen}
        title={t('common.delete')}
        onClose={() => !deleting && setDeleteModalOpen(false)}
        maxWidth="max-w-sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deleting}
              className="btn btn-ghost btn-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="btn btn-danger btn-sm flex items-center gap-1.5 shadow-md"
            >
              {deleting ? (
                <>
                  <Spinner size="xs" />
                  <span>{t('common.deleting')}</span>
                </>
              ) : (
                <span>{t('common.delete')}</span>
              )}
            </button>
          </>
        }
      >
        <p className="text-xs sm:text-sm text-[var(--text)] leading-relaxed">
          {deleteTarget?.dynamic === false || deleteTarget?.dynamic === 'false'
            ? t('staticIp.deleteConfirm', {
                ip: deleteTarget?.ipAddress || '',
                mac: deleteTarget?.macAddress || '',
              })
            : t('staticIp.deleteDynamicConfirm', {
                ip: deleteTarget?.ipAddress || '',
                mac: deleteTarget?.macAddress || '',
              })}
        </p>
      </Modal>

      {/* MODAL 4: Make Dynamic Confirmation */}
      <Modal
        open={makeDynamicModalOpen}
        title={t('staticIp.modalMakeDynamicTitle')}
        onClose={() => !makingDynamic && setMakeDynamicModalOpen(false)}
        maxWidth="max-w-md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setMakeDynamicModalOpen(false)}
              disabled={makingDynamic}
              className="btn btn-ghost btn-sm"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleMakeDynamicConfirm}
              disabled={makingDynamic}
              className="btn btn-primary btn-sm flex items-center gap-1.5 font-medium shadow-md bg-cyan-600 hover:bg-cyan-500 border-cyan-500"
            >
              {makingDynamic ? (
                <>
                  <Spinner size="xs" />
                  <span>{t('common.saving')}</span>
                </>
              ) : (
                <span>{t('common.confirm')}</span>
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-[var(--text-dim)] leading-relaxed">
            {t('staticIp.makeDynamicDesc', {
              ip: targetDynamicLease?.ipAddress || '',
              mac: targetDynamicLease?.macAddress || '',
            })}
          </p>

          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-2)] p-3.5 space-y-2 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">IP Address:</span>
              <span className="font-bold text-cyan-400 text-sm">{targetDynamicLease?.ipAddress}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">MAC Address:</span>
              <span className="text-[var(--text)] font-semibold">{targetDynamicLease?.macAddress}</span>
            </div>
            {targetDynamicLease?.hostName && (
              <div className="flex justify-between items-center">
                <span className="text-[var(--text-faint)]">Host Name:</span>
                <span className="text-[var(--text)] font-sans font-medium">{targetDynamicLease?.hostName}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-[var(--text-faint)]">DHCP Server:</span>
              <span className="sk-tag text-[10px]">{targetDynamicLease?.server || 'all'}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
