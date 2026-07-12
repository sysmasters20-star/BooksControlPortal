import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import PrintChart from '../../components/PrintChart';
import Skeleton from '../../components/Skeleton';

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
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const loadStats = () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    adminApi.getStats(params).then(({ data }) => setStats(data.stats)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const applyDateFilter = () => { loadStats(); };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    const link = document.createElement('a');
    link.href = `/api/admin/export/print-sessions?${params}`;
    link.setAttribute('download', 'print-sessions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!stats) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  const cards = [
    { label: 'Users', value: stats.total_users, color: 'from-blue-500 to-blue-600' },
    { label: 'Books', value: stats.total_books, color: 'from-violet-500 to-violet-600' },
    { label: 'Bookshops', value: stats.total_bookshops, color: 'from-amber-500 to-amber-600' },
    { label: 'Approved', value: stats.approved_books, color: 'from-emerald-500 to-emerald-600' },
    { label: 'Sessions', value: stats.total_print_sessions, color: 'from-cyan-500 to-cyan-600' },
    { label: 'Total Prints', value: stats.total_printed_copies, color: 'from-rose-500 to-rose-600' },
  ];

  const barData = {
    labels: stats.top_bookshops.map((s) => s.name),
    datasets: [{ label: 'Copies', data: stats.top_bookshops.map((s) => s.total_copies), backgroundColor: 'rgba(99, 102, 241, 0.7)' }],
  };

  const lineData = {
    labels: stats.prints_by_day.map((d) => d.date?.substring(0, 10)),
    datasets: [
      { label: 'Sessions', data: stats.prints_by_day.map((d) => d.sessions), borderColor: 'rgb(99, 102, 241)', backgroundColor: 'rgba(99, 102, 241, 0.1)', fill: true },
      { label: 'Copies', data: stats.prints_by_day.map((d) => d.copies), borderColor: 'rgb(34, 197, 94)', backgroundColor: 'rgba(34, 197, 94, 0.1)', fill: true },
    ],
  };

  const pieData = {
    labels: ['Approved', 'Pending', 'Rejected', 'Archived'],
    datasets: [{ label: 'Books', data: [stats.approved_books, stats.pending_books, stats.total_books - stats.approved_books - stats.pending_books, 0], backgroundColor: ['rgba(34, 197, 94, 0.7)', 'rgba(251, 191, 36, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(156, 163, 175, 0.7)'] }],
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Platform-wide statistics and overview</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
          <button onClick={applyDateFilter} className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">Filter</button>
          <button onClick={handleExport} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Export CSV</button>
        </div>
      </div>

      {loading ? (
        <Skeleton className="mb-8" rows={2} cols={6} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {cards.map((card) => (
            <div key={card.label} className={`bg-gradient-to-br ${card.color} rounded-xl p-4 text-white shadow-lg`}>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-white/80 text-xs mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Bookshops by Prints</h3>
          {stats.top_bookshops.length > 0 ? <PrintChart type="bar" labels={barData.labels} datasets={barData.datasets} /> : <p className="text-sm text-gray-400">No data yet</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Print Trends (Last 30 Days)</h3>
          {stats.prints_by_day.length > 0 ? <PrintChart type="line" labels={lineData.labels} datasets={lineData.datasets} /> : <p className="text-sm text-gray-400">No data yet</p>}
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Book Distribution</h3>
          <div className="w-64 mx-auto">{stats.total_books > 0 ? <PrintChart type="pie" labels={pieData.labels} datasets={pieData.datasets} /> : <p className="text-sm text-gray-400">No data yet</p>}</div>
        </div>
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
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      )}
    </div>
  );
}
