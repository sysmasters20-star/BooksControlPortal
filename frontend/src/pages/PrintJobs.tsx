import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { printApi } from '../api/print';
import Pagination from '../components/Pagination';
import Toast from '../components/Toast';
import Skeleton from '../components/Skeleton';

interface PrintJob {
  id: string; book_id: string; book_title: string;
  copies: number; status: string; notes: string; created_at: string;
}

export default function PrintJobs() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
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
    if (filterStatus) params.status = filterStatus;
    printApi.listJobs(params).then(({ data }) => {
      setJobs(data.printJobs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    }).catch(() => setToast({ message: 'Failed to load print jobs', type: 'error' })).finally(() => setLoading(false));
  }, [page, limit, filterStatus]);

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      printing: 'bg-blue-100 text-blue-800',
      completed: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Print Jobs</h1>
          <p className="text-gray-500 text-sm mt-1">Track printing requests</p>
        </div>
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="printing">Printing</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <Skeleton rows={5} cols={5} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Book</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Copies</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Notes</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/books/${job.book_id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">{job.book_title || job.book_id}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{job.copies}</td>
                    <td className="px-4 py-3">{statusBadge(job.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{job.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{new Date(job.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No print jobs yet</td></tr>
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
