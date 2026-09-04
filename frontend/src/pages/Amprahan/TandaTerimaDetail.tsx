import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ship, Navigation2, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import './TandaTerimaDetail.css';

interface AmprahanItem {
  id: number;
  nama_barang: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
}

interface Permohonan {
  id: number;
  user_id: number;
  user_nama: string;
  status: string;
  keterangan_umum: string;
  created_at: string;
  items: AmprahanItem[];
}

export default function TandaTerimaDetail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const state = location.state as {
    kapalId: string;
    kapalName: string;
    nomorVoyage: string;
  };

  if (!state) {
    navigate('/amprahan/tanda-terima');
    return null;
  }

  const [permohonans, setPermohonans] = useState<Permohonan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/amprahan/approved?kapal_id=${state.kapalId}&nomor_voyage=${state.nomorVoyage}`);
      const data = await response.json();
      if (response.ok) {
        setPermohonans(data.data || []);
      }
    } catch (error) {
      console.error(error);
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
        // Hapus permohonan yang sudah di-receive dari daftar
        setPermohonans(prev => prev.filter(p => p.id !== permohonanId));
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
        <button className="btn-back" onClick={() => navigate('/amprahan/tanda-terima')}>
          <ArrowLeft size={20} />
          <span>Kembali</span>
        </button>

        <div className="header-section">
          <h2>Daftar Approved Amprahan</h2>
          <div className="info-chips">
            <div className="chip">
              <Ship size={16} />
              <span>{state.kapalName}</span>
            </div>
            <div className="chip">
              <Navigation2 size={16} />
              <span>Voyage: {state.nomorVoyage}</span>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-state">
            <Loader2 className="spinner" size={32} />
            <p>Memuat data...</p>
          </div>
        ) : permohonans.length === 0 ? (
          <div className="empty-state">
            <CheckCircle2 size={48} className="empty-icon" />
            <h3>Tidak ada data</h3>
            <p>Tidak ada permohonan amprahan berstatus "Approved" untuk Kapal dan Voyage ini.</p>
          </div>
        ) : (
          <div className="permohonan-list">
            {permohonans.map((permohonan) => (
              <div key={permohonan.id} className="permohonan-card">
                <div className="card-header">
                  <div>
                    <h4>ID Permohonan: #{permohonan.id}</h4>
                    <p className="meta-text">Diajukan oleh: {permohonan.user_nama}</p>
                    <p className="meta-text">Tanggal: {new Date(permohonan.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="status-badge approved">Approved</div>
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
                          <td>{parseFloat(item.jumlah)}</td>
                          <td>{item.satuan}</td>
                          <td>{item.keterangan || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card-footer">
                  <button 
                    className="btn-terima"
                    onClick={() => handleTerima(permohonan.id)}
                    disabled={isSubmitting === permohonan.id}
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
