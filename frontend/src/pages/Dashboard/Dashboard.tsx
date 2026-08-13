import { useState, useEffect } from 'react'
import { Clock, Coffee, LogOut, LogIn, CalendarDays, Sun, Plane, AlertCircle, Info, XCircle } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import CameraModal from '../../components/CameraModal'
import IzinModal from '../../components/IzinModal'
import CutiModal from '../../components/CutiModal'
import PermitOutModal from '../../components/PermitOutModal'
import LupaAbsenModal from '../../components/LupaAbsenModal'
import LemburModal from '../../components/LemburModal'
import { useLangStore } from '../../store/lang.store'
import { useModeStore } from '../../store/mode.store'
import { translations } from '../../utils/translations'
import { useToast } from '../../contexts/ToastContext'
import './dashboard.css'

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
  const [permohonanData, setPermohonanData] = useState<any[]>([])
  const [userGroup, setUserGroup] = useState<string>('')
  const [userProfile, setUserProfile] = useState<any>(null)
  
  const { lang } = useLangStore()
  const { isOvertimeMode } = useModeStore()
  const t = translations[lang]
  const { showToast } = useToast()
  
  // Custom Alert States
  const [alertState, setAlertState] = useState<{show: boolean, type: 'warning' | 'info' | 'error', title: string, message: string}>({
    show: false, type: 'warning', title: '', message: ''
  })

  // Izin Modal States
  const [isIzinModalOpen, setIsIzinModalOpen] = useState(false)
  const [izinModalType, setIzinModalType] = useState('Izin 1/2 Hari')
  const [isCutiModalOpen, setIsCutiModalOpen] = useState(false)
  const [isLupaAbsenModalOpen, setIsLupaAbsenModalOpen] = useState(false)
  const [isLemburModalOpen, setIsLemburModalOpen] = useState(false)

  
  // Camera Modal States
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isPermitOutOpen, setIsPermitOutOpen] = useState(false)
  const [attendanceType, setAttendanceType] = useState('')
  const [permitReason, setPermitReason] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 11) return t.morning;
    if (hour < 15) return t.afternoon;
    if (hour < 18) return t.evening;
    return t.night;
  };

  const getFirstName = () => {
    if (!userProfile?.nama_lengkap) return 'Karyawan';
    const names = userProfile.nama_lengkap.trim().split(' ');
    if (names.length === 0 || !names[0]) return 'Karyawan';
    const first = names[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const fetchHistoryAndProfile = async () => {
    if (!user?.id) return
    try {
      // Fetch History
      const histRes = await fetch(`/api/history?user_id=${user.id}`)
      if (histRes.ok) {
        const histData = await histRes.json()
        setHistoryData(histData.data)
      }
      
      // Fetch Permohonan
      const permRes = await fetch(`/api/permohonan?user_id=${user.id}`)
      if (permRes.ok) {
        const permData = await permRes.json()
        setPermohonanData(permData.data)
      }

      // Fetch Profile
      const profRes = await fetch(`/api/profile?user_id=${user.id}`)
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
  
  const isTodayRecord = (h: HistoryItem) => {
    if (h.date !== todayString) return false;
    if (todayCheckIn) {
      return h.time >= todayCheckIn.time;
    }
    // If no check-in today, assume anything before 06:00 is from yesterday's night shift
    return h.time >= '06:00';
  };

  const todayCheckOut = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('out') || h.type.toLowerCase().includes('pulang')) && !h.type.toLowerCase().includes('permit') && !h.type.toLowerCase().includes('lembur'))
  
  // Checking break status (if they have break out but no break in)
  const todayBreakOut = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('istirahat keluar') || h.type.toLowerCase().includes('break out')))
  const todayBreakIn = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('istirahat masuk') || h.type.toLowerCase().includes('break in')))
  // Multiple permit tracking
  const permitOuts = historyData.filter(h => isTodayRecord(h) && h.type.toLowerCase().includes('izin keluar'))
  const permitIns = historyData.filter(h => isTodayRecord(h) && h.type.toLowerCase().includes('izin masuk'))
  
  const todayOvertimeInHistory = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('mulai lembur') || h.type.toLowerCase() === 'lembur' || h.type.toLowerCase() === 'lembur masuk'))
  const todayLemburRequest = permohonanData.find(p => p.tipe === 'Lembur' && p.tanggal_mulai === todayString)
  const isLemburPending = todayLemburRequest && todayLemburRequest.status.toLowerCase() === 'pending'
  const isLemburApproved = todayLemburRequest && (todayLemburRequest.status.toLowerCase() === 'disetujui' || todayLemburRequest.status.toLowerCase() === 'approved')
  
  // Combine history and permohonan data for Mulai Lembur
  const todayOvertimeIn = todayOvertimeInHistory || (todayLemburRequest && (isLemburPending || isLemburApproved) ? { time: new Date(todayLemburRequest.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') } : null)
  const isOvertimeStarted = !!todayOvertimeIn;

  const todayOvertimeOut = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('selesai lembur') || h.type.toLowerCase() === 'lembur_pulang' || h.type.toLowerCase() === 'pulang lembur'))

  const isCurrentlyOnPermit = permitOuts.length > permitIns.length
  const lastPermitOut = isCurrentlyOnPermit ? permitOuts[0] : null
  const lastPermitIn = permitIns[0]
  
  const hasFullDayLeave = userProfile?.has_full_day_leave || false

  const handleAttendanceClick = (type: string) => {
    setAttendanceType(type)
    setPermitReason('')
    if (type.toLowerCase().includes('izin keluar') || type.toLowerCase().includes('permit out')) {
      setIsPermitOutOpen(true)
    } else if (type === 'Mulai Lembur') {
      setIsLemburModalOpen(true)
    } else {
      setIsCameraOpen(true)
    }
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
      
      if (permitReason) {
        formData.append('keterangan', permitReason)
      }

      if (attendanceType === 'Mulai Lembur') {
        // Use the lembur API endpoint
        const now = new Date()
        formData.append('tanggal', now.toISOString().split('T')[0])
        formData.append('jam_mulai', now.toTimeString().slice(0, 5))
        formData.append('jam_selesai', '00:00') // Placeholder as it was removed from UI
        // Keterangan is already appended above, but we can ensure it's there
        if (!formData.has('keterangan')) {
          formData.append('keterangan', permitReason)
        }
        // For foto we need to make sure the backend accepts it
        const response = await fetch('/api/attendance/lembur', {
          method: 'POST',
          body: formData,
        })
        
        if (response.ok) {
          showToast('Pengajuan Lembur berhasil dikirim', 'success')
          fetchHistoryAndProfile() // Refresh data
        } else {
          showToast(t.attendanceFailed, 'error')
        }
      } else {
        // Default attendance logic
        const response = await fetch('/api/attendance/break', {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          showToast(t.attendanceRecorded.replace('{type}', attendanceType), 'success')
          fetchHistoryAndProfile() // Refresh data
        } else {
          showToast(t.attendanceFailed, 'error')
        }
      }
    } catch (error) {
      console.error("Attendance Error:", error)
      showToast(t.systemError, 'error')
    }
    setIsCameraOpen(false)
    setPermitReason('')
  }

  const handleLemburSubmit = (keterangan: string) => {
    setPermitReason(keterangan);
    setIsLemburModalOpen(false);
    setTimeout(() => {
      setIsCameraOpen(true);
    }, 100);
  }

  const handlePermitOutSubmit = async (keterangan: string, _locationData: {lat: number, lng: number, address: string} | null) => {
    // Simpan keterangan dan buka kamera
    setPermitReason(keterangan);
    setIsPermitOutOpen(false);
    
    // Beri sedikit jeda agar modal tutup dulu, baru buka kamera
    setTimeout(() => {
      setIsCameraOpen(true);
    }, 100);
  }

  return (
    <div className={`dashboard fade-in ${isOvertimeMode ? 'overtime-active' : ''}`}>
      <CameraModal 
        isOpen={isCameraOpen} 
        onClose={() => setIsCameraOpen(false)} 
        onCapture={handleCapture}
        attendanceType={attendanceType}
      />

      {isOvertimeMode && (
        <div className="overtime-badge fade-in">
          <Clock size={16} />
          {t.activeOvertimeBadge}
        </div>
      )}

      <div className="greeting-card glass-panel">
        <h2>{getGreeting()}, {getFirstName()}!</h2>
        <p>{hasFullDayLeave ? t.statusLeave : (isOvertimeMode ? t.statusOvertime : t.statusActive)}</p>
      </div>

      <div className="clock-section">
        <div className="time">
          {time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
        </div>
        <div className="date">{time.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      <div className="action-section">
        {isOvertimeMode ? (
          <>
            <button 
              className="btn-attendance overtime-in" 
              disabled={hasFullDayLeave || !!todayOvertimeIn}
              onClick={() => handleAttendanceClick('Mulai Lembur')}
            >
              <Clock size={24} strokeWidth={1.25} />
              <span>
                {todayOvertimeIn 
                  ? (isLemburPending ? `Menunggu Approval` : `${t.startOvertime}: ${todayOvertimeIn.time}`) 
                  : t.startOvertime}
              </span>
            </button>
            <button 
              className="btn-attendance overtime-out" 
              disabled={hasFullDayLeave || !isOvertimeStarted || !!todayOvertimeOut}
              onClick={() => handleAttendanceClick('Selesai Lembur')}
            >
              <Clock size={24} strokeWidth={1.25} />
              <span>{todayOvertimeOut ? `${t.endOvertime}: ${todayOvertimeOut.time}` : t.endOvertime}</span>
            </button>
          </>
        ) : (
          <>
            <button 
              className="btn-attendance check-in" 
              disabled={hasFullDayLeave || !!todayCheckIn}
              onClick={() => handleAttendanceClick('Masuk')}
            >
              <Clock size={24} strokeWidth={1.25} />
              <span>{todayCheckIn ? `${t.masuk}: ${todayCheckIn.time}` : t.checkIn}</span>
            </button>
            <button 
              className="btn-attendance check-out" 
              disabled={hasFullDayLeave || !todayCheckIn || !!todayCheckOut}
              onClick={() => handleAttendanceClick('Pulang')}
            >
              <Clock size={24} strokeWidth={1.25} />
              <span>{todayCheckOut ? `${t.pulang}: ${todayCheckOut.time}` : t.checkOut}</span>
            </button>
            <button 
              className="btn-attendance break-out" 
              disabled={hasFullDayLeave || !todayCheckIn || !!todayBreakOut || !!todayCheckOut}
              onClick={() => handleAttendanceClick('Istirahat Keluar')}
            >
              <Coffee size={24} strokeWidth={1.25} />
              <span>{todayBreakOut ? `${t.istirahat}: ${todayBreakOut.time}` : t.breakOut}</span>
            </button>
            <button 
              className="btn-attendance break-in" 
              disabled={hasFullDayLeave || !todayBreakOut || !!todayBreakIn}
              onClick={() => handleAttendanceClick('Istirahat Masuk')}
            >
              <Coffee size={24} strokeWidth={1.25} />
              <span>{todayBreakIn ? `${t.kembali}: ${todayBreakIn.time}` : t.breakIn}</span>
            </button>
            <button 
              className="btn-attendance permit-out" 
              disabled={hasFullDayLeave || !todayCheckIn || isCurrentlyOnPermit || !!todayCheckOut}
              onClick={() => handleAttendanceClick('Izin Keluar')}
            >
              <LogOut size={24} strokeWidth={1.25} />
              <span>{lastPermitOut ? `${t.keluar}: ${lastPermitOut.time}` : t.permitOut}</span>
            </button>
            <button 
              className="btn-attendance permit-in" 
              disabled={hasFullDayLeave || !isCurrentlyOnPermit}
              onClick={() => handleAttendanceClick('Izin Masuk')}
            >
              <LogIn size={24} strokeWidth={1.25} />
              <span>{lastPermitIn ? `${t.kembali}: ${lastPermitIn.time}` : t.permitIn}</span>
            </button>
          </>
        )}
      </div>

      {!isOvertimeMode && (
        <div className="leave-section glass-panel">
          <h3 className="section-title">{t.leavePermit}</h3>
          <div className="leave-grid">
            <button className="btn-leave" onClick={() => {
              setIzinModalType('Izin Full Day')
              setIsIzinModalOpen(true)
            }}>
              <CalendarDays size={24} strokeWidth={1.25} />
              <span>{t.fullDayPermit}</span>
            </button>
            <button className="btn-leave" onClick={() => {
              setIzinModalType('Izin 1/2 Hari')
              setIsIzinModalOpen(true)
            }}>
              <Sun size={24} strokeWidth={1.25} />
              <span>{t.halfDayPermit}</span>
            </button>
            <button 
              className="btn-leave" 
              onClick={() => {
                if (userGroup && userGroup.toUpperCase().includes('CUTI')) {
                  setIsCutiModalOpen(true)
                } else {
                  setAlertState({
                    show: true,
                    type: 'info',
                    title: t.accessDenied,
                    message: t.notEligibleLeave
                  })
                }
              }}
            >
              <Plane size={24} strokeWidth={1.25} />
              <span>{t.annualLeave}</span>
            </button>
            <button 
              className="btn-leave" 
              onClick={() => setIsLupaAbsenModalOpen(true)}
            >
              <Clock size={24} strokeWidth={1.25} />
              <span>Lupa Absen</span>
            </button>
          </div>
        </div>
      )}

      <div className="copyright-footer">
        <span>&copy; {new Date().getFullYear()} PT ALEXINDO YAKINPRIMA JAKARTA</span>
        <span className="app-name">AYPSIS Attendance</span>
      </div>

      {alertState.show && (
        <div className="custom-alert-overlay" onClick={() => setAlertState({ ...alertState, show: false })}>
          <div className="custom-alert-box" onClick={(e) => e.stopPropagation()}>
            <div className={`custom-alert-icon ${alertState.type}`}>
              {alertState.type === 'error' ? <XCircle size={28} /> : 
               alertState.type === 'warning' ? <AlertCircle size={28} /> : 
               <Info size={28} />}
            </div>
            <h3 className="custom-alert-title">{alertState.title}</h3>
            <p className="custom-alert-message">{alertState.message}</p>
            <button 
              className="custom-alert-button"
              onClick={() => setAlertState({ ...alertState, show: false })}
            >
              {t.gotIt}
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
            title: t.success,
            message: t.permitSuccessMessage
          })
        }}
      />

      <CutiModal
        isOpen={isCutiModalOpen}
        onClose={() => setIsCutiModalOpen(false)}
        userProfile={userProfile}
      />

      <LupaAbsenModal
        isOpen={isLupaAbsenModalOpen}
        onClose={() => setIsLupaAbsenModalOpen(false)}
        userProfile={userProfile}
      />

      <LemburModal
        isOpen={isLemburModalOpen}
        onClose={() => setIsLemburModalOpen(false)}
        userProfile={userProfile}
        onSubmit={handleLemburSubmit}
      />

      <PermitOutModal
        isOpen={isPermitOutOpen}
        onClose={() => setIsPermitOutOpen(false)}
        onSubmit={handlePermitOutSubmit}
        type={attendanceType}
      />
    </div>
  )
}
