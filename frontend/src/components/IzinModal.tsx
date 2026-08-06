import { useState, useEffect } from 'react';
import { X, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import '../styles/izinmodal.css';

interface IzinModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: any;
  defaultType?: string;
  onSuccess: () => void;
}

export default function IzinModal({ isOpen, onClose, userProfile, defaultType = '', onSuccess }: IzinModalProps) {
  const [jenisIzin, setJenisIzin] = useState(
    defaultType === 'Izin 1/2 Hari' ? 'Pulang Cepat' : 'Tidak Masuk'
  );

  useEffect(() => {
    if (isOpen) {
      setJenisIzin(defaultType === 'Izin 1/2 Hari' ? 'Pulang Cepat' : 'Tidak Masuk');
    }
  }, [isOpen, defaultType]);
  const [tanggalMulai, setTanggalMulai] = useState(new Date().toISOString().split('T')[0]);
  const [tanggalSelesai, setTanggalSelesai] = useState(new Date().toISOString().split('T')[0]);
  const [waktu, setWaktu] = useState('');
  const [alasan, setAlasan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('karyawan_id', userProfile?.karyawan_id || '');
      formData.append('nik', userProfile?.nik || '');
      formData.append('nama', userProfile?.nama_lengkap || '');
      formData.append('divisi', userProfile?.divisi || '');
      formData.append('jenis_izin', jenisIzin);
      formData.append('tanggal_mulai', tanggalMulai);
      formData.append('tanggal_selesai', tanggalSelesai);
      formData.append('waktu', waktu);
      formData.append('alasan', alasan);

      const response = await fetch('http://localhost:8000/api/izin', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        alert('Gagal mengirim pengajuan izin.');
      }
    } catch (error) {
      console.error('Submit Error:', error);
      alert('Terjadi kesalahan koneksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="izin-modal-overlay fade-in" onClick={onClose}>
      <div className="izin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="izin-modal-header">
          <div>
            <h3>FORM PERMOHONAN IZIN</h3>
            <p>PT. ALEXINDO YAKINPRIMA</p>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="izin-modal-form">
          <div className="applicant-info">
            <div className="applicant-name">{userProfile?.nama_lengkap || 'Tanpa Nama'}</div>
            <div className="applicant-division">{userProfile?.divisi || '-'}</div>
          </div>

          <div className="form-group">
            <label>Pilih Jenis Permohonan:</label>
            <div className="radio-group">
              <label className="radio-label">
                <input type="radio" name="jenis_izin" value="Tidak Masuk" checked={jenisIzin === 'Tidak Masuk'} onChange={(e) => setJenisIzin(e.target.value)} />
                Tidak Masuk
              </label>
              <label className="radio-label">
                <input type="radio" name="jenis_izin" value="Datang Terlambat" checked={jenisIzin === 'Datang Terlambat'} onChange={(e) => setJenisIzin(e.target.value)} />
                Datang Terlambat
              </label>
              <label className="radio-label">
                <input type="radio" name="jenis_izin" value="Pulang Cepat" checked={jenisIzin === 'Pulang Cepat'} onChange={(e) => setJenisIzin(e.target.value)} />
                Pulang Cepat
              </label>
              <label className="radio-label">
                <input type="radio" name="jenis_izin" value="Dinas Luar" checked={jenisIzin === 'Dinas Luar'} onChange={(e) => setJenisIzin(e.target.value)} />
                Dinas Luar
              </label>
            </div>
          </div>

          {defaultType === 'Izin 1/2 Hari' ? (
            <div className="form-group">
              <label><Calendar size={14} /> Tanggal</label>
              <input type="date" value={tanggalMulai} readOnly className="input-readonly" />
            </div>
          ) : (
            <div className="form-row">
              <div className="form-group half">
                <label><Calendar size={14} /> Tanggal Mulai</label>
                <input type="date" value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} required />
              </div>
              <div className="form-group half">
                <label><Calendar size={14} /> s.d Selesai</label>
                <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} required />
              </div>
            </div>
          )}

          {defaultType === 'Izin 1/2 Hari' && (
            <div className="form-group">
              <label><Clock size={14} /> Waktu</label>
              <input type="time" value={waktu} onChange={(e) => setWaktu(e.target.value)} />
            </div>
          )}

          <div className="form-group">
            <label><FileText size={14} /> Alasan</label>
            <textarea rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} required placeholder="Tuliskan alasan permohonan izin..."></textarea>
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
      </div>
    </div>
  );
}
