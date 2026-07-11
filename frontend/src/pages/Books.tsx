import { useEffect, useState, FormEvent } from 'react';
import { booksApi } from '../api/books';

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  status: string;
  created_at: string;
}

export default function Books() {
  const [books, setBooks] = useState<Book[]>([]);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [showForm, setShowForm] = useState(false);

  const loadBooks = () => booksApi.list().then(({ data }) => setBooks(data.books || []));

  useEffect(() => { loadBooks(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await booksApi.create({ title, author, isbn });
    setTitle(''); setAuthor(''); setIsbn('');
    setShowForm(false);
    loadBooks();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>Books</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ background: '#1a1a2e', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : 'Add Book'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required style={{ padding: '0.5rem' }} />
            <input placeholder="Author" value={author} onChange={(e) => setAuthor(e.target.value)} style={{ padding: '0.5rem' }} />
            <input placeholder="ISBN" value={isbn} onChange={(e) => setIsbn(e.target.value)} style={{ padding: '0.5rem' }} />
          </div>
          <button type="submit" style={{ background: '#1a1a2e', color: '#fff', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer' }}>Create Book</button>
        </form>
      )}

      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem' }}>Title</th>
              <th style={{ padding: '0.75rem' }}>Author</th>
              <th style={{ padding: '0.75rem' }}>ISBN</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {books.map((book) => (
              <tr key={book.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{book.title}</td>
                <td style={{ padding: '0.75rem' }}>{book.author || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{book.isbn || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{book.status}</td>
                <td style={{ padding: '0.75rem' }}>{new Date(book.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {books.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>No books yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
