import { useRef, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import * as faceapi from 'face-api.js';
import { Camera, X, Loader2, AlertCircle, Zap, RefreshCw, MapPin } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { useAuthStore } from '../store/auth.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import { faceDetectorOptions, loadFaceRecognition, loadFaceProfile } from '../utils/faceRecognition';
import '../styles/cameramodal.css';

const activeAiModel = 'Tiny Face Detector';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (imageSrc: string, locationData?: {address: string, lat: number, lng: number, outOfRangeMessage?: string}) => void;
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
  const captureRef = useRef<() => void>(() => {});
  const mapTileRef = useRef<HTMLImageElement | null>(null);
  const locationReadyRef = useRef(false);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  
  // Identity matching state
  const [isFaceMatched, setIsFaceMatched] = useState(false);
  const [faceMatchMsg, setFaceMatchMsg] = useState('');
  
  const { lang } = useLangStore();
  const { user } = useAuthStore();
  const [profileDescriptor, setProfileDescriptor] = useState<Float32Array | null>(null);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);

  const t = translations[lang];
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Location States
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState(t.findingLocation);

  const [allowedLocations, setAllowedLocations] = useState<any[]>([]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setIsFaceMatched(false);
      setFaceMatchMsg("Mencocokkan Wajah dengan Profil...");
      setErrorMsg('');
      setStatusMsg('');
      setIsProcessing(false);
      capturingRef.current = false;
      verifiedFrameRef.current = null;
      locationReadyRef.current = false;
      setIsCameraReady(false); // Add this reset
      setLocationCoords(null);
      setAddress(t.findingLocation);
    }
  }, [isOpen, t.findingLocation]);

  // Fetch Allowed Locations once & preload logo
  useEffect(() => {
    if (isOpen) {
      fetch('/api/lokasi')
        .then(res => res.json())
        .then(data => {
          if (data.data) setAllowedLocations(data.data);
        })
        .catch(err => console.error('Failed to fetch lokasi:', err));

      const img = new Image();
      img.src = '/logo.png';
      img.onload = () => setLogoImage(img);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // Watch Location Real-time (only sets coords + geocoding, NO radius check here)
  useEffect(() => {
    if (!isOpen) return;

    let watchId: number;
    let cancelled = false;

    if (navigator.geolocation) {
      const handleSuccess = (position: GeolocationPosition) => {
        if (cancelled) return;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setLocationCoords({ lat, lng });

        // Reverse Geocoding (Only run once or if address is still default to prevent API spam)
        setAddress((prevAddress) => {
          if (prevAddress === t.findingLocation || prevAddress === t.gpsFailed) {
            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then(res => res.json())
              .then(data => {
                if (!cancelled && data && data.display_name) {
                  setAddress(data.display_name);
                }
              })
              .catch(err => console.error("Geocoding error", err));
            return t.translatingAddress;
          }
          return prevAddress;
        });
      };

      watchId = navigator.geolocation.watchPosition(
        handleSuccess,
        (error) => {
          if (cancelled) return;
          console.warn("High accuracy geolocation failed. Retrying with low accuracy...", error);
          if (error.code === 2 || error.code === 3) {
            // POSITION_UNAVAILABLE (2) or TIMEOUT (3)
            navigator.geolocation.clearWatch(watchId);
            watchId = navigator.geolocation.watchPosition(
              handleSuccess,
              (fallbackError) => {
                if (cancelled) return;
                setErrorMsg(t.gpsFailed);
                console.error("Fallback geolocation error", fallbackError);
                setAddress(t.gpsFailed);
              },
              { enableHighAccuracy: false, timeout: 30000, maximumAge: 10000 }
            );
          } else {
            setErrorMsg(t.gpsFailed);
            setAddress(t.gpsFailed);
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setErrorMsg(t.gpsNotSupported);
      setAddress(t.gpsNotSupported);
    }

    return () => {
      cancelled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, t.findingLocation, t.translatingAddress, t.gpsFailed, t.gpsNotSupported]);

  // Calculate radius synchronously during render — guaranteed no race condition
  const outOfRangeMessage = useMemo(() => {
    if (!locationCoords || allowedLocations.length === 0) return '';

    const { lat, lng } = locationCoords;
    let minDistance = Infinity;
    for (const loc of allowedLocations) {
      const dist = getDistanceFromLatLonInM(lat, lng, parseFloat(loc.latitude), parseFloat(loc.longitude));
      if (dist < minDistance) minDistance = dist;
      if (dist <= parseFloat(loc.radius)) {
        minDistance = -1; // Valid location found
        break;
      }
    }
    if (minDistance > 0 && minDistance !== Infinity) {
      return `${t.outOfRange}: ${minDistance}m`;
    }
    return '';
  }, [locationCoords, allowedLocations, t.outOfRange]);

  // Set initial matching message when camera is ready
  useEffect(() => {
    if (isCameraReady && isModelsLoaded && isProfileLoaded && !isFaceMatched && !errorMsg) {
      setFaceMatchMsg("Mencocokkan Wajah dengan Profil...");
    } else if (isCameraReady && !isModelsLoaded && !errorMsg) {
      setFaceMatchMsg("Mengunduh Mesin AI (Tunggu sebentar)...");
    } else if (isCameraReady && isModelsLoaded && !isProfileLoaded && !errorMsg) {
      setFaceMatchMsg("Menganalisis Foto Profil (Tunggu sebentar)...");
    }
  }, [isCameraReady, isModelsLoaded, isProfileLoaded, isFaceMatched, errorMsg]);

  // Face Recognition Loop
  useEffect(() => {
    if (!isOpen || !isCameraReady || !isModelsLoaded || !isProfileLoaded || !profileDescriptor || !videoRef.current || isFaceMatched || isProcessing || errorMsg) return;

    let timeoutId: number | NodeJS.Timeout;
    let isCancelled = false;
    
    const detectFace = async () => {
      if (isCancelled) return;
      
      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        if (!isCancelled) timeoutId = setTimeout(detectFace, 300);
        return;
      }

      try {
        // Match and capture the very same frame, even if the person moves while
        // inference is running. Never run a second inference just for capture.
        const frame = document.createElement('canvas');
        frame.width = video.videoWidth;
        frame.height = video.videoHeight;
        if (!frame.width || !frame.height) {
          timeoutId = setTimeout(detectFace, 150);
          return;
        }
        const context = frame.getContext('2d');
        if (!context) throw new Error('Canvas tidak tersedia');
        context.drawImage(video, 0, 0);
        const detection = await faceapi.detectSingleFace(frame, faceDetectorOptions).withFaceLandmarks().withFaceDescriptor();
        if (isCancelled) return;
        if (detection) {
          const distance = faceapi.euclideanDistance(detection.descriptor, profileDescriptor);
          
          if (distance < 0.58 && !locationReadyRef.current) {
            setFaceMatchMsg('Wajah cocok. Menunggu koordinat GPS...');
          } else if (distance < 0.58) {
            verifiedFrameRef.current = frame;
            setIsFaceMatched(true);
            setFaceMatchMsg("Wajah Cocok! Verifikasi Berhasil.");
            
            captureRef.current();
            return; // stop looping
          } else {
            setFaceMatchMsg("Wajah tidak cocok dengan profil.");
          }
        } else {
          setFaceMatchMsg('Posisikan wajah di area oval dengan pencahayaan yang cukup.');
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Face recognition failed', err);
        setErrorMsg('Validasi wajah gagal. Tutup kamera lalu coba lagi.');
        return;
      }
      
      if (!isCancelled) {
        timeoutId = setTimeout(detectFace, 150);
      }
    };

    timeoutId = setTimeout(detectFace, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isOpen, isCameraReady, isModelsLoaded, isProfileLoaded, profileDescriptor, isFaceMatched, isProcessing, errorMsg]);

  // Download models and profile photo concurrently; ignore obsolete sessions.
  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    let cancelled = false;
    setIsModelsLoaded(false);
    setIsProfileLoaded(false);
    setProfileDescriptor(null);
    const timeout = setTimeout(() => {
      controller.abort();
      if (!cancelled) setErrorMsg('Koneksi terlalu lama. Tutup kamera lalu coba lagi.');
    }, 30000);

    const prepare = async () => {
      try {
        if (!user?.id) throw new Error('Silakan masuk kembali sebelum absen.');
        const [, descriptor] = await Promise.all([
          loadFaceRecognition().then(() => {
            if (!cancelled && !controller.signal.aborted) setIsModelsLoaded(true);
          }),
          loadFaceProfile(user.id, controller.signal),
        ]);
        if (cancelled || controller.signal.aborted) return;
        setProfileDescriptor(descriptor);
        setIsProfileLoaded(true);
      } catch (error) {
        if (!cancelled && !controller.signal.aborted) {
          setErrorMsg(error instanceof Error ? error.message : 'Gagal memuat AI atau profil.');
        }
      } finally {
        clearTimeout(timeout);
      }
    };
    void prepare();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [isOpen, user?.id]);

  // Stop even a late camera permission response after closing the modal.
  useEffect(() => {
    if (!isOpen || errorMsg) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMsg(t.cameraDenied);
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
    }).catch(() => {
      if (!cancelled) setErrorMsg(t.cameraDenied);
    });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (video) {
        video.onloadeddata = null;
        video.srcObject = null;
      }
    };
  }, [isOpen, errorMsg, t.cameraDenied]);

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

  const captureAndValidate = () => {
    if (!isOpen || !verifiedFrameRef.current || !canvasRef.current || capturingRef.current) return;
    capturingRef.current = true;
    setIsProcessing(true);
    setStatusMsg(t.detectingFace);

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
    
    // Flip horizontally for mirroring before drawing
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();


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

    try {
      const imageSrc = canvas.toDataURL('image/jpeg', 0.8);
      setStatusMsg(t.faceDetected);
      stopCamera();
      onCapture(imageSrc, locationCoords ? { address, lat: locationCoords.lat, lng: locationCoords.lng, outOfRangeMessage } : undefined);
    } catch (error) {
      console.error('Capture failed', error);
      capturingRef.current = false;
      setIsProcessing(false);
      setIsFaceMatched(false);
      verifiedFrameRef.current = null;
      setStatusMsg('');
      showToast('Gagal mengambil foto. Silakan coba lagi.', 'error');
    }
  };

  // Recognition uses the latest location, address and callback without restarting
  // inference whenever the GPS or clock updates.
  useEffect(() => {
    captureRef.current = captureAndValidate;
    locationReadyRef.current = !!locationCoords;
  });

  if (!isOpen) return null;

  return createPortal(
    <div className="camera-modal-overlay fade-in">
      <div className="camera-modal-content">
        
        {/* Fullscreen Video */}
        <div className="video-container">
          {!isCameraReady && !errorMsg && (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginBottom: '12px' }}>
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
              <div className="face-guide"></div>
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
            {isFaceMatched ? (
              <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <AlertCircle size={16} /> {faceMatchMsg}
              </div>
            ) : (
              <div style={{ padding: '8px 16px', background: 'rgba(234, 179, 8, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <AlertCircle size={16} /> {faceMatchMsg}
              </div>
            )}
          </div>

          <div className="action-bar">
            <button className="icon-btn">
              <Zap size={24} />
            </button>

            <button 
              className={`btn-capture-circle ${isFaceMatched ? 'ready' : 'waiting'}`}
              onClick={captureAndValidate} 
              disabled={isProcessing || !isFaceMatched}
              style={{ opacity: isFaceMatched ? 1 : 0.5, cursor: isFaceMatched ? 'pointer' : 'not-allowed', background: 'none', border: 'none', padding: 0 }}
            >
              <div className="btn-capture-inner">
                <Camera size={24} fill="white" />
              </div>
            </button>

            <button className="icon-btn">
              <RefreshCw size={24} />
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
