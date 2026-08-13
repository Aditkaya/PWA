import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/auth.store'
import api from '../../services/axios'
import './Login.css'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<{connected: boolean | null, message: string}>({ connected: null, message: 'Checking database connection...' })
  const navigate = useNavigate()
  const { login } = useAuthStore()

  useEffect(() => {
    const checkDb = async () => {
      try {
        await api.get('/health')
        setDbStatus({ connected: true, message: 'Database Connected' })
      } catch (err: any) {
        setDbStatus({ 
          connected: false, 
          message: err.response?.data?.message || err.message || 'Database connection failed' 
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
      <div className="login-card">
        <div className="login-header">
          <h1>AbsensiApp</h1>
          <p>Silakan masuk ke akun Anda</p>
          
          <div className={`db-status ${dbStatus.connected === true ? 'status-success' : dbStatus.connected === false ? 'status-error' : 'status-loading'}`}>
            <span className="status-indicator"></span>
            <small>{dbStatus.message}</small>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
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
          
          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="btn-login" disabled={isLoading}>
            {isLoading ? 'Memproses...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
