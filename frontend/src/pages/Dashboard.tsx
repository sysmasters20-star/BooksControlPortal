import { useEffect, useState } from 'react';
import { authApi } from '../api/auth';
import { booksApi } from '../api/books';
import { printApi } from '../api/print';

export default function Dashboard() {
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);
  const [stats, setStats] = useState({ books: 0, printJobs: 0 });

  useEffect(() => {
    authApi.me().then(({ data }) => setUser(data.user));
    booksApi.list().then(({ data }) => setStats((s) => ({ ...s, books: data.books?.length || 0 })));
    printApi.listJobs().then(({ data }) => setStats((s) => ({ ...s, printJobs: data.printJobs?.length || 0 })));
  }, []);

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>{user?.email} — Role: {user?.role}</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Total Books</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a2e' }}>{stats.books}</p>
        </div>
        <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
          <h3>Print Jobs</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1a1a2e' }}>{stats.printJobs}</p>
        </div>
      </div>
    </div>
  );
}
