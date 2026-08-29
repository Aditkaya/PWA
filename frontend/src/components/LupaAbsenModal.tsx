import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { useAuthStore } from '../store/auth.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css'; 

interface LupaAbsenModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
}

export default function LupaAbsenModal({ isOpen, onClose, userProfile }: LupaAbsenModalProps) {
  const { lang } = useLangStore();
  const { user } = useAuthStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [tanggal, setTanggal] = useState('');
  const [waktu, setWaktu] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  const [tipeAbsen, setTipeAbsen] = useState('Check In');
  const [alasan, setAlasan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTanggal(new Date().toISOString().split('T')[0]);
      const now = new Date();
      setWaktu(now.toTimeString().slice(0, 5));
      setAlasan('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggal || !waktu || !tipeAbsen || !alasan) {
      showToast(t.fillAllFields || 'Harap lengkapi semua isian', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', user?.id?.toString() || userProfile?.id?.toString() || '');
      formData.append('tanggal', tanggal);
      formData.append('tipe_absen', tipeAbsen);
      formData.append('waktu', waktu);
      formData.append('alasan', alasan);

      const response = await fetch('/api/attendance/lupa', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setIsSuccess(true);
        showToast(t.sent || 'Pengajuan berhasil', 'success');
        setTimeout(() => {
          setIsSuccess(false);
          setTanggal('');
          setWaktu('');
          setAlasan('');
          onClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        showToast(errorData.message || t.failSubmit, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast(t.systemError, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const absenOptions = ['Check In', 'Pulang', 'Istirahat Keluar', 'Istirahat Masuk', 'Mulai Lembur', 'Selesai Lembur'];

  return createPortal(
    <div className="izin-modal-overlay">
      <div className="izin-modal-content">
        <div className="izin-modal-header">
          <div>
            <h3>Lupa Absen</h3>
            <p>Ajukan permohonan persetujuan absen jika Anda lupa tap</p>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={24} />
          </button>
        </div>

        {isSuccess ? (
          <div className="success-state">
            <CheckCircle size={64} color="#10b981" />
            <h3>Berhasil</h3>
            <p>Pengajuan Lupa Absen berhasil dikirim dan menunggu persetujuan.</p>
          </div>
        ) : (
          <form className="izin-modal-form" onSubmit={handleSubmit}>
            <div className="applicant-info">
              <div className="applicant-name">{userProfile?.nama_lengkap || userProfile?.username}</div>
              <div className="applicant-division">{userProfile?.divisi || 'Divisi tidak tersedia'}</div>
            </div>

            <div className="form-group">
              <label><FileText size={16} /> Tipe Absen</label>
              <select 
                className="modal-select" 
                value={tipeAbsen} 
                onChange={(e) => setTipeAbsen(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none' }}
              >
                {absenOptions.map(opt => (
                  <option key={opt} value={opt} style={{ color: '#000' }}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label><Calendar size={16} /> Tanggal</label>
                <input 
                  type="date" 
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group half">
                <label><Clock size={16} /> Waktu</label>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <select 
                    value={waktu.split(':')[0] || '08'} 
                    onChange={(e) => {
                      const currentMin = waktu.split(':')[1] || '00';
                      setWaktu(`${e.target.value}:${currentMin}`);
                    }}
                    className="modal-select"
                    style={{ flex: 1, padding: '10px 4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none', textAlign: 'center' }}
                  >
                    {Array.from({ length: 24 }, (_, i) => {
                      const h = i.toString().padStart(2, '0');
                      return <option key={h} value={h} style={{ color: '#000' }}>{h}</option>;
                    })}
                  </select>
                  <span style={{ color: '#fff' }}>:</span>
                  <select 
                    value={waktu.split(':')[1] || '00'} 
                    onChange={(e) => {
                      const currentHr = waktu.split(':')[0] || '08';
                      setWaktu(`${currentHr}:${e.target.value}`);
                    }}
                    className="modal-select"
                    style={{ flex: 1, padding: '10px 4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', outline: 'none', textAlign: 'center' }}
                  >
                    {Array.from({ length: 60 }, (_, i) => {
                      const m = i.toString().padStart(2, '0');
                      return <option key={m} value={m} style={{ color: '#000' }}>{m}</option>;
                    })}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label><FileText size={16} /> Alasan Lupa</label>
              <textarea 
                rows={3}
                placeholder="Contoh: Terburu-buru karena rapat pagi"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Mengirim...' : (
                <>
                  <CheckCircle size={18} />
                  Kirim Pengajuan
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
