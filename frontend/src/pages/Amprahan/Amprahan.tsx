import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// unused
import { Ship, Navigation2, ArrowRight } from 'lucide-react';
import './Amprahan.css';

interface Kapal {
  id: number;
  nama_kapal: string;
}

export default function Amprahan() {
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
        if (data.data) {
          setKapalList(data.data);
        }
        setIsLoadingKapal(false);
      })
      .catch(err => {
        console.error('Error fetching kapal:', err);
        setIsLoadingKapal(false);
      });
  }, []);

  const handleKapalChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setKapalId(selectedId);
    setNomorVoyage('');
    
    if (selectedId) {
      setIsLoadingVoyage(true);
      fetch(`/api/kapal/voyages?kapal_id=${encodeURIComponent(selectedId)}`)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setVoyageList(data.data);
          }
          setIsLoadingVoyage(false);
        })
        .catch(err => {
          console.error('Error fetching voyages:', err);
          setIsLoadingVoyage(false);
        });
    } else {
      setVoyageList([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (kapalId && nomorVoyage) {
      const selectedKapal = kapalList.find(k => k.id.toString() === kapalId);
      navigate('/amprahan/request', { 
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
          <h2>Permintaan Amprahan</h2>
          <p>Silakan isi informasi operasional kapal</p>
        </div>

        <form onSubmit={handleSubmit} className="amprahan-form">
          <div className="form-group">
            <label>Nomor Kapal</label>
            <div className="input-wrapper select-wrapper">
              <Ship className="input-icon" size={20} />
              <select
                value={kapalId}
                onChange={handleKapalChange}
                className="form-input"
                required
                disabled={isLoadingKapal}
              >
                <option value="">{isLoadingKapal ? 'Loading...' : '--Pilih Kapal--'}</option>
                {kapalList.map(kapal => (
                  <option key={kapal.id} value={kapal.id}>
                    {kapal.nama_kapal}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nomor Voyage</label>
            <div className="input-wrapper select-wrapper">
              <Navigation2 className="input-icon" size={20} />
              <select
                value={nomorVoyage}
                onChange={(e) => setNomorVoyage(e.target.value)}
                className="form-input"
                required
                disabled={!kapalId || isLoadingVoyage}
              >
                <option value="">
                  {!kapalId ? '-PILIH KAPAL TERLEBIH DAHULU-' : (isLoadingVoyage ? 'Loading...' : '--Pilih Voyage--')}
                </option>
                {voyageList.map(v => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={!kapalId || !nomorVoyage}
          >
            Lanjutkan <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
