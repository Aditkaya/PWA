import { Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  
  return (
    <div className="layout-container">
      <header className="navbar">
        <h2>AbsensiApp</h2>
        <div className="avatar" onClick={logout} style={{cursor: 'pointer'}} title="Logout">
          {user?.username ? user.username.substring(0, 2).toUpperCase() : 'AD'}
        </div>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
      <nav className="bottom-nav">
        <button className="nav-item active">Dashboard</button>
        <button className="nav-item">Riwayat</button>
        <button className="nav-item">Profil</button>
      </nav>
    </div>
  )
}
