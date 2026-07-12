import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('print_sessions', (table) => {
    table.uuid('bookshop_id').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('print_sessions', (table) => {
    table.uuid('bookshop_id').notNullable().alter();
  });
}
