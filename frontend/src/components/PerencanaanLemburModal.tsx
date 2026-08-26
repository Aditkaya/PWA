import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, FileText, CheckCircle, Users, Search, Edit2, Trash2, UserPlus } from 'lucide-react';
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
  const [editGroupItems, setEditGroupItems] = useState<any[] | null>(null);

  const [historyData, setHistoryData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

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
      let resOk = false;
      let errMsg = '';
      if (editGroupItems) {
        const oldKaryawanIds = editGroupItems.map((i: any) => i.karyawan_id);
        
        const toDeleteIds = editGroupItems.filter((i: any) => !selectedKaryawan.includes(i.karyawan_id)).map((i: any) => i.id);
        const toUpdateItems = editGroupItems.filter((i: any) => selectedKaryawan.includes(i.karyawan_id));
        const toCreateKaryawanIds = selectedKaryawan.filter(kid => !oldKaryawanIds.includes(kid));

        const promises = [];
        for (const id of toDeleteIds) {
          promises.push(fetch(`/api/hrd/perencanaan-lembur/${id}?user_id=${user?.id}`, { method: 'DELETE' }));
        }
        for (const item of toUpdateItems) {
          promises.push(fetch(`/api/hrd/perencanaan-lembur/${item.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tanggal, jam_mulai: jamMulai, jam_selesai: jamSelesai, keterangan })
          }));
        }
        if (toCreateKaryawanIds.length > 0) {
          promises.push(fetch('/api/hrd/perencanaan-lembur', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user?.id, tanggal, jam_mulai: jamMulai, jam_selesai: jamSelesai, keterangan, karyawan_ids: toCreateKaryawanIds })
          }));
        }

        try {
          const results = await Promise.all(promises);
          const allOk = results.every(r => r.ok);
          if (allOk) {
            resOk = true;
          } else {
            errMsg = 'Gagal memproses beberapa data';
          }
        } catch (e) {
          errMsg = 'Kesalahan jaringan saat memproses data';
        }
      } else {
        const res = await fetch('/api/hrd/perencanaan-lembur', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user?.id,
            tanggal,
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            keterangan,
            karyawan_ids: selectedKaryawan
          })
        });
        if (res.ok) resOk = true;
        else {
          const errorData = await res.json();
          errMsg = errorData.message || 'Gagal menyimpan data';
        }
      }

      if (resOk) {
        showToast(editGroupItems ? 'Perencanaan lembur berhasil diupdate' : 'Perencanaan lembur berhasil disimpan', 'success');
        setTanggal(new Date().toISOString().split('T')[0]);
        setJamMulai('17:00');
        setJamSelesai('19:00');
        setKeterangan('');
        setSelectedKaryawan([]);
        setEditGroupItems(null);
        
        fetchHistory();
        setActiveTab('history');
        if (onSuccess) onSuccess();
      } else {
        showToast(errMsg, 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan pada sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditGroupItems([item]);
    setTanggal(item.tanggal);
    setJamMulai(item.jam_mulai.substring(0, 5));
    setJamSelesai(item.jam_selesai.substring(0, 5));
    setKeterangan(item.keterangan);
    setSelectedKaryawan([item.karyawan_id]);
    setActiveTab('form');
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin menghapus perencanaan lembur ini?')) return;
    
    try {
      const res = await fetch(`/api/hrd/perencanaan-lembur/${id}?user_id=${user?.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showToast('Data berhasil dihapus', 'success');
        fetchHistory();
      } else {
        const err = await res.json();
        showToast(err.message || 'Gagal menghapus data', 'error');
      }
    } catch (error) {
      showToast('Terjadi kesalahan pada sistem', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditGroupItems(null);
    setTanggal(new Date().toISOString().split('T')[0]);
    setJamMulai('17:00');
    setJamSelesai('19:00');
    setKeterangan('');
    setSelectedKaryawan([]);
    setActiveTab('history');
  };

  const handleEditGroup = (group: any) => {
    setEditGroupItems(group.items);
    setTanggal(group.tanggal);
    setJamMulai(group.jam_mulai.substring(0, 5));
    setJamSelesai(group.jam_selesai.substring(0, 5));
    setKeterangan(group.keterangan);
    setSelectedKaryawan(group.items.map((i: any) => i.karyawan_id));
    setActiveTab('form');
  };

  const handleDeleteGroup = async (group: any) => {
    if (!confirm('Apakah Anda yakin ingin menghapus seluruh data perencanaan lembur pada grup ini?')) return;
    setSubmitting(true);
    try {
      await Promise.all(group.items.map((item: any) => fetch(`/api/hrd/perencanaan-lembur/${item.id}?user_id=${user?.id}`, { method: 'DELETE' })));
      showToast('Data grup berhasil dihapus', 'success');
      fetchHistory();
    } catch (error) {
      showToast('Terjadi kesalahan pada sistem', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddKaryawan = (group: any) => {
    setEditGroupItems(null);
    setTanggal(group.tanggal);
    setJamMulai(group.jam_mulai.substring(0, 5));
    setJamSelesai(group.jam_selesai.substring(0, 5));
    setKeterangan(group.keterangan);
    setSelectedKaryawan([]);
    setActiveTab('form');
  };

  const groupedHistory = historyData.reduce((acc, item) => {
    const key = `${item.tanggal}_${item.jam_mulai}_${item.jam_selesai}_${item.keterangan}`;
    if (!acc[key]) {
      acc[key] = {
        tanggal: item.tanggal,
        jam_mulai: item.jam_mulai,
        jam_selesai: item.jam_selesai,
        keterangan: item.keterangan,
        items: []
      };
    }
    acc[key].items.push(item);
    return acc;
  }, {} as Record<string, any>);

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
                      <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                        {k.nama_lengkap.split(' ').find(w => w.length > 2 && !w.includes('.')) || k.nama_lengkap.split(' ')[0]}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{k.pekerjaan}</span>
                    </label>
                  </div>
                ))
              )}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Terpilih: {selectedKaryawan.length} dari {bawahan.length} karyawan
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {editGroupItems && (
              <button 
                type="button" 
                onClick={handleCancelEdit}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                  background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer',
                  fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center'
                }}
              >
                Batal Edit
              </button>
            )}
            <button type="submit" className="btn-submit" disabled={submitting} style={{ flex: editGroupItems ? 1 : 'unset', width: editGroupItems ? 'auto' : '100%' }}>
              <CheckCircle size={18} />
              {submitting ? 'Menyimpan...' : (editGroupItems ? 'Update Perencanaan' : 'Simpan Perencanaan')}
            </button>
          </div>
        </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Memuat riwayat...</div>
            ) : historyData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Belum ada riwayat perencanaan lembur.</div>
            ) : (
              Object.values(groupedHistory).map((group: any, idx) => (
                <div key={idx} style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{new Date(group.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                  <div style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>{group.jam_mulai.substring(0, 5)} - {group.jam_selesai.substring(0, 5)}</div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    {group.keterangan}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <Users size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'text-bottom' }} />
                      {group.items.length} Karyawan
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button 
                        onClick={() => handleAddKaryawan(group)}
                        title="Tambah Karyawan ke Rencana Ini"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#10b981', background: 'rgba(16, 185, 129, 0.05)', cursor: 'pointer', fontWeight: 500 }}
                      >
                        <UserPlus size={14} /> Tambah
                      </button>
                      <button 
                        onClick={() => handleEditGroup(group)}
                        title="Edit Rencana"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#3b82f6', background: 'rgba(59, 130, 246, 0.05)', cursor: 'pointer', fontWeight: 500 }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteGroup(group)}
                        title="Hapus Rencana"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', cursor: 'pointer', fontWeight: 500 }}
                      >
                        <Trash2 size={14} /> Hapus
                      </button>
                      <button 
                        onClick={() => setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', background: 'var(--glass-bg)', cursor: 'pointer', fontWeight: 500 }}
                      >
                        {expandedGroups[idx] ? 'Sembunyikan' : 'Lihat Detail'}
                      </button>
                    </div>
                  </div>
                  
                  {expandedGroups[idx] && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {group.items.map((item: any) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '16px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {item.nama_lengkap.split(' ').find((w: string) => w.length > 2 && !w.includes('.')) || item.nama_lengkap.split(' ')[0]}
                          </span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              onClick={() => handleEdit(item)}
                              style={{ background: 'none', color: '#3b82f6', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex' }}
                              title="Edit Data"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              style={{ background: 'none', color: '#ef4444', border: 'none', padding: '2px', cursor: 'pointer', display: 'flex' }}
                              title="Hapus Data"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
