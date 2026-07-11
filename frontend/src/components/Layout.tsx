import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';

export default function Layout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data.user)).catch(() => navigate('/login'));
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    navigate('/login');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ background: '#1a1a2e', color: '#fff', padding: '1rem 2rem', display: 'flex', gap: '2rem', alignItems: 'center' }}>
        <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>BooksControl</Link>
        <Link to="/books" style={{ color: '#ccc', textDecoration: 'none' }}>Books</Link>
        <Link to="/print-jobs" style={{ color: '#ccc', textDecoration: 'none' }}>Print Jobs</Link>
        {user?.role === 'admin' && <Link to="/admin" style={{ color: '#ccc', textDecoration: 'none' }}>Admin</Link>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span>{user?.name} ({user?.role})</span>
          <button onClick={logout} style={{ background: '#e94560', color: '#fff', border: 'none', padding: '0.25rem 1rem', cursor: 'pointer' }}>Logout</button>
        </div>
      </nav>
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
