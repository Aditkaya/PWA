import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Car, HardHat, Package, ArrowRight, Check } from 'lucide-react';
import './Amprahan.css';

interface Kapal {
  id: number;
  nama_kapal: string;
}

interface Mobil {
  id: number;
  kode_no?: string | null;
  nomor_polisi?: string | null;
  nomor_kir?: string | null;
  jenis?: string | null;
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
  const [kapalId, setKapalId] = useState('');
  const [isLoadingKapal, setIsLoadingKapal] = useState(true);
  const [mobilList, setMobilList] = useState<Mobil[]>([]);
  const [mobilId, setMobilId] = useState('');
  const [isLoadingMobil, setIsLoadingMobil] = useState(false);
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

  useEffect(() => {
    if (jenisAmprahan !== 'kendaraan') return;

    setIsLoadingMobil(true);
    fetch('/api/amprahan/mobils')
      .then(res => res.json())
      .then(data => setMobilList(data.data || []))
      .catch(err => console.error('Error fetching kendaraan:', err))
      .finally(() => setIsLoadingMobil(false));
  }, [jenisAmprahan]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (jenisAmprahan !== 'kapal') {
      const selectedMobil = mobilList.find(m => m.id.toString() === mobilId);
      navigate('/amprahan/request', { state: {
        jenisAmprahan,
        mobilId: jenisAmprahan === 'kendaraan' ? mobilId : undefined,
        mobilName: selectedMobil?.nomor_polisi || selectedMobil?.nomor_kir || selectedMobil?.kode_no,
      } });
      return;
    }

    if (kapalId) {
      const selectedKapal = kapalList.find(k => k.id.toString() === kapalId);
      navigate('/amprahan/request', { 
        state: { 
          kapalId: kapalId, 
          kapalName: selectedKapal?.nama_kapal, 
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
                }
                if (value !== 'kendaraan') setMobilId('');
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
            <label>Pilih Kapal</label>
            <div className="input-wrapper select-wrapper">
              <Ship className="input-icon" size={20} />
              <select
                value={kapalId}
                onChange={e => setKapalId(e.target.value)}
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

          <button 
            type="submit" 
            className="btn-submit"
            disabled={!kapalId}
          >
            Lanjutkan <ArrowRight size={18} />
          </button>
        </form>}

        {jenisAmprahan && jenisAmprahan !== 'kapal' && (
          <form onSubmit={handleSubmit} className="amprahan-form amprahan-continue-form">
            <p className="amprahan-selection-note">Kategori <strong>{jenisPilihan.find(item => item.value === jenisAmprahan)?.label}</strong> dipilih.</p>
            {jenisAmprahan === 'kendaraan' && (
              <div className="form-group">
                <label>Pilih Kendaraan</label>
                <div className="input-wrapper select-wrapper">
                  <Car className="input-icon" size={20} />
                  <select
                    value={mobilId}
                    onChange={e => setMobilId(e.target.value)}
                    className="form-input"
                    required
                    disabled={isLoadingMobil}
                  >
                    <option value="">{isLoadingMobil ? 'Loading...' : '--Pilih Kendaraan--'}</option>
                    {mobilList.map(mobil => (
                      <option key={mobil.id} value={mobil.id}>
                        {mobil.nomor_polisi || mobil.nomor_kir || mobil.kode_no || `Kendaraan #${mobil.id}`}{mobil.jenis ? ` - ${mobil.jenis}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <button type="submit" className="btn-submit" disabled={jenisAmprahan === 'kendaraan' && !mobilId}>
              Lanjutkan <ArrowRight size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
