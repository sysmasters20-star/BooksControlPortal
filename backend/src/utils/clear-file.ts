import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await pool.query("UPDATE books SET file_data = NULL, encryption_iv = NULL, file_hash = NULL, file_size = NULL, pages = NULL WHERE id = $1", [process.argv[2]]);
console.log('Cleared');
await pool.end();
