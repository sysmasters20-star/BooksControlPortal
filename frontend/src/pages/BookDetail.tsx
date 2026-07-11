import { useEffect, useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { booksApi } from '../api/books';
import { printApi } from '../api/print';
import { authApi } from '../api/auth';

interface Book {
  id: string; title: string; author: string; isbn: string;
  status: string; file_size: number; pages: number; created_at: string;
}

export default function BookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [role, setRole] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    if (!id) return;
    booksApi.getById(id).then(({ data }) => setBook(data.book));
    authApi.me().then(({ data }) => setRole(data.user.role));
  }, [id]);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!id) return;
    const fileInput = (e.target as HTMLFormElement).file as HTMLInputElement;
    if (!fileInput?.files?.[0]) return;
    setUploading(true);

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    await fetch(`/api/books/${id}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
      body: formData,
    });

    setUploading(false);
    booksApi.getById(id).then(({ data }) => setBook(data.book));
  };

  const handleStatusChange = async () => {
    if (!id || !newStatus) return;
    await booksApi.updateStatus(id, newStatus);
    booksApi.getById(id).then(({ data }) => setBook(data.book));
    setNewStatus('');
  };

  const handlePrint = async () => {
    if (!id) return;
    await printApi.createJob({ book_id: id, copies });
    navigate('/print-jobs');
  };

  if (!book) return <p>Loading...</p>;

  return (
    <div>
      <button onClick={() => navigate('/books')} style={{ background: 'none', border: 'none', color: '#1a1a2e', cursor: 'pointer', marginBottom: '1rem' }}>&larr; Back</button>
      <div style={{ background: '#fff', padding: '2rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <h1>{book.title}</h1>
        <p><strong>Author:</strong> {book.author || '-'}</p>
        <p><strong>ISBN:</strong> {book.isbn || '-'}</p>
        <p><strong>Pages:</strong> {book.pages || '-'}</p>
        <p><strong>File Size:</strong> {book.file_size ? `${(book.file_size / 1024).toFixed(1)} KB` : 'No file'}</p>
        <p><strong>Status:</strong> {book.status}</p>
        <p><strong>Created:</strong> {new Date(book.created_at).toLocaleDateString()}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Upload PDF</h3>
          <form onSubmit={handleUpload}>
            <input type="file" name="file" accept=".pdf" required style={{ marginBottom: '0.5rem', display: 'block' }} />
            <button type="submit" disabled={uploading} style={{ background: '#1a1a2e', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </form>
        </div>

        {role === 'admin' && (
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>Admin Actions</h3>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ padding: '0.5rem', marginBottom: '0.5rem', display: 'block', width: '100%' }}>
              <option value="">Change status...</option>
              <option value="approved">Approve</option>
              <option value="rejected">Reject</option>
              <option value="archived">Archive</option>
            </select>
            <button onClick={handleStatusChange} disabled={!newStatus} style={{ background: '#e94560', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>Update</button>
          </div>
        )}

        {book.status === 'approved' && (
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
            <h3>Request Print</h3>
            <label>Copies: </label>
            <input type="number" min={1} max={1000} value={copies} onChange={(e) => setCopies(Number(e.target.value))} style={{ padding: '0.5rem', width: '80px', marginBottom: '0.5rem', display: 'block' }} />
            <button onClick={handlePrint} style={{ background: '#5cb85c', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>Submit Print Job</button>
          </div>
        )}
      </div>
    </div>
  );
}
