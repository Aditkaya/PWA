import { useState, useEffect } from 'react'
import { Check, X, Loader2, FileText, ChevronDown, ChevronUp, UserCheck, AlertTriangle, Search } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useLangStore } from '../../store/lang.store'
import { translations } from '../../utils/translations'
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
  const [expandedItems, setExpandedItems] = useState<(number | string)[]>([])
  const [actionConfirm, setActionConfirm] = useState<{ item: PermohonanItem; action: 'Disetujui' | 'Ditolak' } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  const { lang } = useLangStore()
  const t = translations[lang]

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
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.pengaju || '').toLowerCase().includes(query) ||
      (item.tipe || '').toLowerCase().includes(query) ||
      (item.jenis || '').toLowerCase().includes(query) ||
      (item.status || '').toLowerCase().includes(query)
    );
  });

  const toggleItem = (id: number | string) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

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

      const data = await res.json()
      if (res.ok) {
        showToast(`Permohonan ${actionConfirm.action.toLowerCase()} berhasil.`, 'success')
        setActionConfirm(null)
        fetchData(false)
      } else {
        showToast(data.message || 'Gagal mengubah status', 'error')
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

  return (
    <div className="page-container fade-in hrd-approval-page">
      <div className="history-header">
        <h1>Persetujuan HRD</h1>
        <p>Kelola pengajuan perizinan dan cuti karyawan</p>
      </div>

      <div className="search-container">
        <Search size={18} className="search-icon" />
        <input 
          type="text" 
          placeholder="Cari nama karyawan, tipe, jenis, atau status..." 
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
          <h3>Tidak ada pengajuan</h3>
          <p>Belum ada pengajuan perizinan atau cuti dari karyawan.</p>
        </div>
      ) : (
        <div className="permohonan-list fade-in">
          {filteredData.map((item, index) => {
            const uniqueId = `${item.tipe}-${item.id}`;
            const isExpanded = expandedItems.includes(uniqueId);
            const isPending = item.status.toLowerCase() === 'pending';
            
            return (
              <div 
                key={uniqueId} 
                className={`history-card permohonan-card ${isExpanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="history-card-header" onClick={() => toggleItem(uniqueId)}>
                  <div className="history-card-title-group">
                    <div className={`status-badge status-${item.status.toLowerCase().replace(' ', '-')}`}>
                      {item.status}
                    </div>
                    <h4>{item.pengaju}</h4>
                    <span className="history-card-subtitle">{item.tipe} - {item.jenis}</span>
                  </div>
                  <div className="history-card-action">
                    <div className="history-card-date">
                      {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="history-card-content fade-in">
                    <div className="history-detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Tanggal Mulai</span>
                        <span className="detail-value">{new Date(item.tanggal_mulai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Tanggal Selesai</span>
                        <span className="detail-value">{new Date(item.tanggal_selesai).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      {item.waktu && (
                        <div className="detail-item">
                          <span className="detail-label">Waktu</span>
                          <span className="detail-value">{item.waktu}</span>
                        </div>
                      )}
                      <div className="detail-item full-width">
                        <span className="detail-label">Keterangan / Alasan</span>
                        <span className="detail-value" style={{ whiteSpace: 'pre-wrap' }}>{item.keterangan || '-'}</span>
                      </div>
                    </div>

                    {item.lampiran && (
                       <div className="detail-item full-width mt-3">
                          <span className="detail-label">Lampiran Foto</span>
                          <div 
                              className="history-photo-preview"
                              onClick={() => setEnlargedPhoto(item.lampiran!)}
                          >
                              <img src={item.lampiran} alt="Lampiran" />
                          </div>
                      </div>
                    )}
                    
                    {isPending && (
                      <div className="permohonan-actions">
                        <button 
                          className="btn-approve"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionConfirm({ item, action: 'Disetujui' })
                          }}
                        >
                          <Check size={16} /> Setujui
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionConfirm({ item, action: 'Ditolak' })
                          }}
                        >
                          <X size={16} /> Tolak
                        </button>
                      </div>
                    )}
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
