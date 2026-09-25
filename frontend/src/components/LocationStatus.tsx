import React, { useState, useEffect, useCallback } from 'react';
import { MapPinOff, AlertTriangle, CheckCircle2, RefreshCw, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import '../styles/location-status.css';

export type LocationPermissionState = 'loading' | 'granted' | 'prompt' | 'denied' | 'gps_off' | 'timeout' | 'unsupported';

interface LocationStatusProps {
  onStatusChange?: (status: LocationPermissionState, coords?: { lat: number; lng: number } | null) => void;
  compact?: boolean;
}

export const LocationStatus: React.FC<LocationStatusProps> = ({ onStatusChange, compact = false }) => {
  const [status, setStatus] = useState<LocationPermissionState>('loading');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  // Ambil lokasi dan tentukan status detailnya
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      onStatusChange?.('unsupported', null);
      return;
    }

    setIsRequesting(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsRequesting(false);
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setCoords(newCoords);
        setStatus('granted');
        onStatusChange?.('granted', newCoords);
      },
      (error) => {
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
        onStatusChange?.(currentStatus, null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [onStatusChange]);

  // Pantau izin awal menggunakan Permissions API
  useEffect(() => {
    if (!navigator.geolocation) {
      setStatus('unsupported');
      onStatusChange?.('unsupported', null);
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((perm) => {
        if (perm.state === 'granted') {
          // Jika sudah granted, panggil getCurrentPosition untuk memastikan GPS aktif & dapat koordinat
          requestLocation();
        } else if (perm.state === 'prompt') {
          setStatus('prompt');
          onStatusChange?.('prompt', null);
        } else if (perm.state === 'denied') {
          setStatus('denied');
          onStatusChange?.('denied', null);
        }

        // Listener jika user mengubah izin di address bar secara langsung
        perm.onchange = () => {
          if (perm.state === 'granted') {
            requestLocation();
          } else if (perm.state === 'denied') {
            setStatus('denied');
            setCoords(null);
            onStatusChange?.('denied', null);
          } else {
            setStatus('prompt');
            setCoords(null);
            onStatusChange?.('prompt', null);
          }
        };
      }).catch(() => {
        // Fallback untuk browser yang tidak mendukung permission query geolocation
        requestLocation();
      });
    } else {
      requestLocation();
    }
  }, [requestLocation, onStatusChange]);

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
          showGuideOption: false
        };
      case 'prompt':
        return {
          icon: <AlertTriangle size={22} />,
          badge: 'Belum Diizinkan',
          title: 'Izin Lokasi Belum Aktif',
          subtitle: 'Tekan tombol "Izinkan Lokasi" dan pilih "Allow/Izinkan" pada pop-up browser.',
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
          showGuideOption: false
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

  const content = renderContent();

  // Jika mode compact & sudah granted, kita bisa tampilkan versi minimalis
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

  return (
    <div className={`location-status-container status-${status}`}>
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
          <strong>Langkah Mengaktifkan Izin Lokasi:</strong>
          <ol>
            <li>
              <strong>Android (Chrome):</strong> Ketuk ikon <strong>Gembok/Setelan Situs</strong> di sebelah kiri alamat web (URL) &gt; pilih <strong>Izin / Permissions</strong> &gt; nyalakan <strong>Lokasi</strong>. Pastikan juga GPS HP Anda aktif.
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
};

export default LocationStatus;
