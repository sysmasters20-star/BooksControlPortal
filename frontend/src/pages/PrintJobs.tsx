import { useEffect, useState } from 'react';
import { printApi } from '../api/print';

interface PrintJob {
  id: string;
  book_id: string;
  book_title: string;
  copies: number;
  status: string;
  notes: string;
  created_at: string;
}

export default function PrintJobs() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  useEffect(() => {
    printApi.listJobs().then(({ data }) => setJobs(data.printJobs || []));
  }, []);

  const statusColor: Record<string, string> = {
    pending: '#f0ad4e',
    printing: '#5bc0de',
    completed: '#5cb85c',
    cancelled: '#d9534f',
  };

  return (
    <div>
      <h1 style={{ marginBottom: '1.5rem' }}>Print Jobs</h1>
      <div style={{ background: '#fff', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f0f0f0', textAlign: 'left' }}>
              <th style={{ padding: '0.75rem' }}>Book</th>
              <th style={{ padding: '0.75rem' }}>Copies</th>
              <th style={{ padding: '0.75rem' }}>Status</th>
              <th style={{ padding: '0.75rem' }}>Notes</th>
              <th style={{ padding: '0.75rem' }}>Created</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ padding: '0.75rem' }}>{job.book_title || job.book_id}</td>
                <td style={{ padding: '0.75rem' }}>{job.copies}</td>
                <td style={{ padding: '0.75rem' }}>
                  <span style={{ background: statusColor[job.status] || '#999', color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                    {job.status}
                  </span>
                </td>
                <td style={{ padding: '0.75rem' }}>{job.notes || '-'}</td>
                <td style={{ padding: '0.75rem' }}>{new Date(job.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#999' }}>No print jobs yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
