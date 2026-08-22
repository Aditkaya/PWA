import { useState, useEffect, useMemo } from 'react'
import { Check, X, Loader2, FileText, ChevronDown, ChevronUp, AlertTriangle, Search, Filter, Clock, CheckCircle, XCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import './HrdApproval.css'
import { useToast } from '../../contexts/ToastContext'

interface PermohonanItem {
  id: number
  karyawan_id: number
  pengaju: string
  nik?: string
  pekerjaan?: string
  tipe: string
  jenis: string
  tanggal_mulai: string
  tanggal_selesai: string
  waktu?: string
  keterangan: string
  status: string
  created_at: string
  lampiran?: string | null
  foto_profil?: string | null
  nama_spv?: string | null
  nama_hrd?: string | null
}

export default function HrdApproval() {
  const { user } = useAuthStore()
  const { showToast } = useToast()
  const [data, setData] = useState<PermohonanItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('Pending')
  const [typeFilter, setTypeFilter] = useState<string>('Semua')
  const [expandedItems, setExpandedItems] = useState<(number | string)[]>([])
  const [actionConfirm, setActionConfirm] = useState<{ item: PermohonanItem; action: 'Disetujui' | 'Ditolak' } | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [imageErrors, setImageErrors] = useState<string[]>([])
  
  const [isSupervisor, setIsSupervisor] = useState(false)
  const [isHRD, setIsHRD] = useState(false)

  const fetchProfile = async () => {
    if (!user?.id) return
    try {
      const res = await fetch(`/api/profile?user_id=${user.id}`)
      const data = await res.json()
      if (data.data) {
        setIsSupervisor(data.data.is_supervisor || false)
        const pekerjaan = (data.data.pekerjaan || '').toLowerCase()
        setIsHRD(pekerjaan === 'hrd' || pekerjaan === 'it')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleImageError = (id: string) => {
    if (!imageErrors.includes(id)) {
      setImageErrors(prev => [...prev, id])
    }
  }

  const fetchData = async (showLoading = false) => {
    if (!user?.id) return
    try {
      if (showLoading) setLoading(true)
      const res = await fetch(`/api/hrd/permohonan?user_id=${user.id}`)
      if (res.ok) {
        const result = await res.json()
        const rawData = result.data || []
        
        // Menghapus duplikasi permohonan yang sama persis di hari yang sama
        const seen = new Set()
        const deduplicatedData = rawData.filter((item: any) => {
          // Tidak menggunakan waktu sebagai pembeda agar pengajuan (seperti Izin Pulang Cepat) 
          // yang disubmit berulang kali di hari yang sama hanya menampilkan yang terbaru.
          const key = `${item.nik}-${item.tipe}-${item.jenis}-${item.tanggal_mulai}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

        // Mengurutkan agar status "Pending" selalu tampil di urutan paling atas
        deduplicatedData.sort((a: any, b: any) => {
          const isAPending = a.status.toLowerCase().includes('pending')
          const isBPending = b.status.toLowerCase().includes('pending')
          if (isAPending && !isBPending) return -1
          if (!isAPending && isBPending) return 1
          return 0
        })
        
        setData(deduplicatedData)
      } else if (res.status === 403) {
        showToast('Akses ditolak. Anda tidak memiliki akses.', 'error')
      }
    } catch (error) {
      console.error("Failed to fetch permohonan data", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
    fetchData(true)
  }, [user])

  // Hitung ringkasan statistik
  const stats = useMemo(() => {
    return {
      pending: data.filter(d => d.status.toLowerCase().includes('pending')).length,
      approved: data.filter(d => d.status.toLowerCase() === 'disetujui' || d.status.toLowerCase() === 'approved').length,
      rejected: data.filter(d => d.status.toLowerCase() === 'ditolak' || d.status.toLowerCase() === 'rejected').length,
      total: data.length
    }
  }, [data])

  const filteredData = data.filter(item => {
    const queryMatch = !searchQuery ? true : (
      (item.pengaju || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.jenis || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
    
    const statusMatch = statusFilter === 'Semua' ? true : 
      (statusFilter === 'Pending' && item.status.toLowerCase().includes('pending')) ||
      (statusFilter === 'Disetujui' && (item.status.toLowerCase() === 'disetujui' || item.status.toLowerCase() === 'approved')) ||
      (statusFilter === 'Ditolak' && (item.status.toLowerCase() === 'ditolak' || item.status.toLowerCase() === 'rejected'))

    const typeMatch = typeFilter === 'Semua' ? true :
      item.tipe.toLowerCase().includes(typeFilter.toLowerCase()) ||
      (item.jenis || '').toLowerCase().includes(typeFilter.toLowerCase())

    return queryMatch && statusMatch && typeMatch
  })

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

      const responseData = await res.json()
      if (res.ok) {
        showToast(`Permohonan ${actionConfirm.action.toLowerCase()} berhasil.`, 'success')
        setActionConfirm(null)
        fetchData(false)
      } else {
        showToast(responseData.message || 'Gagal mengubah status', 'error')
      }
    } catch (error) {
      console.error("Action error:", error)
      showToast('Terjadi kesalahan koneksi', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const getTypeColor = (tipe: string) => {
    const t = tipe.toLowerCase()
    if (t.includes('cuti')) return 'var(--primary-color)'
    if (t.includes('izin')) return 'var(--warning-color)'
    if (t.includes('lupa')) return '#8b5cf6' // purple
    if (t.includes('lembur')) return '#fb923c' // orange
    return 'var(--text-secondary)'
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
      <div className="approval-header-bg"></div>
      
      <div className="approval-header-content">
        <h1>Approval Karyawan</h1>
        <p>Kelola pengajuan perizinan dan cuti bawahan Anda</p>
        
        <div className="stats-container fade-in">
          <div className={`stat-card ${statusFilter === 'Pending' ? 'active' : ''}`} onClick={() => setStatusFilter('Pending')}>
            <div className="stat-icon pending"><Clock size={20} /></div>
            <div className="stat-info">
              <span className="stat-value">{stats.pending}</span>
              <span className="stat-label">Menunggu</span>
            </div>
          </div>
          <div className={`stat-card ${statusFilter === 'Disetujui' ? 'active' : ''}`} onClick={() => setStatusFilter('Disetujui')}>
            <div className="stat-icon approved"><CheckCircle size={20} /></div>
            <div className="stat-info">
              <span className="stat-value">{stats.approved}</span>
              <span className="stat-label">Disetujui</span>
            </div>
          </div>
          <div className={`stat-card ${statusFilter === 'Ditolak' ? 'active' : ''}`} onClick={() => setStatusFilter('Ditolak')}>
            <div className="stat-icon rejected"><XCircle size={20} /></div>
            <div className="stat-info">
              <span className="stat-value">{stats.rejected}</span>
              <span className="stat-label">Ditolak</span>
            </div>
          </div>
        </div>
      </div>

      <div className="approval-filters">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Cari nama karyawan atau jenis..." 
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
        
        <div className="filter-row">
          <div className="status-tabs">
            {['Semua', 'Pending', 'Disetujui', 'Ditolak'].map(tab => (
              <button 
                key={tab} 
                className={`tab-btn ${statusFilter === tab ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          
          <div className="type-filter">
            <Filter size={14} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="Semua">Semua Tipe</option>
              <option value="Sakit">Izin Sakit</option>
              <option value="Pulang Cepat">Pulang Cepat</option>
              <option value="Datang Telat">Izin Datang Telat</option>
              <option value="Cuti">Cuti</option>
              <option value="Lembur">Lembur</option>
              <option value="Lupa Absen">Lupa Absen</option>
            </select>
          </div>
        </div>
      </div>

      {filteredData.length === 0 ? (
        <div className="empty-state-modern fade-in">
          <div className="empty-icon-wrapper">
            <FileText size={40} />
          </div>
          <h3>Tidak Ada Data</h3>
          <p>Belum ada pengajuan dengan filter yang dipilih.</p>
          {(searchQuery || statusFilter !== 'Semua' || typeFilter !== 'Semua') && (
            <button 
              className="btn-reset-filter"
              onClick={() => { setSearchQuery(''); setStatusFilter('Semua'); setTypeFilter('Semua'); }}
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="permohonan-list fade-in">
          {filteredData.map((item, index) => {
            const uniqueId = `${item.tipe}-${item.id}`;
            const isExpanded = expandedItems.includes(uniqueId);
            
            const statusLower = item.status.toLowerCase();
            const isPendingSpv = statusLower === 'pending spv';
            const isPendingHrd = statusLower === 'pending hrd';
            
            let canAction = false;
            if (isPendingSpv && isSupervisor && !isHRD) {
              canAction = true;
            } else if (isHRD && (isPendingHrd || isPendingSpv)) {
              canAction = true;
            }

            const hasImageError = imageErrors.includes(uniqueId);
            
            return (
              <div 
                key={uniqueId} 
                className={`approval-card ${isExpanded ? 'expanded' : ''}`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="approval-card-header" onClick={() => toggleItem(uniqueId)}>
                  <div className="employee-avatar">
                    {item.foto_profil && !hasImageError ? (
                      <img 
                        src={item.foto_profil} 
                        alt={item.pengaju} 
                        className="avatar-img" 
                        onError={() => handleImageError(uniqueId)}
                      />
                    ) : (
                      getInitials(item.pengaju)
                    )}
                  </div>
                  
                  <div className="approval-info">
                    <h4>{item.pengaju}</h4>
                    <div className="approval-meta">
                      <span className="type-badge" style={{ color: getTypeColor(item.tipe), background: `color-mix(in srgb, ${getTypeColor(item.tipe)} 15%, transparent)` }}>
                        {item.tipe}
                      </span>
                      <span className="bullet">•</span>
                      <span className="date-text">
                        {new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  </div>
                  
                  <div className="approval-right">
                    <div className={`status-pill status-${item.status.toLowerCase().includes('pending') ? 'pending' : item.status.toLowerCase().replace(' ', '-')}`}>
                      {item.status}
                    </div>
                    <div className="expand-icon">
                      {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="approval-card-content fade-in">
                    <div className="detail-grid-modern">

                      <div className="detail-group">
                        <span className="detail-label">Jenis Pengajuan</span>
                        <span className="detail-value highlight">{item.jenis}</span>
                      </div>
                      <div className="detail-group">
                        <span className="detail-label">Tanggal Pelaksanaan</span>
                        <span className="detail-value">
                          {item.tanggal_mulai === item.tanggal_selesai 
                            ? new Date(item.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                            : `${new Date(item.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(item.tanggal_selesai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          }
                        </span>
                      </div>
                      {item.waktu && (
                        <div className="detail-group">
                          <span className="detail-label">Waktu</span>
                          <span className="detail-value">{item.waktu}</span>
                        </div>
                      )}
                      <div className="detail-group full-width">
                        <span className="detail-label">Keterangan / Alasan</span>
                        <div className="reason-box">{item.keterangan || 'Tidak ada keterangan'}</div>
                      </div>
                      
                      {(item.nama_spv || item.nama_hrd) && (
                        <div className="detail-group full-width mt-3">
                          <span className="detail-label">Riwayat Persetujuan</span>
                          <div className="approval-history-box">
                            {item.nama_spv && (
                              <div className="approval-history-item">
                                <CheckCircle size={14} className="text-success" />
                                <span>Disetujui oleh SPV: <strong>{item.nama_spv}</strong></span>
                              </div>
                            )}
                            {item.nama_hrd && (
                              <div className="approval-history-item">
                                <CheckCircle size={14} className="text-success" />
                                <span>Disetujui oleh HRD: <strong>{item.nama_hrd}</strong></span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {item.lampiran && (
                       <div className="detail-group full-width mt-3">
                          <span className="detail-label">Lampiran Bukti</span>
                          <div 
                              className="attachment-preview"
                              onClick={() => setEnlargedPhoto(item.lampiran!)}
                          >
                              <img src={item.lampiran} alt="Lampiran" />
                              <div className="attachment-overlay">
                                <Search size={24} color="white" />
                              </div>
                          </div>
                      </div>
                    )}
                    
                    {canAction && (
                      <div className="approval-actions-modern">
                        <button 
                          className="btn-action reject"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionConfirm({ item, action: 'Ditolak' })
                          }}
                        >
                          <X size={18} /> Tolak Pengajuan
                        </button>
                        <button 
                          className="btn-action approve"
                          onClick={(e) => {
                            e.stopPropagation()
                            setActionConfirm({ item, action: 'Disetujui' })
                          }}
                        >
                          <Check size={18} /> Setujui Pengajuan
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
          <div className="modal-content-modern scale-in">
            <div className={`modal-icon-header ${actionConfirm.action === 'Disetujui' ? 'success' : 'danger'}`}>
              {actionConfirm.action === 'Disetujui' ? <CheckCircle size={40} /> : <AlertTriangle size={40} />}
            </div>
            
            <div className="modal-body-modern">
              <h2>Konfirmasi {actionConfirm.action}</h2>
              <p>Anda yakin ingin <strong>{actionConfirm.action.toLowerCase()}</strong> pengajuan <strong>{actionConfirm.item.tipe}</strong> atas nama <strong>{actionConfirm.item.pengaju}</strong>?</p>
              
              <div className="modal-warning">
                <AlertTriangle size={14} />
                <span>Tindakan ini tidak dapat dibatalkan setelah dikonfirmasi.</span>
              </div>
            </div>
            
            <div className="modal-footer-modern">
              <button 
                className="btn-cancel" 
                onClick={() => setActionConfirm(null)}
                disabled={actionLoading}
              >
                Batal
              </button>
              <button 
                className={`btn-confirm ${actionConfirm.action === 'Disetujui' ? 'success' : 'danger'}`}
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
              <div className="enlarged-photo-modern scale-in">
                  <button className="close-enlarged-modern" onClick={(e) => { e.stopPropagation(); setEnlargedPhoto(null) }}>
                      <X size={24} />
                  </button>
                  <img src={enlargedPhoto} alt="Foto Diperbesar" />
              </div>
          </div>
      )}
    </div>
  )
}
