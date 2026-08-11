import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, CheckCircle, MapPin } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css';

interface PermitOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (keterangan: string, locationData: {lat: number, lng: number, address: string} | null) => void;
  type: string;
}

export default function PermitOutModal({ isOpen, onClose, onSubmit, type }: PermitOutModalProps) {
  const [reason, setReason] = useState('');
  
  const { lang } = useLangStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [locationCoords, setLocationCoords] = useState<{lat: number, lng: number} | null>(null);
  const [address, setAddress] = useState(t.findingLocation);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setAddress(t.findingLocation);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setLocationCoords({ lat, lng });

            fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
              .then(res => res.json())
              .then(data => {
                if (data && data.display_name) {
                  setAddress(data.display_name);
                }
              })
              .catch(() => setAddress('Location found'));
          },
          () => {
            setAddress(t.gpsFailed);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        setAddress(t.gpsNotSupported);
      }
    }
  }, [isOpen, t.findingLocation, t.gpsFailed, t.gpsNotSupported]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      showToast(t.fillAllFields, 'error');
      return;
    }

    // Submit instantly and let parent handle closing
    onSubmit(reason, locationCoords ? { lat: locationCoords.lat, lng: locationCoords.lng, address } : null);
  };

  return createPortal(
    <div className="izin-modal-overlay fade-in" onClick={onClose}>
      <div className="izin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="izin-modal-header">
          <div>
            <h3>{type}</h3>
            <p>PT. ALEXINDO YAKINPRIMA</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="izin-modal-form">
          <div className="form-group" style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <MapPin size={16} /> Lokasi
            </label>
            <div style={{ background: 'var(--glass-bg)', padding: '10px', borderRadius: '10px', fontSize: '0.85rem' }}>
              {address}
            </div>
          </div>

          <div className="form-group">
            <label>{t.descReason}</label>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={lang === 'id' ? "Keterangan keluar..." : "Reason for leaving..."}
              rows={4}
              required
            />
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={!reason.trim()}
          >
            {t.submitLeave}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
