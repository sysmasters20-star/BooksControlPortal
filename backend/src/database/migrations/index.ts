import pool from '../connection.js';
import { logger } from '../../utils/logger.js';

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_verified BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    two_factor_enabled BOOLEAN DEFAULT false,
    refresh_token VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS bookshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    isbn VARCHAR(20) UNIQUE,
    file_data BYTEA,
    file_size BIGINT,
    file_hash VARCHAR(64),
    pages INTEGER,
    uploaded_by UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',
    encryption_iv BYTEA,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS book_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    bookshop_id UUID NOT NULL REFERENCES bookshops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(book_id, bookshop_id)
  )`,

  `CREATE TABLE IF NOT EXISTS print_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    bookshop_id UUID NOT NULL REFERENCES bookshops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    copies INTEGER NOT NULL DEFAULT 1,
    session_token VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    bookshop_id UUID REFERENCES bookshops(id),
    requested_by UUID REFERENCES users(id),
    copies INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)`,

  `CREATE INDEX IF NOT EXISTS idx_book_access_book_id ON book_access(book_id)`,
  `CREATE INDEX IF NOT EXISTS idx_book_access_bookshop_id ON book_access(bookshop_id)`,

  `CREATE INDEX IF NOT EXISTS idx_print_sessions_bookshop_id ON print_sessions(bookshop_id)`,
  `CREATE INDEX IF NOT EXISTS idx_print_sessions_book_id ON print_sessions(book_id)`,

  `CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status)`,
  `CREATE INDEX IF NOT EXISTS idx_print_jobs_bookshop_id ON print_jobs(bookshop_id)`,

  `ALTER TABLE books DROP COLUMN IF EXISTS bookshop_id`,

  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT false,
    link VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`,

  `CREATE TABLE IF NOT EXISTS print_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES print_sessions(id) ON DELETE CASCADE,
    token VARCHAR(100) UNIQUE NOT NULL,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    bookshop_id UUID REFERENCES bookshops(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    purpose VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (purpose IN ('view', 'print')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_print_tokens_token ON print_tokens(token)`,

  `CREATE TABLE IF NOT EXISTS pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    cost_per_copy DECIMAL(10,2) NOT NULL DEFAULT 0,
    effective_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bookshop_id UUID NOT NULL REFERENCES bookshops(id) ON DELETE CASCADE,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    copies INTEGER NOT NULL,
    cost_per_copy DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  `CREATE INDEX IF NOT EXISTS idx_pricing_book_id ON pricing(book_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_bookshop_id ON invoices(bookshop_id)`,
  `CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`,

  `ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ`,

  `CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`,

  `DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_users') THEN
      CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_bookshops') THEN
      CREATE TRIGGER set_updated_at_bookshops BEFORE UPDATE ON bookshops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_books') THEN
      CREATE TRIGGER set_updated_at_books BEFORE UPDATE ON books FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_print_jobs') THEN
      CREATE TRIGGER set_updated_at_print_jobs BEFORE UPDATE ON print_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END $$`,
];

export async function runMigrations() {
  logger.info('Running database migrations...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
      logger.debug(`Migration executed: ${sql.substring(0, 60)}...`);
    } catch (err) {
      logger.error(`Migration failed: ${sql}`, { error: (err as Error).message });
      throw err;
    }
  }
  logger.info('All migrations completed successfully');
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
