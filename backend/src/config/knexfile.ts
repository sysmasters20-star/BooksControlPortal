import type { Knex } from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';

const config: Knex.Config = {
  client: 'postgresql',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  migrations: {
    directory: isProduction
      ? path.resolve(__dirname, '../database/migrations-knex')
      : './src/database/migrations-knex',
    extension: isProduction ? 'js' : 'ts',
    loadExtensions: isProduction ? ['.js'] : ['.ts'],
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: isProduction
      ? path.resolve(__dirname, '../database/seeds-knex')
      : './src/database/seeds-knex',
    extension: isProduction ? 'js' : 'ts',
  },
};

export default config;
