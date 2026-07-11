import api from './client';

export const printApi = {
  listJobs: (params?: Record<string, string>) => api.get('/print', { params }),
  createJob: (data: { book_id: string; bookshop_id?: string; copies?: number; notes?: string }) =>
    api.post('/print', data),
  updateStatus: (id: string, status: string) => api.patch(`/print/${id}/status`, { status }),
};
