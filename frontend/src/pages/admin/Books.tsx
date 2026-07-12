import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { booksApi, BookData } from '../../api/books';
import { adminApi } from '../../api/admin';
import Pagination from '../../components/Pagination';
import Toast from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

interface Book {
  id: string; title: string; author: string; isbn: string;
  status: string; pages: number; file_size: number; created_at: string; shop_count?: number;
}

interface Bookshop {
  id: string; name: string;
}

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [allShops, setAllShops] = useState<Bookshop[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BookData & { file: File | null }>({ title: '', author: '', isbn: '', file: null });
  const [assignBookId, setAssignBookId] = useState('');
  const [assignShopId, setAssignShopId] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === books.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(books.map((b) => b.id)));
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await booksApi.bulkUpdateStatus(Array.from(selectedIds), status);
      setToast({ message: `Updated ${selectedIds.size} books to ${status}`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to update books', type: 'error' });
    }
    setSelectedIds(new Set());
    load();
  };

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(limit) };
    booksApi.list(params).then(({ data }) => {
      setBooks(data.books || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    }).catch(() => setToast({ message: 'Failed to load books', type: 'error' })).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    adminApi.listBookshops().then(({ data }) => setAllShops(data.bookshops || [])).catch(() => {});
  }, [page, limit]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData();
    fd.append('title', form.title);
    if (form.author) fd.append('author', form.author);
    if (form.isbn) fd.append('isbn', form.isbn);
    if (form.file) fd.append('file', form.file);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/books', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
      setToast({ message: 'Book created successfully', type: 'success' });
    } catch {
      setToast({ message: 'Failed to create book', type: 'error' });
    }
    setForm({ title: '', author: '', isbn: '', file: null });
    setShowForm(false);
    setCreating(false);
    load();
  };

  const handleStatus = async (id: string, status: string) => {
    try {
      await booksApi.updateStatus(id, status);
      setToast({ message: 'Status updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
    load();
  };

  const handleAssign = async () => {
    if (!assignBookId || !assignShopId) return;
    try {
      await booksApi.assignShop(assignBookId, assignShopId);
      setToast({ message: 'Book assigned to bookshop', type: 'success' });
    } catch {
      setToast({ message: 'Failed to assign book', type: 'error' });
    }
    setAssignBookId('');
    setAssignShopId('');
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      approved: 'bg-emerald-100 text-emerald-800',
      rejected: 'bg-red-100 text-red-800',
      archived: 'bg-gray-100 text-gray-800',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Books</h1>
          <p className="text-gray-500 text-sm mt-1">Manage books and assignments</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
          {showForm ? 'Cancel' : '+ Add Book'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Book</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title *" required className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <input value={form.author || ''} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Author" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <input value={form.isbn || ''} onChange={(e) => setForm({ ...form, isbn: e.target.value })} placeholder="ISBN" className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            <input type="file" accept=".pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.item(0) || null })} className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
          </div>
          <button type="submit" disabled={creating} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Assign Bookshop</h3>
        <div className="flex flex-col sm:flex-row gap-2">
          <select value={assignBookId} onChange={(e) => setAssignBookId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
            <option value="">Select book...</option>
            {books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
          <select value={assignShopId} onChange={(e) => setAssignShopId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
            <option value="">Select bookshop...</option>
            {allShops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={handleAssign} disabled={!assignBookId || !assignShopId} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50">Assign</button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg border border-primary-200">
          <span className="text-sm text-primary-700 font-medium">{selectedIds.size} selected</span>
          <button onClick={() => handleBulkStatus('approved')} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-medium hover:bg-emerald-700">Approve All</button>
          <button onClick={() => handleBulkStatus('rejected')} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">Reject All</button>
          <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-50">Clear</button>
        </div>
      )}

      {loading ? (
        <Skeleton rows={5} cols={6} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox" checked={selectedIds.size === books.length && books.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300" />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Author</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Shops</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(book.id)} onChange={() => toggleSelect(book.id)} className="rounded border-gray-300" />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/books/${book.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">{book.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{book.author || '-'}</td>
                    <td className="px-4 py-3">{statusBadge(book.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{book.shop_count || 0}</td>
                    <td className="px-4 py-3 text-right">
                      <select onChange={(e) => { if (e.target.value) handleStatus(book.id, e.target.value); e.target.value = ''; }} className="text-xs px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 outline-none">
                        <option value="">Status...</option>
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                        <option value="archived">Archive</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {books.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">No books found</td></tr>
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
