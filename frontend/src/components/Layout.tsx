import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import NotificationBell from './NotificationBell';

const navItems = [
  { label: 'Dashboard', path: '/dashboard', roles: ['admin', 'bookshop_owner'] },
  { label: 'Books', path: '/books', roles: ['admin', 'bookshop_owner'] },
  { label: 'Print Jobs', path: '/print-jobs', roles: ['admin', 'bookshop_owner'] },
  { label: 'Print Sessions', path: '/print-sessions', roles: ['admin', 'bookshop_owner'] },
];

const adminItems = [
  { label: 'Dashboard', path: '/admin', roles: ['admin'] },
  { label: 'Bookshops', path: '/admin/bookshops', roles: ['admin'] },
  { label: 'Books', path: '/admin/books', roles: ['admin'] },
  { label: 'Users', path: '/admin/users', roles: ['admin'] },
  { label: 'Audit Logs', path: '/admin/audit', roles: ['admin'] },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      navigate('/login');
      return;
    }
    authApi.me().then(({ data }) => {
      setUser(data.user);
      localStorage.setItem('userRole', data.user.role);
    }).catch(() => {
      setUser(null);
    });
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col`}>
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <Link to="/dashboard" className="text-xl font-bold text-primary-600">BooksControl</Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Main</p>
              {navItems.map((item) => (
                <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {item.label}
                </Link>
              ))}

          {user?.role === 'admin' && (
            <>
              <div className="pt-4 pb-2">
                <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Admin</p>
              </div>
              {adminItems.map((item) => (
                <Link key={item.path} to={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive(item.path) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role === 'admin' ? 'Admin' : 'Bookshop'}</p>
            </div>
          </div>
          <button onClick={logout} className="mt-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left">Sign out</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="flex-1" />
          {user?.role === 'admin' && <NotificationBell />}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block">{user?.email}</span>
            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-semibold text-sm sm:hidden">
              {user?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
