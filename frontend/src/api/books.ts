import api from './client';

export interface BookData {
  title: string;
  author?: string;
  isbn?: string;
  pages?: number;
}

export const booksApi = {
  list: (params?: Record<string, string>) => api.get('/books', { params }),
  getStats: () => api.get('/books/stats'),
  getById: (id: string) => api.get(`/books/${id}`),
  create: (data: BookData) => api.post('/books', data),
  updateStatus: (id: string, status: string) => api.patch(`/books/${id}/status`, { status }),
  bulkUpdateStatus: (ids: string[], status: string) => api.post('/books/bulk-status', { ids, status }),
  remove: (id: string) => api.delete(`/books/${id}`),
  assignShop: (id: string, bookshopId: string) => api.post(`/books/${id}/assign`, { bookshop_id: bookshopId }),
  unassignShop: (id: string, bookshopId: string) => api.delete(`/books/${id}/assign/${bookshopId}`),
  listShops: (id: string) => api.get(`/books/${id}/shops`),
};
