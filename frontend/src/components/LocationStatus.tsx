import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, MapPinOff, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, HelpCircle, X } from 'lucide-react';
import '../styles/location-status.css';

export type LocationPermissionState = 'loading' | 'granted' | 'prompt' | 'denied' | 'gps_off' | 'timeout' | 'unsupported';

interface LocationStatusProps {
  onStatusChange?: (status: LocationPermissionState, coords?: { lat: number; lng: number } | null) => void;
  compact?: boolean;
  variant?: 'navbar' | 'banner';
}

export const LocationStatus: React.FC<LocationStatusProps> = ({ 
  onStatusChange, 
  compact = false,
  variant = 'navbar' 
}) => {
  const [status, setStatus] = useState<LocationPermissionState>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const requestPending = useRef(false);
  const mounted = useRef(false);

  // Ambil lokasi dan tentukan status detailnya
  const requestLocation = useCallback(() => {
    if (requestPending.current) return;
    if (!navigator.geolocation) {
      setStatus('unsupported');
      onStatusChangeRef.current?.('unsupported', null);
      return;
    }

    requestPending.current = true;
    setIsRequesting(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        requestPending.current = false;
        if (!mounted.current) return;
        setIsRequesting(false);
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoords(newCoords);
        setStatus('granted');
        onStatusChangeRef.current?.('granted', newCoords);
      },
      (error) => {
        requestPending.current = false;
        if (!mounted.current) return;
        setIsRequesting(false);
        setCoords(null);
        let currentStatus: LocationPermissionState = 'denied';

        if (error.code === error.PERMISSION_DENIED) {
          currentStatus = 'denied';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          // Izin browser mungkin sudah ada tapi hardware GPS / sensor mati
          currentStatus = 'gps_off';
        } else if (error.code === error.TIMEOUT) {
          currentStatus = 'timeout';
        }

        setStatus(currentStatus);
        onStatusChangeRef.current?.(currentStatus, null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, []);

  // Pantau izin awal menggunakan Permissions API
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let permission: PermissionStatus | undefined;
    const showPrompt = () => {
      if (cancelled) return;
      // Unsupported permission queries must not trigger an unsolicited prompt.
      setStatus('prompt');
      onStatusChangeRef.current?.('prompt', null);
    };
    if (!navigator.geolocation) {
      setStatus('unsupported');
      onStatusChangeRef.current?.('unsupported', null);
    } else if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
        if (cancelled) return;
        permission = perm;
        if (perm.state === 'granted') {
          // Jika sudah granted, panggil getCurrentPosition untuk memastikan GPS aktif & dapat koordinat
          requestLocation();
        } else if (perm.state === 'prompt') {
          setStatus('prompt');
          onStatusChangeRef.current?.('prompt', null);
        } else if (perm.state === 'denied') {
          setStatus('denied');
          onStatusChangeRef.current?.('denied', null);
        }

        // Listener jika user mengubah izin di address bar secara langsung
        perm.onchange = () => {
          if (perm.state === 'granted') {
            requestLocation();
          } else if (perm.state === 'denied') {
            setStatus('denied');
            setCoords(null);
            onStatusChangeRef.current?.('denied', null);
          } else {
            setStatus('prompt');
            setCoords(null);
            onStatusChangeRef.current?.('prompt', null);
          }
        };
      }).catch(showPrompt);
    } else {
      showPrompt();
    }
    return () => {
      cancelled = true;
      mounted.current = false;
      if (permission) permission.onchange = null;
    };
  }, [requestLocation]);

  // Handle escape key untuk menutup modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Konten berdasarkan status
  const renderContent = () => {
    switch (status) {
      case 'granted':
        return {
          icon: <CheckCircle2 size={22} />,
          badge: 'Izin Aktif',
          title: 'Lokasi Perangkat Terhubung',
          subtitle: coords 
            ? `Koordinat terdeteksi (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})` 
            : 'Perangkat siap digunakan untuk absensi.',
          actionText: 'Segarkan',
          actionClass: 'btn-loc-ghost',
          showGuideOption: true
        };
      case 'prompt':
        return {
          icon: <AlertTriangle size={22} />,
          badge: 'Perlu Diperiksa',
          title: 'Periksa Akses Lokasi',
          subtitle: 'Tekan "Izinkan Lokasi". Jika muncul pilihan izin, pilih "Izinkan" untuk kunjungan berikutnya bila tersedia; hindari "Hanya kali ini".',
          actionText: isRequesting ? 'Menghubungkan...' : 'Izinkan Lokasi',
          actionClass: 'btn-loc-primary',
          showGuideOption: true
        };
      case 'gps_off':
        return {
          icon: <MapPinOff size={22} />,
          badge: 'GPS Belum Aktif',
          title: 'Sinyal GPS Tidak Ditemukan',
          subtitle: 'Izin browser aktif, tetapi sensor GPS di HP/Laptop mati. Mohon nyalakan GPS di pengaturan.',
          actionText: isRequesting ? 'Mencari...' : 'Coba Lagi',
          actionClass: 'btn-loc-danger',
          showGuideOption: true
        };
      case 'timeout':
        return {
          icon: <AlertTriangle size={22} />,
          badge: 'GPS Timeout',
          title: 'Pencarian Sinyal Habis Waktu',
          subtitle: 'Pastikan Anda berada di area terbuka atau terhubung ke Wi-Fi agar GPS mudah terkunci.',
          actionText: isRequesting ? 'Mencari...' : 'Coba Lagi',
          actionClass: 'btn-loc-primary',
          showGuideOption: true
        };
      case 'unsupported':
        return {
          icon: <MapPinOff size={22} />,
          badge: 'Tidak Didukung',
          title: 'Geolocation Tidak Tersedia',
          subtitle: 'Browser tidak mendukung deteksi lokasi atau website diakses tanpa HTTPS.',
          actionText: 'Refresh',
          actionClass: 'btn-loc-ghost',
          showGuideOption: true
        };
      case 'denied':
      default:
        return {
          icon: <MapPinOff size={22} />,
          badge: 'Akses Ditolak',
          title: 'Izin Lokasi Diblokir',
          subtitle: 'Perangkat tidak mengizinkan akses lokasi. Buka ikon gembok pada browser untuk mengaktifkan.',
          actionText: isRequesting ? 'Memeriksa...' : 'Cek Ulang',
          actionClass: 'btn-loc-danger',
          showGuideOption: true
        };
    }
  };

  const getTooltip = () => {
    switch (status) {
      case 'granted':
        return coords 
          ? `Lokasi Terhubung (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}) - Klik untuk detail`
          : 'Lokasi Terhubung - Klik untuk detail';
      case 'prompt':
        return 'Izin Lokasi Belum Aktif - Klik untuk izinkan';
      case 'gps_off':
        return 'Sinyal GPS Tidak Ditemukan - Klik untuk panduan';
      case 'timeout':
        return 'Pencarian Sinyal Habis Waktu - Klik untuk coba lagi';
      case 'denied':
        return 'Izin Lokasi Diblokir - Klik untuk bantuan aktivasi';
      case 'unsupported':
        return 'Perangkat tidak mendukung Geolocation';
      default:
        return 'Memeriksa status lokasi...';
    }
  };

  const content = renderContent();

  // Detail Kartu Status Utama
  const renderDetailCard = () => (
    <div className={`location-status-container status-${status}`} style={{ margin: 0 }}>
      <div className="location-status-header">
        <div className="location-status-main">
          <div className="location-status-icon-wrapper">
            {content.icon}
          </div>
          <div className="location-status-info">
            <div className="location-status-title-row">
              <h4 className="location-status-title">{content.title}</h4>
              <span className="location-status-badge">{content.badge}</span>
            </div>
            <p className="location-status-subtitle">{content.subtitle}</p>
          </div>
        </div>

        <div className="location-status-actions">
          {content.showGuideOption && (
            <button 
              type="button" 
              className="btn-loc-action btn-loc-ghost"
              onClick={() => setShowGuide(prev => !prev)}
              title="Lihat panduan izin"
            >
              <HelpCircle size={15} />
              <span>Panduan</span>
              {showGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          <button 
            type="button" 
            className={`btn-loc-action ${content.actionClass}`}
            onClick={requestLocation}
            disabled={isRequesting}
          >
            <RefreshCw size={14} className={isRequesting ? 'spin-icon' : ''} />
            <span>{content.actionText}</span>
          </button>
        </div>
      </div>

      {/* Accordion Panduan Cara Mengaktifkan Izin */}
      {showGuide && (
        <div className="location-guide-box">
          <strong>Pengaturan Izin Kamera dan Lokasi PWA:</strong>
          <p>Instalasi PWA tidak menjadikan izin permanen. Pilih izin untuk kunjungan berikutnya jika tersedia. Browser tertentu tetap dapat meminta persetujuan lagi.</p>
          <ol>
            <li>
              <strong>Android (Chrome):</strong> Buka alamat aplikasi ini di browser yang digunakan untuk memasang PWA. Di <strong>Setelan Situs / Izin</strong>, izinkan <strong>Kamera</strong> dan <strong>Lokasi</strong>. Periksa juga izin browser/aplikasi di pengaturan HP dan pastikan GPS aktif.
            </li>
            <li>
              <strong>iPhone / iPad (Safari):</strong> Buka <strong>Pengaturan HP</strong> &gt; <strong>Privasi & Keamanan</strong> &gt; <strong>Layanan Lokasi</strong> (Aktifkan). Di Safari, ketuk tombol <strong>aA</strong> di kolom URL &gt; <strong>Setelan Situs Web</strong> &gt; <strong>Lokasi: Izinkan</strong>.
            </li>
            <li>
              <strong>Laptop / PC:</strong> Klik ikon gembok di sebelah kiri URL pada browser &gt; ubah <strong>Location</strong> menjadi <strong>Allow / Izinkan</strong> &gt; tekan <strong>F5</strong> untuk muat ulang.
            </li>
          </ol>
        </div>
      )}
    </div>
  );

  // Jika mode compact & sudah granted (tampilan inline pill)
  if (compact && status === 'granted') {
    return (
      <div 
        style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '6px', 
          fontSize: '0.8rem', 
          color: 'var(--success-color, #34d399)', 
          background: 'rgba(16, 185, 129, 0.15)', 
          border: '1px solid rgba(16, 185, 129, 0.3)',
          padding: '4px 10px', 
          borderRadius: '999px',
          fontWeight: 600
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)' }} />
        <span>Izin Lokasi Aktif</span>
      </div>
    );
  }

  // Jika variant banner inline langsung
  if (variant === 'banner') {
    return renderDetailCard();
  }

  // Default: Variant Navbar (Icon kecil di navbar + Popup Dialog saat ditekan)
  return (
    <>
      <button 
        type="button"
        className={`header-location-btn loc-status-${status}`}
        onClick={() => setIsModalOpen(true)}
        title={getTooltip()}
        aria-label="Status Lokasi Perangkat"
      >
        <MapPin size={18} strokeWidth={1.8} />
        <span className="loc-status-dot" />
      </button>

      {/* Modal Popup Tampilan Status Lokasi */}
      {isModalOpen && (
        <div className="loc-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="loc-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="loc-modal-header">
              <div className="loc-modal-header-text">
                <h3>
                  <MapPin size={18} color={status === 'granted' ? '#10b981' : status === 'prompt' ? '#f59e0b' : '#ef4444'} />
                  Status Lokasi Perangkat
                </h3>
                <p>Informasi koneksi GPS perangkat Anda untuk presensi</p>
              </div>
              <button 
                type="button" 
                className="loc-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                title="Tutup"
                aria-label="Tutup"
              >
                <X size={16} />
              </button>
            </div>

            <div className="loc-modal-body">
              {renderDetailCard()}
            </div>

            <div className="loc-modal-footer">
              <button 
                type="button" 
                className="loc-modal-btn-close"
                onClick={() => setIsModalOpen(false)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LocationStatus;
