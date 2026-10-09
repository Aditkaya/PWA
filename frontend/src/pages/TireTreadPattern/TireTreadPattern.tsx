import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Disc,
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
  Calendar,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  CreditCard,
  ShieldCheck,
  Tag
} from 'lucide-react';
import './TireTreadPattern.css';
import VehicleSchematic3D from './VehicleSchematic3D';

export function formatDateIndo(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.trim().split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      if (!isNaN(month) && month >= 1 && month <= 12 && !isNaN(day)) {
        return `${day} ${months[month - 1]} ${year}`;
      }
    }
  } catch {
    // ignore
  }
  return dateStr;
}

export function isKirActive(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  try {
    const kirDate = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return kirDate >= now;
  } catch {
    return false;
  }
}

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
  roda?: number | string | null;
  tahun_pembuatan?: string | number | null;
  lokasi?: string | null;
  // Alat berat fields
  kode_alat?: string | null;
  nama?: string | null;
  kapasitas?: string | null;
  tipe?: string | null;
  status?: string | null;
}

export interface WheelPosition {
  id: string;
  code: string;
  name: string;
  axle: string;
  side: 'kiri' | 'kanan';
  positionType: 'steer' | 'drive' | 'trailer';
  patternName: string;
  description: string;
}

export interface UnitWheelConfig {
  wheelCount: 6 | 8 | 12 | 4;
  title: string;
  badgeLabel: string;
  chassisType: string;
  image3D: string;
  axleSummary: string;
  treadPatternSummary: string;
  wheels: WheelPosition[];
}

/**
 * Logika pengecekan jumlah roda (6 RODA, 8 RODA, atau 12 RODA)
 * mengecek kolom `roda` dari database, nama `jenis`, serta kategori unit.
 */
export function getUnitWheelConfig(unit: UnitItem, categoryId?: string): UnitWheelConfig {
  const rawRoda = Number(unit.roda);
  const jenisUpper = (unit.jenis || '').toUpperCase();

  let count: 6 | 8 | 12 | 4 = 6;

  if (categoryId === 'forklift') {
    count = rawRoda === 6 || jenisUpper.includes('6 TON') || jenisUpper.includes('7 TON') || jenisUpper.includes('10 TON') ? 6 : 4;
  } else if (rawRoda === 12 || jenisUpper.includes('40 FEET') || jenisUpper.includes('40FT') || jenisUpper.includes('12 RODA')) {
    count = 12;
  } else if (rawRoda === 8 || jenisUpper.includes('20 FEET') || jenisUpper.includes('20FT') || jenisUpper.includes('8 RODA')) {
    count = 8;
  } else if (rawRoda === 6 || jenisUpper.includes('TRACTOR') || jenisUpper.includes('TRACKTOR') || jenisUpper.includes('6 RODA') || categoryId === 'tractor-head') {
    count = 6;
  } else if (categoryId === 'chassis-container') {
    count = 8; // default sasis 20ft jika tidak tercatat
  }

  // 1. Konfigurasi 12 RODA (Chassis Kontainer 40 Feet - Tri-Axle)
  if (count === 12) {
    return {
      wheelCount: 12,
      title: 'Denah 3D Chassis 40ft (12 RODA)',
      badgeLabel: '12 RODA • Tri-Axle (3 Gandar Sasis)',
      chassisType: 'Trailer Sasis Kontainer 40 Feet',
      image3D: '/images/tread-pattern/denah-12-roda.jpg',
      axleSummary: '3 Gandar Belakang Tri-Axle dengan Roda Ganda (4 roda per gandar = total 12 roda).',
      treadPatternSummary: 'Seluruh posisi menggunakan Pola Trailer Rib (Alur Lurus Trailer) dengan alur penepis panas dan tahan gesekan lateral.',
      wheels: [
        { id: 'w1', code: 'A1-LO', name: 'Gandar 1 - Kiri Luar', axle: 'Gandar 1 (Depan)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menopang distribusi beban depan trailer & menjaga kestabilan saat manuver.' },
        { id: 'w2', code: 'A1-LI', name: 'Gandar 1 - Kiri Dalam', axle: 'Gandar 1 (Depan)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Roda tandem dalam peredam kejut beban sasis sisi kiri.' },
        { id: 'w3', code: 'A1-RI', name: 'Gandar 1 - Kanan Dalam', axle: 'Gandar 1 (Depan)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Roda tandem dalam peredam kejut beban sasis sisi kanan.' },
        { id: 'w4', code: 'A1-RO', name: 'Gandar 1 - Kanan Luar', axle: 'Gandar 1 (Depan)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menopang distribusi beban depan trailer sisi kanan.' },

        { id: 'w5', code: 'A2-LO', name: 'Gandar 2 - Kiri Luar', axle: 'Gandar 2 (Tengah)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Titik tumpu sentral penahan beban kontainer berat.' },
        { id: 'w6', code: 'A2-LI', name: 'Gandar 2 - Kiri Dalam', axle: 'Gandar 2 (Tengah)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Distribusi beban sentral tengah sisi kiri.' },
        { id: 'w7', code: 'A2-RI', name: 'Gandar 2 - Kanan Dalam', axle: 'Gandar 2 (Tengah)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Distribusi beban sentral tengah sisi kanan.' },
        { id: 'w8', code: 'A2-RO', name: 'Gandar 2 - Kanan Luar', axle: 'Gandar 2 (Tengah)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Titik tumpu sentral penahan beban kontainer sisi kanan.' },

        { id: 'w9', code: 'A3-LO', name: 'Gandar 3 - Kiri Luar', axle: 'Gandar 3 (Belakang)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menahan drag gesekan samping saat manuver tajam dan belokan ekor trailer.' },
        { id: 'w10', code: 'A3-LI', name: 'Gandar 3 - Kiri Dalam', axle: 'Gandar 3 (Belakang)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam torsi gandar paling belakang sisi kiri.' },
        { id: 'w11', code: 'A3-RI', name: 'Gandar 3 - Kanan Dalam', axle: 'Gandar 3 (Belakang)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam torsi gandar paling belakang sisi kanan.' },
        { id: 'w12', code: 'A3-RO', name: 'Gandar 3 - Kanan Luar', axle: 'Gandar 3 (Belakang)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menahan drag torsi manuver putar paling belakang sisi kanan.' }
      ]
    };
  }

  // 2. Konfigurasi 8 RODA (Chassis Kontainer 20 Feet - Tandem 2-Axle)
  if (count === 8) {
    return {
      wheelCount: 8,
      title: 'Denah 3D Chassis 20ft (8 RODA)',
      badgeLabel: '8 RODA • Tandem 2-Axle (2 Gandar Sasis)',
      chassisType: 'Trailer Sasis Kontainer 20 Feet',
      image3D: '/images/tread-pattern/denah-8-roda.jpg',
      axleSummary: '2 Gandar Belakang Tandem dengan Roda Ganda (4 roda per gandar = total 8 roda).',
      treadPatternSummary: 'Seluruh posisi menggunakan Pola Trailer Rib (Alur Lurus Khusus Trailer) tahan gesek dan efisien BBM perjalanan jarak jauh.',
      wheels: [
        { id: 'w1', code: 'A1-LO', name: 'Gandar 1 - Kiri Luar', axle: 'Gandar 1 (Depan)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menerima distribusi beban awal dari kingpin sasis 20ft.' },
        { id: 'w2', code: 'A1-LI', name: 'Gandar 1 - Kiri Dalam', axle: 'Gandar 1 (Depan)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam kejut beban gandeng sisi kiri.' },
        { id: 'w3', code: 'A1-RI', name: 'Gandar 1 - Kanan Dalam', axle: 'Gandar 1 (Depan)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam kejut beban gandeng sisi kanan.' },
        { id: 'w4', code: 'A1-RO', name: 'Gandar 1 - Kanan Luar', axle: 'Gandar 1 (Depan)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menerima distribusi beban awal sisi kanan.' },

        { id: 'w5', code: 'A2-LO', name: 'Gandar 2 - Kiri Luar', axle: 'Gandar 2 (Belakang)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menstabilkan ekor trailer dan menahan gaya seret tikungan.' },
        { id: 'w6', code: 'A2-LI', name: 'Gandar 2 - Kiri Dalam', axle: 'Gandar 2 (Belakang)', side: 'kiri', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam beban statis peti kemas 20ft sisi kiri.' },
        { id: 'w7', code: 'A2-RI', name: 'Gandar 2 - Kanan Dalam', axle: 'Gandar 2 (Belakang)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Peredam beban statis peti kemas 20ft sisi kanan.' },
        { id: 'w8', code: 'A2-RO', name: 'Gandar 2 - Kanan Luar', axle: 'Gandar 2 (Belakang)', side: 'kanan', positionType: 'trailer', patternName: 'Pola Trailer Rib', description: 'Menstabilkan ekor trailer sisi kanan.' }
      ]
    };
  }

  // 3. Konfigurasi 4 RODA (Forklift Standar)
  if (count === 4) {
    return {
      wheelCount: 4,
      title: 'Denah Forklift (4 RODA)',
      badgeLabel: '4 RODA • 2 Beban + 2 Kemudi',
      chassisType: 'Alat Berat Forklift',
      image3D: '/images/tread-pattern/forklift.jpg',
      axleSummary: '1 Gandar Depan Beban (2 Roda) + 1 Gandar Belakang Kemudi Putar (2 Roda).',
      treadPatternSummary: 'Depan menggunakan Pola Heavy Traction Lug, Belakang menggunakan Pola Smooth / Industri.',
      wheels: [
        { id: 'w1', code: 'FL', name: 'Depan Kiri (Beban Utama)', axle: 'Gandar Depan (Beban)', side: 'kiri', positionType: 'drive', patternName: 'Pola Heavy Traction Lug', description: 'Menopang beban angkat garpu mast depan sisi kiri.' },
        { id: 'w2', code: 'FR', name: 'Depan Kanan (Beban Utama)', axle: 'Gandar Depan (Beban)', side: 'kanan', positionType: 'drive', patternName: 'Pola Heavy Traction Lug', description: 'Menopang beban angkat garpu mast depan sisi kanan.' },
        { id: 'w3', code: 'RL', name: 'Belakang Kiri (Kemudi)', axle: 'Gandar Belakang (Kemudi)', side: 'kiri', positionType: 'steer', patternName: 'Pola Smooth / Industri', description: 'Kemudi putar manuver ruang sempit gudang sisi kiri.' },
        { id: 'w4', code: 'RR', name: 'Belakang Kanan (Kemudi)', axle: 'Gandar Belakang (Kemudi)', side: 'kanan', positionType: 'steer', patternName: 'Pola Smooth / Industri', description: 'Kemudi putar manuver ruang sempit gudang sisi kanan.' }
      ]
    };
  }

  // 4. Konfigurasi 6 RODA (Tractor Head Prime Mover)
  return {
    wheelCount: 6,
    title: 'Denah 3D Tractor Head (6 RODA)',
    badgeLabel: '6 RODA • 1 Gandar Steer + 1 Gandar Dual Drive',
    chassisType: 'Truk Prime Mover / Tractor Head',
    image3D: '/images/tread-pattern/denah-6-roda.jpg',
    axleSummary: '1 Gandar Depan Kemudi (2 Roda Single) + 1 Gandar Belakang Penggerak (4 Roda Dual/Ganda).',
    treadPatternSummary: 'Gandar Kemudi wajib Pola Rib (Alur Lurus), Gandar Penggerak wajib Pola Lug (Balok / Cakar) untuk traksi optimal.',
    wheels: [
      { id: 'w1', code: 'FL', name: 'Depan Kiri (Steer / Kemudi)', axle: 'Gandar Depan (Kemudi)', side: 'kiri', positionType: 'steer', patternName: 'Pola Rib (Alur Lurus)', description: 'Kemudi utama sisi kiri, menjaga stabilitas arah jalan tol & manuver.' },
      { id: 'w2', code: 'FR', name: 'Depan Kanan (Steer / Kemudi)', axle: 'Gandar Depan (Kemudi)', side: 'kanan', positionType: 'steer', patternName: 'Pola Rib (Alur Lurus)', description: 'Kemudi utama sisi kanan, menjaga respons setir kemudi.' },
      { id: 'w3', code: 'RL-O', name: 'Belakang Kiri Luar (Drive)', axle: 'Gandar Belakang (Penggerak)', side: 'kiri', positionType: 'drive', patternName: 'Pola Lug (Balok / Cakar)', description: 'Traksi penggerak luar menahan torsi tarikan kontainer.' },
      { id: 'w4', code: 'RL-I', name: 'Belakang Kiri Dalam (Drive)', axle: 'Gandar Belakang (Penggerak)', side: 'kiri', positionType: 'drive', patternName: 'Pola Lug (Balok / Cakar)', description: 'Menopang beban vertikal fifth wheel sisi kiri.' },
      { id: 'w5', code: 'RR-I', name: 'Belakang Kanan Dalam (Drive)', axle: 'Gandar Belakang (Penggerak)', side: 'kanan', positionType: 'drive', patternName: 'Pola Lug (Balok / Cakar)', description: 'Menopang beban vertikal fifth wheel sisi kanan.' },
      { id: 'w6', code: 'RR-O', name: 'Belakang Kanan Luar (Drive)', axle: 'Gandar Belakang (Penggerak)', side: 'kanan', positionType: 'drive', patternName: 'Pola Lug (Balok / Cakar)', description: 'Traksi penggerak luar sisi kanan menahan torsi jalan.' }
    ]
  };
}

const CATEGORIES: VehicleCategory[] = [
  {
    id: 'tractor-head',
    name: 'Tracktor Head',
    subtitle: 'Truk Penarik Kontainer',
    image: '/images/tread-pattern/tractor-head.jpg',
    wheelCount: '6 Roda',
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

  // Posisi Roda yang Sedang Dipilih
  const [selectedWheelId, setSelectedWheelId] = useState<string | null>(null);

  // Toggle Hide / Unhide Bagian Spesifikasi & Rekomendasi Unit
  const [showUnitSpecs, setShowUnitSpecs] = useState<boolean>(true);

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

  // Konfigurasi roda unit yang sedang dipilih di modal
  const selectedWheelConfig = useMemo(() => {
    if (!selectedUnit) return null;
    return getUnitWheelConfig(selectedUnit, selectedCategory?.id);
  }, [selectedUnit, selectedCategory]);

  // Handler saat user memilih unit dari daftar
  const handleSelectUnit = (unit: UnitItem) => {
    setSelectedUnit(unit);
    setSelectedWheelId(null);
  };

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
      ) : selectedUnit && selectedWheelConfig ? (
        /* ====================================================================
            TAMPILAN 3: Full Screen View Detail Denah 3D Unit (Bukan Pop Up)
            ==================================================================== */
        <div className="unit-fullscreen-view fade-in">
          {/* Header Navigasi Kembali */}
          <div className="tire-header-simple">
            <button
              className="btn-back-simple"
              onClick={() => {
                setSelectedUnit(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              title="Kembali ke Daftar Unit"
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Daftar Unit</span>
            </button>
          </div>

          {/* Hero Banner Unit */}
          <div className="unit-hero-card">
            <div className="unit-hero-top">
              <div className="unit-hero-title-box">
                <span className="unit-hero-subtitle">
                  {selectedCategory.name} • {selectedUnit.jenis}
                </span>
                <h2 className="unit-hero-title">
                  {selectedCategory.id === 'forklift'
                    ? selectedUnit.nama || selectedUnit.kode_alat || `Forklift #${selectedUnit.id}`
                    : selectedCategory.id === 'tractor-head'
                      ? (selectedUnit.nomor_polisi && selectedUnit.nomor_polisi !== '0' && selectedUnit.nomor_polisi.trim() !== ''
                          ? selectedUnit.nomor_polisi
                          : selectedUnit.kode_no || `Unit #${selectedUnit.id}`)
                      : (selectedUnit.no_kir || selectedUnit.nomor_kir || selectedUnit.nomor_polisi || selectedUnit.kode_no || `Sasis #${selectedUnit.id}`)}
                </h2>
              </div>
              <div className="unit-hero-badges">
                {selectedUnit.lokasi && (
                  <span className="unit-hero-loc-badge">
                    <MapPin size={12} />
                    <span>{selectedUnit.lokasi}</span>
                  </span>
                )}
                <span className={`badge-roda-tag badge-roda-${selectedWheelConfig.wheelCount} badge-roda-lg`}>
                  {selectedWheelConfig.wheelCount} RODA
                </span>
              </div>
            </div>

            {/* Panel Identitas Armada: Nomor Plat, No. KIR, Masa Berlaku, dan Kode Sasis */}
            {selectedCategory.id === 'forklift' ? (
              <div className="unit-hero-id-grid">
                <div className="hero-id-card hero-id-card--kode">
                  <div className="hero-id-card-top">
                    <Tag size={13} className="hero-id-icon" />
                    <span className="hero-id-label">KODE ALAT</span>
                  </div>
                  <div className="hero-id-card-body">
                    <span className="hero-id-value hero-id-value--code font-mono">
                      {selectedUnit.kode_alat || selectedUnit.kode_no || '-'}
                    </span>
                  </div>
                </div>

                <div className="hero-id-card hero-id-card--plat">
                  <div className="hero-id-card-top">
                    <CreditCard size={13} className="hero-id-icon" />
                    <span className="hero-id-label">NAMA / MODEL</span>
                  </div>
                  <div className="hero-id-card-body">
                    <span className="hero-id-value hero-id-value--plat">
                      {selectedUnit.nama || selectedUnit.merek || selectedUnit.merk || '-'}
                    </span>
                  </div>
                </div>

                <div className="hero-id-card hero-id-card--kir">
                  <div className="hero-id-card-top">
                    <ShieldCheck size={13} className="hero-id-icon" />
                    <span className="hero-id-label">KAPASITAS</span>
                  </div>
                  <div className="hero-id-card-body">
                    <span className="hero-id-value hero-id-value--kir">
                      {selectedUnit.kapasitas || '-'}
                    </span>
                  </div>
                </div>

                {selectedUnit.tipe && (
                  <div className="hero-id-card hero-id-card--expiry">
                    <div className="hero-id-card-top">
                      <Tag size={13} className="hero-id-icon" />
                      <span className="hero-id-label">TIPE UNIT</span>
                    </div>
                    <div className="hero-id-card-body">
                      <span className="hero-id-value hero-id-value--date">
                        {selectedUnit.tipe}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="unit-hero-id-grid">
                {/* 1. NOMOR PLAT / POLISI */}
                <div className="hero-id-card hero-id-card--plat">
                  <div className="hero-id-card-top">
                    <CreditCard size={13} className="hero-id-icon" />
                    <span className="hero-id-label">NO. PLAT POLISI</span>
                  </div>
                  <div className="hero-id-card-body">
                    {selectedUnit.nomor_polisi && selectedUnit.nomor_polisi !== '0' && selectedUnit.nomor_polisi.trim() !== '' ? (
                      <span className="hero-id-value hero-id-value--plat">{selectedUnit.nomor_polisi}</span>
                    ) : (
                      <span className="hero-id-value hero-id-value--subtle">
                        {selectedCategory.id === 'chassis-container' ? '— (Non-Plat)' : '— Belum Terdata'}
                      </span>
                    )}
                  </div>
                </div>

                {/* 2. NOMOR UJI KIR */}
                <div className="hero-id-card hero-id-card--kir">
                  <div className="hero-id-card-top">
                    <ShieldCheck size={13} className="hero-id-icon" />
                    <span className="hero-id-label">NO. UJI KIR</span>
                  </div>
                  <div className="hero-id-card-body">
                    {selectedUnit.no_kir || selectedUnit.nomor_kir ? (
                      <span className="hero-id-value hero-id-value--kir">{selectedUnit.no_kir || selectedUnit.nomor_kir}</span>
                    ) : (
                      <span className="hero-id-value hero-id-value--subtle">—</span>
                    )}
                  </div>
                </div>

                {/* 3. KODE UNIT / SASIS */}
                <div className="hero-id-card hero-id-card--kode">
                  <div className="hero-id-card-top">
                    <Tag size={13} className="hero-id-icon" />
                    <span className="hero-id-label">KODE SASIS</span>
                  </div>
                  <div className="hero-id-card-body">
                    <span className="hero-id-value hero-id-value--code font-mono">
                      {selectedUnit.kode_no || '-'}
                    </span>
                  </div>
                </div>

                {/* 4. MASA BERLAKU / PAJAK KIR */}
                <div className="hero-id-card hero-id-card--expiry">
                  <div className="hero-id-card-top">
                    <Calendar size={13} className="hero-id-icon" />
                    <span className="hero-id-label">MASA BERLAKU KIR</span>
                  </div>
                  <div className="hero-id-card-body">
                    {selectedUnit.pajak_kir ? (
                      <div className="hero-id-expiry-wrap">
                        <span className="hero-id-value hero-id-value--date">
                          {formatDateIndo(selectedUnit.pajak_kir)}
                        </span>
                        <span className={`hero-expiry-badge ${isKirActive(selectedUnit.pajak_kir) ? 'is-valid' : 'is-expired'}`}>
                          {isKirActive(selectedUnit.pajak_kir) ? 'Aktif' : 'Habis'}
                        </span>
                      </div>
                    ) : (
                      <span className="hero-id-value hero-id-value--subtle">Tidak Tercatat</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Visualizer Workbench: 3D Studio, Denah Blueprint 2D, & Inventori Ban Unit */}
          <div className="fade-in" style={{ width: '100%', marginBottom: '16px' }}>
            <VehicleSchematic3D
              wheelCount={selectedWheelConfig.wheelCount}
              selectedWheelId={selectedWheelId}
              onWheelClick={(id) => {
                setSelectedWheelId(id);
              }}
              mobil_id={selectedCategory?.id === 'forklift' ? undefined : selectedUnit.id}
              alat_berat_id={selectedCategory?.id === 'forklift' ? selectedUnit.id : undefined}
              unitName={selectedUnit.nama || selectedUnit.nickname || selectedUnit.nomor_polisi || selectedUnit.kode_alat || selectedUnit.kode_no || selectedUnit.jenis}
              category={selectedCategory?.id}
              wheelConfig={selectedWheelConfig}
            />
          </div>

          {/* Tombol Toggle Hide / Unhide Spesifikasi & Rekomendasi Unit */}
          <div className="unit-specs-toggle-container">
            <button
              type="button"
              className={`btn-toggle-unit-specs ${!showUnitSpecs ? 'is-collapsed' : ''}`}
              onClick={() => setShowUnitSpecs(!showUnitSpecs)}
              title={showUnitSpecs ? 'Sembunyikan Informasi Spesifikasi & Rekomendasi Unit' : 'Tampilkan Informasi Spesifikasi & Rekomendasi Unit'}
            >
              <div className="toggle-specs-left">
                {showUnitSpecs ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>
                  {showUnitSpecs
                    ? 'Sembunyikan Spesifikasi & Rekomendasi Unit'
                    : 'Tampilkan Spesifikasi & Rekomendasi Unit'}
                </span>
              </div>
              <div className="toggle-specs-right">
                <span className="toggle-specs-status">
                  {showUnitSpecs ? 'Hide' : 'Unhide'}
                </span>
                {showUnitSpecs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
          </div>

          {showUnitSpecs && (
            <div className="unit-specs-collapsible-content">
              {/* Detail Spesifikasi Unit */}
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
                    <div className="unit-detail-item">
                      <span className="unit-detail-label">Masa Berlaku KIR</span>
                      <span className="unit-detail-val" style={{ color: '#a78bfa' }}>
                        {selectedUnit.pajak_kir ? formatDateIndo(selectedUnit.pajak_kir) : '-'}
                      </span>
                    </div>
                  </>
                )}

                <div className="unit-detail-item">
                  <span className="unit-detail-label">Jumlah Roda</span>
                  <span className="unit-detail-val" style={{ color: '#fbbf24', fontWeight: 700 }}>
                    {selectedWheelConfig.wheelCount} Roda ({selectedWheelConfig.chassisType})
                  </span>
                </div>

                {selectedUnit.lokasi && (
                  <div className="unit-detail-item">
                    <span className="unit-detail-label">Lokasi Operasional</span>
                    <span className="unit-detail-val">{selectedUnit.lokasi}</span>
                  </div>
                )}
              </div>

              {/* Ringkasan Rekomendasi Pola Tapak Ban */}
              <div className="simple-info-block">
                <div className="simple-info-title">
                  Rekomendasi Pola Tapak Ban ({selectedWheelConfig.wheelCount} RODA)
                </div>
                <div style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.45, marginBottom: '6px' }}>
                  {selectedWheelConfig.treadPatternSummary}
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
                <span>Denah 3D {selectedWheelConfig.wheelCount} RODA siap digunakan untuk pemantauan rotasi & keausan ban.</span>
              </div>
            </div>
          )}

          {/* Tombol Kembali ke Daftar Unit */}
          <div className="unit-bottom-actions">
            <button
              type="button"
              className="btn-back-to-list"
              onClick={() => {
                setSelectedUnit(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <ArrowLeft size={16} />
              <span>Kembali ke Daftar Unit {selectedCategory.name}</span>
            </button>
          </div>
        </div>
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

                // Cek konfigurasi roda unit (6, 8, atau 12 RODA)
                const unitWheel = getUnitWheelConfig(u, selectedCategory.id);

                return (
                  <div
                    key={u.id}
                    className="unit-item-card"
                    onClick={() => handleSelectUnit(u)}
                  >
                    <div className="unit-item-left">
                      <div className="unit-primary-title">
                        <span>{primaryTitle}</span>
                        <span className={`unit-badge-pill ${selectedCategory.badgeType}`}>
                          {u.jenis}
                        </span>
                        {/* Badge jumlah roda terdeteksi */}
                        <span className={`badge-roda-tag badge-roda-${unitWheel.wheelCount}`}>
                          {unitWheel.wheelCount} RODA
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
                          {u.pajak_kir && (
                            <div className="kir-exp-pill">
                              <Calendar size={11} />
                              <span>Exp: {formatDateIndo(u.pajak_kir)}</span>
                            </div>
                          )}
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

      {/* Lightbox modal dihapus – gunakan SVG interaktif langsung di halaman */}
    </div>
  );
}
