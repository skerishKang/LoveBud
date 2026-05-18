const fs = require('fs');
const path = require('path');

const secretsPath = path.join(__dirname, '..', '.secrets', 'lovebud-runtime.env');
const raw = fs.readFileSync(secretsPath, 'utf-8');
let dbUrl = null;
for (const line of raw.split('\n')) {
  const trimmed = line.trim();
  if (trimmed.startsWith('DATABASE_URL=')) {
    dbUrl = trimmed.replace('DATABASE_URL=', '');
    break;
  }
}

const { Pool } = require('pg');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

(async () => {
  const client = await pool.connect();
  try {
    // Check trees columns fully
    const cols = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='trees' ORDER BY ordinal_position"
    );
    console.log('=== trees columns ===');
    cols.rows.forEach(r => console.log(r.column_name, r.data_type));

    // Check if memories/table with moments exists
    const tables = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('\n=== All tables ===');
    tables.rows.forEach(r => console.log('-', r.table_name));

    // Check users table for UID mapping
    const usersCols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
    );
    console.log('\n=== users columns ===');
    usersCols.rows.forEach(r => console.log('-', r.column_name));

    // Get total tree count
    const count = await client.query('SELECT COUNT(*) as c FROM trees');
    console.log('\nTotal trees:', count.rows[0].c);

    // Sample tree data (first 3)
    const sample = await client.query('SELECT id, owner_id, name, is_public FROM trees WHERE owner_id IS NOT NULL LIMIT 3');
    console.log('\nSample trees:', sample.rows.length);
    sample.rows.forEach(r => {
      const maskedId = r.id.substring(0, 8) + '...';
      console.log(`  id=${maskedId} public=${r.is_public} name="${r.name}"`);
    });

  } catch (err) {
    console.log('ERROR:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
})().catch(e => console.log('FAILED:', e.message));
