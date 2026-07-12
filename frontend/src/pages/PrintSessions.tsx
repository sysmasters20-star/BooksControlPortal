import { useEffect, useState } from 'react';
import { printApi } from '../api/print';
import Pagination from '../components/Pagination';
import Toast from '../components/Toast';
import Skeleton from '../components/Skeleton';

interface Session {
  id: string; book_id: string; book_title: string;
  bookshop_id: string; bookshop_name: string;
  user_id: string; user_name: string;
  copies: number; session_token: string; created_at: string;
}

export default function PrintSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const role = localStorage.getItem('userRole');

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    printApi.listSessions(params).then(({ data }) => {
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    }).catch(() => setToast({ message: 'Failed to load print sessions', type: 'error' })).finally(() => setLoading(false));
  }, [page, limit]);

  const handleExport = () => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const link = document.createElement('a');
    link.href = `/api/admin/export/print-sessions?${params}`;
    link.setAttribute('download', 'print-sessions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Print Sessions</h1>
          <p className="text-gray-500 text-sm mt-1">All printing activity recorded</p>
        </div>
        <button onClick={handleExport} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Export CSV</button>
      </div>

      {loading ? (
        <Skeleton rows={5} cols={role === 'admin' ? 6 : 5} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Book</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bookshop</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Copies</th>
                  {role === 'admin' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">User</th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Session</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.book_title || s.book_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.bookshop_name || s.bookshop_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{s.copies}</td>
                    {role === 'admin' && <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{s.user_name || s.user_id || '-'}</td>}
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono hidden md:table-cell">{s.session_token?.substring(0, 12)}...</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">No print sessions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} total={total} limit={limit} onPageChange={setPage} onLimitChange={(l) => { setLimit(l); setPage(1); }} />
    </div>
  );
}
