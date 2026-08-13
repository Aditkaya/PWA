import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as faceapi from 'face-api.js';
import { Camera, X, Loader2, AlertCircle, Zap, RefreshCw, MapPin } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/cameramodal.css';

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

export default function CameraModal({ isOpen, onClose, onCapture, attendanceType }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  
  // Liveness States
  const [isLivenessPassed, setIsLivenessPassed] = useState(false);
  const [livenessMsg, setLivenessMsg] = useState('');
  
  const { lang } = useLangStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Location States
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState(t.findingLocation);
  const [outOfRangeMessage, setOutOfRangeMessage] = useState('');
  const [allowedLocations, setAllowedLocations] = useState<any[]>([]);

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      setIsLivenessPassed(false);
      setLivenessMsg(t.pleaseSmile || '');
      setErrorMsg('');
      setStatusMsg('');
      setIsProcessing(false);
      setIsCameraReady(false); // Add this reset
    }
  }, [isOpen, t.pleaseSmile]);

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

  // Watch Location Real-time
  useEffect(() => {
    if (!isOpen) return;

    let watchId: number;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocationCoords({ lat, lng });

          // Calculate radius real-time ONLY for 'Check In'
          if (attendanceType === 'Check In' && allowedLocations.length > 0) {
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
              setOutOfRangeMessage(`${t.outOfRange}: ${minDistance}m`);
            } else {
              setOutOfRangeMessage('');
            }
          } else {
            setOutOfRangeMessage('');
          }

          // Reverse Geocoding (Only run once or if address is still default to prevent API spam)
          setAddress((prevAddress) => {
            if (prevAddress === t.findingLocation || prevAddress === t.gpsFailed) {
              fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then(res => res.json())
                .then(data => {
                  if (data && data.display_name) {
                    setAddress(data.display_name);
                  }
                })
                .catch(err => console.error("Geocoding error", err));
              return t.translatingAddress;
            }
            return prevAddress;
          });
        },
        (error) => {
          console.error("Geolocation error", error);
          setAddress(t.gpsFailed);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setAddress(t.gpsNotSupported);
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, allowedLocations, attendanceType]);

  // Set initial liveness message when camera is ready
  useEffect(() => {
    if (isCameraReady && !isLivenessPassed) {
      setLivenessMsg(t.pleaseSmile);
    }
  }, [isCameraReady, t.pleaseSmile, isLivenessPassed]);

  // Liveness Detection Loop
  useEffect(() => {
    if (!isCameraReady || !videoRef.current || isLivenessPassed || isProcessing) return;

    let timeoutId: number | NodeJS.Timeout;
    let isCancelled = false;
    
    const detectLiveness = async () => {
      if (isCancelled) return;
      
      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        if (!isCancelled) timeoutId = setTimeout(detectLiveness, 300);
        return;
      }

      try {
        const detection = await faceapi.detectSingleFace(video).withFaceLandmarks().withFaceExpressions();
        if (detection) {
          const smileProbability = detection.expressions.happy;
          if (smileProbability > 0.8) {
            setIsLivenessPassed(true);
            setLivenessMsg(t.smileDetected);
            
            // Auto capture
            setTimeout(() => {
              if (!isCancelled) captureAndValidate();
            }, 500);
            return; // stop looping
          }
        }
      } catch (err) {
        // ignore errors during loop to keep it running silently
      }
      
      if (!isCancelled) {
        timeoutId = setTimeout(detectLiveness, 300);
      }
    };

    detectLiveness();

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isCameraReady, isLivenessPassed, isProcessing]);

  // Load Models
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        
        setIsModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models", err);
        setErrorMsg(t.modelFailed);
      }
    };

    loadModels();
  }, [isOpen]);

  // Start Camera
  useEffect(() => {
    if (isOpen && isModelsLoaded && !errorMsg) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, isModelsLoaded, errorMsg]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setErrorMsg(t.cameraDenied);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const captureAndValidate = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setIsProcessing(true);
    setStatusMsg(t.detectingFace);

    const video = videoRef.current;
    
    // Draw current frame to canvas
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsProcessing(false);
      return;
    }
    
    // Flip horizontally for mirroring before drawing
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    let mapImage: HTMLImageElement | null = null;
    let mapOffsetX = 0;
    let mapOffsetY = 0;

    if (locationCoords) {
      const zoom = 15;
      const n = Math.pow(2, zoom);
      const latRad = locationCoords.lat * Math.PI / 180;
      const x = (locationCoords.lng + 180) / 360 * n;
      const y = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;

      const tileX = Math.floor(x);
      const tileY = Math.floor(y);

      mapOffsetX = (x - tileX) * 256;
      mapOffsetY = (y - tileY) * 256;

      const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

      try {
        mapImage = await new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error('Failed to load map'));
          img.src = tileUrl;
        });
      } catch (err) {
        console.warn("Could not load map tile for watermark", err);
      }
    }

    // Draw Watermark Background
    const s = Math.max(canvas.width, canvas.height) / 1200; // scaling factor
    const padding = 15 * s;
    const boxWidth = Math.min(320 * s, canvas.width - (padding * 2));
    let boxHeight = mapImage ? 175 * s : 105 * s; 
    if (outOfRangeMessage) {
      boxHeight += 15 * s;
    }
    const boxY = canvas.height - boxHeight - padding;
    
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
    ctx.fillText('© AYPSIS Attendance', padding + (12 * s), currentY);

    if (mapImage) {
      const mapW = boxWidth - (24 * s);
      const mapH = 60 * s;
      const mapStartY = currentY + (4 * s);
      
      const aspect = mapW / mapH;
      let sWidth = 150; 
      let sHeight = sWidth / aspect;

      if (sHeight > 256) {
         sHeight = 256;
         sWidth = sHeight * aspect;
      }
      if (sWidth > 256) {
         sWidth = 256;
         sHeight = sWidth / aspect;
      }

      let sx = mapOffsetX - sWidth / 2;
      let sy = mapOffsetY - sHeight / 2;

      sx = Math.max(0, Math.min(256 - sWidth, sx));
      sy = Math.max(0, Math.min(256 - sHeight, sy));

      // Draw Map
      ctx.drawImage(mapImage, sx, sy, sWidth, sHeight, padding + (12 * s), mapStartY, mapW, mapH);

      // Draw Red Dot at precise center
      const relX = mapOffsetX - sx;
      const relY = mapOffsetY - sy;
      const destX = padding + (12 * s) + (relX / sWidth) * mapW;
      const destY = mapStartY + (relY / sHeight) * mapH;
      
      ctx.fillStyle = '#ef4444'; // red-500
      ctx.beginPath();
      ctx.arc(destX, destY, 4 * s, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.lineWidth = 1.5 * s;
      ctx.strokeStyle = 'white';
      ctx.stroke();
    }

    const imageSrc = canvas.toDataURL('image/jpeg', 0.8);

    // Basic face detection
    const detection = await faceapi.detectSingleFace(video).withFaceLandmarks();

    if (detection) {
      setStatusMsg(t.faceDetected);
      setTimeout(() => {
        stopCamera();
        onCapture(imageSrc, locationCoords ? { address, lat: locationCoords.lat, lng: locationCoords.lng, outOfRangeMessage } : undefined);
        setIsProcessing(false);
        setStatusMsg('');
      }, 1000);
    } else {
      setStatusMsg('');
      showToast(t.noFace, 'error');
      setIsProcessing(false);
      setIsLivenessPassed(false);
      setLivenessMsg(t.pleaseSmile);
    }
  };

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <button onClick={handleClose} className="close-btn" disabled={isProcessing}>
                  <X size={20} />
                </button>
                {isLivenessPassed ? (
                  <div style={{ padding: '8px 16px', background: 'rgba(34, 197, 94, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {livenessMsg}
                  </div>
                ) : (
                  <div style={{ padding: '8px 16px', background: 'rgba(234, 179, 8, 0.9)', color: 'white', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={16} /> {livenessMsg}
                  </div>
                )}
              </div>
              
              {outOfRangeMessage && (
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', border: '1px solid #ef4444', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(4px)', alignSelf: 'stretch' }}>
                  <AlertCircle size={24} style={{ flexShrink: 0 }} />
                  <span>{t.warning}: {outOfRangeMessage}. {t.distanceRecorded}</span>
                </div>
              )}
            </div>

            {/* Live Logo Overlay */}
            <div className="live-logo-overlay">
              <img src="/logo.png" alt="Company Logo" style={{ height: '48px', objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }} />
            </div>
          </div>
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
            
            {/* Google Maps Embed */}
            {locationCoords && (
              <div style={{ marginTop: '6px', borderRadius: '4px', overflow: 'hidden' }}>
                <iframe
                  width="100%"
                  height="50"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  src={`https://maps.google.com/maps?q=${locationCoords.lat},${locationCoords.lng}&hl=id&z=15&output=embed`}
                ></iframe>
              </div>
            )}
          </div>

          <div className="action-bar">
            <button className="icon-btn">
              <Zap size={24} />
            </button>

            <button 
              className={`btn-capture-circle ${isLivenessPassed ? 'ready' : 'waiting'}`}
              onClick={captureAndValidate} 
              disabled={isProcessing || !isLivenessPassed}
              style={{ opacity: isLivenessPassed ? 1 : 0.5, cursor: isLivenessPassed ? 'pointer' : 'not-allowed', background: 'none', border: 'none', padding: 0 }}
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
