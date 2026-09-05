import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Ship, Truck, Send, Anchor, UserPlus, ArrowLeft, Search, CheckCircle, UserX, Loader2, X } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import api from '../../services/axios'
import './Login.css'

type View = 'login' | 'register'
type RegStep = 'search' | 'form'

interface KaryawanResult {
  id: number
  nik: string
  nama_lengkap: string
  has_account: boolean
  username: string | null
  is_approved: boolean | null
}

export default function Login() {
  const [view, setView] = useState<View>('login')

  // ── Login state ──
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginPending, setLoginPending] = useState(false)
  const [loginRejected, setLoginRejected] = useState(false)
  const [isLoginLoading, setIsLoginLoading] = useState(false)

  // ── Register: step 1 – karyawan search ──
  const [regStep, setRegStep] = useState<RegStep>('search')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<KaryawanResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [selectedKaryawan, setSelectedKaryawan] = useState<KaryawanResult | null>(null)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Register: step 2 – form ──
  const [regUsername, setRegUsername] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [regError, setRegError] = useState('')
  const [regSuccess, setRegSuccess] = useState('')
  const [isRegLoading, setIsRegLoading] = useState(false)

  // ── DB Status ──
  const [dbStatus, setDbStatus] = useState<{ connected: boolean | null; message: string }>({
    connected: null,
    message: 'Memeriksa koneksi...',
  })

  const navigate = useNavigate()
  const { login } = useAuthStore()

  useEffect(() => {
    const checkDb = async () => {
      try {
        await api.get('/health')
        setDbStatus({ connected: true, message: 'Sistem Online' })
      } catch (err: any) {
        setDbStatus({
          connected: false,
          message: err.response?.data?.message || 'Sistem Offline',
        })
      }
    }
    checkDb()
  }, [])

  // ── Login handler ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    setLoginPending(false)
    setLoginRejected(false)
    setIsLoginLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      const data = err.response?.data
      if (err.response?.status === 403 && data?.status === 'pending') {
        setLoginPending(true)
      } else if (err.response?.status === 403 && data?.status === 'rejected') {
        setLoginRejected(true)
      } else {
        setLoginError(data?.message || 'Login gagal. Periksa username dan password Anda.')
      }
    } finally {
      setIsLoginLoading(false)
    }
  }

  // ── Karyawan search (debounced) ──
  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
    setSearchError('')
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (q.trim().length < 2) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/karyawans/search', { params: { q: q.trim(), limit: 15 } })
        setSearchResults(res.data.data || [])
      } catch (err: any) {
        setSearchError(err.response?.data?.message || 'Gagal mencari data karyawan.')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 400)
  }, [])

  const handleSelectKaryawan = (k: KaryawanResult) => {
    setSelectedKaryawan(k)
    setSearchResults([])
    setSearchQuery('')
    setRegStep('form')
    setRegError('')
    setRegSuccess('')
    // Pre-fill username from existing username if already has account (shouldn't happen, but safe)
    setRegUsername('')
    setRegPassword('')
    setRegConfirmPassword('')
  }

  // ── Register submit ──
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegError('')

    if (!selectedKaryawan) return

    // Guard double-check on frontend
    if (selectedKaryawan.has_account) {
      setRegError('Karyawan ini sudah memiliki akun.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Password dan konfirmasi password tidak cocok.')
      return
    }
    if (regPassword.length < 6) {
      setRegError('Password minimal 6 karakter.')
      return
    }

    setIsRegLoading(true)
    try {
      await api.post('/register', {
        karyawan_id: selectedKaryawan.id,
        username: regUsername,
        password: regPassword,
      })
      setRegSuccess(
        `Akun untuk ${selectedKaryawan.nama_lengkap} berhasil dibuat! Akun sedang menunggu persetujuan admin. Silakan hubungi HRD untuk konfirmasi.`
      )
    } catch (err: any) {
      setRegError(err.response?.data?.message || 'Gagal membuat akun. Silakan coba lagi.')
    } finally {
      setIsRegLoading(false)
    }
  }

  // ── Navigation helpers ──
  const switchToRegister = () => {
    setLoginError('')
    setView('register')
    setRegStep('search')
    setSelectedKaryawan(null)
    setSearchQuery('')
    setSearchResults([])
    setRegSuccess('')
    setRegError('')
  }

  const switchToLogin = () => {
    setView('login')
  }

  const backToSearch = () => {
    setRegStep('search')
    setSelectedKaryawan(null)
    setRegError('')
    setRegSuccess('')
  }

  return (
    <div className="login-page">
      <div className={`login-container ${view === 'register' ? 'register-mode' : ''}`}>

        {/* ── Left Branding ── */}
        <div className="login-branding">
          <div className="branding-icons">
            <div className="icon-box"><Ship size={24} /></div>
            <div className="icon-box"><Truck size={24} /></div>
          </div>
          <div className="branding-text">
            <h1>
              <span className="text-white">Alexindo</span><br />
              <span className="text-gold">Yakinprima</span>
            </h1>
            <p>Logistics & Maritime Excellence</p>
          </div>
          <div className="branding-badges">
            <div className="badge"><Send size={16} /><span>Jangkauan Global</span></div>
            <div className="badge"><Anchor size={16} /><span>Operasional Pelabuhan Aman</span></div>
          </div>
        </div>

        {/* ── Right Section ── */}
        <div className="login-form-section">

          {/* ════ LOGIN VIEW ════ */}
          {view === 'login' && (
            <>
              <div className="login-header">
                <h2>Portal HRIS</h2>
                <p>Silakan masuk ke akun Anda</p>
                <div className={`db-status ${dbStatus.connected === true ? 'status-success' : dbStatus.connected === false ? 'status-error' : 'status-loading'}`}>
                  <span className="status-indicator"></span>
                  <small>{dbStatus.message}</small>
                </div>
              </div>

              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input type="text" id="username" className="form-input"
                    placeholder="Masukkan username" value={username}
                    onChange={(e) => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <div className="password-input-wrapper">
                    <input type={showPassword ? 'text' : 'password'} id="password" className="form-input"
                      placeholder="Masukkan password" value={password}
                      onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="btn-show-password"
                      onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                {loginRejected && (
                  <div className="rejected-notice">
                    <div className="pending-notice-icon">🚫</div>
                    <div>
                      <strong>Akun Ditolak</strong>
                      <p>Akun Anda telah ditolak oleh admin. Silakan hubungi HRD untuk informasi lebih lanjut.</p>
                    </div>
                  </div>
                )}
                {loginPending && (
                  <div className="pending-notice">
                    <div className="pending-notice-icon">⏳</div>
                    <div>
                      <strong>Akun Menunggu Persetujuan</strong>
                      <p>Akun Anda telah terdaftar namun belum disetujui oleh admin. Silakan hubungi HRD untuk konfirmasi.</p>
                    </div>
                  </div>
                )}
                {loginError && <div className="error-message">{loginError}</div>}
                <button type="submit" className="btn-login" disabled={isLoginLoading} id="btn-login-submit">
                  {isLoginLoading ? 'Memproses...' : 'Masuk ke Portal'}
                </button>
              </form>

              <div className="register-link">
                <p>Belum punya akun?</p>
                <button className="btn-register-link" onClick={switchToRegister} id="btn-go-to-register">
                  <UserPlus size={16} />
                  Daftar Akun Baru
                </button>
              </div>

              <div className="login-footer">
                <p>&copy; 2026 PT Alexindo Yakinprima.</p>
              </div>
            </>
          )}

          {/* ════ REGISTER VIEW ════ */}
          {view === 'register' && (
            <>
              <div className="login-header">
                <button className="btn-back" onClick={regStep === 'form' ? backToSearch : switchToLogin} id="btn-back">
                  <ArrowLeft size={18} />
                  {regStep === 'form' ? 'Pilih Karyawan Lain' : 'Kembali ke Login'}
                </button>
                <h2>{regStep === 'search' ? 'Buat Akun Karyawan' : 'Data Akun'}</h2>
                <p>
                  {regStep === 'search'
                    ? 'Cari karyawan berdasarkan nama atau NIK.'
                    : `Lengkapi data akun untuk ${selectedKaryawan?.nama_lengkap}.`}
                </p>

                {/* Step indicator */}
                <div className="reg-steps">
                  <div className={`reg-step ${regStep === 'search' ? 'active' : 'done'}`}>
                    <span className="step-num">{regStep === 'search' ? '1' : '✓'}</span>
                    <span>Pilih Karyawan</span>
                  </div>
                  <div className="step-divider" />
                  <div className={`reg-step ${regStep === 'form' ? 'active' : ''}`}>
                    <span className="step-num">2</span>
                    <span>Buat Akun</span>
                  </div>
                </div>
              </div>

              {/* ─── STEP 1: SEARCH ─── */}
              {regStep === 'search' && (
                <div className="reg-search-section">
                  <div className="search-input-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                      type="text"
                      id="reg-search"
                      className="form-input search-input"
                      placeholder="Ketik nama atau NIK karyawan..."
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      autoComplete="off"
                    />
                    {isSearching && <Loader2 size={18} className="search-spinner" />}
                    {searchQuery && !isSearching && (
                      <button className="search-clear" onClick={() => { setSearchQuery(''); setSearchResults([]) }}>
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {searchError && <div className="error-message" style={{ marginTop: 8 }}>{searchError}</div>}

                  {searchResults.length > 0 && (
                    <div className="search-results">
                      {searchResults.map((k) => (
                        <button
                          key={k.id}
                          className={`search-result-item ${k.has_account ? 'has-account' : ''}`}
                          onClick={() => handleSelectKaryawan(k)}
                          disabled={k.has_account}
                          id={`karyawan-${k.id}`}
                        >
                          <div className="result-info">
                            <span className="result-name">{k.nama_lengkap}</span>
                            <span className="result-nik">NIK: {k.nik}</span>
                          </div>
                          <div className="result-status">
                            {k.has_account ? (
                              <span className="badge-has-account">
                                <UserX size={13} />
                                Sudah punya akun
                              </span>
                            ) : (
                              <span className="badge-no-account">
                                <UserPlus size={13} />
                                Belum punya akun
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && !searchError && (
                    <p className="search-empty">Tidak ada karyawan ditemukan untuk &ldquo;{searchQuery}&rdquo;</p>
                  )}

                  {searchQuery.length < 2 && (
                    <p className="search-hint">Ketik minimal 2 karakter untuk mencari karyawan.</p>
                  )}
                </div>
              )}

              {/* ─── STEP 2: FORM ─── */}
              {regStep === 'form' && selectedKaryawan && (
                <>
                  {regSuccess ? (
                    <div className="success-message">
                      <div className="success-icon"><CheckCircle size={28} /></div>
                      <p>{regSuccess}</p>
                      <button className="btn-login" onClick={switchToLogin} style={{ marginTop: 16 }}>
                        Kembali ke Login
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Karyawan info card */}
                      <div className="karyawan-card">
                        <div className="karyawan-card-row">
                          <div className="karyawan-field">
                            <span className="karyawan-field-label">Nama Lengkap</span>
                            <span className="karyawan-field-value">{selectedKaryawan.nama_lengkap}</span>
                          </div>
                          <div className="karyawan-field">
                            <span className="karyawan-field-label">NIK</span>
                            <span className="karyawan-field-value">{selectedKaryawan.nik}</span>
                          </div>
                        </div>
                      </div>

                      {selectedKaryawan.has_account ? (
                        /* Should not reach here (disabled in step 1), but safety net */
                        <div className="account-exists-notice">
                          <UserX size={20} />
                          <div>
                            <strong>Karyawan ini sudah memiliki akun.</strong>
                            <p>Username: <code>{selectedKaryawan.username}</code></p>
                            <p>Sistem tidak mengizinkan pembuatan atau penggantian akun untuk karyawan yang sudah terdaftar.</p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handleRegister} className="login-form" style={{ marginTop: 16 }}>
                          <div className="form-group">
                            <label htmlFor="reg-username">Username *</label>
                            <input
                              type="text" id="reg-username" className="form-input"
                              placeholder="Buat username unik"
                              value={regUsername}
                              onChange={(e) => setRegUsername(e.target.value)}
                              required
                            />
                          </div>

                          <div className="form-row-2">
                            <div className="form-group">
                              <label htmlFor="reg-password">Password *</label>
                              <div className="password-input-wrapper">
                                <input
                                  type={showRegPassword ? 'text' : 'password'} id="reg-password" className="form-input"
                                  placeholder="Min. 6 karakter"
                                  value={regPassword}
                                  onChange={(e) => setRegPassword(e.target.value)}
                                  required
                                />
                                <button type="button" className="btn-show-password"
                                  onClick={() => setShowRegPassword(!showRegPassword)} tabIndex={-1}>
                                  {showRegPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>

                            <div className="form-group">
                              <label htmlFor="reg-confirm-password">Konfirmasi Password *</label>
                              <div className="password-input-wrapper">
                                <input
                                  type={showConfirmPassword ? 'text' : 'password'} id="reg-confirm-password" className="form-input"
                                  placeholder="Ulangi password"
                                  value={regConfirmPassword}
                                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                                  required
                                />
                                <button type="button" className="btn-show-password"
                                  onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                              </div>
                            </div>
                          </div>

                          {regError && <div className="error-message">{regError}</div>}

                          <button type="submit" className="btn-login" disabled={isRegLoading} id="btn-submit-register">
                            {isRegLoading ? 'Membuat Akun...' : 'Buat Akun'}
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}

              <div className="login-footer" style={{ marginTop: 24 }}>
                <p>&copy; 2026 PT Alexindo Yakinprima.</p>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
