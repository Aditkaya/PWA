import { useState, useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import './TandaTerimaDetail.css';

interface AmprahanItem {
  id: number;
  nama_barang: string;
  link_barang: string | null;
  jumlah: string;
  satuan: string;
  keterangan: string;
  po_item_id?: number;
  masuk_asset?: boolean;
  asset_id?: number | null;
  nomor_po?: string | null;
}

interface AssetForm {
  po_item_id: number;
  nama_asset: string;
  kategori: string;
  nama_merk: string;
  nomor_seri: string;
  spesifikasi: string;
  kondisi: string;
  lokasi: string;
  lokasi_asset: string;
  keterangan: string;
}

const assetCategories = ['Elektronik', 'Elektronik & IT', 'Kendaraan', 'Alat Berat',
  'Mesin & Peralatan', 'Furniture & Fixture', 'Bangunan & Properti', 'Lain-lain'];
const shipCategories = ['Keselamatan', 'Navigasi', 'Buku', 'Perlengkapan', 'Peta'];
const assetConditions = ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Afkir'];
const shipConditions = ['Belum diketahui', 'Bagus', 'Baru', 'Bekas', 'Bekas/Bagus',
  'Expired Batrai', 'Kurang', 'Kurang Bagus', 'Perlu Servis', 'Rusak', 'SPC/Rusak'];
const shipLocations = ['2 DECK', 'ACOMODATION', 'ANJUNGAN', 'BATH AND AFTER', 'BRIDGE',
  'CABIN', 'CABIN F/P PALKA', 'CO2 ROOM', 'DAPUR', 'DECK', 'DECK BAWAH', 'DECK KANAN',
  'DECK KIRI', 'EMERGENCY ROOM', 'ENGINE ROOM', 'GALERY KABIN', 'HALUAN', 'KAPAL',
  'LAMBUNG KANAN', 'LAMBUNG KIRI', 'MAIN DECK', 'PETA ROOM', 'RALLING', 'SHIP',
  'THIRD DECK', 'TWEEN DECK KIRI'];

interface Permohonan {
  id: number;
  user_id: number;
  kapal_id: number | null;
  jenis_amprahan: string | null;
  status: string;
  keterangan_umum: string;
  created_at: string | null;
  nama_kapal: string | null;
  nomor_voyage: string | null;
  tujuan_permintaan: string | null;
  items: AmprahanItem[];
}

const jenisLabels: Record<string, string> = {
  kapal: 'Kapal',
  kendaraan: 'Kendaraan',
  alat_berat: 'Alat Berat',
  lainnya: 'Lainnya',
};

const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  approved: 'Disetujui',
  partially_approved: 'Disetujui sebagian',
  received: 'Diterima',
  rejected: 'Ditolak',
};

function formatTanggal(value: string | null) {
  if (!value || value.startsWith('0000-00-00')) return 'Tanggal belum tersedia';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime()) || date.getFullYear() < 2000) return 'Tanggal belum tersedia';
  return date.toLocaleString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function TandaTerimaDetail() {
  const { user, token } = useAuthStore();

  const [permohonans, setPermohonans] = useState<Permohonan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);
  const [activeReceiptId, setActiveReceiptId] = useState<number | null>(null);
  const [assetForms, setAssetForms] = useState<AssetForm[]>([]);

  useEffect(() => {
    if (user?.id) fetchData();
    else {
      setError('Data pengguna tidak tersedia. Silakan masuk kembali.');
      setIsLoading(false);
    }
  }, [user?.id, token]);

  const fetchData = async () => {
    if (!user?.id || !token) {
      setError('Data pengguna tidak tersedia. Silakan masuk kembali.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/amprahan/mine', {
        headers: { Authorization: `Bearer ${token || ''}` },
        cache: 'no-store',
      });
      const data = await response.json();
      if (response.ok) {
        setPermohonans(data.data || []);
      } else {
        setError(data.message || 'Gagal memuat permohonan.');
      }
    } catch (error) {
      console.error(error);
      setError('Gagal memuat permohonan.');
    } finally {
      setIsLoading(false);
    }
  };

  const startTerima = (permohonan: Permohonan) => {
    const flagged = permohonan.items.filter(item => item.masuk_asset && !item.asset_id && item.po_item_id);
    if (!flagged.length) {
      void handleTerima(permohonan.id, []);
      return;
    }
    setAssetForms(flagged.map(item => ({
      po_item_id: item.po_item_id!,
      nama_asset: item.nama_barang,
      kategori: '', nama_merk: '', nomor_seri: '', spesifikasi: item.keterangan || '',
      kondisi: '', lokasi: '', lokasi_asset: '', keterangan: '',
    })));
    setActiveReceiptId(permohonan.id);
  };

  const updateAssetForm = (poItemId: number, field: keyof AssetForm, value: string) => {
    setAssetForms(forms => forms.map(form => form.po_item_id === poItemId
      ? field === 'lokasi'
        ? { ...form, lokasi: value, kategori: '', kondisi: '', lokasi_asset: '' }
        : { ...form, [field]: value }
      : form));
  };

  const handleTerima = async (permohonanId: number, assets: AssetForm[]) => {
    if (!window.confirm('Apakah Anda yakin sudah menerima semua barang dari permohonan ini?')) {
      return;
    }

    setIsSubmitting(permohonanId);
    
    try {
      const response = await fetch('/api/amprahan/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token || ''}`,
        },
        body: JSON.stringify({
          permohonan_id: permohonanId,
          assets,
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Berhasil: ' + data.message);
        setPermohonans(prev => prev.map(p => p.id === permohonanId ? { ...p, status: 'received' } : p));
        setActiveReceiptId(null);
        setAssetForms([]);
      } else {
        alert('Gagal: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <div className="tanda-terima-page">
      <div className="tanda-terima-container fade-in">
        <div className="header-section">
          <h2>Tanda Terima Amprahan</h2>
          <p>Permohonan amprahan yang telah Anda buat.</p>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : error ? (
          <div className="empty-state"><p>{error}</p><button type="button" onClick={fetchData}>Coba lagi</button></div>
        ) : permohonans.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={48} className="empty-icon" />
            <h3>Tidak ada data</h3>
            <p>Belum ada permohonan amprahan yang Anda buat.</p>
          </div>
        ) : (
          <div className="permohonan-list">
            {permohonans.map((permohonan) => (
              <div key={permohonan.id} className="permohonan-card">
                <div className="card-header">
                  <div>
                    <h4>Permohonan #{permohonan.id}</h4>
                    <p className="meta-text">{jenisLabels[permohonan.jenis_amprahan || ''] || 'Amprahan'}{permohonan.nama_kapal ? ` · ${permohonan.nama_kapal}` : ''}{permohonan.nomor_voyage ? ` · Voyage ${permohonan.nomor_voyage}` : ''}</p>
                    {permohonan.tujuan_permintaan && <p className="meta-text">Tujuan: {permohonan.tujuan_permintaan}</p>}
                    <p className="meta-text">{formatTanggal(permohonan.created_at)}</p>
                  </div>
                  <div className={`status-badge ${permohonan.status.toLowerCase()}`}>{statusLabels[permohonan.status.toLowerCase()] || permohonan.status}</div>
                </div>

                {permohonan.keterangan_umum && (
                  <div className="keterangan-box">
                    <strong>Catatan:</strong> {permohonan.keterangan_umum}
                  </div>
                )}

                <div className="receipt-items">
                  <h5>Daftar barang</h5>
                  {permohonan.items.map((item, index) => (
                    <div key={item.id} className="receipt-item">
                      <span className="receipt-item-number">{index + 1}</span>
                      <div className="receipt-item-info">
                        <strong>{item.nama_barang}</strong>
                        {item.keterangan && <p>{item.keterangan}</p>}
                        {item.link_barang && <a href={item.link_barang} target="_blank" rel="noreferrer" className="item-link">Lihat referensi barang</a>}
                        {item.masuk_asset && <span className="receipt-asset-tag">{item.asset_id ? 'Sudah masuk aset' : 'Masuk aset saat diterima'}</span>}
                      </div>
                      <span className="receipt-item-amount">{parseFloat(item.jumlah)} {item.satuan}</span>
                    </div>
                  ))}
                </div>

                {['approved', 'partially_approved'].includes(permohonan.status.toLowerCase()) && (
                  <div className="card-footer">
                    {activeReceiptId === permohonan.id ? (
                      <form className="receipt-asset-form" onSubmit={event => { event.preventDefault(); void handleTerima(permohonan.id, assetForms); }}>
                        <h5>Lengkapi data aset</h5>
                        <p>Barang yang dicentang masuk aset pada Purchase Order harus dilengkapi sebelum penerimaan.</p>
                        {assetForms.map((asset, index) => (
                          <fieldset key={asset.po_item_id} className="receipt-asset-fieldset">
                            <legend>Aset {index + 1}: {permohonan.items.find(item => item.po_item_id === asset.po_item_id)?.nama_barang}</legend>
                            <label>Nama aset<input required maxLength={255} value={asset.nama_asset} onChange={e => updateAssetForm(asset.po_item_id, 'nama_asset', e.target.value)} /></label>
                            <label>Kategori<select required value={asset.kategori} onChange={e => updateAssetForm(asset.po_item_id, 'kategori', e.target.value)}><option value="">Pilih kategori</option>{(asset.lokasi === 'Di kapal' ? shipCategories : assetCategories).map(value => <option key={value}>{value}</option>)}</select></label>
                            <label>Kondisi<select required value={asset.kondisi} onChange={e => updateAssetForm(asset.po_item_id, 'kondisi', e.target.value)}><option value="">Pilih kondisi</option>{(asset.lokasi === 'Di kapal' ? shipConditions : assetConditions).map(value => <option key={value}>{value}</option>)}</select></label>
                            <label>Lokasi<select required value={asset.lokasi} onChange={e => updateAssetForm(asset.po_item_id, 'lokasi', e.target.value)}><option value="">Pilih lokasi</option><option>Jakarta</option><option>Batam</option>{permohonan.kapal_id && <option>Di kapal</option>}<option>Di bawa oleh karyawan</option></select></label>
                            <label>Lokasi aset<select value={asset.lokasi_asset} onChange={e => updateAssetForm(asset.po_item_id, 'lokasi_asset', e.target.value)}><option value="">Pilih lokasi aset (opsional)</option>{(asset.lokasi === 'Di kapal' ? shipLocations : ['JKT', 'BTM', 'PNG']).map(value => <option key={value}>{value}</option>)}</select></label>
                            <label>Merk<input maxLength={150} value={asset.nama_merk} onChange={e => updateAssetForm(asset.po_item_id, 'nama_merk', e.target.value)} /></label>
                            <label>Nomor seri<input maxLength={100} value={asset.nomor_seri} onChange={e => updateAssetForm(asset.po_item_id, 'nomor_seri', e.target.value)} /></label>
                            <label className="receipt-asset-wide">Spesifikasi<textarea maxLength={2000} value={asset.spesifikasi} onChange={e => updateAssetForm(asset.po_item_id, 'spesifikasi', e.target.value)} /></label>
                            <label className="receipt-asset-wide">Keterangan<textarea maxLength={5000} value={asset.keterangan} onChange={e => updateAssetForm(asset.po_item_id, 'keterangan', e.target.value)} /></label>
                          </fieldset>
                        ))}
                        <div className="receipt-asset-actions">
                          <button type="button" onClick={() => { setActiveReceiptId(null); setAssetForms([]); }} disabled={isSubmitting !== null}>Batal</button>
                          <button className="btn-terima" type="submit" disabled={isSubmitting !== null}>
                            {isSubmitting === permohonan.id ? <><Loader2 className="spinner" size={18} /> Memproses...</> : <><CheckCircle2 size={18} /> Simpan Aset & Terima Barang</>}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button type="button" className="btn-terima" onClick={() => startTerima(permohonan)} disabled={isSubmitting !== null}>
                        {isSubmitting === permohonan.id ? <><Loader2 className="spinner" size={18} /> Memproses...</> : <><CheckCircle2 size={18} /> Konfirmasi Terima Barang</>}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
