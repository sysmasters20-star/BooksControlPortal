import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

const url = process.env.DATABASE_URL;

async function main() {
  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query('SELECT 1 AS ok');
    process.stdout.write('CONNECTED: ' + JSON.stringify(r.rows) + '\n');
    await pool.end();
  } catch (err) {
    process.stderr.write('FAILED: ' + (err as Error).message + '\n');
  }
  process.exit(0);
}

main();
