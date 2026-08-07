import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Loader2, MapPin, ChevronDown, ChevronUp, X, FileText } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import { useLangStore } from '../../store/lang.store'
import { translations } from '../../utils/translations'

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
  keterangan: string
  status: string
  created_at: string
}

export default function History() {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'absensi' | 'permohonan'>('absensi')
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [permohonanData, setPermohonanData] = useState<PermohonanItem[]>([])
  const [loading, setLoading] = useState(true)

  const { lang } = useLangStore()
  const t = translations[lang]

  const [currentDate, setCurrentDate] = useState(new Date()) // Set to current date
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<number[]>([])

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return
      try {
        setLoading(true)
        const [histRes, permRes] = await Promise.all([
          fetch(`/api/history?user_id=${user.id}`),
          fetch(`/api/permohonan?user_id=${user.id}`)
        ])

        if (histRes.ok) {
          const histResult = await histRes.json()
          setHistoryData(histResult.data)
        }
        
        if (permRes.ok) {
          const permResult = await permRes.json()
          setPermohonanData(permResult.data)
        }
      } catch (error) {
        console.error("Failed to fetch history data", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
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
  
  const toggleItem = (id: number) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  if (loading) {
    return (
      <div className="history-page fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    )
  }

  return (
    <div className="history-page fade-in">
      <div className="tab-switcher glass-panel" style={{ display: 'flex', marginBottom: '20px', padding: '6px', gap: '6px', borderRadius: '16px' }}>
        <button 
          onClick={() => setActiveTab('absensi')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'absensi' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'absensi' ? '#fff' : 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.3s' }}
        >
          {t.absensi}
        </button>
        <button 
          onClick={() => setActiveTab('permohonan')}
          style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: activeTab === 'permohonan' ? 'var(--accent-color)' : 'transparent', color: activeTab === 'permohonan' ? '#fff' : 'var(--text-secondary)', fontWeight: 500, transition: 'all 0.3s' }}
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
                
                return (
                  <div 
                    key={day} 
                    className={`calendar-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
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
                    <div key={item.id} className="history-card glass-panel" style={{ overflow: 'hidden' }}>
                      <div 
                        className="history-card-header" 
                        onClick={() => toggleItem(item.id)}
                        style={{ cursor: 'pointer', paddingBottom: expandedItems.includes(item.id) ? '12px' : '0' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span className={`badge ${item.type.replace(/\s+/g, '-').toLowerCase()}`}>
                            {item.type}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.time}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`status-text ${item.status === 'Tepat Waktu' || item.status === 'Disetujui' ? 'status-ok' : 'status-warn'}`}>
                            {item.status}
                          </span>
                          {expandedItems.includes(item.id) ? <ChevronUp size={20} color="var(--text-secondary)" /> : <ChevronDown size={20} color="var(--text-secondary)" />}
                        </div>
                      </div>
                      
                      {expandedItems.includes(item.id) && (
                        <div className="history-card-body" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px', marginTop: '12px' }}>
                          <div className="history-details">
                            <div className="detail-item">
                              <Info size={16} />
                              <span>{t.status}: {item.status}</span>
                            </div>
                            {item.keterangan && (
                              <div className="detail-item" style={{ gridColumn: '1 / -1', marginTop: '4px', alignItems: 'flex-start' }}>
                                <FileText size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                                  <strong>{t.descReason}:</strong> {item.keterangan}
                                </span>
                              </div>
                            )}
                            <div className="detail-item" style={{ gridColumn: '1 / -1', marginTop: '4px', alignItems: 'flex-start' }}>
                              <MapPin size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>
                                {item.location ? (
                                  <>
                                    {item.location}
                                    <br />
                                    <span style={{ color: 'var(--accent-color)', fontSize: '0.75rem' }}>
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
                                src={`/${item.foto}`} 
                                alt="Foto Absensi" 
                                onClick={() => setEnlargedPhoto(item.foto!)}
                                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px', cursor: 'pointer' }} 
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
          {permohonanData.length > 0 ? (
            <div className="history-list">
              {permohonanData.map(item => (
                <div key={`${item.tipe}-${item.id}`} className="history-card glass-panel" style={{ overflow: 'hidden' }}>
                  <div className="history-card-header" style={{ paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className={`badge`} style={{ background: item.tipe === 'Cuti' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(168, 85, 247, 0.2)', color: item.tipe === 'Cuti' ? '#38bdf8' : '#c084fc', border: `1px solid ${item.tipe === 'Cuti' ? '#38bdf8' : '#c084fc'}` }}>
                        {item.tipe} - {item.jenis}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`status-text ${item.status === 'Disetujui' ? 'status-ok' : item.status === 'Ditolak' ? 'status-err' : 'status-warn'}`} style={{ color: item.status === 'Ditolak' ? '#ef4444' : undefined }}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <div className="history-card-body" style={{ paddingTop: '16px' }}>
                    <div className="history-details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="detail-item" style={{ alignItems: 'flex-start', display: 'flex', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <CalendarIcon size={18} style={{ color: 'var(--accent-color)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{t.date}</span>
                          <span style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                            {item.tanggal_mulai} {item.tanggal_mulai !== item.tanggal_selesai && ` s/d ${item.tanggal_selesai}`}
                          </span>
                        </div>
                      </div>
                      <div className="detail-item" style={{ alignItems: 'flex-start', display: 'flex', gap: '12px' }}>
                        <div style={{ padding: '8px', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                           <Info size={18} style={{ color: 'var(--accent-color)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '2px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{t.descReason}</span>
                          <span style={{ fontSize: '0.95rem', lineHeight: '1.4', color: 'var(--text-primary)' }}>{item.keterangan || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
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
          className="image-modal-overlay" 
          onClick={() => setEnlargedPhoto(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <img src={`/${enlargedPhoto}`} style={{ width: '100%', borderRadius: '12px', objectFit: 'contain' }} alt="Foto Diperbesar" />
            <button 
              onClick={() => setEnlargedPhoto(null)}
              style={{ position: 'absolute', top: '-40px', right: 0, background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={32} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
