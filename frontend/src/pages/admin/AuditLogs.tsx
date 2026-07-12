import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';

interface AuditLog {
  id: string; user_id: string; user_email: string; user_name: string;
  action: string; resource_type: string; resource_id: string;
  details: Record<string, unknown>; ip_address: string; created_at: string;
}

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filterAction) params.action = filterAction;
    adminApi.getAuditLogs(params).then(({ data }) => setLogs(data.auditLogs || []));
  }, [filterAction]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-500 text-sm mt-1">Track all actions on the platform</p>
        </div>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none">
          <option value="">All Actions</option>
          <option value="create_book">Book Created</option>
          <option value="upload_book">PDF Uploaded</option>
          <option value="update_book_status">Status Changed</option>
          <option value="delete_book">Book Deleted</option>
          <option value="assign_bookshop">Bookshop Assigned</option>
          <option value="unassign_bookshop">Bookshop Unassigned</option>
          <option value="create_bookshop">Bookshop Created</option>
          <option value="register">User Registered</option>
          <option value="print_book">Book Printed</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Resource</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">IP</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors text-sm">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-700">{log.action.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{log.user_email || log.user_name || log.user_id || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                    {log.resource_type} {log.resource_id ? `(${log.resource_id.substring(0, 8)}...)` : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs hidden lg:table-cell">{log.ip_address || '-'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400 text-sm">No audit logs found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
