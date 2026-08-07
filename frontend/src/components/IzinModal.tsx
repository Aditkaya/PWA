import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css';

interface IzinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  defaultType?: string;
  onSuccess: () => void;
}

export default function IzinModal({ isOpen, onClose, userProfile, defaultType = '', onSuccess }: IzinModalProps) {
  const { lang } = useLangStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [jenisIzin, setJenisIzin] = useState(
    defaultType === 'Izin 1/2 Hari' ? t.leaveEarly : t.notPresent
  );

  useEffect(() => {
    if (isOpen) {
      setJenisIzin(defaultType === 'Izin 1/2 Hari' ? t.leaveEarly : t.notPresent);
    }
  }, [isOpen, defaultType, t]);
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().split('T')[0]);
  const [waktu, setWaktu] = useState('');
  const [alasan, setAlasan] = useState('');
  const [lampiranFile, setLampiranFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('user_id', userProfile?.id || '');
      formData.append('karyawan_id', userProfile?.karyawan_id || '');
      formData.append('nik', userProfile?.nik || '');
      formData.append('nama', userProfile?.nama_lengkap || '');
      formData.append('divisi', userProfile?.divisi || '');
      formData.append('jenis_izin', jenisIzin);
      formData.append('tanggal_mulai', tanggalMulai);
      formData.append('tanggal_selesai', tanggalSelesai);
      formData.append('waktu', waktu);
      formData.append('alasan', alasan);
      if (lampiranFile) {
        formData.append('lampiran', lampiranFile);
      }

      const response = await fetch('/api/izin', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        onSuccess();
        onClose();
        showToast(t.permitSuccessMessage || 'Pengajuan berhasil dikirim', 'success');
      } else {
        try {
          const errData = await response.json();
          showToast('Gagal mengirim pengajuan izin: ' + (errData.message || response.statusText), 'error');
        } catch(e) {
          showToast('Gagal mengirim pengajuan izin. Status: ' + response.status, 'error');
        }
      }
    } catch (error: any) {
      console.error('Submit Error:', error);
      showToast('Terjadi kesalahan koneksi: ' + error.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="izin-modal-overlay fade-in" onClick={onClose}>
      <div className="izin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="izin-modal-header">
          <div>
            <h3>{t.permitForm}</h3>
            <p>PT. ALEXINDO YAKINPRIMA</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="izin-modal-form">
          <div className="applicant-info">
            <div className="applicant-name">{userProfile?.nama_lengkap || t.noName}</div>
            <div className="applicant-division">{userProfile?.divisi || '-'}</div>
          </div>

          <div className="form-group">
            <label>{t.selectType}</label>
            <div className="radio-group">
              {defaultType === 'Izin 1/2 Hari' ? (
                <>
                  <label className="radio-label">
                    <input type="radio" name="jenis_izin" value={t.late} checked={jenisIzin === t.late} onChange={(e) => setJenisIzin(e.target.value)} />
                    {t.late}
                  </label>
                  <label className="radio-label">
                    <input type="radio" name="jenis_izin" value={t.leaveEarly} checked={jenisIzin === t.leaveEarly} onChange={(e) => setJenisIzin(e.target.value)} />
                    {t.leaveEarly}
                  </label>
                </>
              ) : (
                <>
                  <label className="radio-label">
                    <input type="radio" name="jenis_izin" value={t.notPresent} checked={jenisIzin === t.notPresent} onChange={(e) => setJenisIzin(e.target.value)} />
                    {t.notPresent}
                  </label>
                  <label className="radio-label">
                    <input type="radio" name="jenis_izin" value={t.outOfOffice} checked={jenisIzin === t.outOfOffice} onChange={(e) => setJenisIzin(e.target.value)} />
                    {t.outOfOffice}
                  </label>
                </>
              )}
            </div>
          </div>

          {defaultType === 'Izin 1/2 Hari' ? (
            <div className="form-group">
              <label><Calendar size={14} /> {t.date}</label>
              <input type="date" value={tanggalMulai} readOnly className="input-readonly" />
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group half">
                <label><Calendar size={14} /> {t.startDate}</label>
                <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} required />
              </div>
              <div className="form-group half">
                <label><Calendar size={14} /> {t.endDate}</label>
                <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} required />
              </div>
            </div>
          )}

          {defaultType === 'Izin 1/2 Hari' && (
            <div className="form-group">
              <label><Clock size={14} /> {t.time}</label>
              <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
            </div>
          )}

          {jenisIzin === t.notPresent && (
            <div className="form-group">
              <label>Upload Surat Keterangan Sakit (Max 5MB)</label>
              <input 
                type="file" 
                accept="image/*,.pdf" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 5 * 1024 * 1024) {
                      showToast('Ukuran file maksimal 5MB!', 'error');
                      e.target.value = '';
                    } else {
                      setLampiranFile(file);
                    }
                  }
                }} 
              />
            </div>
          )}

          <div className="form-group">
            <label><FileText size={14} /> {t.reason}</label>
            <textarea rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} required placeholder={t.reasonPlaceholder}></textarea>
          </div>

          <button type="submit" className="btn-submit" disabled={isSubmitting}>
            {isSubmitting ? t.submitting : (
              <>
                <CheckCircle size={18} />
                {t.submitRequest}
              </>
            )}
          </button>
        </form>
      </div>
    </div>,
    document.body
  );
}
