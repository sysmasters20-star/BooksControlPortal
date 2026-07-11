import { useEffect, useState } from 'react';
import { booksApi } from '../api/books';
import { printApi } from '../api/print';

export default function Admin() {
  const [stats, setStats] = useState({ books: 0, approved: 0, pending: 0, printJobs: 0, completed: 0 });

  useEffect(() => {
    Promise.all([
      booksApi.list(),
      booksApi.list({ status: 'approved' }),
      booksApi.list({ status: 'pending' }),
      printApi.listJobs(),
      printApi.listJobs({ status: 'completed' }),
    ]).then(([all, approved, pending, jobs, completed]) => {
      setStats({
        books: all.data.books?.length || 0,
        approved: approved.data.books?.length || 0,
        pending: pending.data.books?.length || 0,
        printJobs: jobs.data.printJobs?.length || 0,
        completed: completed.data.printJobs?.length || 0,
      });
    });
  }, []);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>Overview of platform activity</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <Card label="Total Books" value={stats.books} color="#1a1a2e" />
        <Card label="Approved" value={stats.approved} color="#5cb85c" />
        <Card label="Pending" value={stats.pending} color="#f0ad4e" />
        <Card label="Print Jobs" value={stats.printJobs} color="#5bc0de" />
        <Card label="Completed" value={stats.completed} color="#5cb85c" />
      </div>
    </div>
  );
}

function Card({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', borderLeft: `4px solid ${color}` }}>
      <h3 style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{label}</h3>
      <p style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</p>
    </div>
  );
}
