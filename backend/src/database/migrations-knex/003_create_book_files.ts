import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('book_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('book_id').notNullable().references('id').inTable('books').onDelete('CASCADE');
    table.binary('file_data').notNullable();
    table.string('mime_type', 50).notNullable();
    table.integer('page_number').nullable();
    table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_book_files_book_id ON book_files(book_id)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_book_files_book_page ON book_files(book_id, page_number)`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('book_files');
}
