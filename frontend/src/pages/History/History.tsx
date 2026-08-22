import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Loader2, MapPin, ChevronDown, ChevronUp, X, FileText, Trash2, AlertTriangle, Clock, Search, UserCheck } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useLangStore } from '../../store/lang.store'
import { translations } from '../../utils/translations'
import './History.css'

interface HistoryItem {
  id: number
  date: string
  type: string
  time: string
  status: string
  foto?: string | null
  location?: string | null
  lat?: number | null
  lng?: number | null
  keterangan?: string | null
}

interface PermohonanItem {
  id: number
  tipe: string
  jenis: string
  tanggal_mulai: string
  tanggal_selesai: string
  waktu?: string
  keterangan: string
  status: string
  created_at: string
  approved_by_name?: string
}

interface HolidayItem {
  tanggal: string
  keterangan: string
}

export default function History() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'absensi' | 'permohonan'>('absensi')
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [permohonanData, setPermohonanData] = useState<PermohonanItem[]>([])
  const [holidaysData, setHolidaysData] = useState<HolidayItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const { lang } = useLangStore()
  const t = translations[lang]

  const [currentDate, setCurrentDate] = useState(new Date()) // Set to current date
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<(number | string)[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; tipe: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = async (showLoading = false) => {
    if (!user?.id) return
    try {
      if (showLoading) setLoading(true)
      const [histRes, permRes, holiRes] = await Promise.all([
        fetch(`/api/history?user_id=${user.id}`),
        fetch(`/api/permohonan?user_id=${user.id}`),
        fetch('/api/holidays')
      ])

      if (histRes.ok) {
        const histResult = await histRes.json()
        setHistoryData(histResult.data)
      }
      
      if (permRes.ok) {
        const permResult = await permRes.json()
        setPermohonanData(permResult.data)
      }

      if (holiRes.ok) {
        const holiResult = await holiRes.json()
        setHolidaysData(holiResult.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch history data", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    fetchData(true)
  }, [user])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const monthNames = t.months

  // Generate blank spaces for the first week
  const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i)
  
  // Generate days of the month
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    setSelectedDay(null)
  }
  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    setSelectedDay(null)
  }

  // Get events for a specific day
  const getEventsForDay = (day: number) => {
    const formattedMonth = String(currentDate.getMonth() + 1).padStart(2, '0')
    const formattedDay = String(day).padStart(2, '0')
    const dateString = `${currentDate.getFullYear()}-${formattedMonth}-${formattedDay}`
    
    return historyData.filter(event => event.date === dateString)
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : []
  
  const filteredPermohonanData = permohonanData.filter(item => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (item.tipe || '').toLowerCase().includes(query) ||
      (item.jenis || '').toLowerCase().includes(query) ||
      (item.keterangan || '').toLowerCase().includes(query) ||
      (item.status || '').toLowerCase().includes(query)
    );
  });
  
  const toggleItem = async (id: number | string) => {
    const isExpanding = !expandedItems.includes(id);
    if (isExpanding) {
      // Background refresh to get the latest data or remove if deleted
      await fetchData(false);
    }
    setExpandedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const handleDeletePermohonan = async () => {
    if (!deleteConfirm || !user?.id) return
    setDeleting(true)
    try {
      const res = await fetch('/api/permohonan', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteConfirm.id, tipe: deleteConfirm.tipe, user_id: user.id })
      })
      if (res.ok) {
        setDeleteConfirm(null)
        await fetchData(false)
      }
    } catch (e) {
      console.error('Gagal menghapus permohonan', e)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="history-page fade-in history-loading">
        <Loader2 size={32} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="history-page fade-in">
      <div className="tab-switcher glass-panel">
        <button 
          onClick={() => setActiveTab('absensi')}
          className={`tab-btn ${activeTab === 'absensi' ? 'active' : 'inactive'}`}
        >
          {t.absensi}
        </button>
        <button 
          onClick={() => setActiveTab('permohonan')}
          className={`tab-btn ${activeTab === 'permohonan' ? 'active' : 'inactive'}`}
        >
          {t.permohonan}
        </button>
      </div>

      {activeTab === 'absensi' ? (
        <>
          <div className="calendar-header glass-panel">
            <button className="icon-btn" onClick={handlePrevMonth}><ChevronLeft size={24} /></button>
            <div className="month-title">
              <CalendarIcon size={20} />
              <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
            </div>
            <button className="icon-btn" onClick={handleNextMonth}><ChevronRight size={24} /></button>
          </div>

          <div className="calendar-container glass-panel">
            <div className="calendar-days-header">
              {t.daysShort.map((day: string, idx: number) => <span key={idx}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {blanks.map((_, idx) => (
                <div key={`blank-${idx}`} className="calendar-cell empty"></div>
              ))}
              {days.map((day) => {
                const events = getEventsForDay(day)
                const realToday = new Date()
                const isToday = day === realToday.getDate() && currentDate.getMonth() === realToday.getMonth() && currentDate.getFullYear() === realToday.getFullYear()
                const isSelected = selectedDay === day
                
                const formattedMonth = String(currentDate.getMonth() + 1).padStart(2, '0')
                const formattedDay = String(day).padStart(2, '0')
                const dateString = `${currentDate.getFullYear()}-${formattedMonth}-${formattedDay}`
                const holiday = holidaysData.find(h => h.tanggal === dateString)
                
                return (
                  <div 
                    key={day} 
                    className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${holiday ? 'holiday' : ''}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    <span className="day-number">{day}</span>
                    <div className="event-dots">
                      {events.map(ev => {
                        let dotClass = 'dot-default'
                        if (ev.type.toLowerCase().includes('in') || ev.type.toLowerCase().includes('masuk')) dotClass = 'dot-checkin'
                        if (ev.type.toLowerCase().includes('out') || ev.type.toLowerCase().includes('pulang')) dotClass = 'dot-checkout'
                        if (ev.type.toLowerCase().includes('izin')) dotClass = 'dot-permit'
                        if (ev.type.toLowerCase().includes('istirahat')) dotClass = 'dot-break'
                        
                        return <span key={ev.id} className={`event-dot ${dotClass}`} title={ev.type}></span>
                      })}
                    </div>
                    {holiday && <span className="holiday-desc">{holiday.keterangan}</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {selectedDay && (
            <div className="selected-date-details fade-in">
              <h3 className="detail-title">
                {t.detail}: {selectedDay} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
              
              {selectedEvents.length > 0 ? (
                <div className="history-list">
                  {selectedEvents.map((item) => (
                    <div key={item.id} className="history-card glass-panel">
                      <div 
                        className={`history-card-header ${expandedItems.includes(item.id) ? 'expanded' : 'collapsed'}`} 
                        onClick={() => toggleItem(item.id)}
                      >
                        <div className="history-card-header-title">
                          <span className={`badge ${item.type.replace(/\s+/g, '-').toLowerCase()}`}>
                            {item.type}
                          </span>
                          <span className="time">{item.time}</span>
                        </div>
                        <div className="history-card-header-status">
                          <span className={`status-text ${item.status === 'Tepat Waktu' || item.status === 'Disetujui' ? 'status-ok' : 'status-warn'}`}>
                            {item.status}
                          </span>
                          {expandedItems.includes(item.id) ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                        </div>
                      </div>
                      
                      {expandedItems.includes(item.id) && (
                        <div className="history-card-body">
                          <div className="history-details">
                            <div className="detail-item">
                              <Info size={16} />
                              <span>{t.status}: {item.status}</span>
                            </div>
                            {item.keterangan && (
                              <div className="detail-item detail-item-full">
                                <FileText size={16} className="detail-item-icon" />
                                <span className="detail-item-text">
                                  <strong>{t.descReason}:</strong> {item.keterangan}
                                </span>
                              </div>
                            )}
                            <div className="detail-item detail-item-full">
                              <MapPin size={16} className="detail-item-icon" />
                              <span className="detail-item-text">
                                {item.location ? (
                                  <>
                                    {item.location}
                                    <br />
                                    <span className="detail-location-coords">
                                      Lat: {item.lat} | Lng: {item.lng}
                                    </span>
                                  </>
                                ) : t.noLocation}
                              </span>
                            </div>
                          </div>
                          {item.foto && (
                            <div className="history-photo">
                              <img 
                                src={item.foto.startsWith('/') ? item.foto : `/${item.foto}`} 
                                alt="Foto Absensi" 
                                onClick={() => setEnlargedPhoto(item.foto!)}
                                className="history-photo-img"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state glass-panel">
                  <Info size={32} />
                  <p>{t.noHistory}</p>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="permohonan-list fade-in">
          <div className="search-container glass-panel" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', padding: '10px 16px', gap: '8px', borderRadius: '12px' }}>
            <Search size={20} color="var(--text-secondary)" />
            <input 
              type="text" 
              placeholder="Cari permohonan (Cuti, Izin, Sakit...)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="icon-btn" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            )}
          </div>

          {filteredPermohonanData.length > 0 ? (
            <div className="history-list">
              {filteredPermohonanData.map(item => {
                const itemKey = `${item.tipe}-${item.id}`;
                const isExpanded = expandedItems.includes(itemKey);
                return (
                <div key={itemKey} className="history-card glass-panel">
                  <div 
                    className={`history-card-header ${isExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={() => toggleItem(itemKey)}
                  >
                    <div className="history-card-header-title">
                      <span className={`badge ${item.tipe === 'Cuti' ? 'badge-cuti' : 'badge-izin'}`}>
                        {item.tipe} - {item.jenis}
                      </span>
                    </div>
                    <div className="history-card-header-status">
                      <span className={`status-text ${item.status === 'Disetujui' ? 'status-ok' : item.status === 'Ditolak' ? 'status-err-custom' : 'status-warn'}`}>
                        {item.status}
                      </span>
                      {item.status.toLowerCase().includes('pending') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: item.id, tipe: item.tipe }); }}
                          title="Hapus permohonan"
                          className="btn-delete-permohonan"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                    </div>
                  </div>
                  {isExpanded && (
                  <div className="history-card-body">
                    <div className="permohonan-details-col">
                      <div className="permohonan-detail-item">
                        <div className="permohonan-detail-icon-wrap">
                           <CalendarIcon size={18} className="permohonan-detail-icon" />
                        </div>
                        <div className="permohonan-detail-text-wrap">
                          <span className="permohonan-detail-label">{t.date}</span>
                          <span className="permohonan-detail-value">
                            {item.tanggal_mulai} {item.tanggal_mulai !== item.tanggal_selesai && ` s/d ${item.tanggal_selesai}`}
                          </span>
                        </div>
                      </div>
                      {item.waktu && (
                        <div className="permohonan-detail-item">
                          <div className="permohonan-detail-icon-wrap">
                             <Clock size={18} className="permohonan-detail-icon" />
                          </div>
                          <div className="permohonan-detail-text-wrap">
                            <span className="permohonan-detail-label">WAKTU</span>
                            <span className="permohonan-detail-value">{item.waktu}</span>
                          </div>
                        </div>
                      )}
                      <div className="permohonan-detail-item">
                        <div className="permohonan-detail-icon-wrap">
                           <Info size={18} className="permohonan-detail-icon" />
                        </div>
                        <div className="permohonan-detail-text-wrap">
                          <span className="permohonan-detail-label">{t.descReason}</span>
                          <span className="permohonan-detail-value-light">{item.keterangan || '-'}</span>
                        </div>
                      </div>
                      <div className="permohonan-detail-item">
                        <div className="permohonan-detail-icon-wrap">
                           <FileText size={18} className="permohonan-detail-icon" />
                        </div>
                        <div className="permohonan-detail-text-wrap">
                          <span className="permohonan-detail-label">DIAJUKAN PADA</span>
                          <span className="permohonan-detail-value-light">
                            {new Date(item.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':')}
                          </span>
                        </div>
                      </div>
                      {(item.status === 'Disetujui' || item.status === 'Ditolak') && item.approved_by_name && (
                        <div className="permohonan-detail-item">
                          <div className="permohonan-detail-icon-wrap">
                             <UserCheck size={18} className="permohonan-detail-icon" style={{ color: item.status === 'Disetujui' ? 'var(--success-color)' : 'var(--error-color)' }} />
                          </div>
                          <div className="permohonan-detail-text-wrap">
                            <span className="permohonan-detail-label">{item.status.toUpperCase()} OLEH</span>
                            <span className="permohonan-detail-value" style={{ fontWeight: 600 }}>{item.approved_by_name}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              )})}
            </div>
          ) : (
            <div className="empty-state glass-panel">
              <Info size={32} />
              <p>{t.noPermitHistory}</p>
            </div>
          )}
        </div>
      )}

      {enlargedPhoto && (
        <div 
          className="modal-overlay" 
          onClick={() => setEnlargedPhoto(null)}
        >
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedPhoto.startsWith('/') ? enlargedPhoto : `/${enlargedPhoto}`} className="image-modal-img" alt="Foto Diperbesar" />
            <button 
              onClick={() => setEnlargedPhoto(null)}
              className="image-modal-close"
            >
              <X size={32} />
            </button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div
          onClick={() => setDeleteConfirm(null)}
          className="modal-overlay modal-overlay-light"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="confirm-modal-content"
          >
            <div className="confirm-modal-body">
              <div className="confirm-modal-icon-wrap">
                <AlertTriangle size={28} color="#ef4444" />
              </div>
              <div>
                <h3 className="confirm-modal-title">Hapus Permohonan?</h3>
                <p className="confirm-modal-text">
                  Permohonan <strong>{deleteConfirm.tipe}</strong> ini akan dihapus secara permanen dan tidak dapat dikembalikan.
                </p>
              </div>
              <div className="confirm-modal-actions">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="btn-cancel"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeletePermohonan}
                  disabled={deleting}
                  className={`btn-danger ${deleting ? 'disabled' : ''}`}
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {deleting ? 'Menghapus...' : 'Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
