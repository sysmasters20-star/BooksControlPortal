import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { booksApi, BookData } from '../api/books';

interface Book {
  id: string; title: string; author: string; isbn: string;
  status: string; pages: number; file_size: number; created_at: string; shop_count?: number;
}

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BookData & { file: File | null }>({ title: '', author: '', isbn: '', file: null });
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const role = localStorage.getItem('userRole');

  const loadBooks = () => {
    const params: Record<string, string> = {};
    if (filterStatus) params.status = filterStatus;
    if (search) params.search = search;
    booksApi.list(params).then(({ data }) => setBooks(data.books || []));
  };

  useEffect(() => { loadBooks(); }, [filterStatus, search]);

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
      await fetch('/api/books', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
    } catch { /* handled */ }
    setForm({ title: '', author: '', isbn: '', file: null });
    setShowForm(false);
    setCreating(false);
    loadBooks();
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Books</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your book collection</p>
        </div>
        {role === 'admin' && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add Book'}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="archived">Archived</option>
        </select>
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title or author..." className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Book</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
              <input value={form.author || ''} onChange={(e) => setForm({ ...form, author: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ISBN</label>
              <input value={form.isbn || ''} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PDF File</label>
              <input type="file" accept=".pdf" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100" />
            </div>
          </div>
          <button type="submit" disabled={creating} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
            {creating ? 'Creating...' : 'Create Book'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Author</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">ISBN</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                {role === 'admin' && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Shops</th>}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {books.map((book) => (
                <tr key={book.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/books/${book.id}`} className="text-sm font-medium text-primary-600 hover:text-primary-700">{book.title}</Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{book.author || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 hidden sm:table-cell">{book.isbn || '-'}</td>
                  <td className="px-4 py-3">{statusBadge(book.status)}</td>
                  {role === 'admin' && <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{book.shop_count || 0}</td>}
                  <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{new Date(book.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/books/${book.id}`} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View</Link>
                  </td>
                </tr>
              ))}
              {books.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">No books found. {role === 'admin' ? 'Click "Add Book" to create one.' : ''}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
