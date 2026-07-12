import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

interface Stats {
  total_users: number; total_books: number; total_bookshops: number;
  total_print_sessions: number; total_printed_copies: number;
  approved_books: number; pending_books: number;
  top_books: { id: string; title: string; times_printed: number; total_copies: number }[];
  top_bookshops: { id: string; name: string; sessions: number; total_copies: number }[];
  prints_by_day: { date: string; sessions: number; copies: number }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.getStats().then(({ data }) => setStats(data.stats));
  }, []);

  if (!stats) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: 'Users', value: stats.total_users, color: 'from-blue-500 to-blue-600' },
    { label: 'Books', value: stats.total_books, color: 'from-violet-500 to-violet-600' },
    { label: 'Bookshops', value: stats.total_bookshops, color: 'from-amber-500 to-amber-600' },
    { label: 'Approved', value: stats.approved_books, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Sessions', value: stats.total_print_sessions, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Total Prints', value: stats.total_printed_copies, color: 'from-rose-500 to-rose-600' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Platform-wide statistics and overview</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white shadow-lg`}>
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-white/80 text-xs mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Books</h3>
          {stats.top_books.length > 0 ? (
            <div className="space-y-3">
              {stats.top_books.map((book, i) => (
                <div key={book.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}.</span>
                    <span className="text-sm font-medium text-gray-700">{book.title}</span>
                  </div>
                  <span className="text-sm text-gray-500">{book.total_copies} copies</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No printing data yet</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Bookshops</h3>
          {stats.top_bookshops.length > 0 ? (
            <div className="space-y-3">
              {stats.top_bookshops.map((shop, i) => (
                <div key={shop.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400 w-6">{i + 1}.</span>
                    <span className="text-sm font-medium text-gray-700">{shop.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{shop.total_copies} copies</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No bookshop activity yet</p>}
        </div>
      </div>
    </div>
  );
}
