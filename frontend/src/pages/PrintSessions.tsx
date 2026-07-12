import { useEffect, useState } from 'react';
import { printApi } from '../api/print';

interface Session {
  id: string; book_id: string; book_title: string;
  bookshop_id: string; bookshop_name: string;
  user_id: string; user_name: string;
  copies: number; session_token: string; created_at: string;
}

export default function PrintSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const role = localStorage.getItem('userRole');

  useEffect(() => {
    printApi.listSessions().then(({ data }) => setSessions(data.sessions || []));
  }, []);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Print Sessions</h1>
        <p className="text-gray-500 text-sm mt-1">All printing activity recorded</p>
      </div>

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
    </div>
  );
}
