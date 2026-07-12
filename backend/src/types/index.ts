export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'bookshop_owner' | 'user';
  is_verified: boolean;
  two_factor_secret?: string;
  two_factor_enabled: boolean;
  refresh_token?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Bookshop {
  id: string;
  name: string;
  owner_id: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  isbn?: string;
  file_data?: Buffer;
  file_size?: number;
  file_hash?: string;
  pages?: number;
  uploaded_by?: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  encryption_iv?: Buffer;
  created_at: Date;
  updated_at: Date;
}

export interface BookAccess {
  id: string;
  book_id: string;
  bookshop_id: string;
  created_at: Date;
}

export interface PrintSession {
  id: string;
  book_id: string;
  bookshop_id: string;
  user_id?: string;
  copies: number;
  session_token: string;
  created_at: Date;
}

export interface PrintJob {
  id: string;
  book_id: string;
  bookshop_id?: string;
  requested_by: string;
  copies: number;
  status: 'pending' | 'printing' | 'completed' | 'cancelled';
  notes?: string;
  completed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface WatermarkConfig {
  bookshopName: string;
  sessionId: string;
  copyNum: number;
  date: string;
  ip?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}
