import api from './client';

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getAuditLogs: (params?: Record<string, string>) => api.get('/admin/audit-logs', { params }),
  listBookshops: () => api.get('/admin/bookshops'),
  getBookshop: (id: string) => api.get(`/admin/bookshops/${id}`),
  createBookshop: (data: Record<string, unknown>) => api.post('/admin/bookshops', data),
  updateBookshop: (id: string, data: Record<string, unknown>) => api.put(`/admin/bookshops/${id}`, data),
  deleteBookshop: (id: string) => api.delete(`/admin/bookshops/${id}`),
  getBookshopAnalytics: (id: string) => api.get(`/admin/bookshops/${id}/analytics`),
};
