import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, ArrowLeft, ChevronRight, CheckCircle, AlertCircle, Info, Ship, Calendar } from "lucide-react";
import "./GerakVoyage.css";

const API = import.meta.env.VITE_API_BASE_URL || "/api";

interface DateFields {
  tanggal_mulai_berlayar: string;
  tanggal_berlabuh: string;
  tanggal_sandar: string;
  tanggal_mulai_bongkar: string;
  tanggal_selesai_bongkar: string;
  tanggal_muat: string;
}

const DATE_LABELS: { key: keyof DateFields; label: string }[] = [
  { key: "tanggal_mulai_berlayar", label: "Mulai Berlayar" },
  { key: "tanggal_berlabuh",       label: "Berlabuh" },
  { key: "tanggal_sandar",         label: "Sandar" },
  { key: "tanggal_mulai_bongkar",  label: "Mulai Bongkar" },
  { key: "tanggal_selesai_bongkar",label: "Selesai Bongkar" },
  { key: "tanggal_muat",           label: "Muat" },
];

const EMPTY_DATES: DateFields = {
  tanggal_mulai_berlayar: "",
  tanggal_berlabuh: "",
  tanggal_sandar: "",
  tanggal_mulai_bongkar: "",
  tanggal_selesai_bongkar: "",
  tanggal_muat: "",
};

export default function GerakVoyage() {
  const navigate = useNavigate();

  const [ships,         setShips]         = useState<string[]>([]);
  const [voyages,       setVoyages]       = useState<string[]>([]);
  const [selectedShip,  setSelectedShip]  = useState("");
  const [selectedVoyage,setSelectedVoyage]= useState("");
  const [dates,         setDates]         = useState<DateFields>({ ...EMPTY_DATES });

  const [loadingShips,  setLoadingShips]  = useState(false);
  const [loadingVoyages,setLoadingVoyages]= useState(false);
  const [loadingData,   setLoadingData]   = useState(false);
  const [saving,        setSaving]        = useState(false);

  const [step,    setStep]    = useState<1 | 2>(1);
  const [alert,   setAlert]   = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
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
    if (!selectedShip) { setVoyages([]); setSelectedVoyage(""); return; }
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
    fetch(`${API}/gerak-voyage?nama_kapal=${encodeURIComponent(selectedShip)}&no_voyage=${encodeURIComponent(selectedVoyage)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.data) {
          const filled: DateFields = { ...EMPTY_DATES };
          for (const k of Object.keys(EMPTY_DATES) as (keyof DateFields)[]) {
            filled[k] = d.data[k] ? d.data[k].substring(0, 10) : "";
          }
          setDates(filled);
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
        setAlert({ type: "success", msg: d.message || "Berhasil disimpan." });
      } else {
        setAlert({ type: "error", msg: d.message || "Gagal menyimpan." });
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

  return (
    <div className="gv-page">

      {/* Back button */}
      <button className="gv-btn-secondary" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
        <ArrowLeft size={18} /> Kembali
      </button>

      {/* Heading */}
      <div className="gv-heading">
        <div className="gv-heading-icon">
          <Anchor size={24} color="white" />
        </div>
        <div>
          <h2>Tanggal Gerak Voyage</h2>
          <p>Atur tanggal pergerakan kapal berdasarkan voyage</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="gv-steps">
        <div className={`gv-step ${step === 1 ? "active" : "done"}`}>
          <div className="gv-step-dot">{step > 1 ? "✓" : "1"}</div>
          <span>Pilih Kapal & Voyage</span>
        </div>
        <div className="gv-step-line" />
        <div className={`gv-step ${step === 2 ? "active" : ""}`}>
          <div className="gv-step-dot">2</div>
          <span>Input Tanggal</span>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`gv-alert ${alert.type}`}>
          {alert.type === "success" && <CheckCircle size={18} />}
          {alert.type === "error"   && <AlertCircle size={18} />}
          {alert.type === "info"    && <Info size={18} />}
          <span>{alert.msg}</span>
        </div>
      )}

      {/* ─── STEP 1: Pilih Kapal & Voyage ─── */}
      {step === 1 && (
        <div className="gv-card">
          <h3><Ship size={18} /> Pilih Kapal &amp; Voyage</h3>

          <div className="gv-field">
            <label>Nama Kapal</label>
            <select
              value={selectedShip}
              onChange={(e) => setSelectedShip(e.target.value)}
              disabled={loadingShips}
            >
              <option value="">{loadingShips ? "Memuat kapal…" : "-- Pilih Kapal --"}</option>
              {ships.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="gv-field">
            <label>
              Nomor Voyage
              {voyages.length > 0 && (
                <span className="gv-badge">{voyages.length} voyage</span>
              )}
            </label>
            <select
              value={selectedVoyage}
              onChange={(e) => setSelectedVoyage(e.target.value)}
              disabled={!selectedShip || loadingVoyages}
            >
              <option value="">
                {!selectedShip
                  ? "Pilih kapal dulu"
                  : loadingVoyages
                  ? "Memuat voyage…"
                  : "-- Pilih Voyage --"}
              </option>
              {voyages.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div className="gv-alert info" style={{ marginTop: 16, marginBottom: 0 }}>
            <Info size={16} />
            <span>Data tanggal akan diterapkan ke semua manifest dengan kapal &amp; voyage yang sama.</span>
          </div>

          <button
            className="gv-btn-primary"
            onClick={handleNext}
            disabled={!selectedShip || !selectedVoyage || loadingData}
          >
            {loadingData ? (
              <>Memuat data…</>
            ) : (
              <>Lanjutkan <ChevronRight size={18} /></>
            )}
          </button>
        </div>
      )}

      {/* ─── STEP 2: Input Tanggal ─── */}
      {step === 2 && (
        <>
          {/* Info kapal terpilih */}
          <div className="gv-card" style={{ padding: "14px 18px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Kapal</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{selectedShip}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Voyage</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{selectedVoyage}</div>
              </div>
              <button className="gv-btn-secondary" onClick={backToStep1} style={{ flexShrink: 0, fontSize: "0.8rem" }}>
                Ubah
              </button>
            </div>
          </div>

          {/* Form tanggal */}
          <div className="gv-card">
            <h3><Calendar size={18} /> Tanggal Pergerakan</h3>
            <div className="gv-dates-grid">
              {DATE_LABELS.map(({ key, label }) => (
                <div className="gv-field" key={key}>
                  <label>{label}</label>
                  <input
                    type="date"
                    value={dates[key]}
                    onChange={(e) => setDates((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            {updatedCount !== null && updatedCount === 0 && (
              <div className="gv-alert info" style={{ marginTop: 12 }}>
                <Info size={16} />
                <span>Tidak ada manifest yang diperbarui. Pastikan nama kapal dan voyage sesuai.</span>
              </div>
            )}

            <button className="gv-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan Tanggal"}
            </button>
          </div>
        </>
      )}

    </div>
  );
}
