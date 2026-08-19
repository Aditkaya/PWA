import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, FileText, CheckCircle, AlertTriangle } from 'lucide-react';
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
  const [warningConfirm, setWarningConfirm] = useState<{ diffDays: number, sisaCuti: number } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggalMulai || !tanggalSelesai || !alasan) {
      showToast(t.fillAllFields, 'error');
      return;
    }

    const start = new Date(tanggalMulai);
    const end = new Date(tanggalSelesai);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) {
      showToast('Tanggal selesai tidak boleh sebelum tanggal mulai', 'error');
      return;
    }
    
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const sisaCuti = userProfile?.sisa_cuti ?? 0;

    if (diffDays > sisaCuti) {
      setWarningConfirm({ diffDays, sisaCuti });
      return;
    }

    proceedSubmit();
  };

  const proceedSubmit = async () => {
    setIsSubmitting(true);
    setWarningConfirm(null);
    try {
      const formData = new FormData();
      formData.append('user_id', userProfile?.id?.toString() || '');
      formData.append('karyawan_id', userProfile?.karyawan_id?.toString() || '');
      formData.append('tanggal_mulai', tanggalMulai);
      formData.append('tanggal_selesai', tanggalSelesai);
      formData.append('jenis_cuti', jenisCuti);
      formData.append('keterangan', alasan);

      const response = await fetch('/api/cuti', {
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
            
            <div className="leave-balance-info" style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Total Cuti</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>{userProfile?.total_cuti ?? 0}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Terpakai</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f87171' }}>{userProfile?.cuti_terpakai ?? 0}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>Sisa Cuti</div>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#10b981' }}>{userProfile?.sisa_cuti ?? 0}</div>
              </div>
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

        {warningConfirm && (
          <div className="izin-modal-overlay" style={{ zIndex: 9999, position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}>
            <div className="izin-modal-content" style={{ maxWidth: '400px', background: '#1e293b', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '24px', textAlign: 'center', margin: '20px' }}>
              <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center', background: 'rgba(239, 68, 68, 0.1)', width: '64px', height: '64px', borderRadius: '50%', alignItems: 'center' }}>
                <AlertTriangle size={32} color="#ef4444" />
              </div>
              <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>Sisa Cuti Tidak Mencukupi</h3>
              <p style={{ color: '#9ca3af', marginBottom: '24px', lineHeight: '1.5', fontSize: '14px' }}>
                Sisa cuti anda (<strong>{warningConfirm.sisaCuti} hari</strong>) tidak mencukupi untuk mengambil cuti selama <strong>{warningConfirm.diffDays} hari</strong>.<br/><br/>
                Apakah Anda tetap ingin melanjutkan pengajuan cuti ini?
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => setWarningConfirm(null)} style={{ flex: 1, padding: '10px 16px', background: '#374151', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Batal</button>
                <button onClick={proceedSubmit} style={{ flex: 1, padding: '10px 16px', background: '#ef4444', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Lanjutkan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
