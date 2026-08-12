import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { useLangStore } from '../store/lang.store';
import { translations } from '../utils/translations';
import { useToast } from '../contexts/ToastContext';
import '../styles/izinmodal.css'; 

interface LemburModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  onSubmit: (keterangan: string) => void;
}

export default function LemburModal({ isOpen, onClose, userProfile, onSubmit }: LemburModalProps) {
  const { lang } = useLangStore();
  const t = translations[lang];
  const { showToast } = useToast();

  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [jamMulai, setJamMulai] = useState(() => {
    const now = new Date();
    return now.toTimeString().slice(0, 5);
  });
  const [keterangan, setKeterangan] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tanggal || !jamMulai || !keterangan) {
      showToast(t.fillAllFields || 'Harap lengkapi semua isian', 'error');
      return;
    }
    onSubmit(keterangan);
  };

  return createPortal(
    <div className="izin-modal-overlay">
      <div className="izin-modal-content">
        <div className="izin-modal-header">
          <div>
            <h3>Pengajuan Lembur</h3>
            <p>Formulir permohonan persetujuan lembur</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form className="izin-modal-form" onSubmit={handleSubmit}>
          <div className="applicant-info">
              <div className="applicant-name">{userProfile?.nama_lengkap || userProfile?.username}</div>
              <div className="applicant-division">{userProfile?.divisi || 'Divisi tidak tersedia'}</div>
            </div>

            <div className="form-group">
              <label><Calendar size={16} /> Tanggal Lembur</label>
              <input 
                type="date" 
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label><Clock size={16} /> Jam Mulai</label>
              <input 
                type="time" 
                value={jamMulai}
                onChange={(e) => setJamMulai(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label><FileText size={16} /> Keterangan / Pekerjaan</label>
              <textarea 
                rows={3}
                placeholder="Contoh: Menyelesaikan laporan bulanan"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-submit">
              <CheckCircle size={18} />
              Lanjut Foto
            </button>
          </form>
      </div>
    </div>,
    document.body
  );
}
