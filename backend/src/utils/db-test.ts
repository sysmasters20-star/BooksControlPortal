import 'dotenv/config';
import pg from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('Testing connection to:', url?.substring(0, 40) + '...');

  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 5000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const result = await pool.query('SELECT 1 AS connected');
    console.log('SUCCESS:', JSON.stringify(result.rows));
    process.exit(0);
  } catch (err) {
    console.error('FAILED:', (err as Error).message);
    process.exit(1);
  }
}

main();
