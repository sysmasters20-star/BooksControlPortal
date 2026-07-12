import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { booksApi } from '../api/books';

interface User {
  name: string; email: string; role: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({ total_books: 0, total_print_jobs: 0, total_sessions: 0, total_copies: 0 });

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data.user)).catch(() => {});
    booksApi.getStats().then(({ data }) => { if (data?.stats) setStats(data.stats); }).catch(() => {});
  }, []);

  const cards = [
    { label: 'Total Books', value: stats?.total_books ?? 0, color: 'from-blue-500 to-blue-600' },
    { label: 'Print Jobs', value: stats.total_print_jobs, color: 'from-amber-500 to-amber-600' },
    { label: 'Print Sessions', value: stats.total_sessions, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Printed Copies', value: stats.total_copies, color: 'from-violet-500 to-violet-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}</h1>
        <p className="text-gray-500 mt-1">{user?.email} &middot; <span className="capitalize">{user?.role === 'admin' ? 'Administrator' : 'Bookshop Owner'}</span></p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-xl p-6 text-white shadow-lg`}>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="text-white/80 text-sm mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {user?.role === 'admin' && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Quick Actions</h2>
          <p className="text-gray-500 text-sm mb-4">Navigate to admin sections</p>
          <div className="flex flex-wrap gap-3">
            <a href="/admin/bookshops" className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">Manage Bookshops</a>
            <a href="/admin/books" className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">Manage Books</a>
            <a href="/admin/audit" className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">View Audit Logs</a>
            <a href="/admin" className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium hover:bg-primary-100 transition-colors">Platform Stats</a>
          </div>
        </div>
      )}
    </div>
  );
}
