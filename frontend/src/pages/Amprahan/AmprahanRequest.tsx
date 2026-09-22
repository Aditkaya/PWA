import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Send, ArrowLeft, PackagePlus, ChevronDown, LoaderCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';
import './AmprahanRequest.css';

interface AmprahanItem {
  id: string;
  nama_barang: string;
  link_barang: string;
  jumlah: string;
  satuan: string;
  keterangan: string;
}

export default function AmprahanRequest() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [keteranganUmum, setKeteranganUmum] = useState('');
  const [items, setItems] = useState<AmprahanItem[]>([
    { id: Date.now().toString(), nama_barang: '', link_barang: '', jumlah: '', satuan: '', keterangan: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), nama_barang: '', link_barang: '', jumlah: '', satuan: '', keterangan: '' }
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
          keterangan_umum: keteranganUmum,
          items: items.map(i => ({
            nama_barang: i.nama_barang,
            link_barang: i.link_barang || null,
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
        <button type="button" className="btn-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
          <span>Kembali</span>
        </button>

        <div className="request-header">
          <div className="request-header-icon" aria-hidden="true">
            <PackagePlus size={24} />
          </div>
          <div>
            <h2>Permintaan Amprahan</h2>
            <p>Isi barang yang dibutuhkan. Kolom bertanda * wajib diisi.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="request-form">
          <div className="items-container">
            <div className="items-header">
              <div>
                <h3>Daftar Barang</h3>
                <p>{items.length} barang dalam permintaan</p>
              </div>
              <span className="item-count">{items.length}</span>
            </div>
            
            {items.map((item, index) => (
              <div key={item.id} className="item-card">
                <div className="item-header">
                  <div className="item-number">{index + 1}</div>
                  <h4>Barang {index + 1}</h4>
                  {items.length > 1 && (
                    <button 
                      type="button" 
                      className="btn-remove"
                      onClick={() => handleRemoveItem(item.id)}
                      aria-label={`Hapus barang ${index + 1}`}
                      title="Hapus barang"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <div className="item-fields">
                  <div className="form-group full-width">
                    <label htmlFor={`nama-barang-${item.id}`}>Nama barang <span>*</span></label>
                    <input 
                      id={`nama-barang-${item.id}`}
                      type="text" 
                      className="form-input" 
                      placeholder="Contoh: Oli mesin"
                      value={item.nama_barang}
                      onChange={e => handleItemChange(item.id, 'nama_barang', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group half-width">
                    <label htmlFor={`jumlah-${item.id}`}>Jumlah <span>*</span></label>
                    <input 
                      id={`jumlah-${item.id}`}
                      type="number" 
                      className="form-input" 
                      placeholder="1"
                      min="0.1"
                      step="any"
                      value={item.jumlah}
                      onChange={e => handleItemChange(item.id, 'jumlah', e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group half-width">
                    <label htmlFor={`satuan-${item.id}`}>Satuan <span>*</span></label>
                    <input 
                      id={`satuan-${item.id}`}
                      type="text" 
                      className="form-input" 
                      placeholder="Pcs, kg, liter"
                      value={item.satuan}
                      onChange={e => handleItemChange(item.id, 'satuan', e.target.value)}
                      required
                    />
                  </div>
                  
                  <details className="optional-fields full-width">
                    <summary>
                      <span>Detail tambahan <small>opsional</small></span>
                      <ChevronDown size={18} />
                    </summary>
                    <div className="optional-fields-content">
                      <div className="form-group">
                        <label htmlFor={`link-barang-${item.id}`}>Link referensi barang</label>
                        <input
                          id={`link-barang-${item.id}`}
                          type="url"
                          className="form-input"
                          placeholder="https://..."
                          value={item.link_barang}
                          onChange={e => handleItemChange(item.id, 'link_barang', e.target.value)}
                          inputMode="url"
                        />
                      </div>
                      <div className="form-group">
                        <label htmlFor={`keterangan-${item.id}`}>Spesifikasi atau keterangan</label>
                        <input
                          id={`keterangan-${item.id}`}
                          type="text"
                          className="form-input"
                          placeholder="Ukuran, merek, atau catatan lainnya"
                          value={item.keterangan}
                          onChange={e => handleItemChange(item.id, 'keterangan', e.target.value)}
                        />
                      </div>
                    </div>
                  </details>
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
            <span>Tambah barang lain</span>
          </button>

          <div className="general-note">
            <label htmlFor="keterangan-umum">Catatan permintaan <span>Opsional</span></label>
            <textarea
              id="keterangan-umum"
              className="form-input"
              rows={2}
              placeholder="Catatan umum untuk seluruh permintaan"
              value={keteranganUmum}
              onChange={e => setKeteranganUmum(e.target.value)}
            />
          </div>

          <div className="form-actions">
            <p>Pastikan nama, jumlah, dan satuan sudah benar.</p>
            <button 
              type="submit" 
              className="btn-submit-request"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle className="submit-spinner" size={18} />
                  <span>Mengirim...</span>
                </>
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
