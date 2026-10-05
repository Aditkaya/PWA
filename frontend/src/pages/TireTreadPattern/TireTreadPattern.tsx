import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Disc,
  X,
  ChevronRight,
  ChevronLeft,
  CircleDot,
  Search,
  Database,
  Truck,
  Layers,
  Wrench,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Calendar
} from 'lucide-react';
import './TireTreadPattern.css';

interface VehicleCategory {
  id: 'tractor-head' | 'chassis-container' | 'forklift';
  name: string;
  subtitle: string;
  image: string;
  wheelCount: string;
  sourceTable: string;
  filterLabel: string;
  badgeType: 'tractor' | 'buntut' | 'forklift';
  description: string;
  tireInfo: {
    label: string;
    detail: string;
  }[];
}

interface UnitItem {
  id: number;
  kode_no?: string | null;
  nomor_polisi?: string | null;
  no_kir?: string | null;
  nomor_kir?: string | null;
  pajak_kir?: string | null;
  nickname?: string | null;
  merek?: string | null;
  merk?: string | null;
  jenis: string;
  tahun_pembuatan?: string | number | null;
  lokasi?: string | null;
  // Alat berat fields
  kode_alat?: string | null;
  nama?: string | null;
  kapasitas?: string | null;
  tipe?: string | null;
  status?: string | null;
}

const CATEGORIES: VehicleCategory[] = [
  {
    id: 'tractor-head',
    name: 'Tracktor Head',
    subtitle: 'Truk Penarik Kontainer',
    image: '/images/tread-pattern/tractor-head.jpg',
    wheelCount: '10 Roda',
    sourceTable: 'mobils',
    filterLabel: 'TRACTOR HEAD',
    badgeType: 'tractor',
    description: 'Unit penarik kontainer utama (Prime Mover). Menggunakan kombinasi ban alur lurus di kemudi dan balok cakar di roda penggerak.',
    tireInfo: [
      {
        label: 'Roda Depan (Kemudi / Steer)',
        detail: 'Pola Rib (Alur Lurus) - Menjaga stabilitas kemudi dan hemat bahan bakar.'
      },
      {
        label: 'Roda Belakang (Penggerak / Drive)',
        detail: 'Pola Lug (Balok / Cakar) - Menghasilkan daya cengkeram dan traksi maksimal saat menarik beban berat.'
      }
    ]
  },
  {
    id: 'chassis-container',
    name: 'Chassis Kontainer',
    subtitle: 'Sasis Trailer Peti Kemas 20ft / 40ft',
    image: '/images/tread-pattern/container-chassis.jpg',
    wheelCount: '8 - 12 Roda',
    sourceTable: 'mobils',
    filterLabel: 'BUNTUT',
    badgeType: 'buntut',
    description: 'Rangka trailer pengangkut peti kemas. Membutuhkan ban tahan gesekan samping dan tahan panas.',
    tireInfo: [
      {
        label: 'Roda Sasis Trailer',
        detail: 'Pola Trailer Rib - Meredam keausan samping saat belokan dan efisien untuk perjalanan jarak jauh.'
      }
    ]
  },
  {
    id: 'forklift',
    name: 'Forklift',
    subtitle: 'Alat Angkut Gudang & Depo Kontainer',
    image: '/images/tread-pattern/forklift.jpg',
    wheelCount: '4 - 6 Roda',
    sourceTable: 'alat_berats',
    filterLabel: 'FORKLIFT',
    badgeType: 'forklift',
    description: 'Alat angkat operasional gudang dan depo. Menggunakan ban tebal untuk menahan beban angkat vertikal tinggi.',
    tireInfo: [
      {
        label: 'Roda Depan (Beban Utama)',
        detail: 'Pola Heavy Traction Lug - Menopang beban angkat barang dan garpu mast.'
      },
      {
        label: 'Roda Belakang (Kemudi Putar)',
        detail: 'Pola Smooth / Industri - Memudahkan manuver belok sudut sempit di area gudang.'
      }
    ]
  }
];

export default function TireTreadPattern() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | null>(null);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Ambil data dari database sesuai kategori yang dipilih
  useEffect(() => {
    if (!selectedCategory) {
      setUnits([]);
      setSearchQuery('');
      setSelectedUnit(null);
      setErrorMessage(null);
      setCurrentPage(1);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setErrorMessage(null);
    setSearchQuery('');
    setCurrentPage(1);

    fetch(`/api/tire-tread/units?category=${selectedCategory.id}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Gagal memuat data (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.status === 'success' && Array.isArray(json.data)) {
            setUnits(json.data);
          } else {
            setUnits([]);
            setErrorMessage(json.message || 'Tidak ada data ditemukan');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching units:', err);
          setErrorMessage('Terjadi kendala saat menghubungkan ke database server.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory]);

  // Reset halaman ke-1 setiap kali kata kunci pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Filter pencarian berdasarkan nomor polisi, KIR, kode, merek, nama, dsb
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return units;
    const q = searchQuery.toLowerCase();
    return units.filter((u) => {
      const nopol = (u.nomor_polisi || '').toLowerCase();
      const kir = (u.no_kir || u.nomor_kir || '').toLowerCase();
      const kode = (u.kode_no || u.kode_alat || '').toLowerCase();
      const nama = (u.nama || '').toLowerCase();
      const merk = (u.merek || u.merk || '').toLowerCase();
      const jenis = (u.jenis || '').toLowerCase();
      const lokasi = (u.lokasi || '').toLowerCase();
      return (
        nopol.includes(q) ||
        kir.includes(q) ||
        kode.includes(q) ||
        nama.includes(q) ||
        merk.includes(q) ||
        jenis.includes(q) ||
        lokasi.includes(q)
      );
    });
  }, [units, searchQuery]);

  // Hitung total halaman dan potong data 10 item per halaman
  const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE) || 1;

  const paginatedUnits = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUnits.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUnits, currentPage]);

  return (
    <div className="tire-page fade-in">
      {/* ====================================================================
          TAMPILAN 1: Pilihan Kategori Utama (Jika belum memilih unit category)
          ==================================================================== */}
      {!selectedCategory ? (
        <>
          <div className="tire-header-simple">
            <button
              className="btn-back-simple"
              onClick={() => navigate('/')}
              title="Kembali ke Dashboard"
            >
              <ArrowLeft size={16} />
              <span>Kembali</span>
            </button>

            <div className="tire-title-box">
              <h2>
                <Disc size={22} color="#38bdf8" />
                <span>Tire Tread Pattern</span>
              </h2>
              <p>Pilih salah satu armada atau alat di bawah untuk melihat pola ban:</p>
            </div>
          </div>

          <div className="tire-card-list">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="tire-simple-card"
                onClick={() => setSelectedCategory(cat)}
              >
                <div className="card-img-banner">
                  <img src={cat.image} alt={cat.name} loading="lazy" />
                  <div className="card-badge-wheel">
                    <CircleDot
                      size={12}
                      style={{
                        display: 'inline',
                        marginRight: '4px',
                        verticalAlign: '-1px'
                      }}
                    />
                    <span>{cat.wheelCount}</span>
                  </div>
                </div>

                <div className="card-content-simple">
                  <div className="card-text-group">
                    <h3 className="card-simple-title">{cat.name}</h3>
                    <p className="card-simple-desc">{cat.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    className="btn-card-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(cat);
                    }}
                  >
                    <span>Pilih</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* ====================================================================
            TAMPILAN 2: Daftar Unit Sesuai Kategori yang Dipilih dari Database
            ==================================================================== */
        <>
          <div className="tire-header-simple">
            <button
              className="btn-back-simple"
              onClick={() => setSelectedCategory(null)}
              title="Pilih Kategori Lain"
            >
              <ArrowLeft size={16} />
              <span>Ganti Jenis Kategori</span>
            </button>
          </div>

          <div className="unit-list-header">
            <div className="unit-list-top-row">
              <div className="unit-category-heading">
                <div className="unit-category-icon">
                  {selectedCategory.id === 'tractor-head' ? (
                    <Truck size={20} />
                  ) : selectedCategory.id === 'chassis-container' ? (
                    <Layers size={20} />
                  ) : (
                    <Wrench size={20} />
                  )}
                </div>
                <div className="unit-category-title-text">
                  <h3>{selectedCategory.name}</h3>
                  <span>{selectedCategory.subtitle}</span>
                </div>
              </div>

              {!isLoading && (
                <div className="unit-count-badge">
                  <span>{units.length} Unit</span>
                </div>
              )}
            </div>

            {/* Banner Filter Database */}
            <div className="db-source-banner">
              <Database size={15} style={{ flexShrink: 0 }} />
              <div>
                Sumber Database: <strong>Tabel {selectedCategory.sourceTable}</strong> (Hanya menampilkan jenis{' '}
                <strong>{selectedCategory.filterLabel}</strong>)
              </div>
            </div>

            {/* Kotak Pencarian Unit */}
            <div className="unit-search-wrapper">
              <Search size={16} className="unit-search-icon" />
              <input
                type="text"
                className="unit-search-input"
                placeholder={
                  selectedCategory.id === 'tractor-head'
                    ? 'Cari plat nomor, no. KIR, kode unit, atau merek...'
                    : selectedCategory.id === 'chassis-container'
                    ? 'Cari no. KIR, kode sasis, atau plat...'
                    : 'Cari nama alat atau kode forklift...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Kondisi Loading */}
          {isLoading && (
            <div className="unit-state-box">
              <div className="unit-spinner" />
              <span>Memuat data {selectedCategory.name} dari database...</span>
            </div>
          )}

          {/* Kondisi Error */}
          {!isLoading && errorMessage && (
            <div className="unit-state-box">
              <span style={{ color: '#ef4444' }}>{errorMessage}</span>
              <button
                className="btn-back-simple"
                onClick={() => setSelectedCategory({ ...selectedCategory })}
                style={{ alignSelf: 'center', marginTop: '6px' }}
              >
                <RefreshCw size={14} />
                <span>Coba Muat Ulang</span>
              </button>
            </div>
          )}

          {/* Kondisi Data Kosong */}
          {!isLoading && !errorMessage && filteredUnits.length === 0 && (
            <div className="unit-state-box">
              <p style={{ margin: 0 }}>
                {searchQuery
                  ? `Tidak ada unit yang cocok dengan "${searchQuery}".`
                  : `Belum ada unit dengan jenis ${selectedCategory.filterLabel}.`}
              </p>
            </div>
          )}

          {/* Daftar Kartu Unit */}
          {!isLoading && !errorMessage && filteredUnits.length > 0 && (
            <div className="unit-items-container">
              {paginatedUnits.map((u) => {
                const isForklift = selectedCategory.id === 'forklift';
                const isTractorOrChassis = selectedCategory.id === 'tractor-head' || selectedCategory.id === 'chassis-container';
                const platNumber = u.nomor_polisi && u.nomor_polisi !== '0' && u.nomor_polisi.trim() !== '' ? u.nomor_polisi : null;
                const kirNumber = u.no_kir || u.nomor_kir || null;

                const primaryTitle = isForklift
                  ? u.nama || u.kode_alat || `Forklift #${u.id}`
                  : selectedCategory.id === 'tractor-head'
                  ? (platNumber || u.kode_no || `Unit #${u.id}`)
                  : (kirNumber ? `KIR: ${kirNumber}` : (platNumber || u.kode_no || `Sasis #${u.id}`));

                const secondaryCode = isForklift
                  ? u.kode_alat ? `Kode: ${u.kode_alat}` : null
                  : u.kode_no ? `Kode: ${u.kode_no}` : null;

                const brand = u.merek || u.merk || null;
                const capacity = u.kapasitas || null;
                const year = u.tahun_pembuatan || null;

                return (
                  <div
                    key={u.id}
                    className="unit-item-card"
                    onClick={() => setSelectedUnit(u)}
                  >
                    <div className="unit-item-left">
                      <div className="unit-primary-title">
                        <span>{primaryTitle}</span>
                        <span className={`unit-badge-pill ${selectedCategory.badgeType}`}>
                          {u.jenis}
                        </span>
                      </div>

                      {/* Baris Khusus PLAT / KIR untuk Tractor Head & Chassis Kontainer */}
                      {isTractorOrChassis && (
                        <div className="unit-plat-kir-row">
                          <div className="plat-badge">
                            <span className="badge-tag-label">PLAT</span>
                            <span className="plat-val">{platNumber || '-'}</span>
                          </div>
                          <div className="kir-badge">
                            <span className="badge-tag-label">KIR</span>
                            <span className="kir-val">{kirNumber || '-'}</span>
                          </div>
                        </div>
                      )}

                      <div className="unit-meta-row">
                        {secondaryCode && <span>{secondaryCode}</span>}
                        {brand && <span>• Merk: {brand}</span>}
                        {capacity && <span>• Kapasitas: {capacity}</span>}
                        {year && (
                          <span className="unit-meta-item">
                            <Calendar size={12} /> {year}
                          </span>
                        )}
                        {u.lokasi && (
                          <span className="unit-meta-item">
                            <MapPin size={12} /> {u.lokasi}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="unit-item-right">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                );
              })}

              {/* Kontrol Navigasi Halaman (Pagination) */}
              {filteredUnits.length > ITEMS_PER_PAGE && (
                <div className="unit-pagination-container">
                  <span className="pagination-info-text">
                    Menampilkan {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredUnits.length)} dari{' '}
                    {filteredUnits.length} unit
                  </span>

                  <div className="pagination-controls-row">
                    <button
                      className="btn-page-nav"
                      disabled={currentPage === 1}
                      onClick={() => {
                        setCurrentPage((prev) => Math.max(prev - 1, 1));
                        window.scrollTo({ top: 80, behavior: 'smooth' });
                      }}
                    >
                      <ChevronLeft size={16} />
                      <span>Sebelumnya</span>
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <button
                        key={pageNum}
                        className={`btn-page-num ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => {
                          setCurrentPage(pageNum);
                          window.scrollTo({ top: 80, behavior: 'smooth' });
                        }}
                      >
                        {pageNum}
                      </button>
                    ))}

                    <button
                      className="btn-page-nav"
                      disabled={currentPage === totalPages}
                      onClick={() => {
                        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                        window.scrollTo({ top: 80, behavior: 'smooth' });
                      }}
                    >
                      <span>Selanjutnya</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ====================================================================
          MODAL DETAIL UNIT & REKOMENDASI POLA BAN
          ==================================================================== */}
      {selectedUnit && selectedCategory && (
        <div
          className="simple-modal-backdrop fade-in"
          onClick={() => setSelectedUnit(null)}
        >
          <div
            className="simple-modal-box scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="simple-modal-header">
              <h3>
                {selectedCategory.id === 'forklift'
                  ? selectedUnit.nama || selectedUnit.kode_alat
                  : selectedUnit.nomor_polisi || selectedUnit.kode_no}
              </h3>
              <button
                className="btn-close-modal"
                onClick={() => setSelectedUnit(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="simple-modal-body">
              <div className="modal-img-wrap">
                <img src={selectedCategory.image} alt={selectedCategory.name} />
              </div>

              {/* Detail Unit Terpilih */}
              <div className="unit-detail-grid">
                <div className="unit-detail-item">
                  <span className="unit-detail-label">Jenis Armada</span>
                  <span className="unit-detail-val">{selectedUnit.jenis}</span>
                </div>
                <div className="unit-detail-item">
                  <span className="unit-detail-label">
                    {selectedCategory.id === 'forklift' ? 'Kode Alat' : 'Kode No'}
                  </span>
                  <span className="unit-detail-val">
                    {selectedUnit.kode_alat || selectedUnit.kode_no || '-'}
                  </span>
                </div>

                {(selectedCategory.id === 'tractor-head' || selectedCategory.id === 'chassis-container') && (
                  <>
                    <div className="unit-detail-item">
                      <span className="unit-detail-label">Nomor Plat Polisi</span>
                      <span className="unit-detail-val" style={{ color: '#38bdf8' }}>
                        {selectedUnit.nomor_polisi && selectedUnit.nomor_polisi !== '0'
                          ? selectedUnit.nomor_polisi
                          : '-'}
                      </span>
                    </div>
                    <div className="unit-detail-item">
                      <span className="unit-detail-label">Nomor Uji KIR</span>
                      <span className="unit-detail-val" style={{ color: '#34d399' }}>
                        {selectedUnit.no_kir || selectedUnit.nomor_kir || '-'}
                      </span>
                    </div>
                  </>
                )}

                {selectedUnit.lokasi && (
                  <div className="unit-detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="unit-detail-label">Lokasi Operasional</span>
                    <span className="unit-detail-val">{selectedUnit.lokasi}</span>
                  </div>
                )}
              </div>

              {/* Rekomendasi Pola Tapak Ban */}
              <div className="simple-info-block">
                <div className="simple-info-title">
                  Konfigurasi Pola Ban ({selectedCategory.wheelCount})
                </div>
                {selectedCategory.tireInfo.map((info, idx) => (
                  <div key={idx} className="simple-info-row">
                    <span className="simple-row-label">{info.label}</span>
                    <span className="simple-row-value">{info.detail}</span>
                  </div>
                ))}
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.82rem',
                  color: '#10b981'
                }}
              >
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span>Unit terpilih siap untuk modul pemantauan ketebalan & nomor ban.</span>
              </div>
            </div>

            <div className="simple-modal-footer">
              <button
                className="btn-modal-close"
                onClick={() => setSelectedUnit(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
