import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Books from './pages/Books';
import BookDetail from './pages/BookDetail';
import PrintViewer from './pages/PrintViewer';
import PrintJobs from './pages/PrintJobs';
import PrintSessions from './pages/PrintSessions';
import AdminDashboard from './pages/admin/Dashboard';
import AdminBookshops from './pages/admin/Bookshops';
import AdminBookshopDetail from './pages/admin/BookshopDetail';
import AdminBooks from './pages/admin/Books';
import AdminAuditLogs from './pages/admin/AuditLogs';
import AdminUsers from './pages/admin/Users';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('accessToken');
  const role = localStorage.getItem('userRole');
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="books" element={<Books />} />
        <Route path="books/:id" element={<BookDetail />} />
        <Route path="print/:id" element={<PrintViewer />} />
        <Route path="print-jobs" element={<PrintJobs />} />
        <Route path="print-sessions" element={<PrintSessions />} />
        <Route path="admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="admin/bookshops" element={<AdminRoute><AdminBookshops /></AdminRoute>} />
        <Route path="admin/bookshops/:id" element={<AdminRoute><AdminBookshopDetail /></AdminRoute>} />
        <Route path="admin/books" element={<AdminRoute><AdminBooks /></AdminRoute>} />
        <Route path="admin/audit" element={<AdminRoute><AdminAuditLogs /></AdminRoute>} />
        <Route path="admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      </Route>
    </Routes>
  );
}
