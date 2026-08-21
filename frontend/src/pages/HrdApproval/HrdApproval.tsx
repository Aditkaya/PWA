import { useState, useEffect } from 'react'
import { Check, X, Loader2, FileText, UserCheck, AlertTriangle, Search, Clock, History } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import './HrdApproval.css'
import { useToast } from '../../contexts/ToastContext'

interface PermohonanItem {
  id: number
  karyawan_id: number
  pengaju: string
  tipe: string
  jenis: string
  tanggal_mulai: string
  tanggal_selesai: string
  waktu?: string
  keterangan: string
  status: string
  created_at: string
  lampiran?: string | null
}

export default function HrdApproval() {
  const { user } = useAuthStore()
  const { showToast } = useToast()
  const [data, setData] = useState<PermohonanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'pending' | 'riwayat'>('pending')
  const [actionConfirm, setActionConfirm] = useState<{ item: PermohonanItem; action: 'Disetujui' | 'Ditolak' } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  const fetchData = async (showLoading = false) => {
    if (!user?.id) return
    try {
      if (showLoading) setLoading(true)
      const res = await fetch(`/api/hrd/permohonan?user_id=${user.id}`)
      if (res.ok) {
        const result = await res.json()
        setData(result.data || [])
      } else if (res.status === 403) {
        showToast('Akses ditolak. Anda bukan HRD.', 'error')
      }
    } catch (error) {
      console.error("Failed to fetch permohonan data", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(true)
  }, [user])

  const filteredData = data.filter(item => {
    // Filter by tab
    if (activeTab === 'pending' && item.status.toLowerCase() !== 'pending') return false;
    if (activeTab === 'riwayat' && item.status.toLowerCase() === 'pending') return false;

    // Filter by search
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.pengaju || '').toLowerCase().includes(query) ||
      (item.tipe || '').toLowerCase().includes(query) ||
      (item.jenis || '').toLowerCase().includes(query) ||
      (item.status || '').toLowerCase().includes(query)
    );
  });

  const handleAction = async () => {
    if (!actionConfirm || !user?.id) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/hrd/permohonan/status', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: actionConfirm.item.id, 
          tipe: actionConfirm.item.tipe, 
          status: actionConfirm.action,
          user_id: user.id 
        })
      })

      const result = await res.json()
      if (res.ok) {
        showToast(`Permohonan ${actionConfirm.action.toLowerCase()} berhasil.`, 'success')
        setActionConfirm(null)
        fetchData(false)
      } else {
        showToast(result.message || 'Gagal mengubah status', 'error')
      }
    } catch (error) {
      console.error("Action error:", error)
      showToast('Terjadi kesalahan koneksi', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="spinner" size={32} color="var(--accent-color)" />
      </div>
    )
  }

  const pendingCount = data.filter(i => i.status.toLowerCase() === 'pending').length;

  return (
    <div className="page-container fade-in hrd-approval-page">
      <div className="history-header">
        <h1>Persetujuan HRD</h1>
        <p>Kelola pengajuan perizinan dan cuti karyawan</p>
      </div>

      <div className="approval-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          <Clock size={16} /> Menunggu Persetujuan {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
        </button>
        <button 
          className={`tab-btn ${activeTab === 'riwayat' ? 'active' : ''}`}
          onClick={() => setActiveTab('riwayat')}
        >
          <History size={16} /> Riwayat
        </button>
      </div>

      <div className="search-container">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Cari nama karyawan, tipe, jenis..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>
            <X size={14} />
          </button>
        )}
      </div>

      {filteredData.length === 0 ? (
        <div className="empty-state fade-in">
          <FileText size={48} opacity={0.3} style={{ marginBottom: '16px' }} />
          <h3>Tidak ada data</h3>
          <p>{activeTab === 'pending' ? 'Semua pengajuan sudah diproses.' : 'Belum ada riwayat persetujuan.'}</p>
        </div>
      ) : (
        <div className="simple-card-list fade-in">
          {filteredData.map((item, index) => {
            const uniqueId = `${item.tipe}-${item.id}`;
            const isPending = item.status.toLowerCase() === 'pending';
            
            return (
              <div 
                key={uniqueId} 
                className="simple-card"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="simple-card-header">
                  <div className="card-user-info">
                    <h4>{item.pengaju}</h4>
                    <span className="card-type-badge">{item.tipe} - {item.jenis}</span>
                  </div>
                  {!isPending && (
                    <div className={`status-badge status-${item.status.toLowerCase().replace(' ', '-')}`}>
                      {item.status}
                    </div>
                  )}
                </div>
                
                <div className="simple-card-body">
                  <div className="info-row">
                    <span className="info-label">Tanggal:</span>
                    <span className="info-value">
                      {new Date(item.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} 
                      {item.tanggal_mulai !== item.tanggal_selesai && ` s/d ${new Date(item.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </span>
                  </div>
                  {item.waktu && (
                    <div className="info-row">
                      <span className="info-label">Waktu:</span>
                      <span className="info-value">{item.waktu}</span>
                    </div>
                  )}
                  <div className="info-row">
                    <span className="info-label">Alasan:</span>
                    <span className="info-value">{item.keterangan || '-'}</span>
                  </div>

                  {item.lampiran && (
                    <div className="info-row" style={{ marginTop: '8px' }}>
                      <span className="info-label">Lampiran:</span>
                      <div 
                          className="lampiran-thumb"
                          onClick={() => setEnlargedPhoto(item.lampiran!)}
                      >
                          <img src={item.lampiran} alt="Lampiran" />
                          <span>Lihat Lampiran</span>
                      </div>
                    </div>
                  )}
                </div>

                {isPending && (
                  <div className="simple-card-footer">
                    <button 
                      className="btn-reject-simple"
                      onClick={() => setActionConfirm({ item, action: 'Ditolak' })}
                    >
                      <X size={16} /> Tolak
                    </button>
                    <button 
                      className="btn-approve-simple"
                      onClick={() => setActionConfirm({ item, action: 'Disetujui' })}
                    >
                      <Check size={16} /> Setujui
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {actionConfirm && (
        <div className="modal-overlay fade-in" style={{ zIndex: 9999 }}>
          <div className="modal-content scale-in" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-title-wrapper" style={{ color: actionConfirm.action === 'Disetujui' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                {actionConfirm.action === 'Disetujui' ? <UserCheck size={24} /> : <AlertTriangle size={24} />}
                <h2>Konfirmasi {actionConfirm.action}</h2>
              </div>
              <button className="modal-close" onClick={() => !actionLoading && setActionConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', padding: '20px 0' }}>
              <p>Anda yakin ingin <strong>{actionConfirm.action.toLowerCase()}</strong> pengajuan {actionConfirm.item.tipe} dari <strong>{actionConfirm.item.pengaju}</strong>?</p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px' }}>Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                onClick={() => setActionConfirm(null)}
                disabled={actionLoading}
              >
                Batal
              </button>
              <button 
                className="btn" 
                style={{ flex: 1, background: actionConfirm.action === 'Disetujui' ? 'var(--success-color)' : 'var(--danger-color)', color: 'white', border: 'none' }}
                onClick={handleAction}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 size={18} className="spinner" /> : `Ya, ${actionConfirm.action}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {enlargedPhoto && (
          <div className="modal-overlay fade-in" onClick={() => setEnlargedPhoto(null)} style={{ zIndex: 9999 }}>
              <div className="enlarged-photo-container scale-in">
                  <button className="close-enlarged" onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(null) }}>
                      <X size={24} />
                  </button>
                  <img src={enlargedPhoto} alt="Foto Diperbesar" />
              </div>
          </div>
      )}
    </div>
  )
}
