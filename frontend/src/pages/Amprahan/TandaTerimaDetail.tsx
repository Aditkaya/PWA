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
  created_at: string;
  nama_kapal: string | null;
  nomor_voyage: string | null;
  tujuan_permintaan: string | null;
  items: AmprahanItem[];
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
                    <h4>ID Permohonan: #{permohonan.id}</h4>
                    <p className="meta-text">{({ kapal: 'Kapal', kendaraan: 'Kendaraan', alat_berat: 'Alat Berat', lainnya: 'Lainnya' } as Record<string, string>)[permohonan.jenis_amprahan || ''] || 'Amprahan'}{permohonan.nama_kapal ? ` · ${permohonan.nama_kapal}` : ''}{permohonan.nomor_voyage ? ` · Voyage ${permohonan.nomor_voyage}` : ''}</p>
                    {permohonan.tujuan_permintaan && <p className="meta-text">Tujuan: {permohonan.tujuan_permintaan}</p>}
                    <p className="meta-text">Tanggal: {new Date(permohonan.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className={`status-badge ${permohonan.status.toLowerCase()}`}>{permohonan.status}</div>
                </div>

                {permohonan.keterangan_umum && (
                  <div className="keterangan-box">
                    <strong>Catatan:</strong> {permohonan.keterangan_umum}
                  </div>
                )}

                <div className="items-table-container">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Nama Barang</th>
                        <th>Link Barang</th>
                        <th>Jumlah</th>
                        <th>Satuan</th>
                        <th>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {permohonan.items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td>{item.nama_barang}</td>
                          <td>
                            {item.link_barang ? (
                              <a href={item.link_barang} target="_blank" rel="noreferrer" className="item-link">
                                Buka link
                              </a>
                            ) : '-'}
                          </td>
                          <td>{parseFloat(item.jumlah)}</td>
                          <td>{item.satuan}</td>
                          <td>{item.keterangan || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
