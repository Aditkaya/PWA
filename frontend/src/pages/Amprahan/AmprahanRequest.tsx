import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Ship, Navigation2, Plus, Trash2, Send, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import './AmprahanRequest.css';

interface AmprahanItem {
  id: string;
  nama_barang: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
}

export default function AmprahanRequest() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const state = location.state as {
    kapalId: string;
    kapalName: string;
    nomorVoyage: string;
  };

  // If accessed directly without state, redirect back
  if (!state) {
    navigate('/amprahan');
    return null;
  }

  const [keteranganUmum, setKeteranganUmum] = useState('');
  const [items, setItems] = useState<AmprahanItem[]>([
    { id: Date.now().toString(), nama_barang: '', jumlah: '', satuan: '', keterangan: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), nama_barang: '', jumlah: '', satuan: '', keterangan: '' }
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: string, field: keyof AmprahanItem, value: string) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validasi
    const invalidItems = items.some(i => !i.nama_barang || !i.jumlah || !i.satuan);
    if (invalidItems) {
      alert('Harap isi semua kolom wajib (Nama Barang, Jumlah, Satuan) untuk setiap item.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/amprahan/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: user?.id,
          kapal_id: state.kapalId,
          nomor_voyage: state.nomorVoyage,
          keterangan_umum: keteranganUmum,
          items: items.map(i => ({
            nama_barang: i.nama_barang,
            jumlah: parseFloat(i.jumlah),
            satuan: i.satuan,
            keterangan: i.keterangan
          }))
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Berhasil: ' + data.message);
        navigate('/'); // redirect to home or somewhere else
      } else {
        alert('Gagal: ' + (data.message || 'Terjadi kesalahan'));
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan koneksi saat mengirim permintaan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="amprahan-request-page">
      <div className="amprahan-request-container fade-in">
        <button className="btn-back" onClick={() => navigate('/amprahan')}>
          <ArrowLeft size={20} />
          <span>Kembali</span>
        </button>

        <div className="request-header">
          <h2>Form Permintaan Amprahan</h2>
          <div className="info-chips">
            <div className="chip">
              <Ship size={16} />
              <span>{state.kapalName}</span>
            </div>
            <div className="chip">
              <Navigation2 size={16} />
              <span>Voyage: {state.nomorVoyage}</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="request-form">
          <div className="form-group mb-4">
            <label>Keterangan Umum (Opsional)</label>
            <textarea 
              className="form-input"
              rows={2}
              placeholder="Tambahkan keterangan untuk keseluruhan permintaan ini..."
              value={keteranganUmum}
              onChange={e => setKeteranganUmum(e.target.value)}
            />
          </div>

          <div className="items-container">
            <div className="items-header">
              <h3>Daftar Barang</h3>
            </div>
            
            {items.map((item, index) => (
              <div key={item.id} className="item-card">
                <div className="item-header">
                  <h4>Item #{index + 1}</h4>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      className="btn-remove"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <div className="item-fields">
                  <div className="form-group full-width">
                    <label>Nama Barang *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: Majun, Sabun, Oli..."
                      value={item.nama_barang}
                      onChange={e => handleItemChange(item.id, 'nama_barang', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group half-width">
                    <label>Jumlah *</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="0"
                      min="0.1"
                      step="any"
                      value={item.jumlah}
                      onChange={e => handleItemChange(item.id, 'jumlah', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group half-width">
                    <label>Satuan *</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Pcs, Kg, Ltr..."
                      value={item.satuan}
                      onChange={e => handleItemChange(item.id, 'satuan', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group full-width">
                    <label>Keterangan (Opsional)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Spesifikasi / ukuran / merk..."
                      value={item.keterangan}
                      onChange={e => handleItemChange(item.id, 'keterangan', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button 
            type="button" 
            className="btn-add-item"
            onClick={handleAddItem}
          >
            <Plus size={18} />
            <span>Tambah Barang</span>
          </button>

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn-submit-request"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <Send size={18} />
                  <span>Kirim Permintaan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
