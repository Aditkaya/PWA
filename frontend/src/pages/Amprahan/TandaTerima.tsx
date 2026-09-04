import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Navigation2, ArrowRight } from 'lucide-react';
import './Amprahan.css';

interface Kapal {
  id: number;
  nama_kapal: string;
}

export default function TandaTerima() {
  const navigate = useNavigate();
  const [kapalList, setKapalList] = useState<Kapal[]>([]);
  const [voyageList, setVoyageList] = useState<string[]>([]);
  
  const [kapalId, setKapalId] = useState('');
  const [nomorVoyage, setNomorVoyage] = useState('');
  const [isLoadingKapal, setIsLoadingKapal] = useState(true);
  const [isLoadingVoyage, setIsLoadingVoyage] = useState(false);

  useEffect(() => {
    fetch('/api/kapal')
      .then(res => res.json())
      .then(data => {
        setKapalList(data.data || []);
        setIsLoadingKapal(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoadingKapal(false);
      });
  }, []);

  const handleKapalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedKapalId = e.target.value;
    setKapalId(selectedKapalId);
    setNomorVoyage('');
    setVoyageList([]);

    if (selectedKapalId) {
      setIsLoadingVoyage(true);
      fetch(`/api/kapal/voyages?kapal_id=${selectedKapalId}`)
        .then(res => res.json())
        .then(data => {
          setVoyageList(data.data || []);
          setIsLoadingVoyage(false);
        })
        .catch(err => {
          console.error(err);
          setIsLoadingVoyage(false);
        });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kapalId && nomorVoyage) {
      const selectedKapal = kapalList.find(k => k.id.toString() === kapalId);
      navigate('/amprahan/tanda-terima/detail', { 
        state: { 
          kapalId: kapalId, 
          kapalName: selectedKapal?.nama_kapal, 
          nomorVoyage: nomorVoyage 
        } 
      });
    }
  };

  return (
    <div className="amprahan-page">
      <div className="amprahan-container fade-in">
        <div className="amprahan-header">
          <h2>Tanda Terima Amprahan</h2>
          <p>Pilih Kapal dan Nomor Voyage untuk melihat permohonan yang telah disetujui (Approved) dan siap diterima.</p>
        </div>

        <form className="amprahan-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Pilih Kapal</label>
            <div className="input-wrapper">
              <Ship className="input-icon" size={20} />
              <select
                className="form-input"
                value={kapalId}
                onChange={handleKapalChange}
                disabled={isLoadingKapal}
                required
              >
                <option value="" disabled hidden>
                  {isLoadingKapal ? 'Memuat data kapal...' : 'Pilih Kapal...'}
                </option>
                {kapalList.map((k) => (
                  <option key={k.id} value={k.id}>{k.nama_kapal}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nomor Voyage</label>
            <div className="input-wrapper">
              <Navigation2 className="input-icon" size={20} />
              <select
                className="form-input"
                value={nomorVoyage}
                onChange={e => setNomorVoyage(e.target.value)}
                disabled={!kapalId || isLoadingVoyage}
                required
              >
                <option value="" disabled hidden>
                  {!kapalId 
                    ? 'Pilih kapal terlebih dahulu...' 
                    : isLoadingVoyage 
                      ? 'Memuat data voyage...' 
                      : 'Pilih Voyage...'}
                </option>
                {voyageList.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={!kapalId || !nomorVoyage}
          >
            <span>Cari Data Disetujui</span>
            <ArrowRight size={20} />
          </button>
        </form>
      </div>
    </div>
  );
}
