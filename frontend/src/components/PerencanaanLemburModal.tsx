import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, FileText, CheckCircle, Users, Search } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css'; 

interface KaryawanItem {
  id: number;
  nik: string;
  nama_lengkap: string;
  pekerjaan: string;
  grup: string;
}

interface PerencanaanLemburModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  onSuccess?: () => void;
}

export default function PerencanaanLemburModal({ isOpen, onClose, onSuccess }: PerencanaanLemburModalProps) {
  const { user } = useAuthStore();
  const { showToast } = useToast();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamMulai, setJamMulai] = useState('17:00');
  const [jamSelesai, setJamSelesai] = useState('19:00');
  const [keterangan, setKeterangan] = useState('');
  
  const [bawahan, setBawahan] = useState<KaryawanItem[]>([]);
  const [selectedKaryawan, setSelectedKaryawan] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  useEffect(() => {
    if (isOpen && user?.id) {
      if (activeTab === 'form') {
        fetchBawahan();
      } else {
        fetchHistory();
      }
    }
  }, [isOpen, user, activeTab]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrd/perencanaan-lembur/history?user_id=${user?.id}`);
      if (res.ok) {
        const result = await res.json();
        setHistoryData(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBawahan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hrd/bawahan?user_id=${user?.id}`);
      if (res.ok) {
        const result = await res.json();
        setBawahan(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch bawahan', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleKaryawan = (id: number) => {
    setSelectedKaryawan(prev => 
      prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id]
    );
  };

  const [searchQuery, setSearchQuery] = useState('');

  const filteredBawahan = bawahan.filter(k => 
    k.nama_lengkap.toLowerCase().includes(searchQuery.toLowerCase()) || 
    k.nik.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectAll = () => {
    // Only select/deselect from the currently filtered list
    const filteredIds = filteredBawahan.map(b => b.id);
    const allFilteredSelected = filteredIds.every(id => selectedKaryawan.includes(id));
    
    if (allFilteredSelected) {
      setSelectedKaryawan(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedKaryawan(prev => {
        const newSelected = new Set(prev);
        filteredIds.forEach(id => newSelected.add(id));
        return Array.from(newSelected);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggal || !jamMulai || !jamSelesai || !keterangan || selectedKaryawan.length === 0) {
      showToast('Harap lengkapi semua isian dan pilih minimal 1 karyawan', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/hrd/perencanaan-lembur', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user?.id,
          tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          keterangan,
          karyawan_ids: selectedKaryawan
        })
      });

      if (res.ok) {
        showToast('Perencanaan lembur berhasil disimpan', 'success');
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamMulai('17:00');
        setJamSelesai('19:00');
        setKeterangan('');
        setSelectedKaryawan([]);
        onClose();
        if (onSuccess) onSuccess();
      } else {
        const errorData = await res.json();
        showToast(errorData.message || 'Gagal menyimpan data', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan pada sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="izin-modal-overlay">
      <div className="izin-modal-content" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="izin-modal-header">
          <div>
            <h3>Perencanaan Lembur</h3>
            <p>Jadwalkan lembur untuk tim Anda</p>
          </div>
          <button className="close-btn" onClick={onClose} disabled={submitting}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '16px' }}>
          <button 
            type="button"
            onClick={() => setActiveTab('form')}
            style={{ 
              flex: 1, padding: '12px', background: 'transparent', border: 'none', 
              borderBottom: activeTab === 'form' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'form' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'form' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            Formulir
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('history')}
            style={{ 
              flex: 1, padding: '12px', background: 'transparent', border: 'none', 
              borderBottom: activeTab === 'history' ? '2px solid var(--accent-color)' : '2px solid transparent',
              color: activeTab === 'history' ? 'var(--accent-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === 'history' ? 600 : 400,
              cursor: 'pointer'
            }}
          >
            Riwayat
          </button>
        </div>

        {activeTab === 'form' ? (
        <form className="izin-modal-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label><Calendar size={16} /> Tanggal Lembur</label>
            <input 
              type="date" 
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label><Clock size={16} /> Jam Mulai</label>
              <input 
                type="time" 
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label><Clock size={16} /> Jam Selesai</label>
              <input 
                type="time" 
                value={jamSelesai}
                onChange={(e) => setJamSelesai(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label><FileText size={16} /> Keterangan Pekerjaan</label>
            <textarea 
              rows={2}
              placeholder="Contoh: Bongkar muat barang"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ marginBottom: 0 }}><Users size={16} /> Daftar Karyawan</label>
              <button 
                type="button" 
                onClick={handleSelectAll}
                style={{ 
                  background: 'none', border: 'none', color: 'var(--accent-color)', 
                  fontSize: '0.8rem', cursor: 'pointer', padding: 0 
                }}
              >
                {selectedKaryawan.length === filteredBawahan.length && filteredBawahan.length > 0 ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            
            <div style={{ position: 'relative', marginBottom: '8px' }}>
              <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>
                <Search size={16} />
              </div>
              <input
                type="text"
                placeholder="Cari nama atau NIK..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '8px 10px 8px 34px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--glass-border)',
                  background: 'rgba(0,0,0,0.1)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
            
            <div style={{ 
              background: 'rgba(0,0,0,0.1)', border: '1px solid var(--glass-border)', 
              borderRadius: '8px', padding: '10px', maxHeight: '180px', overflowY: 'auto' 
            }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Memuat data karyawan...</div>
              ) : filteredBawahan.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  {bawahan.length === 0 ? 'Tidak ada data bawahan.' : 'Karyawan tidak ditemukan.'}
                </div>
              ) : (
                filteredBawahan.map(k => (
                  <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <input 
                      type="checkbox" 
                      id={`karyawan-${k.id}`}
                      checked={selectedKaryawan.includes(k.id)}
                      onChange={() => handleToggleKaryawan(k.id)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor={`karyawan-${k.id}`} style={{ cursor: 'pointer', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{k.nama_lengkap}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{k.nik} - {k.pekerjaan}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Terpilih: {selectedKaryawan.length} dari {bawahan.length} karyawan
            </div>
          </div>

          <button type="submit" className="btn-submit" disabled={submitting}>
            <CheckCircle size={18} />
            {submitting ? 'Menyimpan...' : 'Simpan Perencanaan'}
          </button>
        </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Memuat riwayat...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Belum ada riwayat perencanaan lembur.</div>
            ) : (
              historyData.map(item => (
                <div key={item.id} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.9rem' }}>{item.jam_mulai} - {item.jam_selesai}</span>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    {item.keterangan}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', width: 'fit-content' }}>
                    <Users size={14} />
                    <span>{item.nama_lengkap} ({item.nik})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
