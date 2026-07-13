import bcrypt from 'bcryptjs';
import pool from '../connection.js';
import { logger } from '../../utils/logger.js';

export async function runSeeds() {
  logger.info('Running database seeds...');

  const adminEmail = 'admin@bookprint.com';
  const existingAdmin = await pool.query('SELECT id, role, name FROM users WHERE email = $1', [adminEmail]);

  if (existingAdmin.rows.length === 0) {
    const passwordHash = await bcrypt.hash('Admin@123456', 12);
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5)`,
      [adminEmail, passwordHash, 'System Admin', 'admin', true],
    );
    logger.info('Admin user created');
  } else {
    if (existingAdmin.rows[0].role !== 'admin') {
      await pool.query('UPDATE users SET role = $1, is_verified = true WHERE email = $2', ['admin', adminEmail]);
      logger.info('Admin user role fixed (was bookshop_owner, set to admin)');
    } else {
      logger.info(`Admin user OK (role=admin, name=${existingAdmin.rows[0].name || 'NULL'})`);
    }
  }

  const shopEmail = 'bookshop@demo.com';
  const existingShop = await pool.query('SELECT id FROM users WHERE email = $1', [shopEmail]);

  let shopOwnerId: string | null = null;
  if (existingShop.rows.length === 0) {
    const passwordHash = await bcrypt.hash('Shop@123456', 12);
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, name, role, is_verified)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [shopEmail, passwordHash, 'Demo Bookshop', 'bookshop_owner', true],
    );
    shopOwnerId = userRes.rows[0].id;
    logger.info('Demo bookshop owner created');
  } else {
    shopOwnerId = existingShop.rows[0].id;
  }

  if (shopOwnerId) {
    const existingBookshop = await pool.query('SELECT id FROM bookshops WHERE email = $1', [shopEmail]);
    if (existingBookshop.rows.length === 0) {
      await pool.query(
        `INSERT INTO bookshops (name, owner_id, address, phone, email, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['Demo Bookshop', shopOwnerId, '123 Main St, City', '+20123456789', shopEmail, true],
      );
      logger.info('Demo bookshop created');
    }
  }

  logger.info('Seeds completed successfully');
}

if (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  runSeeds()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
