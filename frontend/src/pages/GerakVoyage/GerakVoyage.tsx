import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Anchor,
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Info,
  Ship,
  Calendar,
  Navigation,
  MapPin,
  Truck,
  Package,
  Sparkles,
  RotateCcw,
  Check,
  Compass,
  Zap
} from "lucide-react";
import "./GerakVoyage.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

interface DateFields {
  tanggal_muat: string;
  jam_muat: string;
  tanggal_mulai_berlayar: string;
  jam_mulai_berlayar: string;
  tanggal_berlabuh: string;
  jam_berlabuh: string;
  tanggal_sandar: string;
  jam_sandar: string;
  tanggal_mulai_bongkar: string;
  jam_mulai_bongkar: string;
  tanggal_selesai_bongkar: string;
  jam_selesai_bongkar: string;
}

const DATE_CONFIG: {
  key: keyof DateFields;
  jamKey: keyof DateFields;
  label: string;
  subLabel: string;
  icon: typeof Package;
  color: string;
  step: number;
}[] = [
  {
    key: "tanggal_muat",
    jamKey: "jam_muat",
    label: "Muat",
    subLabel: "Pemuatan barang/kargo ke kapal (OB Muat)",
    icon: Package,
    color: "#06b6d4",
    step: 1,
  },
  {
    key: "tanggal_mulai_berlayar",
    jamKey: "jam_mulai_berlayar",
    label: "Mulai Berlayar",
    subLabel: "Kapal berangkat menuju pelabuhan tujuan",
    icon: Navigation,
    color: "#3b82f6",
    step: 2,
  },
  {
    key: "tanggal_berlabuh",
    jamKey: "jam_berlabuh",
    label: "Berlabuh",
    subLabel: "Kapal tiba di area labuh / lego jangkar",
    icon: Anchor,
    color: "#8b5cf6",
    step: 3,
  },
  {
    key: "tanggal_sandar",
    jamKey: "jam_sandar",
    label: "Sandar",
    subLabel: "Kapal sandar merapat di dermaga",
    icon: MapPin,
    color: "#f59e0b",
    step: 4,
  },
  {
    key: "tanggal_mulai_bongkar",
    jamKey: "jam_mulai_bongkar",
    label: "Mulai Bongkar",
    subLabel: "Proses bongkar kargo dimulai",
    icon: Truck,
    color: "#ec4899",
    step: 5,
  },
  {
    key: "tanggal_selesai_bongkar",
    jamKey: "jam_selesai_bongkar",
    label: "Selesai Bongkar",
    subLabel: "Seluruh muatan selesai dibongkar",
    icon: CheckCircle2,
    color: "#10b981",
    step: 6,
  },
];

const EMPTY_DATES: DateFields = {
  tanggal_muat: "",
  jam_muat: "",
  tanggal_mulai_berlayar: "",
  jam_mulai_berlayar: "",
  tanggal_berlabuh: "",
  jam_berlabuh: "",
  tanggal_sandar: "",
  jam_sandar: "",
  tanggal_mulai_bongkar: "",
  jam_mulai_bongkar: "",
  tanggal_selesai_bongkar: "",
  jam_selesai_bongkar: "",
};

export default function GerakVoyage() {
  const navigate = useNavigate();

  const [ships, setShips] = useState<string[]>([]);
  const [voyages, setVoyages] = useState<string[]>([]);
  const [selectedShip, setSelectedShip] = useState("");
  const [selectedVoyage, setSelectedVoyage] = useState("");
  const [dates, setDates] = useState<DateFields>({ ...EMPTY_DATES });
  const [autoObMuat, setAutoObMuat] = useState<string | null>(null);

  const [loadingShips, setLoadingShips] = useState(false);
  const [loadingVoyages, setLoadingVoyages] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);

  const [step, setStep] = useState<1 | 2>(1);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [updatedCount, setUpdatedCount] = useState<number | null>(null);

  /* ─── Load ships on mount ─── */
  useEffect(() => {
    setLoadingShips(true);
    fetch(`${API}/gerak-voyage/ships`)
      .then((r) => r.json())
      .then((d) => setShips(d.data || []))
      .catch(() => setAlert({ type: "error", msg: "Gagal memuat daftar kapal." }))
      .finally(() => setLoadingShips(false));
  }, []);

  /* ─── Load voyages when ship changes ─── */
  useEffect(() => {
    if (!selectedShip) {
      setVoyages([]);
      setSelectedVoyage("");
      return;
    }
    setLoadingVoyages(true);
    setVoyages([]);
    setSelectedVoyage("");
    fetch(`${API}/gerak-voyage/voyages?nama_kapal=${encodeURIComponent(selectedShip)}`)
      .then((r) => r.json())
      .then((d) => setVoyages(d.data || []))
      .catch(() => setAlert({ type: "error", msg: "Gagal memuat daftar voyage." }))
      .finally(() => setLoadingVoyages(false));
  }, [selectedShip]);

  /* ─── Load saved dates when voyage is chosen ─── */
  const handleNext = () => {
    if (!selectedShip || !selectedVoyage) return;
    setAlert(null);
    setUpdatedCount(null);
    setLoadingData(true);
    setDates({ ...EMPTY_DATES });
    setAutoObMuat(null);

    fetch(
      `${API}/gerak-voyage?nama_kapal=${encodeURIComponent(selectedShip)}&no_voyage=${encodeURIComponent(selectedVoyage)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          const filled: DateFields = { ...EMPTY_DATES };
          for (const k of Object.keys(EMPTY_DATES) as (keyof DateFields)[]) {
            if (k.startsWith("tanggal_")) {
              filled[k] = d.data[k] ? d.data[k].substring(0, 10) : "";
            } else if (k.startsWith("jam_")) {
              filled[k] = d.data[k] ? String(d.data[k]).substring(0, 5) : "";
            }
          }
          setDates(filled);
        }
        if (d.auto_ob_muat) {
          setAutoObMuat(d.auto_ob_muat);
        }
        setStep(2);
      })
      .catch(() => {
        setAlert({ type: "error", msg: "Gagal memuat data tanggal." });
        setStep(2);
      })
      .finally(() => setLoadingData(false));
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    setSaving(true);
    setAlert(null);
    setUpdatedCount(null);
    try {
      const res = await fetch(`${API}/gerak-voyage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama_kapal: selectedShip, no_voyage: selectedVoyage, ...dates }),
      });
      const d = await res.json();
      if (res.ok) {
        setUpdatedCount(d.updated ?? null);
        setAlert({ type: "success", msg: d.message || "Data tanggal gerak voyage berhasil disimpan." });
      } else {
        setAlert({ type: "error", msg: d.message || "Gagal menyimpan tanggal." });
      }
    } catch {
      setAlert({ type: "error", msg: "Terjadi kesalahan jaringan." });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Helpers ─── */
  const backToStep1 = () => {
    setStep(1);
    setAlert(null);
    setUpdatedCount(null);
  };

  const applyAutoObMuat = () => {
    if (autoObMuat) {
      setDates((prev) => ({ ...prev, tanggal_muat: autoObMuat }));
    }
  };

  // Hanya hitung field tanggal (bukan jam) untuk progress badge
  const filledCount = (Object.keys(dates) as (keyof DateFields)[])
    .filter((k) => k.startsWith("tanggal_") && dates[k].trim() !== "").length;

  return (
    <div className="gv-page">
      {/* Top Navbar / Back Button */}
      <div className="gv-header-bar">
        <button className="gv-back-btn" onClick={() => (step === 2 ? backToStep1() : navigate(-1))}>
          <ArrowLeft size={18} />
          <span>{step === 2 ? "Ganti Kapal" : "Kembali"}</span>
        </button>
      </div>

      {/* Main Hero Header */}
      <div className="gv-hero">
        <div className="gv-hero-glow" />
        <div className="gv-hero-icon">
          <Compass size={28} className="gv-icon-spin-slow" />
        </div>
        <div className="gv-hero-text">
          <h2>Tanggal Gerak Voyage</h2>
          <p>Kelola urutan tanggal tahapan perjalanan &amp; muatan kapal</p>
        </div>
      </div>

      {/* Stepper Progress */}
      <div className="gv-stepper">
        <div
          className={`gv-stepper-item ${step === 1 ? "active" : "completed"}`}
          onClick={() => step === 2 && backToStep1()}
          role="button"
          style={{ cursor: step === 2 ? "pointer" : "default" }}
        >
          <div className="gv-stepper-circle">{step > 1 ? <Check size={14} strokeWidth={3} /> : "1"}</div>
          <div className="gv-stepper-label">
            <span className="gv-stepper-num">Langkah 1</span>
            <span className="gv-stepper-title">Pilih Kapal &amp; Voyage</span>
          </div>
        </div>

        <div className="gv-stepper-connector">
          <div className={`gv-stepper-line ${step === 2 ? "filled" : ""}`} />
        </div>

        <div className={`gv-stepper-item ${step === 2 ? "active" : ""}`}>
          <div className="gv-stepper-circle">2</div>
          <div className="gv-stepper-label">
            <span className="gv-stepper-num">Langkah 2</span>
            <span className="gv-stepper-title">Input Urutan Tanggal</span>
          </div>
        </div>
      </div>

      {/* Alert Notification */}
      {alert && (
        <div className={`gv-alert-card ${alert.type} fade-in`}>
          <div className="gv-alert-icon">
            {alert.type === "success" && <CheckCircle2 size={20} />}
            {alert.type === "error" && <AlertCircle size={20} />}
            {alert.type === "info" && <Info size={20} />}
          </div>
          <div className="gv-alert-content">
            <p>{alert.msg}</p>
          </div>
        </div>
      )}

      {/* ──────────────── STEP 1: Pilih Kapal & Voyage ──────────────── */}
      {step === 1 && (
        <div className="gv-card gv-selection-card fade-in">
          <div className="gv-card-header">
            <div className="gv-card-title">
              <Ship size={20} className="gv-accent-icon" />
              <div>
                <h3>Pilih Informasi Pelayaran</h3>
                <p>Tentukan nama armada kapal beserta nomor voyagenya</p>
              </div>
            </div>
          </div>

          <div className="gv-form-group">
            <label className="gv-label">
              <span>Nama Kapal</span>
              {ships.length > 0 && <span className="gv-pill">{ships.length} Kapal</span>}
            </label>
            <div className="gv-input-wrapper">
              <select
                className="gv-select"
                value={selectedShip}
                onChange={(e) => setSelectedShip(e.target.value)}
                disabled={loadingShips}
              >
                <option value="">{loadingShips ? "Memuat armada kapal…" : "-- Pilih Nama Kapal --"}</option>
                {ships.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="gv-form-group">
            <label className="gv-label">
              <span>Nomor Voyage</span>
              {selectedShip && voyages.length > 0 && (
                <span className="gv-pill active">{voyages.length} Voyage Ditemukan</span>
              )}
            </label>
            <div className="gv-input-wrapper">
              <select
                className="gv-select"
                value={selectedVoyage}
                onChange={(e) => setSelectedVoyage(e.target.value)}
                disabled={!selectedShip || loadingVoyages}
              >
                <option value="">
                  {!selectedShip
                    ? "Pilih kapal terlebih dahulu"
                    : loadingVoyages
                    ? "Memuat daftar voyage…"
                    : voyages.length === 0
                    ? "Tidak ada voyage untuk kapal ini"
                    : "-- Pilih Nomor Voyage --"}
                </option>
                {voyages.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="gv-info-box">
            <Info size={18} className="gv-info-icon" />
            <p>
              Tanggal yang Anda inputkan akan diperbarui secara otomatis pada seluruh dokumen manifest sesuai kombinasi{" "}
              <strong>Kapal &amp; Voyage</strong> yang dipilih. Tanggal <strong>MUAT</strong> akan otomatis diambil dari data <strong>OB MUAT</strong>.
            </p>
          </div>

          <button
            className="gv-btn-submit"
            onClick={handleNext}
            disabled={!selectedShip || !selectedVoyage || loadingData}
          >
            {loadingData ? (
              <span>Memuat Data…</span>
            ) : (
              <>
                <span>Lanjutkan ke Pengisian Tanggal</span>
                <ChevronRight size={18} />
              </>
            )}
          </button>
        </div>
      )}

      {/* ──────────────── STEP 2: Input Urutan Tanggal ──────────────── */}
      {step === 2 && (
        <div className="fade-in">
          {/* Active Ship & Voyage Info Banner */}
          <div className="gv-active-banner">
            <div className="gv-active-info">
              <div className="gv-active-item">
                <span className="gv-active-label">Kapal</span>
                <span className="gv-active-val">
                  <Ship size={15} /> {selectedShip}
                </span>
              </div>
              <div className="gv-active-divider" />
              <div className="gv-active-item">
                <span className="gv-active-label">Voyage</span>
                <span className="gv-active-val">
                  <Anchor size={15} /> {selectedVoyage}
                </span>
              </div>
            </div>
            <button className="gv-btn-change" onClick={backToStep1} title="Ganti Kapal / Voyage">
              <RotateCcw size={14} /> Ganti
            </button>
          </div>

          {/* Form Date Fields in Chronological Sequence */}
          <div className="gv-card">
            <div className="gv-card-header gv-card-header-flex">
              <div className="gv-card-title">
                <Calendar size={20} className="gv-accent-icon" />
                <div>
                  <h3>Urutan Kronologis Gerak Voyage</h3>
                  <p>Isi tanggal sesuai tahapan alur operasional perkapalan</p>
                </div>
              </div>
              <div className="gv-progress-badge">
                <Sparkles size={14} />
                <span>{filledCount}/6 Terisi</span>
              </div>
            </div>

            {/* List of 6 stages in exact user sequence */}
            <div className="gv-timeline-list">
              {DATE_CONFIG.map(({ key, jamKey, label, subLabel, icon: Icon, color, step: stepNum }, index) => {
                const isFilled = dates[key].trim() !== "";
                const isMuatField = key === "tanggal_muat";

                return (
                  <div key={key} className={`gv-timeline-card ${isFilled ? "filled" : ""}`}>
                    {/* Left Step Number & Indicator Line */}
                    <div className="gv-timeline-track">
                      <div
                        className="gv-step-badge"
                        style={{
                          background: isFilled ? color : "var(--glass-bg)",
                          borderColor: color,
                          color: isFilled ? "#ffffff" : color,
                        }}
                      >
                        {stepNum}
                      </div>
                      {index < DATE_CONFIG.length - 1 && <div className="gv-track-connector" />}
                    </div>

                    {/* Right Content */}
                    <div className="gv-timeline-body">
                      <div className="gv-timeline-meta">
                        <div className="gv-stage-title-wrap">
                          <div className="gv-stage-icon" style={{ color: color, background: `${color}18` }}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span className="gv-stage-name">{label}</span>
                              {isMuatField && autoObMuat && (
                                <span
                                  className="gv-auto-badge"
                                  title={`Tanggal otomatis terdeteksi dari OB Muat: ${autoObMuat}`}
                                  onClick={applyAutoObMuat}
                                  role="button"
                                >
                                  <Zap size={11} /> Auto OB Muat
                                </span>
                              )}
                            </div>
                            <span className="gv-stage-desc">
                              {isMuatField && autoObMuat && dates.tanggal_muat === autoObMuat ? (
                                <span style={{ color: "#38bdf8" }}>Otomatis tersinkronisasi dari data OB Muat</span>
                              ) : (
                                subLabel
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="gv-date-time-wrap">
                        {/* Input Tanggal */}
                        <div className="gv-date-input-wrap">
                          <input
                            type="date"
                            className="gv-date-input"
                            value={dates[key]}
                            onChange={(e) => setDates((prev) => ({ ...prev, [key]: e.target.value }))}
                          />
                          {dates[key] && (
                            <button
                              type="button"
                              className="gv-clear-date"
                              onClick={() => setDates((prev) => ({ ...prev, [key]: "" }))}
                              title="Hapus tanggal"
                            >
                              ×
                            </button>
                          )}
                        </div>
                        {/* Input Jam */}
                        <div className="gv-time-input-wrap">
                          <input
                            type="time"
                            className="gv-time-input"
                            value={dates[jamKey]}
                            onChange={(e) => setDates((prev) => ({ ...prev, [jamKey]: e.target.value }))}
                          />
                          {dates[jamKey] && (
                            <button
                              type="button"
                              className="gv-clear-date"
                              onClick={() => setDates((prev) => ({ ...prev, [jamKey]: "" }))}
                              title="Hapus jam"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {updatedCount !== null && updatedCount === 0 && (
              <div className="gv-alert-card info" style={{ marginTop: 16 }}>
                <div className="gv-alert-icon">
                  <Info size={18} />
                </div>
                <div className="gv-alert-content">
                  <p>Tidak ada baris manifest yang terupdate. Pastikan nama kapal dan voyage terdaftar.</p>
                </div>
              </div>
            )}

            <button className="gv-btn-submit" onClick={handleSave} disabled={saving} style={{ marginTop: 24 }}>
              {saving ? (
                <span>Menyimpan Perubahan…</span>
              ) : (
                <>
                  <CheckCircle2 size={18} />
                  <span>Simpan Tanggal Gerak Voyage</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
