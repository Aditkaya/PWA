import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Search,
  ChevronDown,
  Calendar,
  Clock,
  Plane,
  ClipboardCheck,
  Anchor,
  Map,
  Package,
  CheckCircle,
  XCircle,
  MapPin,
  Building2,
  X,
  Sparkles,
  Check,
  SlidersHorizontal,
  Users,
  Navigation,
  ScanFace,
  ShieldCheck,
  RotateCcw,
  Newspaper,
} from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { useToast } from "../../contexts/ToastContext";
import "./itadmin.css";

// ============================================================
// Types
// ============================================================
type FeatureKey =
  | "izin_sakit"
  | "izin_setengah_hari"
  | "cuti_tahunan"
  | "lupa_absen"
  | "perencanaan_lembur"
  | "approval_karyawan"
  | "stowage_plan"
  | "denah_gudang"
  | "amprahan"
  | "gerak_voyage"
  | "perbarui_wajah"
  | "berita";

interface FeaturePermissions {
  [key: string]: boolean;
}

interface UserItem {
  user_id: number;
  username: string;
  nama_lengkap: string;
  nik: string;
  pekerjaan: string;
  divisi: string;
  cabang: string;
  feature_permissions: FeaturePermissions;
  active_feature_count: number;
}

// ============================================================
// Feature metadata with curated theme colors
// ============================================================
const FEATURES: {
  key: FeatureKey;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { key: "izin_sakit",         label: "Izin Sakit",           desc: "Pengajuan izin tidak masuk / sakit",        icon: <Calendar size={18} />,       color: "#f43f5e" },
  { key: "izin_setengah_hari", label: "Izin 1/2 Hari",        desc: "Pengajuan izin setengah hari kerja",        icon: <Clock size={18} />,          color: "#f59e0b" },
  { key: "cuti_tahunan",       label: "Cuti Tahunan",         desc: "Pengajuan cuti tahunan karyawan",           icon: <Plane size={18} />,          color: "#06b6d4" },
  { key: "lupa_absen",         label: "Lupa Absen",           desc: "Permohonan koreksi lupa absen",            icon: <Clock size={18} />,          color: "#8b5cf6" },
  { key: "perencanaan_lembur", label: "Perencanaan Lembur",   desc: "Membuat jadwal lembur karyawan",           icon: <ClipboardCheck size={18} />, color: "#10b981" },
  { key: "approval_karyawan",  label: "Approval Karyawan",    desc: "Akses persetujuan izin & cuti tim",        icon: <CheckCircle size={18} />,    color: "#6366f1" },
  { key: "stowage_plan",       label: "Stowage Plan",         desc: "Akses modul perencanaan muat kapal",       icon: <Anchor size={18} />,         color: "#14b8a6" },
  { key: "denah_gudang",       label: "Denah Gudang",         desc: "Akses tata letak & kapasitas gudang",      icon: <Map size={18} />,            color: "#3b82f6" },
  { key: "amprahan",           label: "Amprahan",             desc: "Pengajuan & penerimaan barang amprahan",   icon: <Package size={18} />,        color: "#d946ef" },
  { key: "gerak_voyage",       label: "Tanggal Gerak Voyage", desc: "Akses tanggal pergerakan kapal & voyage",  icon: <Navigation size={18} />,     color: "#38bdf8" },
  { key: "perbarui_wajah",     label: "Perbarui Wajah Ulang", desc: "Izin memindai ulang biometrik wajah",      icon: <ScanFace size={18} />,       color: "#10b981" },
  { key: "berita",             label: "Menu Berita",          desc: "Akses membaca berita internal & pamflet",  icon: <Newspaper size={18} />,      color: "#0ea5e9" },
];

const TOTAL_FEATURES = FEATURES.length;

const DEFAULT_FEATURES: FeatureKey[] = [
  "izin_sakit",
  "izin_setengah_hari",
  "cuti_tahunan",
  "lupa_absen",
];

// ============================================================
// Component
// ============================================================
export default function ItAdmin() {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [cabangs, setCabangs] = useState<string[]>([]);
  const [selectedCabang, setSelectedCabang] = useState<string>("ALL");
  const [totalUsersCount, setTotalUsersCount] = useState<number | null>(null);
  const [serverStats, setServerStats] = useState<{ total: number; full_count: number; standard_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // State untuk modal aksi massal seluruh karyawan
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"grant_all" | "set_default">("grant_all");
  const [bulkTargetCabang, setBulkTargetCabang] = useState<string>("ALL");
  const [isSubmittingBulkAll, setIsSubmittingBulkAll] = useState(false);

  // ---- Fetch users ----
  const fetchUsers = useCallback(async (q: string, cabang: string = selectedCabang) => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/it/users?requester_id=${user.id}&search=${encodeURIComponent(q)}&cabang=${encodeURIComponent(cabang)}`
      );
      const data = await res.json();
      if (res.ok) {
        setUsers(data.data || []);
        if (data.cabangs && Array.isArray(data.cabangs)) {
          setCabangs(data.cabangs);
        }
        if (typeof data.total_users === "number") {
          setTotalUsersCount(data.total_users);
        }
        if (data.stats) {
          setServerStats(data.stats);
        }
      } else {
        showToast(data.message || "Gagal mengambil data", "error");
      }
    } catch {
      showToast("Gagal terhubung ke server", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedCabang]);

  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(search, selectedCabang), 300);
    return () => clearTimeout(timer);
  }, [search, selectedCabang, fetchUsers]);

  // ---- Toggle single feature ----
  const handleToggle = async (targetUserId: number, featureKey: FeatureKey, currentValue: boolean) => {
    const key = `${targetUserId}:${featureKey}`;
    setSavingKey(key);

    const newValue = !currentValue;

    // Optimistic update
    setUsers(prev =>
      prev.map(u =>
        u.user_id === targetUserId
          ? {
              ...u,
              feature_permissions: { ...u.feature_permissions, [featureKey]: newValue },
              active_feature_count: u.active_feature_count + (newValue ? 1 : -1),
            }
          : u
      )
    );

    try {
      const res = await fetch("/api/it/feature-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_id: user?.id,
          user_id: targetUserId,
          feature_key: featureKey,
          is_enabled: newValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.message || "Gagal menyimpan", "error");
        // Revert on error
        setUsers(prev =>
          prev.map(u =>
            u.user_id === targetUserId
              ? {
                  ...u,
                  feature_permissions: { ...u.feature_permissions, [featureKey]: currentValue },
                  active_feature_count: u.active_feature_count + (currentValue ? 1 : -1),
                }
              : u
          )
        );
      }
    } catch {
      showToast("Gagal terhubung ke server", "error");
    } finally {
      setSavingKey(null);
    }
  };

  // ---- Set default standard features (Izin Sakit, Izin 1/2 Hari, Cuti, Lupa Absen) ----
  const handleSetDefault = async (targetUserId: number) => {
    const permissions: FeaturePermissions = {};
    FEATURES.forEach(f => {
      permissions[f.key] = DEFAULT_FEATURES.includes(f.key);
    });

    const activeCount = DEFAULT_FEATURES.length;

    // Optimistic update
    setUsers(prev =>
      prev.map(u =>
        u.user_id === targetUserId
          ? { ...u, feature_permissions: { ...permissions }, active_feature_count: activeCount }
          : u
      )
    );

    try {
      const res = await fetch("/api/it/feature-permissions/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: user?.id, user_id: targetUserId, permissions }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.message || "Gagal menyimpan", "error");
      else showToast("Fitur standar (Default) berhasil diterapkan", "success");
    } catch {
      showToast("Gagal terhubung ke server", "error");
    }
  };

  // ---- Bulk enable/disable ----
  const handleBulk = async (targetUserId: number, enableAll: boolean) => {
    const permissions: FeaturePermissions = {};
    FEATURES.forEach(f => { permissions[f.key] = enableAll; });

    // Optimistic update
    setUsers(prev =>
      prev.map(u =>
        u.user_id === targetUserId
          ? { ...u, feature_permissions: { ...permissions }, active_feature_count: enableAll ? TOTAL_FEATURES : 0 }
          : u
      )
    );

    try {
      const res = await fetch("/api/it/feature-permissions/bulk", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester_id: user?.id, user_id: targetUserId, permissions }),
      });
      const data = await res.json();
      if (!res.ok) showToast(data.message || "Gagal menyimpan", "error");
      else showToast(enableAll ? "Semua fitur diaktifkan" : "Semua fitur dinonaktifkan", "success");
    } catch {
      showToast("Gagal terhubung ke server", "error");
    }
  };

  const getInitials = (name: string) =>
    name ? name.trim().split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() : "?";

  // Summary statistics
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total,
        standardCount: serverStats.standard_count,
        fullCount: serverStats.full_count,
        customCount: Math.max(0, serverStats.total - serverStats.standard_count - serverStats.full_count),
      };
    }
    const total = totalUsersCount ?? users.length;
    const standardCount = users.filter(u => u.active_feature_count === DEFAULT_FEATURES.length).length;
    const fullCount = users.filter(u => u.active_feature_count === TOTAL_FEATURES).length;
    const customCount = total - standardCount - fullCount;
    return { total, standardCount, fullCount, customCount };
  }, [users, totalUsersCount, serverStats]);

  // Open modal
  const openBulkAllModal = (action: "grant_all" | "set_default" = "grant_all") => {
    setBulkActionType(action);
    setBulkTargetCabang(selectedCabang);
    setBulkModalOpen(true);
  };

  // Submit bulk all update to backend
  const handleBulkAllSubmit = async () => {
    if (!user?.id) return;
    setIsSubmittingBulkAll(true);
    try {
      const res = await fetch("/api/it/feature-permissions/all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requester_id: user.id,
          cabang: bulkTargetCabang,
          action: bulkActionType,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || "Hak akses massal berhasil diperbarui", "success");
        setBulkModalOpen(false);
        // Refresh users and stats from server
        await fetchUsers(search, selectedCabang);
      } else {
        showToast(data.message || "Gagal menerapkan hak akses massal", "error");
      }
    } catch {
      showToast("Gagal terhubung ke server", "error");
    } finally {
      setIsSubmittingBulkAll(false);
    }
  };

  return (
    <div className="it-admin">
      {/* Header Banner */}
      <div className="it-admin-header">
        <div className="it-admin-header-content">
          <div className="it-admin-header-badge">
            <Shield size={14} />
            <span>MODUL OTORISASI IT</span>
          </div>
          <h1>Kelola Hak Akses Fitur</h1>
          <p>Atur hak akses modul & fitur aplikasi PWA untuk seluruh karyawan</p>
        </div>
      </div>

      {/* Control Bar: Search & Branch Selector */}
      <div className="it-admin-controls">
        {/* Search Box */}
        <div className="it-admin-search-wrapper">
          <div className="it-admin-search-box">
            <Search size={16} className="it-search-icon" />
            <input
              type="text"
              placeholder="Cari nama, NIK, jabatan, atau username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="it-search-clear"
                onClick={() => setSearch("")}
                title="Hapus pencarian"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Cabang Filter Pills */}
        <div className="it-admin-cabang-bar">
          <div className="it-admin-cabang-scroll">
            <button
              type="button"
              className={`it-admin-cabang-pill ${selectedCabang === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedCabang("ALL")}
            >
              <Building2 size={13} />
              <span>Semua Cabang</span>
            </button>
            {cabangs.map(c => (
              <button
                key={c}
                type="button"
                className={`it-admin-cabang-pill ${selectedCabang === c ? "active" : ""}`}
                onClick={() => setSelectedCabang(c)}
              >
                <MapPin size={13} />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats Metric Cards */}
      {!loading && users.length > 0 && (
        <div className="it-admin-stats-strip">
          <div className="it-admin-stat-card">
            <div className="it-admin-stat-header">
              <Users size={13} className="stat-icon stat-icon-blue" />
              <span className="it-admin-stat-label">Total Karyawan</span>
            </div>
            <div className="it-admin-stat-value">{stats.total}</div>
          </div>
          <div className="it-admin-stat-card">
            <div className="it-admin-stat-header">
              <Sparkles size={13} className="stat-icon stat-icon-purple" />
              <span className="it-admin-stat-label">Standar (4)</span>
            </div>
            <div className="it-admin-stat-value">{stats.standardCount}</div>
          </div>
          <div className="it-admin-stat-card">
            <div className="it-admin-stat-header">
              <CheckCircle size={13} className="stat-icon stat-icon-emerald" />
              <span className="it-admin-stat-label">Akses Penuh ({TOTAL_FEATURES})</span>
            </div>
            <div className="it-admin-stat-value">{stats.fullCount}</div>
          </div>
        </div>
      )}

      {/* Global Bulk Action Banner */}
      {!loading && (
        <div className="it-admin-bulk-banner-wrapper">
          <div className="it-admin-bulk-banner">
            <div className="it-admin-bulk-banner-left">
              <div className="it-admin-bulk-banner-badge">
                <ShieldCheck size={14} />
                <span>AKSI MASSAL OTORISASI</span>
              </div>
              <div className="it-admin-bulk-banner-title">
                Pemberian Akses Cepat Seluruh Karyawan
              </div>
              <div className="it-admin-bulk-banner-sub">
                Terapkan izin fitur serentak ke {stats.total} karyawan tanpa perlu mengatur satu per satu.
              </div>
            </div>
            <div className="it-admin-bulk-banner-buttons">
              <button
                type="button"
                className="btn-bulk-banner-primary"
                onClick={() => openBulkAllModal("grant_all")}
                disabled={loading}
              >
                <Sparkles size={15} />
                <span>Beri Full Akses ke Semua Karyawan</span>
              </button>
              <button
                type="button"
                className="btn-bulk-banner-secondary"
                onClick={() => openBulkAllModal("set_default")}
                disabled={loading}
                title="Terapkan 4 fitur standar default ke seluruh karyawan"
              >
                <RotateCcw size={14} />
                <span>Reset Standar Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main List Content */}
      <div className="it-admin-body">
        {loading ? (
          <div className="it-admin-loading">
            <div className="it-admin-spinner" />
            <span>Memuat data perizinan karyawan...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="it-admin-empty">
            <div className="it-admin-empty-icon">
              <XCircle size={32} />
            </div>
            <h3>Tidak Ada Karyawan Ditemukan</h3>
            <p>Coba ubah kata kunci pencarian atau ganti filter cabang.</p>
          </div>
        ) : (
          <div className="it-admin-list">
            {users.map(u => {
              const isExpanded = expandedId === u.user_id;
              const isFull = u.active_feature_count === TOTAL_FEATURES;
              const isDefault = u.active_feature_count === DEFAULT_FEATURES.length;
              const isAllOff = u.active_feature_count === 0;

              return (
                <div
                  key={u.user_id}
                  className={`it-admin-user-card ${isExpanded ? "expanded" : ""}`}
                >
                  {/* Card Header Accordion */}
                  <div
                    className="it-admin-user-header"
                    onClick={() => setExpandedId(isExpanded ? null : u.user_id)}
                  >
                    <div className="it-admin-user-avatar">
                      {getInitials(u.nama_lengkap || u.username)}
                    </div>

                    <div className="it-admin-user-info">
                      <div className="it-admin-user-name">
                        {u.nama_lengkap || u.username}
                      </div>
                      <div className="it-admin-user-meta">
                        {u.nik && <span className="meta-nik">NIK: {u.nik}</span>}
                        {u.pekerjaan && (
                          <>
                            <span className="meta-dot">•</span>
                            <span className="meta-job">{u.pekerjaan}</span>
                          </>
                        )}
                        {u.cabang && (
                          <span className="it-admin-cabang-tag">
                            <MapPin size={10} />
                            {u.cabang}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div className="it-admin-user-status">
                      <span
                        className={`feature-status-badge ${
                          isFull
                            ? "status-full"
                            : isDefault
                            ? "status-default"
                            : isAllOff
                            ? "status-off"
                            : "status-custom"
                        }`}
                      >
                        {u.active_feature_count}/{TOTAL_FEATURES} Fitur
                      </span>
                      <ChevronDown
                        size={18}
                        className={`it-admin-chevron ${isExpanded ? "open" : ""}`}
                      />
                    </div>
                  </div>

                  {/* Expanded Feature Panel */}
                  {isExpanded && (
                    <div className="it-admin-features-panel">
                      {/* Action Bar Header */}
                      <div className="it-admin-panel-top">
                        <div className="it-admin-panel-heading">
                          <SlidersHorizontal size={14} />
                          <span>PENGATURAN HAK AKSES</span>
                        </div>

                        {/* Segmented Quick Actions */}
                        <div className="it-admin-bulk-toolbar">
                          <button
                            type="button"
                            className="btn-quick btn-quick-enable"
                            onClick={() => handleBulk(u.user_id, true)}
                            title="Aktifkan semua 9 fitur"
                          >
                            <Check size={12} />
                            <span>Semua</span>
                          </button>
                          <button
                            type="button"
                            className="btn-quick btn-quick-default"
                            onClick={() => handleSetDefault(u.user_id)}
                            title="Terapkan 4 fitur standar: Izin Sakit, 1/2 Hari, Cuti, Lupa Absen"
                          >
                            <Sparkles size={12} />
                            <span>Set Default</span>
                          </button>
                          <button
                            type="button"
                            className="btn-quick btn-quick-disable"
                            onClick={() => handleBulk(u.user_id, false)}
                            title="Nonaktifkan seluruh fitur"
                          >
                            <X size={12} />
                            <span>Matikan</span>
                          </button>
                        </div>
                      </div>

                      {/* Feature Grid */}
                      <div className="it-admin-feature-grid">
                        {FEATURES.map(f => {
                          const enabled = (f.key === "perbarui_wajah" || f.key === "berita")
                            ? Boolean(u.feature_permissions[f.key])
                            : u.feature_permissions[f.key] !== false;
                          const isLoading = savingKey === `${u.user_id}:${f.key}`;

                          return (
                            <div
                              key={f.key}
                              className={`it-admin-feature-item ${enabled ? "enabled" : "disabled"}`}
                            >
                              <div
                                className="it-feature-icon-wrapper"
                                style={{
                                  backgroundColor: enabled ? `${f.color}18` : "rgba(148, 163, 184, 0.08)",
                                  color: enabled ? f.color : "#64748b",
                                  borderColor: enabled ? `${f.color}35` : "rgba(148, 163, 184, 0.15)",
                                }}
                              >
                                {f.icon}
                              </div>

                              <div className="it-feature-text">
                                <div className="it-feature-title">{f.label}</div>
                                <div className="it-feature-subtitle">{f.desc}</div>
                              </div>

                              <label className="toggle-switch">
                                <input
                                  type="checkbox"
                                  checked={enabled}
                                  disabled={isLoading}
                                  onChange={() => handleToggle(u.user_id, f.key, enabled)}
                                />
                                <span className="toggle-slider" />
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Dialog Konfirmasi Massal */}
      {bulkModalOpen && (
        <div
          className="it-admin-modal-overlay"
          onClick={() => !isSubmittingBulkAll && setBulkModalOpen(false)}
        >
          <div className="it-admin-modal" onClick={e => e.stopPropagation()}>
            <div className="it-admin-modal-header">
              <div className={`it-admin-modal-header-icon ${bulkActionType === "grant_all" ? "icon-grant" : "icon-reset"}`}>
                {bulkActionType === "grant_all" ? <ShieldCheck size={22} /> : <RotateCcw size={22} />}
              </div>
              <div className="it-admin-modal-header-text">
                <h3>
                  {bulkActionType === "grant_all"
                    ? "Konfirmasi Full Akses Karyawan"
                    : "Konfirmasi Reset Standar Fitur"}
                </h3>
                <p>
                  {bulkActionType === "grant_all"
                    ? "Berikan 11 fitur lengkap ke seluruh karyawan sekaligus."
                    : "Kembalikan perizinan ke 4 fitur standar default."}
                </p>
              </div>
              <button
                type="button"
                className="it-admin-modal-close"
                onClick={() => !isSubmittingBulkAll && setBulkModalOpen(false)}
                disabled={isSubmittingBulkAll}
                title="Tutup dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="it-admin-modal-body">
              {/* Scope Selection */}
              <div className="it-admin-modal-section">
                <label className="it-admin-modal-label">Pilih Sasaran Karyawan:</label>
                <div className="it-admin-scope-options">
                  <label className={`it-admin-scope-card ${bulkTargetCabang === "ALL" ? "selected" : ""}`}>
                    <input
                      type="radio"
                      name="bulkCabang"
                      value="ALL"
                      checked={bulkTargetCabang === "ALL"}
                      onChange={() => setBulkTargetCabang("ALL")}
                      disabled={isSubmittingBulkAll}
                    />
                    <div className="scope-card-content">
                      <div className="scope-title">
                        <Users size={15} />
                        <span>Semua Karyawan (Seluruh Cabang)</span>
                      </div>
                      <div className="scope-desc">
                        Total <strong>{stats.total}</strong> karyawan terdaftar di sistem akan diperbarui serentak
                      </div>
                    </div>
                  </label>

                  {selectedCabang !== "ALL" && (
                    <label className={`it-admin-scope-card ${bulkTargetCabang === selectedCabang ? "selected" : ""}`}>
                      <input
                        type="radio"
                        name="bulkCabang"
                        value={selectedCabang}
                        checked={bulkTargetCabang === selectedCabang}
                        onChange={() => setBulkTargetCabang(selectedCabang)}
                        disabled={isSubmittingBulkAll}
                      />
                      <div className="scope-card-content">
                        <div className="scope-title">
                          <MapPin size={15} />
                          <span>Hanya Cabang {selectedCabang}</span>
                        </div>
                        <div className="scope-desc">
                          Hanya karyawan di cabang <strong>{selectedCabang}</strong> yang akan diperbarui
                        </div>
                      </div>
                    </label>
                  )}
                </div>
              </div>

              {/* Features summary badge grid */}
              <div className="it-admin-modal-section">
                <label className="it-admin-modal-label">
                  {bulkActionType === "grant_all"
                    ? `Daftar Fitur yang Diaktifkan Penuh (${TOTAL_FEATURES} Fitur):`
                    : `Daftar Fitur Standar Default (${DEFAULT_FEATURES.length} Fitur):`}
                </label>
                <div className="it-admin-modal-feature-chips">
                  {FEATURES.map(f => {
                    const isIncluded =
                      bulkActionType === "grant_all" || DEFAULT_FEATURES.includes(f.key);
                    return (
                      <div
                        key={f.key}
                        className={`it-modal-chip ${isIncluded ? "active" : "inactive"}`}
                      >
                        <span className="chip-icon">{f.icon}</span>
                        <span className="chip-label">{f.label}</span>
                        {isIncluded ? (
                          <Check size={13} className="chip-check" />
                        ) : (
                          <X size={13} className="chip-x" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notice / Alert */}
              <div className="it-admin-modal-notice">
                <Shield size={16} className="notice-icon" />
                <div className="notice-text">
                  Hak akses akan langsung disimpan ke database server dan aktif saat karyawan membuka aplikasi PWA.
                </div>
              </div>
            </div>

            <div className="it-admin-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setBulkModalOpen(false)}
                disabled={isSubmittingBulkAll}
              >
                Batal
              </button>
              <button
                type="button"
                className={`btn-modal-submit ${bulkActionType === "grant_all" ? "grant-all" : "set-default"}`}
                onClick={handleBulkAllSubmit}
                disabled={isSubmittingBulkAll}
              >
                {isSubmittingBulkAll ? (
                  <>
                    <span className="it-modal-spinner" />
                    <span>Menerapkan ke Database...</span>
                  </>
                ) : (
                  <>
                    {bulkActionType === "grant_all" ? <Sparkles size={16} /> : <RotateCcw size={16} />}
                    <span>
                      {bulkActionType === "grant_all"
                        ? "Ya, Berikan Full Akses Sekarang"
                        : "Ya, Reset ke Standar"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
