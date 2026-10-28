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
}

interface Permohonan {
  id: number;
  user_id: number;
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
  const { user } = useAuthStore();

  const [permohonans, setPermohonans] = useState<Permohonan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id) fetchData();
    else {
      setError('Data pengguna tidak tersedia. Silakan masuk kembali.');
      setIsLoading(false);
    }
  }, [user?.id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/amprahan/mine?user_id=${encodeURIComponent(user!.id)}`);
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

  const handleTerima = async (permohonanId: number) => {
    if (!window.confirm('Apakah Anda yakin sudah menerima semua barang dari permohonan ini?')) {
      return;
    }

    setIsSubmitting(permohonanId);
    
    try {
      const response = await fetch('/api/amprahan/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          permohonan_id: permohonanId,
          user_id: user?.id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Berhasil: ' + data.message);
        setPermohonans(prev => prev.map(p => p.id === permohonanId ? { ...p, status: 'received' } : p));
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
                      </div>
                      <span className="receipt-item-amount">{parseFloat(item.jumlah)} {item.satuan}</span>
                    </div>
                  ))}
                </div>

                {permohonan.status.toLowerCase() === 'approved' && <div className="card-footer">
                  <button 
                    className="btn-terima"
                    onClick={() => handleTerima(permohonan.id)}
                    disabled={isSubmitting !== null}
                  >
                    {isSubmitting === permohonan.id ? (
                      <>
                        <Loader2 className="spinner" size={18} />
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={18} />
                        <span>Konfirmasi Terima Barang</span>
                      </>
                    )}
                  </button>
                </div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
