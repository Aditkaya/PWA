import { useState, useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';

export default function UpdateNotification() {
  const [show, setShow] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      setUpdateFn(() => customEvent.detail.updateSW);
      setShow(true);
    };

    window.addEventListener('pwa-update-available', handleUpdate);
    return () => window.removeEventListener('pwa-update-available', handleUpdate);
  }, []);

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 99999,
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      border: '1px solid rgba(56, 189, 248, 0.4)',
      borderRadius: '14px',
      padding: '12px 16px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(56, 189, 248, 0.1)',
      maxWidth: '90vw',
      width: 'max-content',
      animation: 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Animated glow dot */}
      <div style={{
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        background: '#38bdf8',
        flexShrink: 0,
        boxShadow: '0 0 8px #38bdf8',
        animation: 'pulse 2s infinite',
      }} />

      {/* Text */}
      <div>
        <div style={{
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#f8fafc',
          lineHeight: '1.2',
        }}>
          🚀 Pembaruan Tersedia!
        </div>
        <div style={{
          fontSize: '0.75rem',
          color: '#94a3b8',
          marginTop: '2px',
        }}>
          Versi terbaru aplikasi siap digunakan
        </div>
      </div>

      {/* Refresh Button */}
      <button
        onClick={() => {
          if (updateFn) updateFn();
          setShow(false);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: 'linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '7px 14px',
          fontSize: '0.8rem',
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
      >
        <RefreshCw size={13} />
        Perbarui Sekarang
      </button>

      {/* Dismiss Button */}
      <button
        onClick={() => setShow(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.05)',
          color: '#94a3b8',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '6px',
          padding: '6px',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
          e.currentTarget.style.color = '#f8fafc';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          e.currentTarget.style.color = '#94a3b8';
        }}
        title="Tutup"
      >
        <X size={13} />
      </button>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #38bdf8; }
          50%       { opacity: 0.6; box-shadow: 0 0 16px #38bdf8; }
        }
      `}</style>
    </div>
  );
}
