import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin';
import Pagination from '../../components/Pagination';
import Toast from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

interface User {
  id: string; email: string; name: string; role: string;
  is_verified: boolean; created_at: string; updated_at: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const load = (p: number, l: number) => {
    setLoading(true);
    adminApi.listUsers({ page: String(p), limit: String(l) }).then(({ data }) => {
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }).catch(() => setToast({ message: 'Failed to load users', type: 'error' })).finally(() => setLoading(false));
  };

  useEffect(() => { load(page, limit); }, [page, limit]);

  const handleToggleVerify = async (user: User) => {
    try {
      await adminApi.updateUser(user.id, { is_verified: !user.is_verified });
      setToast({ message: `User ${user.is_verified ? 'unverified' : 'verified'}`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to update user', type: 'error' });
    }
    load(page, limit);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user and all associated data?')) return;
    try {
      await adminApi.deleteUser(id);
      setToast({ message: 'User deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete user', type: 'error' });
    }
    load(page, limit);
  };

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-1">Manage platform users</p>
        </div>
      </div>

      {loading ? (
        <Skeleton rows={5} cols={6} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Verified</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Created</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>{user.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleVerify(user)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${user.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}`}>
                        {user.is_verified ? 'Verified' : 'Unverified'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">{new Date(user.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(user.id)} className="text-sm text-red-600 hover:text-red-700 font-medium">Delete</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">No users found</td></tr>
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
