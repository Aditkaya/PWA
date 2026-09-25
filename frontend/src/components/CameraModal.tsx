import { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, Loader2, AlertCircle, Zap, RefreshCw, MapPin } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { useAuthStore } from '../store/auth.store';
import { translations } from '../utils/translations';
import '../styles/cameramodal.css';

const activeAiModel = 'Server';
const MAX_GPS_AGE_MS = 30000;
const MAX_GPS_ACCURACY = 50;

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string, locationData?: {address: string, lat: number, lng: number, accuracy: number, locationAgeMs: number, outOfRangeMessage?: string}) => void | Promise<void>;
  attendanceType: string;
}

function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return Math.round(R * c * 1000); // Distance in meters
}

export default function CameraModal({ isOpen, onClose, onCapture, attendanceType: _attendanceType }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const verifiedFrameRef = useRef<HTMLCanvasElement | null>(null);
  const capturingRef = useRef(false);
  const sessionRef = useRef(0);
  const mapTileRef = useRef<HTMLImageElement | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [gpsError, setGpsError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  
  // Identity matching state
  
  const { lang } = useLangStore();
  const { user } = useAuthStore();

  const t = translations[lang];

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Location States
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null); // dalam meter
  const [gpsTimestamp, setGpsTimestamp] = useState<number | null>(null);
  const [gpsRetry, setGpsRetry] = useState(0);
  const [address, setAddress] = useState(t.findingLocation);

  const [allowedLocations, setAllowedLocations] = useState<any[]>([]);

  useEffect(() => {
    sessionRef.current += 1;
    return () => { sessionRef.current += 1; };
  }, [isOpen, user?.id]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setCameraError('');
      setGpsError('');
      setValidationError('');
      setStatusMsg('');
      setIsProcessing(false);
      capturingRef.current = false;
      verifiedFrameRef.current = null;
      setIsCameraReady(false);
      setLocationCoords(null);
      setGpsAccuracy(null);
      setGpsTimestamp(null);
      setAddress(t.findingLocation);
    }
  }, [isOpen, t.findingLocation]);

  // Fetch Allowed Locations once & preload logo
  useEffect(() => {
    if (isOpen) {
      const url = user?.id ? `/api/lokasi?user_id=${user.id}` : '/api/lokasi';
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.data) setAllowedLocations(data.data);
        })
        .catch(err => console.error('Failed to fetch lokasi:', err));

      const img = new Image();
      img.src = '/logo.png';
      img.onload = () => setLogoImage(img);
    }
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Watch Location Real-time (selalu gunakan fix GPS terbaru)
  useEffect(() => {
    if (!isOpen) return;

    let watchId: number;
    let cancelled = false;
    setLocationCoords(null);
    setGpsAccuracy(null);
    setGpsTimestamp(null);
    setGpsError('');

    if (!window.isSecureContext) {
      setGpsError('GPS membutuhkan koneksi HTTPS atau localhost.');
    } else if (navigator.geolocation) {
      const handleSuccess = (position: GeolocationPosition) => {
        if (cancelled) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const rawAccuracy = position.coords.accuracy;
        const accuracy = typeof rawAccuracy === 'number' && Number.isFinite(rawAccuracy) && rawAccuracy > 0 ? rawAccuracy : null;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
          setLocationCoords(null);
          setGpsTimestamp(null);
          setGpsError('Koordinat GPS tidak valid. Silakan cari ulang lokasi.');
          return;
        }

        setGpsError('');
        // GPS selalu menggunakan fix terbaru tanpa filter selisih 5 meter
        setGpsAccuracy(accuracy);
        setGpsTimestamp(Number.isFinite(position.timestamp) ? position.timestamp : null);
        setLocationCoords({ lat, lng });
      };

      // Selalu gunakan enableHighAccuracy: true tanpa fallback ke low accuracy
      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        (error) => {
          if (cancelled) return;
          console.warn("GPS error:", error);
          if (error.code === 1) {
            setGpsError(t.gpsFailed || 'Izin akses lokasi ditolak. Silakan aktifkan izin lokasi.');
            setAddress(t.gpsFailed || 'Izin lokasi ditolak');
          } else if (error.code === 2) {
            setGpsError('Sinyal GPS tidak tersedia. Pastikan GPS aktif dan berada di area terbuka.');
            setAddress('Sinyal GPS tidak tersedia');
          } else if (error.code === 3) {
            setGpsError('Waktu pencarian GPS habis. Mohon pastikan sinyal GPS aktif.');
            setAddress('Pencarian GPS timeout');
          } else {
            setGpsError(t.gpsFailed);
            setAddress(t.gpsFailed);
          }
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
      );
    } else {
      setGpsError(t.gpsNotSupported);
      setAddress(t.gpsNotSupported);
    }

    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, gpsRetry, t.gpsFailed, t.gpsNotSupported]);

  const isAccuracyAcceptable = gpsAccuracy !== null && gpsAccuracy > 0 && gpsAccuracy <= MAX_GPS_ACCURACY;
  const gpsAge = gpsTimestamp === null ? Infinity : Math.max(Date.now(), currentTime.getTime()) - gpsTimestamp;
  const isLocationReady = !!locationCoords && isAccuracyAcceptable && gpsAge >= 0 && gpsAge <= MAX_GPS_AGE_MS && !gpsError;

  // Round only the address lookup (~11 m), never the attendance coordinates.
  const addressLat = isLocationReady ? locationCoords!.lat.toFixed(4) : null;
  const addressLng = isLocationReady ? locationCoords!.lng.toFixed(4) : null;
  useEffect(() => {
    if (!isOpen || addressLat === null || addressLng === null) {
      setAddress(t.findingLocation);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setAddress(t.translatingAddress);
    const timer = setTimeout(() => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${addressLat}&lon=${addressLng}`, { signal: controller.signal })
        .then(res => { if (!res.ok) throw new Error('Geocoding failed'); return res.json(); })
        .then(data => { if (!cancelled) setAddress(data.display_name || 'Alamat tidak tersedia'); })
        .catch(() => { if (!cancelled) setAddress('Alamat tidak tersedia'); });
    }, 1000);
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [isOpen, addressLat, addressLng, t.findingLocation, t.translatingAddress]);

  // Calculate radius synchronously during render — guaranteed no race condition
  // Accuracy dijadikan quality gate terpisah, bukan otomatis ditambahkan ke radius
  const outOfRangeMessage = useMemo(() => {
    if (!isLocationReady || !locationCoords || !Array.isArray(allowedLocations) || allowedLocations.length === 0) return '';

    const { lat, lng } = locationCoords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';

    let minDistance = Infinity;
    let targetLocName = '';
    let hasValidLocation = false;

    for (const loc of allowedLocations) {
      if (!loc) continue;
      const locLat = parseFloat(loc.latitude);
      const locLng = parseFloat(loc.longitude);
      const locRadius = parseFloat(loc.radius);

      // Validasi koordinat dan radius kantor agar aman terhadap data invalid
      if (!Number.isFinite(locLat) || !Number.isFinite(locLng) || !Number.isFinite(locRadius) || locRadius <= 0) {
        continue;
      }

      hasValidLocation = true;
      const dist = getDistanceFromLatLonInM(lat, lng, locLat, locLng);
      if (!Number.isFinite(dist)) continue;

      if (dist < minDistance) {
        minDistance = dist;
        targetLocName = loc.nama_lokasi || '';
      }

      // Bandingkan jarak langsung terhadap radius lokasi kantor (murni tanpa penambahan toleransi)
      if (dist <= locRadius) {
        minDistance = -1; // Berada di dalam radius lokasi
        break;
      }
    }

    if (!hasValidLocation) return '';

    if (minDistance > 0 && minDistance !== Infinity) {
      return targetLocName
        ? `${t.outOfRange} ${targetLocName}: ${Math.round(minDistance)}m`
        : `${t.outOfRange}: ${Math.round(minDistance)}m`;
    }
    return '';
  }, [isLocationReady, locationCoords, allowedLocations, t.outOfRange]);

  // Stop even a late camera permission response after closing the modal.
  useEffect(() => {
    if (!isOpen || cameraError) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    if (!window.isSecureContext) {
      setCameraError('Kamera membutuhkan koneksi HTTPS atau localhost.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Browser atau perangkat ini tidak mendukung akses kamera.');
      return;
    }
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    }).then(result => {
      stream = result;
      if (cancelled || !video) {
        result.getTracks().forEach(track => track.stop());
        return;
      }
      video.onloadeddata = () => {
        if (!cancelled) setIsCameraReady(true);
      };
      video.srcObject = result;
    }).catch((error: unknown) => {
      if (cancelled) return;
      const errorName = error instanceof DOMException ? error.name : '';
      if (errorName === 'NotFoundError') {
        setCameraError('Kamera tidak ditemukan pada perangkat ini.');
      } else if (errorName === 'NotReadableError') {
        setCameraError('Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.');
      } else if (errorName === 'SecurityError' || errorName === 'NotAllowedError') {
        setCameraError('Akses kamera ditolak. Periksa izin kamera untuk alamat situs ini.');
      } else {
        setCameraError(t.cameraDenied);
      }
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (video) {
        video.onloadeddata = null;
        video.srcObject = null;
      }
    };
  }, [isOpen, cameraError, t.cameraDenied]);

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach(track => track.stop());
  };

  // Fetch the optional map while recognition runs, never on the capture path.
  useEffect(() => {
    mapTileRef.current = null;
    if (!isOpen || !locationCoords) return;
    const zoom = 16;
    const n = 2 ** zoom;
    const x = Math.floor((locationCoords.lng + 180) / 360 * n);
    const latRad = locationCoords.lat * Math.PI / 180;
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => { mapTileRef.current = img; };
    img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    return () => { img.onload = null; mapTileRef.current = null; };
  }, [isOpen, locationCoords]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleTakePhoto = async () => {
    const video = videoRef.current;
    const age = gpsTimestamp === null ? Infinity : Date.now() - gpsTimestamp;
    if (!isLocationReady || age < 0 || age > MAX_GPS_AGE_MS) return;
    if (!isOpen || !isCameraReady || !locationCoords || !user?.id || !video || capturingRef.current || cameraError || gpsError) return;
    capturingRef.current = true;
    setIsProcessing(true);
    setValidationError('');
    setStatusMsg('Mengirim foto dan memvalidasi wajah di server...');
    const session = sessionRef.current;
    try {
      const frame = document.createElement('canvas');
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      const context = frame.getContext('2d');
      if (!context || !frame.width || !frame.height) throw new Error('Kamera belum siap. Silakan coba lagi.');
      context.drawImage(video, 0, 0);
      verifiedFrameRef.current = frame;
      await captureAndValidate();
    } catch (error) {
      if (session !== sessionRef.current) return;
      capturingRef.current = false;
      setIsProcessing(false);
      verifiedFrameRef.current = null;
      setStatusMsg('');
      const message = error instanceof Error ? error.message : 'Gagal memverifikasi wajah.';
      setValidationError(message);
    }
  };

  const captureAndValidate = async () => {
    if (!isOpen || !verifiedFrameRef.current || !canvasRef.current) return;

    const video = verifiedFrameRef.current;
    
    // Draw verified frame to canvas
    const canvas = canvasRef.current;
    canvas.width = video.width;
    canvas.height = video.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      capturingRef.current = false;
      setIsProcessing(false);
      return;
    }
    
    // Keep the same orientation as the registered photo for server matching.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);


    // Draw Watermark Background
    const s = Math.max(canvas.width, canvas.height) / 1200; // scaling factor
    const padding = 15 * s;
    const boxWidth = Math.min(320 * s, canvas.width - (padding * 2));
    let boxHeight = 105 * s;
    if (outOfRangeMessage) {
      boxHeight += 15 * s;
    }
    // Move box to top
    const boxY = padding;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(padding, boxY, boxWidth, boxHeight, 8 * s);
      ctx.fill();
    } else {
      ctx.fillRect(padding, boxY, boxWidth, boxHeight);
    }

    // Draw logo inside the box (top-right of the box)
    if (logoImage) {
      const logoWidth = 40 * s;
      const logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      ctx.drawImage(logoImage, padding + boxWidth - logoWidth - (12 * s), boxY + (12 * s), logoWidth, logoHeight);
    }

    // Draw Watermark Text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    
    let currentY = boxY + (22 * s);
    
    ctx.font = `bold ${11 * s}px sans-serif`;
    ctx.fillText('PT ALEXINDO YAKINPRIMA JAKARTA', padding + (12 * s), currentY);
    currentY += 15 * s;
    
    ctx.font = `${9.5 * s}px sans-serif`;
    const shortAddress = address.length > 50 ? address.substring(0, 50) + '...' : address;
    ctx.fillText(shortAddress, padding + (12 * s), currentY);
    currentY += 15 * s;
    
    if (locationCoords) {
      ctx.fillText(`${locationCoords.lat.toFixed(8)} | ${locationCoords.lng.toFixed(8)}`, padding + (12 * s), currentY);
    }
    currentY += 15 * s;

    if (outOfRangeMessage) {
      ctx.fillStyle = '#ef4444'; // Red for warning
      ctx.font = `bold ${9 * s}px sans-serif`;
      ctx.fillText(`${t.warning}: ${outOfRangeMessage}. ${t.distanceRecorded}`, padding + (12 * s), currentY);
      currentY += 15 * s;
      ctx.fillStyle = 'white'; // Reset to white
    }

    const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    ctx.fillText(`${dateStr} ${timeStr}`, padding + (12 * s), currentY);
    currentY += 16 * s;

    ctx.fillStyle = '#06b6d4';
    ctx.font = `bold ${9.5 * s}px sans-serif`;
    ctx.fillText(`© AYPSIS Attendance | AI: ${activeAiModel}`, padding + (12 * s), currentY);

    if (locationCoords) {
      try {
        const zoom = 16;
        const latRad = locationCoords.lat * Math.PI / 180;
        const n = Math.pow(2, zoom);
        const xExact = (locationCoords.lng + 180) / 360 * n;
        const yExact = (1.0 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2.0 * n;
        const pixelX = (xExact - Math.floor(xExact)) * 256;
        const pixelY = (yExact - Math.floor(yExact)) * 256;
        const mapImg = mapTileRef.current;
        if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
          const destW = 120 * s;
          const destH = 120 * s;
          const mapBoxX = padding;
          // Move map below the watermark box
          const mapBoxY = boxY + boxHeight + (8 * s);
          
          ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.fillRect(mapBoxX - (3 * s), mapBoxY - (3 * s), destW + (6 * s), destH + (6 * s));
          ctx.drawImage(mapImg, 0, 0, 256, 256, mapBoxX, mapBoxY, destW, destH);
          
          const dotX = mapBoxX + (pixelX / 256 * destW);
          const dotY = mapBoxY + (pixelY / 256 * destH);
          
          ctx.beginPath();
          ctx.arc(dotX, dotY, 4 * s, 0, 2 * Math.PI, false);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.lineWidth = 1.5 * s;
          ctx.strokeStyle = 'white';
          ctx.stroke();
        }
      } catch (err) {
        console.warn("Could not load map tile", err);
      }
    }

    const imageSrc = canvas.toDataURL('image/jpeg', 0.8);
    await onCapture(imageSrc, locationCoords && gpsAccuracy !== null && gpsTimestamp !== null ? { address, lat: locationCoords.lat, lng: locationCoords.lng, accuracy: gpsAccuracy, locationAgeMs: Date.now() - gpsTimestamp, outOfRangeMessage } : undefined);
    stopCamera();
  };

  // Quality gate: jika akurasi GPS > 50 meter, tombol absensi tidak bisa digunakan
  const errorMsg = cameraError || gpsError;
  const canTakePhoto = isCameraReady && isLocationReady && !errorMsg && !isProcessing;

  // Label kualitas sinyal GPS untuk ditampilkan di UI
  const gpsQualityLabel = gpsAccuracy === null
    ? null
    : isAccuracyAcceptable && !isLocationReady
      ? { label: 'Lokasi GPS perlu diperbarui', color: '#ef4444' }
    : gpsAccuracy <= 15
      ? { label: `GPS Sangat Akurat (±${Math.round(gpsAccuracy)}m)`, color: '#4ade80' }   // hijau (<= 15m)
      : gpsAccuracy <= 50
        ? { label: `GPS Cukup Akurat (±${Math.round(gpsAccuracy)}m)`, color: '#facc15' }  // kuning (16m - 50m)
        : { label: `GPS Kurang Akurat (±${Math.round(gpsAccuracy)}m) — Tunggu GPS lebih presisi`, color: '#ef4444' }; // merah (> 50m)

  const faceMatchMsg = !isCameraReady ? 'Menyiapkan kamera...' : !locationCoords
    ? 'Menunggu koordinat GPS...'
    : gpsAccuracy === null
      ? 'Akurasi GPS belum tersedia. Aktifkan lokasi presisi atau cari ulang GPS.'
    : !isAccuracyAcceptable
      ? `Akurasi GPS belum memadai (±${Math.round(gpsAccuracy)}m). Mohon tunggu GPS lebih akurat (maks 50m)...`
      : !isLocationReady
        ? 'Lokasi GPS sudah kedaluwarsa atau tidak tersedia. Silakan cari ulang GPS.'
      : 'Posisikan wajah, lalu klik foto. Wajah diperiksa di server.';

  if (!isOpen) return null;

  return createPortal(
    <div className="camera-modal-overlay fade-in">
      <div className="camera-modal-content">
        
        {/* Fullscreen Video */}
        <div className="video-container">
          {!isCameraReady && !cameraError && (
            <div style={{ color: 'white' }}>
              <Loader2 size={40} className="animate-spin" />
            </div>
          )}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`camera-video ${isCameraReady ? 'visible' : 'hidden'}`}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Top Controls */}
        <div className="camera-top-controls">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '8px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <button onClick={handleClose} className="close-btn" disabled={isProcessing}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Live Logo Overlay */}
            <div className="live-logo-overlay">
              <img src="/logo.png" alt="Company Logo" style={{ height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            </div>
          </div>

          {/* In-Camera Biometric Error Warning Banner */}
          {validationError && (
            <div 
              className="fade-in-down"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.95)',
                border: '1.5px solid rgba(254, 202, 202, 0.6)',
                color: 'white',
                padding: '12px 14px',
                borderRadius: '14px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5), 0 0 15px rgba(239, 68, 68, 0.5)',
                animation: 'shake 0.4s ease-in-out',
                marginBottom: '8px'
              }}
            >
              <AlertCircle size={22} style={{ flexShrink: 0, marginTop: '2px', color: '#fecaca' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }}>
                  Verifikasi Wajah Gagal
                </div>
                <div style={{ fontSize: '0.8rem', lineHeight: '1.35', opacity: 0.95 }}>
                  {validationError}
                </div>
              </div>
              <button
                onClick={() => setValidationError('')}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0
                }}
                title="Tutup"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="location-box">
            <p className="company-name">
              <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {t.yourLocation}
            </p>
            <p>{address}</p>
            <p>
              {locationCoords 
                ? `${locationCoords.lat.toFixed(8)} | ${locationCoords.lng.toFixed(8)}` 
                : t.waitingCoords}
            </p>
            <p>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} {' '}
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
            </p>
            <p className="brand-text">© AYPSIS Attendance</p>
            <p style={{ fontSize: '0.75rem', color: '#4ade80', marginTop: '2px', fontWeight: 'bold' }}>AI Engine: {activeAiModel}</p>

            {/* Indikator kualitas sinyal GPS */}
            {gpsQualityLabel && (
              <p style={{ fontSize: '0.75rem', color: gpsQualityLabel.color, marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: gpsQualityLabel.color, boxShadow: `0 0 5px ${gpsQualityLabel.color}` }} />
                {gpsQualityLabel.label}
              </p>
            )}
          </div>

          {outOfRangeMessage && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', border: '1px solid #ef4444', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(4px)', alignSelf: 'stretch', marginTop: '8px' }}>
              <AlertCircle size={24} style={{ flexShrink: 0 }} />
              <span>{t.warning}: {outOfRangeMessage}. {t.distanceRecorded}</span>
            </div>
          )}
        </div>

          {/* Center Guide */}
          {isCameraReady && (
            <div className="camera-overlay-frame">
              <div 
                className="face-guide"
                style={{
                  position: 'relative',
                  borderColor: validationError ? '#ef4444' : undefined,
                  boxShadow: validationError 
                    ? '0 0 0 4000px rgba(0, 0, 0, 0.65), inset 0 0 30px rgba(239, 68, 68, 0.4), 0 0 25px rgba(239, 68, 68, 0.7)' 
                    : undefined
                }}
              >
                {validationError && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: 'rgba(220, 38, 38, 0.92)',
                    backdropFilter: 'blur(8px)',
                    padding: '8px 18px',
                    borderRadius: '20px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none'
                  }}>
                    <AlertCircle size={18} color="#ffffff" />
                    <span>Wajah Ditolak</span>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Status Overlay */}
        {(statusMsg || errorMsg) && (
          <div className="camera-status">
            {errorMsg ? (
              <AlertCircle size={32} color="#ef4444" />
            ) : (
              <Loader2 size={32} className="animate-spin" />
            )}
            <span>{errorMsg || statusMsg}</span>
          </div>
        )}

        {/* Bottom Controls */}
        <div className="camera-bottom-controls">
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            {validationError ? (
              <div style={{ padding: '8px 16px', background: 'rgba(220, 38, 38, 0.95)', color: 'white', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.4)' }}>
                <AlertCircle size={16} /> Wajah tidak cocok. Silakan arahkan wajah Anda dan foto ulang.
              </div>
            ) : canTakePhoto ? (
              <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <AlertCircle size={16} /> {faceMatchMsg}
              </div>
            ) : (
              <div style={{ padding: '8px 16px', background: !isAccuracyAcceptable ? 'rgba(239, 68, 68, 0.95)' : 'rgba(234, 179, 8, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <AlertCircle size={16} /> {faceMatchMsg}
              </div>
            )}
          </div>

          <div className="action-bar">
            <button className="icon-btn">
              <Zap size={24} />
            </button>

            <button 
              className={`btn-capture-circle ${canTakePhoto ? 'ready' : 'waiting'}`}
              onClick={handleTakePhoto}
              aria-label="Ambil foto untuk absen"
              disabled={!canTakePhoto}
              style={{ opacity: canTakePhoto ? 1 : 0.5, cursor: canTakePhoto ? 'pointer' : 'not-allowed', background: 'none', border: 'none', padding: 0 }}
            >
              <div className="btn-capture-inner">
                <Camera size={24} fill="white" />
              </div>
            </button>

            <button className="icon-btn" aria-label="Cari ulang GPS" title="Cari ulang GPS" disabled={isProcessing} onClick={() => setGpsRetry(value => value + 1)}>
              <RefreshCw size={24} />
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
