import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, CheckCircle } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css'; // Reusing premium styling

interface CutiModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
}

export default function CutiModal({ isOpen, onClose, userProfile }: CutiModalProps) {
  const { lang } = useLangStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [tanggalMulai, setTanggalMulai] = useState('');
  const [tanggalSelesai, setTanggalSelesai] = useState('');
  const [alasan, setAlasan] = useState('');
  const [jenisCuti, setJenisCuti] = useState('Tahunan');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggalMulai || !tanggalSelesai || !alasan) {
      showToast(t.fillAllFields, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('user_id', userProfile?.id?.toString() || '');
      formData.append('karyawan_id', userProfile?.karyawan_id?.toString() || '');
      formData.append('tanggal_mulai', tanggalMulai);
      formData.append('tanggal_selesai', tanggalSelesai);
      formData.append('jenis_cuti', jenisCuti);
      formData.append('keterangan', alasan);

      const response = await fetch('http://localhost:8000/api/cuti', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setIsSuccess(true);
        showToast(t.sent, 'success');
        setTimeout(() => {
          setIsSuccess(false);
          setTanggalMulai('');
          setTanggalSelesai('');
          setAlasan('');
          onClose();
        }, 2000);
      } else {
        showToast(t.failSubmit, 'error');
      }
    } catch (error) {
      console.error(error);
      showToast(t.systemError, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cutiOptions = ['Tahunan', 'Menikah', 'Hamil', 'Haji'];

  return createPortal(
    <div className="izin-modal-overlay">
      <div className="izin-modal-content">
        <div className="izin-modal-header">
          <div>
            <h3>{t.leaveForm}</h3>
            <p>{t.basedOnRules}</p>
          </div>
          <button className="close-btn" onClick={onClose} disabled={isSubmitting}>
            <X size={24} />
          </button>
        </div>

        {isSuccess ? (
          <div className="success-state">
            <CheckCircle size={64} color="#10b981" />
            <h3>{t.sent}</h3>
            <p>{t.leaveSuccessMessage}</p>
          </div>
        ) : (
          <form className="izin-modal-form" onSubmit={handleSubmit}>
            <div className="applicant-info">
              <div className="applicant-name">{userProfile?.nama_lengkap || userProfile?.username}</div>
              <div className="applicant-division">{userProfile?.divisi || 'Divisi tidak tersedia'}</div>
            </div>

            <div className="form-group">
              <label><FileText size={16} /> {t.leaveType}</label>
              <div className="radio-group" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {cutiOptions.map(opt => (
                  <label key={opt} className="radio-label">
                    <input 
                      type="radio" 
                      name="jenis_cuti" 
                      value={opt} 
                      checked={jenisCuti === opt} 
                      onChange={(e) => setJenisCuti(e.target.value)} 
                    />
                    {opt}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label><Calendar size={16} /> {t.startDate}</label>
                <input 
                  type="date" 
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="form-group half">
                <label><Calendar size={16} /> {t.endDate}</label>
                <input 
                  type="date" 
                  value={tanggalSelesai}
                  onChange={(e) => setTanggalSelesai(e.target.value)}
                  min={tanggalMulai || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label><FileText size={16} /> {t.leaveReason}</label>
              <textarea 
                rows={3}
                placeholder={t.leaveReasonPlaceholder}
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-submit" disabled={isSubmitting}>
              {isSubmitting ? t.submitting : (
                <>
                  <CheckCircle size={18} />
                  {t.submitLeave}
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
