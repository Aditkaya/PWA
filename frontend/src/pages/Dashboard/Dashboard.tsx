import { useState, useEffect } from 'react'
import { Clock, Coffee, LogOut, LogIn, CalendarDays, Sun, Plane, AlertCircle, Info } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import CameraModal from '../../components/CameraModal'
import IzinModal from '../../components/IzinModal'

interface HistoryItem {
  id: number
  date: string
  type: string
  time: string
  status: string
}

export default function Dashboard() {
  const [time, setTime] = useState(new Date())
  const { user } = useAuthStore()
  const [historyData, setHistoryData] = useState<HistoryItem[]>([])
  const [userGroup, setUserGroup] = useState<string>('')
  const [userProfile, setUserProfile] = useState<any>(null)
  
  // Custom Alert States
  const [alertState, setAlertState] = useState<{show: boolean, type: 'warning' | 'info', title: string, message: string}>({
    show: false, type: 'warning', title: '', message: ''
  })

  // Izin Modal States
  const [isIzinModalOpen, setIsIzinModalOpen] = useState(false)
  const [izinModalType, setIzinModalType] = useState('Izin 1/2 Hari')

  
  // Camera Modal States
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [attendanceType, setAttendanceType] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchHistoryAndProfile = async () => {
    if (!user?.id) return
    try {
      // Fetch History
      const histRes = await fetch(`http://localhost:8000/api/history?user_id=${user.id}`)
      if (histRes.ok) {
        const histData = await histRes.json()
        setHistoryData(histData.data)
      }
      
      // Fetch Profile
      const profRes = await fetch(`http://localhost:8000/api/profile?user_id=${user.id}`)
      if (profRes.ok) {
        const profData = await profRes.json()
        setUserProfile(profData.data)
        setUserGroup(profData.data?.grup || '')
      }
    } catch (error) {
      console.error("Failed to fetch data", error)
    }
  }

  useEffect(() => {
    fetchHistoryAndProfile()
  }, [user])

  const now = new Date()
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const todayCheckIn = historyData.find(h => h.date === todayString && (h.type.toLowerCase().includes('in') || h.type.toLowerCase().includes('masuk')))
  
  // Checking break status (if they have break out but no break in)
  const todayBreakOut = historyData.find(h => h.date === todayString && h.type.toLowerCase().includes('istirahat keluar'))
  const todayBreakIn = historyData.find(h => h.date === todayString && h.type.toLowerCase().includes('istirahat masuk'))
  const hasFullDayLeave = userProfile?.has_full_day_leave || false

  const handleAttendanceClick = (type: string) => {
    setAttendanceType(type)
    setIsCameraOpen(true)
  }

  const handleCapture = async (imageSrc: string, locationData?: {address: string, lat: number, lng: number, outOfRangeMessage?: string}) => {
    if (!user?.id) return
    
    try {
      // Create form data with base64 image and location
      const formData = new FormData()
      formData.append('user_id', user.id.toString())
      formData.append('tipe', attendanceType)
      formData.append('foto_base64', imageSrc)
      
      if (locationData) {
        formData.append('latitude', locationData.lat.toString())
        formData.append('longitude', locationData.lng.toString())
        let detailLokasi = locationData.address;
        if (locationData.outOfRangeMessage) {
          detailLokasi += ` (${locationData.outOfRangeMessage})`;
        }
        formData.append('detail_lokasi', detailLokasi)
      }

      const response = await fetch('http://localhost:8000/api/attendance/break', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('Absen ' + attendanceType + ' berhasil dicatat!')
        fetchHistoryAndProfile() // Refresh data
      } else {
        alert('Gagal mencatat absensi')
      }
    } catch (error) {
      console.error("Attendance Error:", error)
      alert('Terjadi kesalahan sistem')
    }
    setIsCameraOpen(false)
  }

  return (
    <div className="dashboard fade-in">
      <CameraModal 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={handleCapture}
        attendanceType={attendanceType}
      />

      <div className="greeting-card glass-panel">
        <h2>Selamat Pagi, Karyawan!</h2>
        <p>{hasFullDayLeave ? 'Status Anda hari ini: Izin (Tidak Masuk).' : 'Mari mulai hari dengan produktif dan penuh semangat.'}</p>
      </div>

      <div className="clock-section">
        <div className="time">
          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
        </div>
        <div className="date">{time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="action-section">
        <button 
          className="btn-attendance check-in" 
          disabled={hasFullDayLeave || !!todayCheckIn}
          onClick={() => handleAttendanceClick('Check In')}
        >
          <Clock size={22} strokeWidth={2} />
          <span>{todayCheckIn ? `Masuk: ${todayCheckIn.time}` : 'Check In'}</span>
        </button>
        <button 
          className="btn-attendance check-out" 
          disabled={hasFullDayLeave || !todayCheckIn}
          onClick={() => handleAttendanceClick('Check Out')}
        >
          <Clock size={22} strokeWidth={2} />
          <span>Check Out</span>
        </button>
        <button 
          className="btn-attendance break-out" 
          disabled={hasFullDayLeave || !todayCheckIn || !!todayBreakOut}
          onClick={() => handleAttendanceClick('Istirahat Keluar')}
        >
          <Coffee size={22} strokeWidth={2} />
          <span>{todayBreakOut ? `Istirahat: ${todayBreakOut.time}` : 'Istirahat Keluar'}</span>
        </button>
        <button 
          className="btn-attendance break-in" 
          disabled={hasFullDayLeave || !todayBreakOut || !!todayBreakIn}
          onClick={() => handleAttendanceClick('Istirahat Masuk')}
        >
          <Coffee size={22} strokeWidth={2} />
          <span>{todayBreakIn ? `Kembali: ${todayBreakIn.time}` : 'Istirahat Masuk'}</span>
        </button>
        <button className="btn-attendance permit-out" disabled={hasFullDayLeave}>
          <LogOut size={22} strokeWidth={2} />
          <span>Izin Keluar</span>
        </button>
        <button className="btn-attendance permit-in" disabled>
          <LogIn size={22} strokeWidth={2} />
          <span>Izin Masuk</span>
        </button>
      </div>

      <div className="leave-section glass-panel">
        <h3 className="section-title">Pengajuan Cuti & Izin</h3>
        <div className="leave-grid">
          <button className="btn-leave" onClick={() => {
            setIzinModalType('Izin Full Day')
            setIsIzinModalOpen(true)
          }}>
            <CalendarDays size={20} strokeWidth={2} />
            <span>Izin Full Day</span>
          </button>
          <button className="btn-leave" onClick={() => {
            setIzinModalType('Izin 1/2 Hari')
            setIsIzinModalOpen(true)
          }}>
            <Sun size={20} strokeWidth={2} />
            <span>Izin 1/2 Hari</span>
          </button>
          <button 
            className="btn-leave" 
            onClick={() => {
              if (userGroup && userGroup.toUpperCase().includes('CUTI')) {
                setAlertState({
                  show: true,
                  type: 'info',
                  title: 'Segera Hadir',
                  message: 'Fitur form pengajuan Cuti Tahunan sedang dalam tahap pengembangan.'
                })
              } else {
                setAlertState({
                  show: true,
                  type: 'warning',
                  title: 'Akses Ditolak',
                  message: 'ANDA BELUM BISA MELAKUKAN CUTI'
                })
              }
            }}
          >
            <Plane size={20} strokeWidth={2} />
            <span>Cuti Tahunan</span>
          </button>
        </div>
      </div>

      <div className="copyright-footer">
        <span>&copy; {new Date().getFullYear()} PT ALEXINDO YAKINPRIMA JAKARTA</span>
        <span className="app-name">AYPSIS Attendance</span>
      </div>

      {alertState.show && (
        <div className="custom-alert-overlay" onClick={() => setAlertState({ ...alertState, show: false })}>
          <div className="custom-alert-box" onClick={(e) => e.stopPropagation()}>
            <div className={`custom-alert-icon ${alertState.type}`}>
              {alertState.type === 'warning' ? <AlertCircle size={28} /> : <Info size={28} />}
            </div>
            <h3 className="custom-alert-title">{alertState.title}</h3>
            <p className="custom-alert-message">{alertState.message}</p>
            <button 
              className="custom-alert-button"
              onClick={() => setAlertState({ ...alertState, show: false })}
            >
              Mengerti
            </button>
          </div>
        </div>
      )}

      <IzinModal 
        isOpen={isIzinModalOpen}
        onClose={() => setIsIzinModalOpen(false)}
        userProfile={userProfile}
        defaultType={izinModalType}
        onSuccess={() => {
          setAlertState({
            show: true,
            type: 'info',
            title: 'Berhasil',
            message: 'Permohonan izin Anda telah berhasil dikirim dan menunggu persetujuan.'
          })
        }}
      />
    </div>
  )
}

