import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api/admin';

interface Analytics {
  total_sessions: number;
  total_copies: number;
  books_printed: { id: string; title: string; times_printed: number; total_copies: number }[];
  recent_sessions: { id: string; book_title: string; user_name: string; copies: number; created_at: string }[];
}

export default function AdminBookshopDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [shopName, setShopName] = useState('');

  useEffect(() => {
    if (!id) return;
    adminApi.getBookshop(id).then(({ data }) => setShopName(data.bookshop.name));
    adminApi.getBookshopAnalytics(id).then(({ data }) => setAnalytics(data.analytics));
  }, [id]);

  if (!analytics) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div>
      <button onClick={() => navigate('/admin/bookshops')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">&larr; Back to Bookshops</button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{shopName}</h1>
        <p className="text-gray-500 text-sm mt-1">Print analytics and activity</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{analytics.total_sessions}</p>
          <p className="text-white/80 text-sm mt-1">Total Sessions</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{analytics.total_copies}</p>
          <p className="text-white/80 text-sm mt-1">Total Copies Printed</p>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 text-white shadow-lg">
          <p className="text-3xl font-bold">{analytics.books_printed.length}</p>
          <p className="text-white/80 text-sm mt-1">Unique Books Printed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Books Printed</h3>
          {analytics.books_printed.length > 0 ? (
            <div className="space-y-3">
              {analytics.books_printed.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{b.title}</span>
                  <span className="text-sm text-gray-500">{b.total_copies} copies ({b.times_printed}x)</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No books printed yet</p>}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sessions</h3>
          {analytics.recent_sessions.length > 0 ? (
            <div className="space-y-2">
              {analytics.recent_sessions.slice(0, 10).map((s) => (
                <div key={s.id} className="text-sm py-2 px-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">{s.book_title || 'Unknown'}</span>
                    <span className="text-gray-500">{s.copies} copies</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{s.user_name || 'Unknown'} &middot; {new Date(s.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400">No recent sessions</p>}
        </div>
      </div>
    </div>
  );
}
