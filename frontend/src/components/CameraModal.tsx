import { useRef, useEffect, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, X, Loader2, AlertCircle, Zap, RefreshCw, MapPin } from 'lucide-react';
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
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Location States
  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState('Sedang mencari lokasi akurat...');
  const [outOfRangeMessage, setOutOfRangeMessage] = useState('');
  const [allowedLocations, setAllowedLocations] = useState<any[]>([]);

  // Fetch Allowed Locations once
  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:8000/api/lokasi')
        .then(res => res.json())
        .then(data => {
          if (data.data) setAllowedLocations(data.data);
        })
        .catch(err => console.error('Failed to fetch lokasi:', err));
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
              setOutOfRangeMessage(`Di luar radius: ${minDistance}m`);
            } else {
              setOutOfRangeMessage('');
            }
          } else {
            setOutOfRangeMessage('');
          }

          // Reverse Geocoding (Only run once or if address is still default to prevent API spam)
          setAddress((prevAddress) => {
            if (prevAddress === 'Sedang mencari lokasi akurat...' || prevAddress === 'Gagal mengambil detail alamat') {
              fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
                .then(res => res.json())
                .then(data => {
                  if (data && data.display_name) {
                    setAddress(data.display_name);
                  }
                })
                .catch(err => console.error("Geocoding error", err));
              return 'Sedang menerjemahkan alamat...';
            }
            return prevAddress;
          });
        },
        (error) => {
          console.error("Geolocation error", error);
          setAddress('Gagal mendapatkan lokasi GPS');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setAddress('GPS tidak didukung di perangkat ini');
    }

    return () => {
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
    };
  }, [isOpen, allowedLocations, attendanceType]);

  // Load Models
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models')
        ]);
        
        setIsModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models", err);
        setErrorMsg('Gagal memuat modul pendeteksi wajah.');
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
      setErrorMsg('Akses kamera ditolak.');
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
    setStatusMsg('Mendeteksi wajah...');

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

    // Draw Watermark Background
    const padding = 20;
    // Calculate box height dynamically or set fixed
    const boxHeight = 130; 
    const boxY = canvas.height - boxHeight - padding;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(padding, boxY, canvas.width - (padding * 2), boxHeight, 12);
      ctx.fill();
    } else {
      ctx.fillRect(padding, boxY, canvas.width - (padding * 2), boxHeight);
    }

    // Draw Watermark Text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    
    let currentY = boxY + 24;
    
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('PT ALEXINDO YAKINPRIMA JAKARTA', padding + 16, currentY);
    currentY += 18;
    
    ctx.font = '10px sans-serif';
    // Handle long address wrapping simply by slicing or just let it run off (in a real app we'd wrap text)
    const shortAddress = address.length > 50 ? address.substring(0, 50) + '...' : address;
    ctx.fillText(shortAddress, padding + 16, currentY);
    currentY += 18;
    
    if (locationCoords) {
      ctx.fillText(`${locationCoords.lat.toFixed(8)} | ${locationCoords.lng.toFixed(8)}`, padding + 16, currentY);
    }
    currentY += 18;

    const dateStr = currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':');
    ctx.fillText(`${dateStr} ${timeStr}`, padding + 16, currentY);
    currentY += 20;

    ctx.fillStyle = '#06b6d4';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('© AYPSIS Attendance', padding + 16, currentY);

    const imageSrc = canvas.toDataURL('image/jpeg', 0.8);

    // Basic face detection
    const detection = await faceapi.detectSingleFace(video).withFaceLandmarks();

    if (detection) {
      setStatusMsg('Wajah terdeteksi! Menyimpan absensi...');
      setTimeout(() => {
        stopCamera();
        onCapture(imageSrc, locationCoords ? { address, lat: locationCoords.lat, lng: locationCoords.lng, outOfRangeMessage } : undefined);
        setIsProcessing(false);
        setStatusMsg('');
      }, 1000);
    } else {
      setStatusMsg('');
      alert('Wajah tidak terdeteksi. Pastikan wajah berada di dalam lingkaran dengan cahaya yang cukup.');
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
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
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <button onClick={handleClose} className="close-btn" disabled={isProcessing}>
                <X size={20} />
              </button>
              <div className="instruction-box">
                Posisikan wajah Anda pada lingkaran lalu ambil foto selfie.
              </div>
            </div>
            
            {outOfRangeMessage && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', border: '1px solid #ef4444', color: 'white', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', backdropFilter: 'blur(4px)', alignSelf: 'stretch' }}>
                <AlertCircle size={24} style={{ flexShrink: 0 }} />
                <span>Peringatan: {outOfRangeMessage}. Data jarak akan dicatat.</span>
              </div>
            )}
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
              Lokasi Absensi Anda
            </p>
            <p>{address}</p>
            <p>
              {locationCoords 
                ? `${locationCoords.lat.toFixed(8)} | ${locationCoords.lng.toFixed(8)}` 
                : 'Menunggu titik koordinat...'}
            </p>
            <p>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} {' '}
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')}
            </p>
            <p className="brand-text">© AYPSIS Attendance</p>
          </div>

          <div className="action-bar">
            <button className="icon-btn">
              <Zap size={24} />
            </button>

            <button 
              className="btn-capture-circle" 
              onClick={captureAndValidate}
              disabled={!isCameraReady || isProcessing || !!errorMsg}
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
    </div>
  );
}
