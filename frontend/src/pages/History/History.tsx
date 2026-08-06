import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Info, Loader2, X, MapPin } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'

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
}

export default function History() {
  const { user } = useAuthStore()
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [currentDate, setCurrentDate] = useState(new Date()) // Set to current date
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [enlargedPhoto, setEnlargedPhoto] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return
      try {
        const response = await fetch(`http://localhost:8000/api/history?user_id=${user.id}`)
        if (response.ok) {
          const result = await response.json()
          setHistoryData(result.data)
        }
      } catch (error) {
        console.error("Failed to fetch history", error)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [user])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]

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

  if (loading) {
    return (
      <div className="history-page fade-in" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    )
  }

  return (
    <div className="history-page fade-in">
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
          <span>Min</span><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span>
        </div>
        <div className="calendar-grid">
          {blanks.map((_, idx) => (
            <div key={`blank-${idx}`} className="calendar-cell empty"></div>
          ))}
          {days.map((day) => {
            const events = getEventsForDay(day)
            const isToday = day === 6 && currentDate.getMonth() === 7 && currentDate.getFullYear() === 2026 // hardcoded today for demo
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
            Detail: {selectedDay} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h3>
          
          {selectedEvents.length > 0 ? (
            <div className="history-list">
              {selectedEvents.map((item) => (
                <div key={item.id} className="history-card glass-panel">
                  <div className="history-card-header">
                    <span className={`badge ${item.type.replace(/\s+/g, '-').toLowerCase()}`}>
                      {item.type}
                    </span>
                    <span className={`status-text ${item.status === 'Tepat Waktu' || item.status === 'Disetujui' ? 'status-ok' : 'status-warn'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="history-card-body">
                    <div className="history-details">
                      <div className="detail-item">
                        <Clock size={16} />
                        <span>{item.time}</span>
                      </div>
                      <div className="detail-item">
                        <Info size={16} />
                        <span>Status: {item.status}</span>
                      </div>
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
                          ) : 'Data lokasi tidak tersimpan di sistem'}
                        </span>
                      </div>
                    </div>
                    {item.foto && (
                      <div className="history-photo">
                        <img 
                          src={`http://localhost:8000/${item.foto}`} 
                          alt="Foto Absensi" 
                          onClick={() => setEnlargedPhoto(item.foto!)}
                          style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '8px', marginTop: '10px', cursor: 'pointer' }} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state glass-panel">
              <Info size={32} />
              <p>Tidak ada riwayat absensi pada tanggal ini.</p>
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
            <img src={`http://localhost:8000/${enlargedPhoto}`} style={{ width: '100%', borderRadius: '12px', objectFit: 'contain' }} alt="Foto Diperbesar" />
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
