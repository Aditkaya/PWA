import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Car, HardHat, Package, Navigation2, ArrowRight, Check } from 'lucide-react';
import './Amprahan.css';

interface Kapal {
  id: number;
  nama_kapal: string;
}

type JenisAmprahan = 'kapal' | 'kendaraan' | 'alat_berat' | 'lainnya';

const jenisPilihan: Array<{ value: JenisAmprahan; label: string; description: string; icon: typeof Ship }> = [
  { value: 'kapal', label: 'Kapal', description: 'Kebutuhan operasional kapal', icon: Ship },
  { value: 'kendaraan', label: 'Kendaraan', description: 'Kebutuhan kendaraan', icon: Car },
  { value: 'alat_berat', label: 'Alat Berat', description: 'Kebutuhan alat berat', icon: HardHat },
  { value: 'lainnya', label: 'Lainnya', description: 'Kebutuhan umum lainnya', icon: Package },
];

export default function Amprahan() {
  const navigate = useNavigate();
  const [kapalList, setKapalList] = useState<Kapal[]>([]);
  const [voyageList, setVoyageList] = useState<string[]>([]);
  
  const [kapalId, setKapalId] = useState('');
  const [nomorVoyage, setNomorVoyage] = useState('');
  const [isLoadingKapal, setIsLoadingKapal] = useState(true);
  const [isLoadingVoyage, setIsLoadingVoyage] = useState(false);
  const [jenisAmprahan, setJenisAmprahan] = useState<JenisAmprahan | null>(null);

  useEffect(() => {
    if (jenisAmprahan !== 'kapal') return;

    setIsLoadingKapal(true);
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
  }, [jenisAmprahan]);

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
    if (jenisAmprahan !== 'kapal') {
      navigate('/amprahan/request', { state: { jenisAmprahan } });
      return;
    }

    if (kapalId && nomorVoyage) {
      const selectedKapal = kapalList.find(k => k.id.toString() === kapalId);
      navigate('/amprahan/request', { 
        state: { 
          kapalId: kapalId, 
          kapalName: selectedKapal?.nama_kapal, 
          nomorVoyage: nomorVoyage,
          jenisAmprahan
        } 
      });
    }
  };

  return (
    <div className="amprahan-page">
      <div className="amprahan-container fade-in">
        <div className="amprahan-header">
          <h2>Permintaan Amprahan</h2>
          <p>Pilih tujuan permintaan amprahan</p>
        </div>

        <div className="amprahan-type-grid">
          {jenisPilihan.map(({ value, label, description, icon: Icon }) => (
            <button
              key={value}
              type="button"
              className={`amprahan-type-card ${jenisAmprahan === value ? 'selected' : ''}`}
              onClick={() => {
                setJenisAmprahan(value);
                if (value !== 'kapal') {
                  setKapalId('');
                  setNomorVoyage('');
                  setVoyageList([]);
                }
              }}
            >
              <span className="amprahan-type-icon"><Icon size={25} /></span>
              <span className="amprahan-type-label">{label}</span>
              <span className="amprahan-type-description">{description}</span>
              {jenisAmprahan === value && <Check className="amprahan-type-check" size={18} />}
            </button>
          ))}
        </div>

        {jenisAmprahan === 'kapal' && <form onSubmit={handleSubmit} className="amprahan-form">
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
        </form>}

        {jenisAmprahan && jenisAmprahan !== 'kapal' && (
          <form onSubmit={handleSubmit} className="amprahan-form amprahan-continue-form">
            <p className="amprahan-selection-note">Kategori <strong>{jenisPilihan.find(item => item.value === jenisAmprahan)?.label}</strong> dipilih.</p>
            <button type="submit" className="btn-submit">
              Lanjutkan <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
