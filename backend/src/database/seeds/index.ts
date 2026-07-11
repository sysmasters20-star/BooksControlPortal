import bcrypt from 'bcryptjs';
import pool from '../connection.js';
import { logger } from '../../utils/logger.js';

export async function runSeeds() {
  logger.info('Running database seeds...');

  const adminEmail = 'admin@bookprint.com';
  const existingAdmin = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);

  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminEmail, passwordHash, 'System Admin', 'admin', true],
    );
    logger.info('Admin user created');
  }

  logger.info('Seeds completed successfully');
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
