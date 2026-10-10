import { useState, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { Clock, Coffee, LogOut, LogIn, CalendarDays, Sun, Plane, AlertCircle, Info, XCircle, ScanFace, ClipboardCheck, CalendarClock, Shield, WifiOff, RefreshCw, Megaphone } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import CameraModal from '../../components/CameraModal'
import IzinModal from '../../components/IzinModal'
import CutiModal from '../../components/CutiModal'
import PermitOutModal from '../../components/PermitOutModal'
import LupaAbsenModal from '../../components/LupaAbsenModal'
import PerencanaanLemburModal from '../../components/PerencanaanLemburModal'
import PamfletCarousel from '../../components/PamfletCarousel'
import { useLangStore } from '../../store/lang.store'
import { useModeStore } from '../../store/mode.store'
import { translations } from '../../utils/translations'
import { useToast } from '../../contexts/ToastContext'
import { saveOfflineAttendance, getPendingOfflineCount, syncOfflineAttendances, getOfflineAttendances, type OfflineAttendanceItem } from '../../utils/offlineQueue'
import './dashboard.css'

interface HistoryItem {
  id: number | string
  date: string
  type: string
  time: string
  status: string
  is_overnight?: boolean
  actual_date?: string
  occurred_at?: string
  is_offline?: boolean
}

const NEWS_API_BASE = import.meta.env.VITE_API_URL ?? ''

function sanitizeAnnouncementHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const escapeText = (text: string) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const serialize = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent || '')
    if (!(node instanceof HTMLElement)) return Array.from(node.childNodes).map(serialize).join('')

    const tag = node.tagName.toLowerCase()
    if (['script', 'style', 'iframe', 'object', 'svg', 'math'].includes(tag)) return ''
    if (tag === 'br') return '<br>'

    let content = Array.from(node.childNodes).map(serialize).join('')
    const weight = node.style.fontWeight
    const isBold = tag === 'b' || tag === 'strong' || weight === 'bold' || Number.parseInt(weight, 10) >= 600
    const isItalic = tag === 'i' || tag === 'em' || node.style.fontStyle === 'italic'
    const isUnderlined = tag === 'u' || node.style.textDecorationLine.includes('underline')
    if (isBold) content = `<strong>${content}</strong>`
    if (isItalic) content = `<em>${content}</em>`
    if (isUnderlined) content = `<u>${content}</u>`
    if (['p', 'div', 'li'].includes(tag)) content += ' '
    return content
  }

  return Array.from(document.body.childNodes).map(serialize).join('').replace(/\s+/g, ' ').trim()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [time, setTime] = useState(new Date())
  const { user } = useAuthStore()
  const [historyData, setHistoryData] = useState<HistoryItem[]>(() => {
    if (!user?.id) return [];
    try {
      const cached = localStorage.getItem(`cached_history_${user.id}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  })
  const [, setPermohonanData] = useState<any[]>([])
  const [userGroup, setUserGroup] = useState<string>('')
  const [userProfile, setUserProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  })
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0)
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [announcementMarkup, setAnnouncementMarkup] = useState('')
  const [announcementDuration, setAnnouncementDuration] = useState(22)
  
  const { lang } = useLangStore()
  const { isOvertimeMode } = useModeStore()
  const t = translations[lang]
  const { showToast } = useToast()
  
  // Use Outlet Context for Face Registration Modal
  const { openFaceRegistration } = useOutletContext<{ openFaceRegistration: () => void }>() || { openFaceRegistration: () => {} };
  
  // Custom Alert States
  const [alertState, setAlertState] = useState<{show: boolean, type: 'warning' | 'info' | 'error', title: string, message: string}>({
    show: false, type: 'warning', title: '', message: ''
  })

  // Izin Modal States
  const [isIzinModalOpen, setIsIzinModalOpen] = useState(false)
  const [izinModalType, setIzinModalType] = useState('Izin 1/2 Hari')
  const [isCutiModalOpen, setIsCutiModalOpen] = useState(false)
  const [isLupaAbsenModalOpen, setIsLupaAbsenModalOpen] = useState(false)
  const [isPerencanaanModalOpen, setIsPerencanaanModalOpen] = useState(false)

  
  // Camera Modal States
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isPermitOutOpen, setIsPermitOutOpen] = useState(false)
  const [attendanceType, setAttendanceType] = useState('')
  const [permitReason, setPermitReason] = useState('')

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadAnnouncements = async () => {
      try {
        const deptParam = userProfile?.departemen ? `&departemen=${encodeURIComponent(userProfile.departemen)}` : ''
        const response = await fetch(`${NEWS_API_BASE}/api/berita?limit=50${deptParam}`)
        if (!response.ok) return
        const result = await response.json()
        if (!result.success || !Array.isArray(result.data) || cancelled) return

        const messages = result.data
          .map((item: { konten?: string; kecepatan_teks?: number | string | null }) => sanitizeAnnouncementHtml(item.konten || ''))
          .filter(Boolean)

        if (!cancelled) setAnnouncementMarkup(messages.join('  •  '))
        const speedValue = Number(result.data.find((item: { konten?: string; kecepatan_teks?: number | string | null }) => item.konten?.trim())?.kecepatan_teks)
        if (!cancelled) {
          setAnnouncementDuration(Number.isFinite(speedValue) && speedValue > 0
            ? Math.min(120, Math.max(5, speedValue))
            : 22)
        }
      } catch {
        // Dashboard tetap bisa digunakan saat layanan berita sedang offline.
      }
    }

    loadAnnouncements()
    const refreshTimer = window.setInterval(loadAnnouncements, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(refreshTimer)
    }
  }, [userProfile?.departemen])

  const getGreeting = () => {
    const hour = time.getHours();
    if (hour < 11) return t.morning;
    if (hour < 15) return t.afternoon;
    if (hour < 18) return t.evening;
    return t.night;
  };

  const getGreetingGradient = () => {
    const hour = time.getHours();
    // Use dynamic gradients based on time of day
    if (hour < 11) return 'linear-gradient(135deg, rgba(250, 204, 21, 0.1) 0%, rgba(253, 186, 116, 0.05) 100%)'; // Morning (yellow/orange)
    if (hour < 15) return 'linear-gradient(135deg, rgba(56, 189, 248, 0.1) 0%, rgba(186, 230, 253, 0.05) 100%)'; // Afternoon (blue)
    if (hour < 18) return 'linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(252, 165, 165, 0.05) 100%)'; // Evening (orange/red)
    return 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(167, 139, 250, 0.05) 100%)'; // Night (indigo/purple)
  };

  const getFirstName = () => {
    if (!userProfile?.nama_lengkap) return 'Karyawan';
    const names = userProfile.nama_lengkap.trim().split(' ');
    if (names.length === 0 || !names[0]) return 'Karyawan';
    const first = names[0];
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const getHonorific = () => {
    const gender = String(
      userProfile?.jenis_kelamin ?? userProfile?.gender ?? userProfile?.jk ?? ''
    ).trim().toLowerCase();
    if (/^(p|perempuan|wanita|female|f)$/.test(gender)) return 'Ibu';
    if (/^(l|laki[-\s]?laki|pria|male|m)$/.test(gender)) return 'Bapak';
    return '';
  };

  const loadOfflinePendingToHistory = async () => {
    try {
      const offlineItems = await getOfflineAttendances();
      setPendingOfflineCount(offlineItems.length);
      if (offlineItems.length > 0 && user?.id) {
        const offlineHistoryItems: HistoryItem[] = offlineItems
          .filter(item => item.user_id === user.id)
          .map(item => {
            const timePart = item.waktu_offline.split(' ')[1] || '';
            const datePart = item.waktu_offline.split(' ')[0] || '';
            return {
              id: item.id,
              date: datePart,
              actual_date: datePart,
              occurred_at: item.waktu_offline,
              type: item.tipe,
              time: timePart.slice(0, 5),
              status: 'Tersimpan Offline',
              is_offline: true
            };
          });

        setHistoryData(prev => {
          const existingIds = new Set(prev.map(h => String(h.id)));
          const toAdd = offlineHistoryItems.filter(item => !existingIds.has(String(item.id)));
          return [...toAdd, ...prev];
        });
      }
    } catch (e) {
      console.warn('Gagal memuat pending offline ke history:', e);
    }
  };

  const runAutoSync = async () => {
    if (isSyncing) return;
    const count = await getPendingOfflineCount();
    if (count === 0) return;
    setIsSyncing(true);
    try {
      const res = await syncOfflineAttendances();
      if (res.success > 0) {
        showToast(`Berhasil menyinkronkan ${res.success} absensi offline ke server!`, 'success');
        fetchHistoryAndProfile();
      }
      if (res.errors.length > 0 && res.failed > 0) {
        showToast(res.errors[0], 'error');
      }
    } catch (e) {
      console.warn('Auto-sync offline attendance error:', e);
    } finally {
      setIsSyncing(false);
      const remaining = await getPendingOfflineCount();
      setPendingOfflineCount(remaining);
    }
  };

  const fetchHistoryAndProfile = async () => {
    if (!user?.id) return
    try {
      // Fetch History
      const histRes = await fetch(`/api/history?user_id=${user.id}`).catch(() => null)
      if (histRes && histRes.ok) {
        const histData = await histRes.json()
        setHistoryData(histData.data)
        try {
          localStorage.setItem(`cached_history_${user.id}`, JSON.stringify(histData.data))
        } catch {}
      }
      
      // Fetch Permohonan
      const permRes = await fetch(`/api/permohonan?user_id=${user.id}`).catch(() => null)
      if (permRes && permRes.ok) {
        const permData = await permRes.json()
        setPermohonanData(permData.data)

        const pendingLembur = permData.data.filter((item: any) => item.tipe === 'Lembur' && item.status.toLowerCase().includes('pending')).length;
        const lastPendingLembur = parseInt(sessionStorage.getItem('pending_lembur_karyawan') || '0', 10);
        
        if (pendingLembur > lastPendingLembur && pendingLembur > 0) {
          showToast(`Data lembur Anda telah masuk ke dalam antrean approval.`, 'info');
          if ('Notification' in window) {
            if (Notification.permission === 'granted') {
              new Notification('Pengajuan Lembur', { body: `Data lembur Anda telah masuk dan menunggu persetujuan.` });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  new Notification('Pengajuan Lembur', { body: `Data lembur Anda telah masuk dan menunggu persetujuan.` });
                }
              });
            }
          }
        }
        sessionStorage.setItem('pending_lembur_karyawan', pendingLembur.toString());
      }

      // Fetch Profile
      const profRes = await fetch(`/api/profile?user_id=${user.id}`).catch(() => null)
      if (profRes && profRes.ok) {
        const profData = await profRes.json()
        setUserProfile(profData.data)
        setUserGroup(profData.data?.grup || '')
        try {
          localStorage.setItem('cached_profile', JSON.stringify(profData.data))
        } catch {}
        
        const isSpv = profData.data?.is_supervisor;
        const job = profData.data?.pekerjaan?.trim().toUpperCase();
        if (isSpv || job === 'HRD' || job === 'IT') {
          try {
            const apprRes = await fetch(`/api/hrd/permohonan?user_id=${user.id}`).catch(() => null)
            if (apprRes && apprRes.ok) {
              const apprResult = await apprRes.json();
              const rawData = apprResult.data || [];
              
              const seen = new Set();
              const deduplicatedData = rawData.filter((item: any) => {
                const key = `${item.nik}-${item.tipe}-${item.jenis}-${item.tanggal_mulai}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
              });
              
              const pendingCount = deduplicatedData.filter((item: any) => item.status.toLowerCase().includes('pending')).length;
              setPendingApprovalCount(pendingCount);
              
              const lastCount = parseInt(sessionStorage.getItem('pending_approval_count') || '0', 10);
              if (pendingCount > lastCount && pendingCount > 0) {
                showToast(`Ada ${pendingCount} permohonan izin/cuti baru yang menunggu persetujuan.`, 'info');
                
                if ('Notification' in window) {
                  if (Notification.permission === 'granted') {
                    new Notification('Permohonan Masuk', { body: `Ada ${pendingCount} permohonan izin/cuti baru.` });
                  } else if (Notification.permission !== 'denied') {
                    Notification.requestPermission().then(permission => {
                      if (permission === 'granted') {
                        new Notification('Permohonan Masuk', { body: `Ada ${pendingCount} permohonan izin/cuti baru.` });
                      }
                    });
                  }
                }
              }
              sessionStorage.setItem('pending_approval_count', pendingCount.toString());
            }
          } catch (e) {
            console.error("Failed to fetch approvals", e);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data", error)
    } finally {
      loadOfflinePendingToHistory();
    }
  }

  useEffect(() => {
    fetchHistoryAndProfile()

    const handleOnline = () => {
      runAutoSync();
    };
    window.addEventListener('online', handleOnline);

    const interval = setInterval(() => {
      if (navigator.onLine) {
        getPendingOfflineCount().then(c => {
          setPendingOfflineCount(c);
          if (c > 0) {
            runAutoSync();
          }
        });
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(interval);
    };
  }, [user])

  const now = new Date()
  const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // Tanggal kemarin untuk mendeteksi sesi lembur lintas malam
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayString = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`

  const todayCheckIn = historyData.find(h => h.date === todayString && (h.type.toLowerCase() === 'masuk' || h.type.toLowerCase() === 'check in' || (h.type.toLowerCase().includes('masuk') && !h.type.toLowerCase().includes('istirahat') && !h.type.toLowerCase().includes('izin') && !h.type.toLowerCase().includes('lembur'))))
  
  const isTodayRecord = (h: HistoryItem) => {
    if (h.date !== todayString) return false;
    if (todayCheckIn) {
      return h.time >= todayCheckIn.time;
    }
    // If no check-in today, assume anything before 06:00 is from yesterday's night shift
    return h.time >= '06:00';
  };

  const todayCheckOut = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('out') || h.type.toLowerCase().includes('pulang')) && !h.type.toLowerCase().includes('permit') && !h.type.toLowerCase().includes('lembur') && !h.type.toLowerCase().includes('istirahat') && !h.type.toLowerCase().includes('break'))
  
  // Checking break status (if they have break out but no break in)
  const todayBreakOut = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('istirahat keluar') || h.type.toLowerCase().includes('break out')))
  const todayBreakIn = historyData.find(h => isTodayRecord(h) && (h.type.toLowerCase().includes('istirahat masuk') || h.type.toLowerCase().includes('break in')))
  // Multiple permit tracking
  const permitOuts = historyData.filter(h => isTodayRecord(h) && h.type.toLowerCase().includes('izin keluar'))
  const permitIns = historyData.filter(h => isTodayRecord(h) && h.type.toLowerCase().includes('izin masuk'))

  // =====================================================================
  // OVERNIGHT OVERTIME DETECTION
  // Deteksi sesi "Mulai Lembur" yang dimulai H-1 dan belum selesai.
  // Ini memastikan tombol "Selesai Lembur" tetap aktif di dini hari.
  // =====================================================================
  const overtimeStartTypes = (t: string) => ['mulai lembur', 'lembur masuk', 'lembur'].includes(t.toLowerCase().replace(/_/g, ' ').trim())
  const overtimeEndTypes   = (t: string) => ['selesai lembur', 'lembur pulang', 'lembur keluar'].includes(t.toLowerCase().replace(/_/g, ' ').trim())

  // History is ordered by the actual timestamp; only the latest session can be active.
  const latestOvertime = historyData.find(h => overtimeStartTypes(h.type) || overtimeEndTypes(h.type))
  const latestStartDate = latestOvertime?.occurred_at
    ? new Date(latestOvertime.occurred_at.replace(' ', 'T') + '+07:00').getTime()
    : NaN
  const isRecentStart = Number.isFinite(latestStartDate)
    ? now.getTime() - latestStartDate >= 0 && now.getTime() - latestStartDate <= 24 * 60 * 60 * 1000
    : latestOvertime?.date === todayString || latestOvertime?.date === yesterdayString
  const todayOvertimeIn = latestOvertime && overtimeStartTypes(latestOvertime.type) && isRecentStart
    ? latestOvertime : undefined
  const hasActiveOvernightSession = !!todayOvertimeIn && todayOvertimeIn.date === yesterdayString
  const isOvertimeStarted = !!todayOvertimeIn
  const todayOvertimeOut = latestOvertime && overtimeEndTypes(latestOvertime.type)
    && (latestOvertime.actual_date ?? latestOvertime.date) === todayString ? latestOvertime : undefined

  const isCurrentlyOnPermit = permitOuts.length > permitIns.length
  const lastPermitOut = isCurrentlyOnPermit ? permitOuts[0] : null
  const lastPermitIn = permitIns[0]
  
  const hasFullDayLeave = userProfile?.has_full_day_leave || false

  const handleAttendanceClick = (type: string) => {
    setAttendanceType(type)
    setPermitReason('')
    if (type.toLowerCase().includes('izin keluar') || type.toLowerCase().includes('permit out')) {
      setIsPermitOutOpen(true)
    } else {
      setIsCameraOpen(true)
    }
  }



  const handleOfflineSave = async (
    imageSrc: string,
    locationData?: {address: string, lat: number, lng: number, accuracy: number, locationAgeMs: number, outOfRangeMessage?: string},
    detailLokasi?: string
  ) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const waktuOffline = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

    const offlineItem: OfflineAttendanceItem = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      user_id: user!.id,
      tipe: attendanceType,
      foto_base64: imageSrc,
      latitude: locationData?.lat ?? null,
      longitude: locationData?.lng ?? null,
      gps_accuracy: locationData?.accuracy ?? null,
      location_age_ms: locationData?.locationAgeMs ?? null,
      detail_lokasi: detailLokasi || null,
      keterangan: permitReason || null,
      waktu_offline: waktuOffline,
      created_at: Date.now(),
      status: 'pending'
    };

    await saveOfflineAttendance(offlineItem);
    const count = await getPendingOfflineCount();
    setPendingOfflineCount(count);

    // Optimistically update history so UI updates immediately
    const optimisticHistory: HistoryItem = {
      id: offlineItem.id,
      date: dateStr,
      actual_date: dateStr,
      occurred_at: waktuOffline,
      type: attendanceType,
      time: timeStr,
      status: 'Tersimpan Offline',
      is_offline: true
    };

    setHistoryData(prev => {
      const updated = [optimisticHistory, ...prev];
      if (user?.id) {
        try {
          localStorage.setItem(`cached_history_${user.id}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });

    showToast(`Mode Offline: Absen ${attendanceType} tersimpan di HP! Akan otomatis dikirim saat server aktif.`, 'info');
  };

  const handleCapture = async (imageSrc: string, locationData?: {address: string, lat: number, lng: number, accuracy: number, locationAgeMs: number, outOfRangeMessage?: string}) => {
    if (!user?.id) throw new Error('Silakan masuk kembali sebelum absen.')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    let detailLokasi = locationData?.address || '';
    if (locationData?.outOfRangeMessage) {
      detailLokasi += ` (${locationData.outOfRangeMessage})`;
    }

    try {
      // Create form data with base64 image and location
      const formData = new FormData()
      formData.append('user_id', user.id.toString())
      formData.append('tipe', attendanceType)
      formData.append('foto_base64', imageSrc)
      
      if (locationData) {
        formData.append('latitude', locationData.lat.toString())
        formData.append('longitude', locationData.lng.toString())
        formData.append('gps_accuracy', locationData.accuracy.toString())
        formData.append('location_age_ms', locationData.locationAgeMs.toString())
        formData.append('detail_lokasi', detailLokasi)
      }
      
      if (permitReason) {
        formData.append('keterangan', permitReason)
      }

      // Check if navigator is already offline before fetch
      if (!navigator.onLine) {
        await handleOfflineSave(imageSrc, locationData, detailLokasi);
        return;
      }

      try {
        const response = await fetch('/api/attendance/break', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          if (data.status === 'Persetujuan' || data.is_approval) {
            showToast(data.message || 'Absensi di luar radius lokasi wajib dan memerlukan persetujuan.', 'info');
          } else {
            showToast(data.message || t.attendanceRecorded.replace('{type}', attendanceType), 'success');
          }
          fetchHistoryAndProfile(); // Refresh data
        } else {
          // If server error 502, 503, 504 (server offline / bad gateway)
          if ([502, 503, 504].includes(response.status)) {
            await handleOfflineSave(imageSrc, locationData, detailLokasi);
            return;
          }
          const data = await response.json().catch(() => ({}))
          throw new Error(data.message || t.attendanceFailed)
        }
      } catch (fetchError: any) {
        const isOfflineLike = !navigator.onLine || 
          fetchError?.name === 'AbortError' || 
          (fetchError?.message && (
            fetchError.message.includes('fetch') || 
            fetchError.message.includes('network') || 
            fetchError.message.includes('Failed') ||
            fetchError.message.includes('NetworkError')
          ));

        if (isOfflineLike) {
          await handleOfflineSave(imageSrc, locationData, detailLokasi);
          return;
        }
        throw fetchError;
      }
    } finally {
      clearTimeout(timeout)
      setIsCameraOpen(false)
      setPermitReason('')
    }
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

      <div 
        className="greeting-card glass-panel"
        style={{ background: getGreetingGradient() }}
      >
        <h2>{getGreeting()}, {getHonorific() && `${getHonorific()} `}{getFirstName()}!</h2>
        <p>{hasFullDayLeave ? t.statusLeave : (isOvertimeMode ? t.statusOvertime : t.statusActive)}</p>
      </div>

      {pendingOfflineCount > 0 && (
        <div className="offline-banner glass-panel">
          <div className="offline-banner-left">
            <div className="offline-pulse-dot"></div>
            <WifiOff size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div>
              <div className="offline-title">
                {pendingOfflineCount} Absen Offline Tersimpan di HP
              </div>
              <div className="offline-desc">
                Data absensi aman di memori HP. Otomatis dikirim saat server aktif.
              </div>
            </div>
          </div>
          <button 
            className="btn-sync-offline" 
            onClick={runAutoSync}
            disabled={isSyncing}
            title="Kirim antrean ke server sekarang"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Sinkron...' : 'Sinkronkan'}
          </button>
        </div>
      )}



      {userProfile && userProfile.is_face_verified === false && (
        <div className="warning-banner glass-panel" style={{ borderLeft: '4px solid #ef4444', padding: '12px 16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ScanFace color="#ef4444" size={24} style={{ flexShrink: 0 }} />
            <div>
              <h4 style={{ margin: '0 0 4px 0', color: '#ef4444', fontSize: '0.95rem' }}>Verifikasi Wajah Belum Dilakukan</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Anda harus melakukan registrasi wajah (wajib) agar dapat menggunakan fitur absensi.</p>
            </div>
          </div>
          <button 
            onClick={openFaceRegistration}
            style={{ alignSelf: 'flex-start', background: '#ef4444', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ScanFace size={16} /> Buka Kamera Verifikasi
          </button>
        </div>
      )}

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
              disabled={hasFullDayLeave || !!todayOvertimeIn || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Mulai Lembur')}
            >
              <Clock size={20} strokeWidth={1.5} />
              <span>
                {todayOvertimeIn
                  ? hasActiveOvernightSession
                    ? `${t.startOvertime}: ${todayOvertimeIn.time} (kemarin)`
                    : `${t.startOvertime}: ${todayOvertimeIn.time}`
                  : t.startOvertime
                }
              </span>
            </button>
            <button 
              className="btn-attendance overtime-out" 
              disabled={hasFullDayLeave || !isOvertimeStarted || !!todayOvertimeOut || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Selesai Lembur')}
            >
              <Clock size={20} strokeWidth={1.5} />
              <span>{todayOvertimeOut ? `${t.endOvertime}: ${todayOvertimeOut.time}` : t.endOvertime}</span>
            </button>
          </>
        ) : (
          <>
            <button 
              className="btn-attendance check-in" 
              disabled={hasFullDayLeave || !!todayCheckIn || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Masuk')}
            >
              <Clock size={20} strokeWidth={1.5} />
              <span>{todayCheckIn ? `${t.masuk}: ${todayCheckIn.time}` : t.checkIn}</span>
            </button>
            <button 
              className="btn-attendance check-out" 
              disabled={hasFullDayLeave || !todayCheckIn || !!todayCheckOut || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Pulang')}
            >
              <Clock size={20} strokeWidth={1.5} />
              <span>{todayCheckOut ? `${t.pulang}: ${todayCheckOut.time}` : t.checkOut}</span>
            </button>
            <button 
              className="btn-attendance break-out" 
              disabled={hasFullDayLeave || !todayCheckIn || !!todayBreakOut || !!todayBreakIn || !!todayCheckOut || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Istirahat Keluar')}
            >
              <Coffee size={20} strokeWidth={1.5} />
              <span>{todayBreakOut ? `${t.istirahat}: ${todayBreakOut.time}` : t.breakOut}</span>
            </button>
            <button 
              className="btn-attendance break-in" 
              disabled={hasFullDayLeave || !todayBreakOut || !!todayBreakIn || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Istirahat Masuk')}
            >
              <Coffee size={20} strokeWidth={1.5} />
              <span>{todayBreakIn ? `${t.kembali}: ${todayBreakIn.time}` : t.breakIn}</span>
            </button>
            <button 
              className="btn-attendance permit-out" 
              disabled={hasFullDayLeave || !todayCheckIn || isCurrentlyOnPermit || !!todayCheckOut || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Izin Keluar')}
            >
              <LogOut size={20} strokeWidth={1.5} />
              <span>{lastPermitOut ? `${t.keluar}: ${lastPermitOut.time}` : t.permitOut}</span>
            </button>
            <button 
              className="btn-attendance permit-in" 
              disabled={hasFullDayLeave || !isCurrentlyOnPermit || (userProfile && userProfile.is_face_verified === false)}
              onClick={() => handleAttendanceClick('Izin Masuk')}
            >
              <LogIn size={20} strokeWidth={1.5} />
              <span>{lastPermitIn ? `${t.kembali}: ${lastPermitIn.time}` : t.permitIn}</span>
            </button>
          </>
        )}
      </div>

      {/* ── Pamflet Banner Carousel ── */}
      {!isOvertimeMode && (
        <div style={{ padding: '4px 0 0 0' }}>
          <PamfletCarousel />
        </div>
      )}

      <div className="announcement-ticker glass-panel" role="status" aria-label="Pengumuman">
        <div className="announcement-ticker-label"><Megaphone size={17} /><span>Pengumuman</span></div>
        <div className="announcement-ticker-viewport">
          <div className="announcement-ticker-track" style={{ animationDuration: `${announcementDuration}s` }}>
            <span dangerouslySetInnerHTML={{ __html: announcementMarkup || 'Belum ada pengumuman saat ini.' }} />
            <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: announcementMarkup || 'Belum ada pengumuman saat ini.' }} />
          </div>
        </div>
      </div>

      {!isOvertimeMode && (
        <div className="leave-section glass-panel">
          <h3 className="section-title">{t.leavePermit}</h3>
          <div className="leave-grid">
            {/* fp() helper: true jika fitur aktif atau belum diset */}
            {(() => {
              const fp = (key: string) =>
                !userProfile?.feature_permissions || userProfile.feature_permissions[key] !== false
              const isIT = userProfile?.pekerjaan?.trim().toUpperCase() === 'IT'
              const isHrdOrSpv = userProfile && (
                userProfile.pekerjaan?.trim().toUpperCase() === 'HRD' ||
                userProfile.pekerjaan?.trim().toUpperCase() === 'IT' ||
                userProfile.is_supervisor
              )
              return (
                <>
                  {fp('izin_sakit') && (
                    <button className="btn-leave" onClick={() => {
                      setIzinModalType('Izin Sakit')
                      setIsIzinModalOpen(true)
                    }}>
                      <CalendarDays size={20} strokeWidth={1.5} />
                      <span>{t.fullDayPermit}</span>
                    </button>
                  )}
                  {fp('izin_setengah_hari') && (
                    <button className="btn-leave" onClick={() => {
                      setIzinModalType('Izin 1/2 Hari')
                      setIsIzinModalOpen(true)
                    }}>
                      <Sun size={20} strokeWidth={1.5} />
                      <span>{t.halfDayPermit}</span>
                    </button>
                  )}
                  {fp('cuti_tahunan') && (
                    <button
                      className="btn-leave"
                      onClick={() => {
                        if (userGroup && userGroup.toUpperCase().includes('CUTI')) {
                          setIsCutiModalOpen(true)
                        } else {
                          setAlertState({ show: true, type: 'info', title: t.accessDenied, message: t.notEligibleLeave })
                        }
                      }}
                    >
                      <Plane size={20} strokeWidth={1.5} />
                      <span>{t.annualLeave}</span>
                    </button>
                  )}
                  {fp('lupa_absen') && (
                    <button className="btn-leave" onClick={() => setIsLupaAbsenModalOpen(true)}>
                      <Clock size={20} strokeWidth={1.5} />
                      <span>Lupa Absen</span>
                    </button>
                  )}
                  {isHrdOrSpv && fp('perencanaan_lembur') && (
                    <button className="btn-leave" onClick={() => setIsPerencanaanModalOpen(true)}>
                      <CalendarClock size={20} strokeWidth={1.5} />
                      <span>Perencanaan Lembur</span>
                    </button>
                  )}
                  {isHrdOrSpv && fp('approval_karyawan') && (
                    <button
                      className="btn-leave"
                      onClick={() => navigate('/hrd/approval')}
                      style={{ position: 'relative' }}
                    >
                      {pendingApprovalCount > 0 && (
                        <div style={{
                          position: 'absolute', top: '-6px', right: '-6px',
                          background: '#ef4444', color: 'white', fontSize: '0.75rem',
                          fontWeight: 'bold', width: '24px', height: '24px',
                          borderRadius: '50%', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', border: '2px solid var(--panel-bg)',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                        }}>
                          {pendingApprovalCount}
                        </div>
                      )}
                      <ClipboardCheck size={20} strokeWidth={1.5} />
                      <span>Approval Karyawan</span>
                    </button>
                  )}
                  {/* Tombol IT Admin – hanya muncul untuk user IT */}
                  {isIT && (
                    <button
                      className="btn-leave"
                      onClick={() => navigate('/it/admin')}
                      style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))', borderColor: 'rgba(99,102,241,0.3)' }}
                    >
                      <Shield size={20} strokeWidth={1.5} color="#6366f1" />
                      <span style={{ color: '#6366f1' }}>IT Admin</span>
                    </button>
                  )}
                </>
              )
            })()}
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

      <PerencanaanLemburModal
        isOpen={isPerencanaanModalOpen}
        onClose={() => setIsPerencanaanModalOpen(false)}
        userProfile={userProfile}
        onSuccess={() => fetchHistoryAndProfile()}
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
