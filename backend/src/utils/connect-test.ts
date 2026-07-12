import pg from 'pg';

const url = process.env.DATABASE_URL || 'postgresql://postgres:tTRJmAGuBkLaWtvVDiyNJDDYdVKhaDNF@tokaido.proxy.rlwy.net:25733/railway';

async function main() {
  console.log('Connecting to:', url.replace(/\/\/.*@/, '//USER:PASS@'));

  const pool = new pg.Pool({
    connectionString: url,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const r = await pool.query('SELECT 1 AS ok');
    console.log('CONNECTED:', JSON.stringify(r.rows));
    await pool.end();
  } catch (err) {
    console.error('FAILED:', (err as Error).message);
  }
  process.exit(0);
}

main();
