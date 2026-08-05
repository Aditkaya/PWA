import { Outlet } from 'react-router-dom'

export default function DashboardLayout() {
  return (
    <div className="layout-container">
      <header className="navbar">
        <h2>AbsensiApp</h2>
        <div className="avatar">AD</div>
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
