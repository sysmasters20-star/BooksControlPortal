import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const r = await pool.query(
  'SELECT id, encryption_iv IS NOT NULL AS has_iv, octet_length(encryption_iv) AS iv_len, octet_length(file_data) AS f_len FROM books WHERE id = $1',
  ['d39d4bf7-0645-4fee-9e71-c99cedba3f21'],
);
console.log(JSON.stringify(r.rows[0]));
await pool.end();
