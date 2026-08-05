import { useState, useEffect } from 'react'
import { Clock, MapPin } from 'lucide-react'

export default function Dashboard() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="dashboard fade-in">
      <div className="greeting-card glass-panel">
        <h2>Selamat Pagi, Karyawan!</h2>
        <p>Mari mulai hari dengan produktif.</p>
      </div>

      <div className="clock-section">
        <div className="time">{time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
        <div className="date">{time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="action-section">
        <button className="btn-attendance check-in">
          <Clock size={24} />
          <span>Check In</span>
        </button>
        <button className="btn-attendance check-out" disabled>
          <Clock size={24} />
          <span>Check Out</span>
        </button>
      </div>

      <div className="location-status">
        <MapPin size={16} />
        <span>Mencari lokasi...</span>
      </div>
    </div>
  )
}
