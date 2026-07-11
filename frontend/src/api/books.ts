import api from './client';

export interface BookData {
  title: string;
  author?: string;
  isbn?: string;
  pages?: number;
  bookshop_id?: string;
}

export const booksApi = {
  list: (params?: Record<string, string>) => api.get('/books', { params }),
  getById: (id: string) => api.get(`/books/${id}`),
  create: (data: BookData) => api.post('/books', data),
  updateStatus: (id: string, status: string) => api.patch(`/books/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/books/${id}`),
};
