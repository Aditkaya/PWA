import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import * as faceapi from 'face-api.js';
import { Camera, Loader2, AlertCircle, ScanFace } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useToast } from '../contexts/ToastContext';
import '../styles/cameramodal.css';

interface FaceRegistrationModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

let globalModelsPromise: Promise<any> | null = null;

const faceDetectorOptions = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });

export default function FaceRegistrationModal({ isOpen, onSuccess, onClose }: FaceRegistrationModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelsLoaded, setIsModelsLoaded] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [hasFace, setHasFace] = useState(false);
  
  const { user } = useAuthStore();
  const { showToast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setStatusMsg('');
      setIsProcessing(false);
      setIsCameraReady(false);
      setHasFace(false);
    }
  }, [isOpen]);

  // Face Detection Loop for visual feedback
  useEffect(() => {
    if (!isCameraReady || !isModelsLoaded || !videoRef.current || isProcessing || errorMsg) return;

    let animationFrameId: number;
    let isCancelled = false;
    
    const detectFace = async () => {
      if (isCancelled) return;
      
      const video = videoRef.current;
      if (!video || video.paused || video.ended) {
        if (!isCancelled) animationFrameId = requestAnimationFrame(detectFace);
        return;
      }

      try {
        const detection = await faceapi.detectSingleFace(video, faceDetectorOptions).withFaceLandmarks();
        if (detection) {
          setHasFace(true);
          if (overlayCanvasRef.current) {
            const canvas = overlayCanvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
          }
        } else {
          setHasFace(false);
          if (overlayCanvasRef.current) {
            const ctx = overlayCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
          }
        }
      } catch (err) {
        // ignore errors during loop
      }
      
      if (!isCancelled) {
        animationFrameId = requestAnimationFrame(detectFace);
      }
    };

    animationFrameId = requestAnimationFrame(detectFace);

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isCameraReady, isModelsLoaded, isProcessing, errorMsg]);

  // Load Models
  useEffect(() => {
    if (!isOpen) return;

    const loadModels = async () => {
      try {
        if (!globalModelsPromise) {
          globalModelsPromise = Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
            faceapi.nets.faceLandmark68Net.loadFromUri('/models')
          ]);
        }
        await globalModelsPromise;
        setIsModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models", err);
        setErrorMsg('Gagal memuat AI.');
      }
    };

    loadModels();
  }, [isOpen]);

  // Start Camera
  useEffect(() => {
    if (isOpen && !errorMsg) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, errorMsg]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          setIsCameraReady(true);
        };
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setErrorMsg('Akses Kamera Ditolak');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureAndRegister = async () => {
    if (!videoRef.current || !canvasRef.current || !user?.id) return;

    setIsProcessing(true);
    setStatusMsg('Memproses foto...');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Draw current frame to canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsProcessing(false);
      return;
    }
    
    // Original face registration doesn't need to be mirrored, but let's keep consistency
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageSrc = canvas.toDataURL('image/jpeg', 0.9);

    // Basic face detection
    setStatusMsg('Menganalisis wajah...');
    const detection = await faceapi.detectSingleFace(video, faceDetectorOptions).withFaceLandmarks();

    if (detection) {
      setStatusMsg('Mengunggah data wajah...');
      try {
        const response = await fetch('/api/face-registration', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: user.id,
            image: imageSrc
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          showToast('Wajah berhasil didaftarkan!', 'success');
          stopCamera();
          onSuccess();
        } else {
          showToast(data.message || 'Gagal mendaftarkan wajah', 'error');
          setIsProcessing(false);
          setStatusMsg('');
        }
      } catch (err) {
        console.error(err);
        showToast('Koneksi terputus saat menyimpan', 'error');
        setIsProcessing(false);
        setStatusMsg('');
      }
    } else {
      setStatusMsg('');
      showToast('Wajah tidak terdeteksi dengan jelas', 'error');
      setIsProcessing(false);
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
            <div className={`hud-scanner ${hasFace ? 'active' : ''}`}>
              <div style={{ 
                width: '320px', 
                height: '420px', 
                borderRadius: '50%', 
                border: hasFace ? '3px dashed rgba(74, 222, 128, 0.9)' : '3px dashed rgba(255,255,255,0.4)', 
                boxShadow: hasFace ? '0 0 30px rgba(74, 222, 128, 0.2), inset 0 0 20px rgba(74, 222, 128, 0.1)' : 'none',
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
        {(statusMsg || errorMsg || (!isModelsLoaded && !errorMsg)) && (
          <div className="camera-status">
            {errorMsg ? (
              <AlertCircle size={32} color="#ef4444" />
            ) : (
              <Loader2 size={32} className="animate-spin" />
            )}
            <span>{errorMsg || statusMsg || 'Memuat AI Mesin...'}</span>
          </div>
        )}

        {/* Bottom Controls - Premium Glass */}
        <div className="camera-bottom-controls" style={{ zIndex: 10, paddingBottom: '30px', background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)' }}>
          
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
            <div style={{ 
              padding: '12px 28px', 
              background: hasFace ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.7)', 
              backdropFilter: 'blur(16px)',
              border: hasFace ? '1px solid rgba(74, 222, 128, 0.3)' : '1px solid rgba(255,255,255,0.1)',
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
              ) : hasFace ? (
                <>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px #4ade80', animation: 'pulse 2s infinite' }}></div>
                  <span style={{ letterSpacing: '0.5px', color: '#4ade80' }}>Wajah Terdeteksi</span>
                </>
              ) : (
                <>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#eab308' }}></div>
                  <span style={{ letterSpacing: '0.5px' }}>Mencari wajah...</span>
                </>
              )}
            </div>
          </div>

          <div className="action-bar" style={{ justifyContent: 'center' }}>
            <button 
              onClick={captureAndRegister} 
              disabled={isProcessing || !hasFace || !isModelsLoaded}
              className={`premium-capture-btn ${hasFace && !isProcessing ? 'ready' : ''}`}
            >
              <div className="inner-circle">
                <Camera size={26} fill={hasFace ? "#1e293b" : "white"} stroke={hasFace ? "#1e293b" : "white"} />
              </div>
            </button>
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
