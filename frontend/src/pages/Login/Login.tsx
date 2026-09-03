import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Ship, Truck, Anchor, Navigation } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import api from '../../services/axios'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<{connected: boolean | null, message: string}>({ connected: null, message: 'Memeriksa koneksi...' })
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
          message: err.response?.data?.message || err.message || 'Sistem Offline' 
        })
      }
    }
    checkDb()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login gagal. Periksa username dan password Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      {/* Animated background elements */}
      <div className="ocean-bg"></div>
      
      <div className="login-container">
        <div className="login-branding">
          <div className="branding-content">
            <div className="logo-group">
              <div className="icon-wrapper">
                <Ship size={32} strokeWidth={1.5} />
              </div>
              <div className="icon-wrapper secondary">
                <Truck size={32} strokeWidth={1.5} />
              </div>
            </div>
            
            <div className="branding-text">
              <h1>Alexindo <span>Yakinprima</span></h1>
              <p className="tagline">Logistics & Maritime Excellence</p>
              
              <div className="features">
                <div className="feature-item">
                  <Navigation size={18} />
                  <span>Jangkauan Global</span>
                </div>
                <div className="feature-item">
                  <Anchor size={18} />
                  <span>Operasional Pelabuhan Aman</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="login-form-section">
          <div className="form-header">
            <h2>Portal HRIS</h2>
            <p>Silakan masuk ke akun Anda</p>
            
            <div className={`system-status ${dbStatus.connected === true ? 'online' : dbStatus.connected === false ? 'offline' : 'checking'}`}>
              <span className="status-dot"></span>
              <span className="status-text">{dbStatus.message}</span>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input 
                type="text" 
                id="username"
                className="form-input" 
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="password-input-wrapper">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  id="password"
                  className="form-input" 
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="btn-show-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            {error && <div className="error-alert">{error}</div>}
            
            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? (
                <span className="loader"></span>
              ) : (
                'Masuk ke Portal'
              )}
            </button>
          </form>
          
          <div className="form-footer">
            <p>&copy; {new Date().getFullYear()} PT Alexindo Yakinprima.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
