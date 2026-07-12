import knex from 'knex';
import config from '../../config/knexfile.js';
import { logger } from '../../utils/logger.js';

export async function runMigrations() {
  logger.info('Running database migrations via Knex...');
  const db = knex(config);
  try {
    await db.migrate.latest();
    logger.info('All migrations completed successfully');
  } catch (err) {
    logger.error('Migration failed', { error: (err as Error).message });
    throw err;
  } finally {
    await db.destroy();
  }
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
