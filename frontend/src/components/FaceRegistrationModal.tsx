import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Loader2, AlertCircle, ScanFace } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useToast } from '../contexts/ToastContext';
import '../styles/cameramodal.css';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

export default function FaceRegistrationModal({ isOpen, onSuccess, onClose }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const processingRef = useRef(false);
  const sessionRef = useRef(0);
  
  const { user } = useAuthStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setStatusMsg('');
      setIsProcessing(false);
      setIsCameraReady(false);
      processingRef.current = false;
    }
  }, [isOpen]);

  useEffect(() => {
    sessionRef.current += 1;
    if (!isOpen) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    const video = videoRef.current;
    const start = async () => {
      setErrorMsg('');
      setIsCameraReady(false);
      if (!window.isSecureContext) {
        setErrorMsg('Kamera membutuhkan koneksi HTTPS yang aman. Tekan Izinkan akses kamera untuk membuka situs melalui HTTPS. Jika tetap gagal, hubungi admin untuk memeriksa sertifikat HTTPS situs.');
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('Browser ini tidak mendukung akses kamera. Buka situs melalui browser yang mendukung kamera.');
        return;
      }
      try {
        const result = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        stream = result;
        if (cancelled || !video) { result.getTracks().forEach(track => track.stop()); return; }
        video.onloadeddata = () => { if (!cancelled) setIsCameraReady(true); };
        video.srcObject = result;
      } catch (error: unknown) {
        if (cancelled) return;
        const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
        switch (name) {
          case 'NotAllowedError':
          case 'PermissionDeniedError':
            setErrorMsg('Akses kamera diblokir. Tekan Izinkan akses kamera, lalu pilih Izinkan pada permintaan browser. Jika permintaan tidak muncul, izinkan kamera untuk alamat situs ini melalui ikon di sebelah alamat dan periksa izin kamera browser di pengaturan HP.');
            break;
          case 'NotReadableError':
          case 'TrackStartError':
            setErrorMsg('Kamera gagal dibuka. Tutup aplikasi atau tab lain yang memakai kamera, lalu coba lagi. Jika tetap gagal, mulai ulang browser atau HP.');
            break;
          case 'NotFoundError':
          case 'DevicesNotFoundError':
            setErrorMsg('Kamera tidak ditemukan pada perangkat ini. Periksa apakah kamera HP dapat digunakan.');
            break;
          case 'SecurityError':
            setErrorMsg('Akses kamera diblokir oleh keamanan browser atau situs. Buka situs langsung di browser; jika tetap gagal, hubungi admin.');
            break;
          case 'OverconstrainedError':
            setErrorMsg('Kamera tidak mendukung pengaturan video yang diminta. Coba gunakan browser lain.');
            break;
          default:
            setErrorMsg(`Kamera gagal dibuka${name ? ` (${name})` : ''}. Muat ulang halaman atau coba browser lain.`);
        }
      }
    };
    void start();
    return () => {
      cancelled = true;
      sessionRef.current += 1;
      stream?.getTracks().forEach(track => track.stop());
      if (video) { video.onloadeddata = null; video.srcObject = null; }
    };
  }, [isOpen, cameraAttempt]);

  const requestCameraAccess = () => {
    if (!window.isSecureContext) {
      const secureUrl = new URL(window.location.href);
      if (secureUrl.protocol === 'http:') {
        secureUrl.protocol = 'https:';
        window.location.assign(secureUrl.href);
      } else {
        setErrorMsg('Koneksi situs belum dianggap aman oleh browser. Hubungi admin untuk memeriksa sertifikat HTTPS dan buka situs langsung di browser.');
      }
      return;
    }
    setCameraAttempt(attempt => attempt + 1);
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureAndRegister = async () => {
    if (!isOpen || !isCameraReady || !videoRef.current || !canvasRef.current || !user?.id || processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    setStatusMsg('Mengirim foto dan memeriksa wajah di server...');
    const session = sessionRef.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width || !canvas.height) throw new Error('Kamera belum siap.');
      ctx.drawImage(video, 0, 0);
      const response = await fetch('/api/face-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, image: canvas.toDataURL('image/jpeg', 0.9) }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (session !== sessionRef.current) return;
      if (!response.ok) throw new Error(data.message || 'Gagal mendaftarkan wajah.');
      showToast('Wajah berhasil didaftarkan!', 'success');
      window.dispatchEvent(new Event('face-registered'));
      stopCamera();
      onSuccess();
    } catch (error) {
      if (session !== sessionRef.current) return;
      showToast(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Server belum merespons. Silakan coba lagi.', 'error');
    } finally {
      clearTimeout(timeout);
      if (session === sessionRef.current) {
        processingRef.current = false;
        setIsProcessing(false);
        setStatusMsg('');
      }
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="camera-modal-overlay fade-in" style={{ zIndex: 9999 }}>
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
          <canvas ref={overlayCanvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 5 }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Top Header - Sleek Glassmorphism */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '20px', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{ 
            background: 'rgba(15, 23, 42, 0.6)', 
            backdropFilter: 'blur(12px)', 
            border: '1px solid rgba(255, 255, 255, 0.1)', 
            borderRadius: '16px', 
            padding: '12px 24px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            maxWidth: '90%',
            pointerEvents: 'auto'
          }}>
            <ScanFace size={28} color="#4ade80" />
            <div>
              <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 2px 0' }}>Registrasi Biometrik</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: 0 }}>Posisikan wajah Anda dalam area oval</p>
            </div>
            
            <button
              disabled={isProcessing}
              onClick={() => {
                stopCamera();
                onClose();
              }} 
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 'auto', transition: 'background 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>

        {/* Center Guide HUD */}
        {isCameraReady && (
          <div className="camera-overlay-frame" style={{ zIndex: 10 }}>
            <div className={`hud-scanner ${isCameraReady ? 'active' : ''}`}>
              <div style={{ 
                width: '320px', 
                height: '420px', 
                borderRadius: '50%', 
                border: isCameraReady ? '3px dashed rgba(74, 222, 128, 0.9)' : '3px dashed rgba(255,255,255,0.4)',
                boxShadow: isCameraReady ? '0 0 30px rgba(74, 222, 128, 0.2), inset 0 0 20px rgba(74, 222, 128, 0.1)' : 'none',
                transition: 'all 0.4s ease',
                position: 'relative'
              }}>
                {/* Corner Accents */}
                <div className="corner top-left"></div>
                <div className="corner top-right"></div>
                <div className="corner bottom-left"></div>
                <div className="corner bottom-right"></div>
              </div>
            </div>
          </div>
        )}

        {/* Status Overlay */}
        {(statusMsg || errorMsg) && (
          <div className="camera-status" role={errorMsg ? 'alert' : 'status'} style={{ width: 'min(400px, 90%)', maxHeight: '45%', overflowY: 'auto' }}>
            {errorMsg ? (
              <AlertCircle size={32} color="#ef4444" />
            ) : (
              <Loader2 size={32} className="animate-spin" />
            )}
            <span>{errorMsg || statusMsg || 'Memeriksa wajah di server...'}</span>
          </div>
        )}

        {/* Bottom Controls - Premium Glass */}
        <div className="camera-bottom-controls" style={{ zIndex: 10, paddingBottom: '30px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
          
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ 
              padding: '12px 28px', 
              background: 'rgba(15, 23, 42, 0.7)',
              backdropFilter: 'blur(16px)',
              border: isCameraReady ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255,255,255,0.1)',
              color: 'white', 
              borderRadius: '30px', 
              fontSize: '1rem', 
              fontWeight: 500, 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px', 
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              minWidth: '220px',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all 0.3s ease'
            }}>
              {isProcessing ? (
                <>
                  <Loader2 size={20} className="animate-spin" color="#4ade80" />
                  <span style={{ letterSpacing: '0.5px' }}>Menganalisis Biometrik...</span>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, height: '3px', background: '#4ade80', width: '50%', animation: 'progress 1s infinite linear', boxShadow: '0 0 10px #4ade80' }} />
                </>
              ) : errorMsg ? (
                <>
                  <AlertCircle size={20} color="#ef4444" />
                  <span>Kamera belum tersedia</span>
                </>
              ) : isCameraReady ? (
                <>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80', animation: 'pulse 2s infinite' }}></div>
                  <span style={{ letterSpacing: '0.5px', color: '#4ade80' }}>Kamera siap. Klik tombol foto.</span>
                </>
              ) : (
                <>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                  <span style={{ letterSpacing: '0.5px' }}>Menyiapkan kamera...</span>
                </>
              )}
            </div>
          </div>

          <div className="action-bar" style={{ justifyContent: 'center' }}>
            {errorMsg ? (
              <button
                type="button"
                aria-label="Izinkan akses kamera"
                onClick={requestCameraAccess}
                style={{ padding: '14px 28px', borderRadius: '24px', border: '1px solid #94a3b8', background: '#1e293b', color: 'white', cursor: 'pointer' }}
              >
                Izinkan akses kamera
              </button>
            ) : (
            <button 
              aria-label="Ambil foto untuk registrasi wajah"
              onClick={captureAndRegister} 
              disabled={isProcessing || !isCameraReady}
              className={`premium-capture-btn ${isCameraReady && !isProcessing ? 'ready' : ''}`}
            >
              <div className="inner-circle">
                <Camera size={26} fill={isCameraReady ? "#1e293b" : "white"} stroke={isCameraReady ? "#1e293b" : "white"} />
              </div>
            </button>
            )}
          </div>
        </div>

      </div>
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        .hud-scanner .corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border-color: rgba(255,255,255,0.7);
          border-style: solid;
          transition: all 0.4s ease;
        }
        .hud-scanner.active .corner {
          border-color: #4ade80;
          box-shadow: 0 0 10px rgba(74, 222, 128, 0.5);
        }
        .hud-scanner .top-left { top: -10px; left: -10px; border-width: 3px 0 0 3px; border-top-left-radius: 12px; }
        .hud-scanner .top-right { top: -10px; right: -10px; border-width: 3px 3px 0 0; border-top-right-radius: 12px; }
        .hud-scanner .bottom-left { bottom: -10px; left: -10px; border-width: 0 0 3px 3px; border-bottom-left-radius: 12px; }
        .hud-scanner .bottom-right { bottom: -10px; right: -10px; border-width: 0 3px 3px 0; border-bottom-right-radius: 12px; }
        
        .premium-capture-btn {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 4px solid rgba(255,255,255,0.4);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: not-allowed;
          transition: all 0.3s ease;
          padding: 4px;
          opacity: 0.6;
        }
        .premium-capture-btn.ready {
          border-color: #4ade80;
          opacity: 1;
          cursor: pointer;
          transform: scale(1.05);
          box-shadow: 0 0 20px rgba(74, 222, 128, 0.3);
        }
        .premium-capture-btn .inner-circle {
          width: 100%;
          height: 100%;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .premium-capture-btn.ready .inner-circle {
          background: #4ade80;
        }
        .premium-capture-btn.ready:active {
          transform: scale(0.95);
        }
      `}</style>
    </div>,
    document.body
  );
}
