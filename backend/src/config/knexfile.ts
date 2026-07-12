import type { Knex } from 'knex';
import dotenv from 'dotenv';
dotenv.config();

const config: Knex.Config = {
  client: 'postgresql',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },
  migrations: {
    directory: './src/database/migrations-knex',
    extension: 'ts',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/database/seeds-knex',
    extension: 'ts',
  },
};

export default config;
