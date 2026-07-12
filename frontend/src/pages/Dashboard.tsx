import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { booksApi } from '../api/books';
import { printApi } from '../api/print';

interface User {
  name: string; email: string; role: string;
}

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState({ books: 0, printJobs: 0, sessions: 0, printedCopies: 0 });

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data.user));
    booksApi.list().then(({ data }) => setStats((s) => ({ ...s, books: data.books?.length || 0 })));
    printApi.listJobs().then(({ data }) => setStats((s) => ({ ...s, printJobs: data.printJobs?.length || 0 })));
    printApi.listSessions({ limit: '1000' }).then(({ data }) => {
      const sessions = data.sessions || [];
      const copies = sessions.reduce((sum: number, s: { copies: number }) => sum + (s.copies || 0), 0);
      setStats((s) => ({ ...s, sessions: sessions.length, printedCopies: copies }));
    });
  }, []);

  const cards = [
    { label: 'Total Books', value: stats.books, color: 'from-blue-500 to-blue-600', icon: '📚' },
    { label: 'Print Jobs', value: stats.printJobs, color: 'from-amber-500 to-amber-600', icon: '🖨️' },
    { label: 'Print Sessions', value: stats.sessions, color: 'from-emerald-500 to-emerald-600', icon: '📋' },
    { label: 'Printed Copies', value: stats.printedCopies, color: 'from-violet-500 to-violet-600', icon: '📄' },
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
            <div className="flex items-center justify-between mb-3">
              <span className="text-3xl">{card.icon}</span>
            </div>
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
