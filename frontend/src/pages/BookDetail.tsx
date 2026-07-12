import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { booksApi } from '../api/books';
import { printApi } from '../api/print';
import { adminApi } from '../api/admin';

interface Book {
  id: string; title: string; author: string; isbn: string; status: string;
  file_size: number; pages: number; created_at: string; shops?: { id: string; name: string }[];
}

interface Bookshop {
  id: string; name: string;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole');
  const [book, setBook] = useState<Book | null>(null);
  const [uploading, setUploading] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [copies, setCopies] = useState(1);
  const [assignShopId, setAssignShopId] = useState('');
  const [allShops, setAllShops] = useState<Bookshop[]>([]);
  const [showAssign, setShowAssign] = useState(false);

  const loadBook = () => {
    if (!id) return;
    booksApi.getById(id).then(({ data }) => setBook(data.book));
  };

  useEffect(() => {
    loadBook();
    if (role === 'admin') {
      adminApi.listBookshops().then(({ data }) => setAllShops(data.bookshops || []));
    }
  }, [id]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const input = (e.target as HTMLFormElement).querySelector('[name="file"]') as HTMLInputElement;
    if (!input?.files?.[0]) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', input.files[0]);
    await fetch(`/api/books/${id}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      body: formData,
    });
    setUploading(false);
    loadBook();
  };

  const handleStatusChange = async () => {
    if (!id || !newStatus) return;
    await booksApi.updateStatus(id, newStatus);
    setNewStatus('');
    loadBook();
  };

  const handlePrint = async () => {
    if (!id) return;
    await printApi.createJob({ book_id: id, copies });
    navigate('/print-jobs');
  };

  const handleAssign = async () => {
    if (!id || !assignShopId) return;
    await booksApi.assignShop(id, assignShopId);
    setAssignShopId('');
    loadBook();
  };

  const handleUnassign = async (shopId: string) => {
    if (!id) return;
    await booksApi.unassignShop(id, shopId);
    loadBook();
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

  if (!book) return <div className="flex items-center justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  return (
    <div className="max-w-4xl">
      <button onClick={() => navigate('/books')} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">&larr; Back to Books</button>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{book.title}</h1>
            <div className="flex items-center gap-3 mt-2">
              {statusBadge(book.status)}
              <span className="text-sm text-gray-500">by {book.author || 'Unknown'}</span>
            </div>
          </div>
          {role === 'admin' && book.status === 'approved' && (
            <Link to={`/print/${id}`} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors text-center">View &amp; Print</Link>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">ISBN</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{book.isbn || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Pages</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{book.pages || '-'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">File Size</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(1)} MB` : 'No file'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Created</p>
            <p className="text-sm font-medium text-gray-900 mt-0.5">{new Date(book.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload PDF</h3>
          <form onSubmit={handleUpload}>
            <input type="file" name="file" accept=".pdf" required className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 mb-4" />
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload PDF'}
            </button>
          </form>
        </div>

        {role === 'admin' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Admin Actions</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Change Status</label>
                <div className="flex gap-2">
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                    <option value="">Select...</option>
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="archived">Archive</option>
                  </select>
                  <button onClick={handleStatusChange} disabled={!newStatus} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50">Update</button>
                </div>
              </div>

              <div>
                <button onClick={() => setShowAssign(!showAssign)} className="text-sm text-primary-600 hover:text-primary-700 font-medium">{showAssign ? 'Cancel' : '+ Assign Bookshop'}</button>
                {showAssign && (
                  <div className="flex gap-2 mt-2">
                    <select value={assignShopId} onChange={(e) => setAssignShopId(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
                      <option value="">Select bookshop...</option>
                      {allShops.filter((s) => !book.shops?.find((bs) => bs.id === s.id)).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button onClick={handleAssign} disabled={!assignShopId} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50">Assign</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {book.status === 'approved' && role === 'bookshop_owner' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Print</h3>
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm font-medium text-gray-700">Copies:</label>
              <input type="number" min={1} max={1000} value={copies} onChange={(e) => setCopies(Number(e.target.value))} className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={handlePrint} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">Submit Print Job</button>
              <Link to={`/print/${id}`} className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">View PDF</Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Bookshops</h3>
          {book.shops && book.shops.length > 0 ? (
            <ul className="space-y-2">
              {book.shops.map((shop) => (
                <li key={shop.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{shop.name}</span>
                  {role === 'admin' && (
                    <button onClick={() => handleUnassign(shop.id)} className="text-xs text-red-600 hover:text-red-700 font-medium">Remove</button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No bookshops assigned yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
