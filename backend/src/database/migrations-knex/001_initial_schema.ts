import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
   $$ LANGUAGE plpgsql`);

  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 255).unique().notNullable();
    table.string('password_hash', 255).notNullable();
    table.string('name', 255).notNullable();
    table.string('role', 50).notNullable().defaultTo('user');
    table.boolean('is_verified').defaultTo(false);
    table.string('two_factor_secret', 255);
    table.boolean('two_factor_enabled').defaultTo(false);
    table.string('refresh_token', 500);
    table.string('reset_token', 255);
    table.timestamp('reset_token_expires_at', { useTz: true });
    table.string('verification_token', 255);
    table.integer('failed_login_attempts').defaultTo(0);
    table.timestamp('locked_until', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('bookshops', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 255).notNullable();
    table.uuid('owner_id').references('id').inTable('users').onDelete('CASCADE');
    table.text('address');
    table.string('phone', 50);
    table.string('email', 255);
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('books', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('title', 500).notNullable();
    table.string('author', 255);
    table.string('isbn', 20).unique();
    table.binary('file_data');
    table.bigInteger('file_size');
    table.string('file_hash', 64);
    table.integer('pages');
    table.uuid('uploaded_by').references('id').inTable('users');
    table.string('status', 50).defaultTo('pending');
    table.binary('encryption_iv');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('book_access', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.uuid('bookshop_id').notNullable().references('id').inTable('bookshops').onDelete('CASCADE');
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.unique(['book_id', 'bookshop_id']);
  });

  await knex.schema.createTable('print_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.uuid('bookshop_id').notNullable().references('id').inTable('bookshops').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users');
    table.integer('copies').notNullable().defaultTo(1);
    table.string('session_token', 100).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('print_jobs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('book_id').references('id').inTable('books').onDelete('CASCADE');
    table.uuid('bookshop_id').references('id').inTable('bookshops');
    table.uuid('requested_by').references('id').inTable('users');
    table.integer('copies').defaultTo(1);
    table.string('status', 50).defaultTo('pending');
    table.text('notes');
    table.timestamp('completed_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users');
    table.string('action', 100).notNullable();
    table.string('resource_type', 50);
    table.uuid('resource_id');
    table.jsonb('details');
    table.string('ip_address', 45);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.string('type', 50).notNullable().defaultTo('info');
    table.boolean('is_read').defaultTo(false);
    table.string('link', 500);
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('print_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('session_id').references('id').inTable('print_sessions').onDelete('CASCADE');
    table.string('token', 100).unique().notNullable();
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.uuid('bookshop_id').references('id').inTable('bookshops');
    table.uuid('user_id').references('id').inTable('users');
    table.string('purpose', 20).notNullable().defaultTo('view');
    table.timestamp('expires_at', { useTz: true }).notNullable();
    table.timestamp('used_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE print_tokens ADD CONSTRAINT print_tokens_purpose_check CHECK (purpose IN ('view', 'print'))`);

  await knex.schema.createTable('pricing', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.decimal('cost_per_copy', 10, 2).notNullable().defaultTo(0);
    table.timestamp('effective_date', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('invoices', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('bookshop_id').notNullable().references('id').inTable('bookshops').onDelete('CASCADE');
    table.timestamp('period_start', { useTz: true }).notNullable();
    table.timestamp('period_end', { useTz: true }).notNullable();
    table.decimal('total_amount', 10, 2).notNullable().defaultTo(0);
    table.string('status', 20).notNullable().defaultTo('pending');
    table.timestamp('paid_at', { useTz: true });
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`ALTER TABLE invoices ADD CONSTRAINT invoices_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'))`);

  await knex.schema.createTable('invoice_items', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('invoice_id').notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.integer('copies').notNullable();
    table.decimal('cost_per_copy', 10, 2).notNullable();
    table.decimal('subtotal', 10, 2).notNullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_books_status ON books(status)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_book_access_book_id ON book_access(book_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_book_access_bookshop_id ON book_access(bookshop_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_print_sessions_bookshop_id ON print_sessions(bookshop_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_print_sessions_book_id ON print_sessions(book_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_print_jobs_bookshop_id ON print_jobs(bookshop_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_print_tokens_token ON print_tokens(token)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_pricing_book_id ON pricing(book_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoices_bookshop_id ON invoices(bookshop_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`);

  await knex.raw(`CREATE TRIGGER set_updated_at_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
  await knex.raw(`CREATE TRIGGER set_updated_at_bookshops BEFORE UPDATE ON bookshops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
  await knex.raw(`CREATE TRIGGER set_updated_at_books BEFORE UPDATE ON books FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
  await knex.raw(`CREATE TRIGGER set_updated_at_print_jobs BEFORE UPDATE ON print_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`DROP TRIGGER IF EXISTS set_updated_at_users ON users`);
  await knex.raw(`DROP TRIGGER IF EXISTS set_updated_at_bookshops ON bookshops`);
  await knex.raw(`DROP TRIGGER IF EXISTS set_updated_at_books ON books`);
  await knex.raw(`DROP TRIGGER IF EXISTS set_updated_at_print_jobs ON print_jobs`);
  await knex.raw(`DROP FUNCTION IF EXISTS update_updated_at_column`);

  await knex.schema.dropTableIfExists('invoice_items');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('pricing');
  await knex.schema.dropTableIfExists('print_tokens');
  await knex.schema.dropTableIfExists('notifications');
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('print_jobs');
  await knex.schema.dropTableIfExists('print_sessions');
  await knex.schema.dropTableIfExists('book_access');
  await knex.schema.dropTableIfExists('books');
  await knex.schema.dropTableIfExists('bookshops');
  await knex.schema.dropTableIfExists('users');
}
