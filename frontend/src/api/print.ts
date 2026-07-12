import api from './client';

export const printApi = {
  listJobs: (params?: Record<string, string>) => api.get('/print', { params }),
  createJob: (data: { book_id: string; bookshop_id?: string; copies?: number; notes?: string }) =>
    api.post('/print', data),
  updateStatus: (id: string, status: string) => api.patch(`/print/${id}/status`, { status }),
  viewWatermarked: (bookId: string, params?: Record<string, string>) =>
    api.get(`/print/${bookId}/view`, { params }),
  getPage: (bookId: string, pageNum: number, params?: Record<string, string>) =>
    api.get(`/print/${bookId}/page/${pageNum}`, { params, responseType: 'blob' }),
  generatePrintPdf: (bookId: string, data: { sessionId: string; copies: number; printToken: string }) =>
    api.post(`/print/${bookId}/generate-print-pdf`, data, { responseType: 'blob' }),
  countPrint: (bookId: string, data: { copies: number; bookshop_id?: string }) =>
    api.post(`/print/${bookId}/print`, data),
  listSessions: (params?: Record<string, string>) => api.get('/print/sessions', { params }),
};
