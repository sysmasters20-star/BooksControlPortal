import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const pool = new pg.Pool({
  connectionString: env.database.url,
  max: env.database.pool.max,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  ssl: env.isProduction
    ? { rejectUnauthorized: false }
    : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export async function query(text: string, params?: unknown[]) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  logger.debug(`Query executed in ${duration}ms`, { rows: result.rowCount });
  return result;
}

export async function getClient() {
  const client = await pool.connect();
  return client;
}

export default pool;
